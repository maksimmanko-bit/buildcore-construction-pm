const APP_URL = process.env.BUILDCRE_TEST_URL || "http://127.0.0.1:5174/";
const CDP_URL = process.env.BUILDCRE_CDP_URL || "http://127.0.0.1:9223";
const EMAIL = process.env.BUILDCRE_TEST_EMAIL;
const PASSWORD = process.env.BUILDCRE_TEST_PASSWORD;

if (!EMAIL || !PASSWORD) {
  throw new Error("BUILDCRE_TEST_EMAIL and BUILDCRE_TEST_PASSWORD are required.");
}

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.console = [];
    this.exceptions = [];
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(`${message.error.message}: ${message.error.data || ""}`));
        else resolve(message.result);
        return;
      }
      if (message.method === "Runtime.consoleAPICalled") {
        this.console.push(message.params.args?.map((arg) => arg.value || arg.description || "").join(" "));
      }
      if (message.method === "Runtime.exceptionThrown") {
        const details = message.params.exceptionDetails;
        this.exceptions.push({
          text: details?.text || "Runtime exception",
          description: details?.exception?.description || "",
          value: details?.exception?.value || "",
          url: details?.url || "",
          lineNumber: details?.lineNumber,
          columnNumber: details?.columnNumber,
        });
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(cdp, sessionId, expression, label, timeout = 30000) {
  const started = Date.now();
  let last = "";
  while (Date.now() - started < timeout) {
    const result = await cdp.send(
      "Runtime.evaluate",
      {
        expression: `(async () => { try { return Boolean(${expression}); } catch (error) { return "ERR:" + error.message; } })()`,
        awaitPromise: true,
        returnByValue: true,
      },
      sessionId,
    );
    last = String(result.result?.value);
    if (result.result?.value === true) return;
    await delay(300);
  }
  throw new Error(`Timed out waiting for ${label}. Last result: ${last}`);
}

async function evaluate(cdp, sessionId, body) {
  const result = await cdp.send(
    "Runtime.evaluate",
    {
      expression: `(async () => { ${body} })()`,
      awaitPromise: true,
      returnByValue: true,
    },
    sessionId,
  );
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Evaluation failed");
  }
  return result.result?.value;
}

async function clickVisibleButton(cdp, sessionId, text) {
  const rect = await evaluate(
    cdp,
    sessionId,
    `
      const button = [...document.querySelectorAll("button")].find((item) => {
        const rect = item.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && item.textContent.includes(${JSON.stringify(text)});
      });
      if (!button) return null;
      const rect = button.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, disabled: button.disabled, label: button.textContent.trim() };
    `,
  );
  if (!rect) throw new Error(`Button not found: ${text}`);
  if (rect.disabled) throw new Error(`Button disabled: ${text}`);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: rect.x, y: rect.y }, sessionId);
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: rect.x, y: rect.y, button: "left", clickCount: 1 }, sessionId);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rect.x, y: rect.y, button: "left", clickCount: 1 }, sessionId);
  await evaluate(
    cdp,
    sessionId,
    `
      const button = [...document.querySelectorAll("button")].find((item) => {
        const rect = item.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && item.textContent.includes(${JSON.stringify(text)});
      });
      button?.focus();
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      return true;
    `,
  );
  await delay(250);
  return rect.label;
}

async function dumpState(cdp, sessionId, reason) {
  return evaluate(
    cdp,
    sessionId,
    `
      return {
        reason: ${JSON.stringify(reason)},
        text: document.body.innerText.slice(0, 3000),
        modal: Boolean(document.querySelector(".modalBackdrop")),
        buttons: [...document.querySelectorAll("button")]
          .map((button, index) => ({
            index,
            text: button.textContent.trim(),
            disabled: button.disabled,
            className: String(button.className || ""),
            hidden: button.offsetParent === null,
          }))
          .filter((button) => /Overview|Arrived|Complete Work|Save|Before Work Photos|Digital Safety Form/.test(button.text)),
        notice: document.querySelector(".notice")?.textContent?.trim() || "",
      };
    `,
  );
}

const version = await fetch(`${CDP_URL}/json/version`).then((response) => response.json());
const socket = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

const cdp = new Cdp(socket);
const target = await cdp.send("Target.createTarget", { url: "about:blank" });
const attached = await cdp.send("Target.attachToTarget", { targetId: target.targetId, flatten: true });
const sessionId = attached.sessionId;
await cdp.send("Runtime.enable", {}, sessionId);
await cdp.send("Page.enable", {}, sessionId);
await cdp.send("Page.navigate", { url: APP_URL }, sessionId);
await waitFor(cdp, sessionId, "document.readyState === 'complete'", "page load");
await waitFor(cdp, sessionId, "document.body && document.body.innerText.length > 0", "rendered app");

const initialState = await evaluate(cdp, sessionId, `
  return {
    title: document.title,
    text: document.body.innerText.slice(0, 500),
    buttons: [...document.querySelectorAll("button")].map((button) => button.textContent.trim()).filter(Boolean).slice(0, 30),
  };
`);

await waitFor(
  cdp,
  sessionId,
  "document.body.innerText.includes('Sign in') || document.body.innerText.includes('Overview')",
  "auth check",
  45000,
);

const authState = await evaluate(cdp, sessionId, `return document.body.innerText.slice(0, 500);`);

if (authState.includes("Sign in")) {
  await evaluate(cdp, sessionId, `
    const setNativeValue = (input, value) => {
      const setter = Object.getOwnPropertyDescriptor(input.constructor.prototype, "value")?.set;
      setter ? setter.call(input, value) : (input.value = value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    setNativeValue(document.querySelector('input[type="email"]'), ${JSON.stringify(EMAIL)});
    setNativeValue(document.querySelector('input[type="password"]'), ${JSON.stringify(PASSWORD)});
    [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "Sign in").click();
    return true;
  `);
  await waitFor(cdp, sessionId, "document.body.innerText.includes('Overview') && !document.body.innerText.includes('Checking access')", "signed in", 45000);
}

try {
  await clickVisibleButton(cdp, sessionId, "Overview");
} catch (error) {
  console.log(JSON.stringify({ status: "overview-button-missing", error: error.message, state: await dumpState(cdp, sessionId, "before-overview-click"), console: cdp.console, exceptions: cdp.exceptions }, null, 2));
  socket.close();
  process.exit(1);
}
try {
  await waitFor(cdp, sessionId, "Boolean(document.querySelector('.todayTickets'))", "overview tab");
} catch (error) {
  console.log(JSON.stringify({ status: "overview-timeout", error: error.message, state: await dumpState(cdp, sessionId, "after-overview-click"), console: cdp.console, exceptions: cdp.exceptions }, null, 2));
  socket.close();
  process.exit(1);
}

const overviewState = await evaluate(cdp, sessionId, `
  return {
    text: document.body.innerText.slice(0, 1200),
    arrivedButtons: [...document.querySelectorAll("button")].filter((button) => button.textContent.includes("Arrived")).length,
    activeButtons: [...document.querySelectorAll("button")].filter((button) => button.textContent.includes("Complete Work")).length,
  };
`);

if (overviewState.arrivedButtons === 0) {
  console.log(JSON.stringify({ status: "no-arrived-ticket", overviewState, console: cdp.console, exceptions: cdp.exceptions }, null, 2));
  socket.close();
  process.exit(0);
}

await clickVisibleButton(cdp, sessionId, "Arrived");

try {
  await waitFor(
    cdp,
    sessionId,
    "document.body.innerText.includes('Digital Safety Form') || document.body.innerText.includes('Before Work Photos')",
    "arrival workflow modal",
  );
} catch (error) {
  console.log(JSON.stringify({ status: "arrival-modal-timeout", error: error.message, state: await dumpState(cdp, sessionId, "after-arrived-click"), console: cdp.console, exceptions: cdp.exceptions }, null, 2));
  socket.close();
  process.exit(1);
}

let modalState = await evaluate(cdp, sessionId, `
  return {
    hasSafety: document.body.innerText.includes("Digital Safety Form"),
    hasBeforePhotos: document.body.innerText.includes("Before Work Photos"),
    text: document.body.innerText.slice(0, 1400),
  };
`);

if (modalState.hasSafety) {
  await evaluate(cdp, sessionId, `
    const hazard = document.querySelector('.pickerList input[type="checkbox"]');
    if (hazard && !hazard.checked) hazard.click();
    return true;
  `);
  const canvasCount = await evaluate(cdp, sessionId, `return document.querySelectorAll(".signaturePad canvas").length;`);
  for (let index = 0; index < canvasCount; index += 1) {
    await evaluate(cdp, sessionId, `
      const canvas = document.querySelectorAll(".signaturePad canvas")[${index}];
      const rect = canvas.getBoundingClientRect();
      const events = [
        ["mousedown", 0.18, 0.55],
        ["mousemove", 0.32, 0.35],
        ["mousemove", 0.48, 0.62],
        ["mousemove", 0.66, 0.42],
        ["mouseup", 0.78, 0.58],
      ];
      for (const [type, xRatio, yRatio] of events) {
        canvas.dispatchEvent(new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + rect.width * xRatio,
          clientY: rect.top + rect.height * yRatio,
        }));
      }
      return true;
    `);
  }
  await waitFor(
    cdp,
    sessionId,
    `[...document.querySelectorAll("button")].some((button) => button.textContent.includes("Save Safety PDF") && !button.disabled)`,
    "enabled safety save",
  );
  await clickVisibleButton(cdp, sessionId, "Save Safety PDF");
  await waitFor(cdp, sessionId, "document.body.innerText.includes('Before Work Photos')", "before photos after safety save", 60000);
}

modalState = await evaluate(cdp, sessionId, `
  return {
    hasBeforePhotos: document.body.innerText.includes("Before Work Photos"),
    hasWhiteScreen: document.body.innerText.trim().length < 20,
    text: document.body.innerText.slice(0, 1400),
  };
`);

const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }, sessionId);
console.log(JSON.stringify({
  status: modalState.hasBeforePhotos && !modalState.hasWhiteScreen ? "ok" : "failed",
  modalState,
  console: cdp.console,
  exceptions: cdp.exceptions,
  screenshotBytes: screenshot.data.length,
}, null, 2));

socket.close();
