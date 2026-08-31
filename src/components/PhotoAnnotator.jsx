import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Check, Circle, Copy, Minus, Pencil, Plus, Redo2, Square, Trash2, Type, Undo2 } from "lucide-react";
import { Canvas, Circle as FabricCircle, FabricImage, Group, IText, Line, PencilBrush, Rect, Triangle, util } from "fabric";

const tools = [
  { id: "draw", label: "Pen", icon: Pencil },
  { id: "arrow", label: "Arrow", icon: ArrowUpRight },
  { id: "circle", label: "Circle", icon: Circle },
  { id: "rect", label: "Rectangle", icon: Square },
  { id: "text", label: "Text", icon: Type },
];

const swatches = [
  { id: "red", label: "Red", value: "#cf2e2e", fill: "rgba(207,46,46,0.13)" },
  { id: "yellow", label: "Yellow", value: "#f59e0b", fill: "rgba(245,158,11,0.16)" },
  { id: "blue", label: "Blue", value: "#2563eb", fill: "rgba(37,99,235,0.13)" },
  { id: "green", label: "Green", value: "#16a34a", fill: "rgba(22,163,74,0.13)" },
  { id: "white", label: "White", value: "#ffffff", fill: "rgba(255,255,255,0.18)" },
  { id: "black", label: "Black", value: "#111827", fill: "rgba(17,24,39,0.13)" },
];

function getCanvasPoint(canvas, event) {
  const rect = canvas.upperCanvasEl.getBoundingClientRect();
  const pointer = event.touches?.[0] || event.changedTouches?.[0] || event;
  return {
    x: ((pointer.clientX - rect.left) / rect.width) * canvas.width,
    y: ((pointer.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function imageToDataUrl(url) {
  return fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error("Photo could not be loaded for annotation.");
      return response.blob();
    })
    .then(
      (blob) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        }),
    );
}

function loadHtmlImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Photo could not be decoded for annotation."));
    image.src = source;
  });
}

function makeAnnotationId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

function annotationControlDefaults(object) {
  object.set({
    borderColor: "#2563eb",
    cornerColor: "#ffffff",
    cornerStrokeColor: "#2563eb",
    cornerSize: 14,
    cornerStyle: "circle",
    padding: 4,
    transparentCorners: false,
    data: { ...(object.data || {}), annotation: true },
  });
  object.setControlsVisibility?.({ mt: true, mb: true, ml: true, mr: true, bl: true, br: true, tl: true, tr: true, mtr: true });
  return object;
}

function createArrow({ color, point, strokeWidth }) {
  const line = new Line([0, 0, 186, 0], {
    stroke: color,
    strokeWidth,
    strokeLineCap: "round",
    strokeLineJoin: "round",
    selectable: false,
    evented: false,
    shadow: "rgba(15, 23, 42, 0.22) 0px 3px 7px",
  });
  const head = new Triangle({
    left: 186,
    top: 0,
    width: Math.max(24, strokeWidth * 5),
    height: Math.max(28, strokeWidth * 5.6),
    angle: 90,
    fill: color,
    originX: "center",
    originY: "center",
    selectable: false,
    evented: false,
    shadow: "rgba(15, 23, 42, 0.18) 0px 3px 7px",
  });
  return annotationControlDefaults(
    new Group([line, head], {
      left: point.x,
      top: point.y,
      angle: -16,
      data: { annotation: true, annotationType: "arrow" },
    }),
  );
}

function createShape({ color, fill, point, strokeWidth, tool }) {
  if (tool === "rect") {
    return annotationControlDefaults(
      new Rect({
        left: point.x,
        top: point.y,
        width: 210,
        height: 118,
        fill,
        stroke: color,
        strokeWidth,
        rx: 14,
        ry: 14,
        shadow: "rgba(15, 23, 42, 0.12) 0px 5px 14px",
        data: { annotation: true, annotationType: "rect" },
      }),
    );
  }

  if (tool === "circle") {
    return annotationControlDefaults(
      new FabricCircle({
        left: point.x,
        top: point.y,
        radius: 64,
        fill,
        stroke: color,
        strokeWidth,
        shadow: "rgba(15, 23, 42, 0.12) 0px 5px 14px",
        data: { annotation: true, annotationType: "circle" },
      }),
    );
  }

  if (tool === "arrow") return createArrow({ color, point, strokeWidth });
  return null;
}

function createTextBubble({ color, point, text }) {
  const cleanText = text.trim();
  if (!cleanText) return null;
  return annotationControlDefaults(
    new IText(cleanText, {
      left: point.x,
      top: point.y,
      fill: color === "#ffffff" ? "#111827" : color,
      fontSize: 34,
      fontFamily: "Inter, system-ui, sans-serif",
      fontWeight: 850,
      backgroundColor: "rgba(255,255,255,0.92)",
      borderColor: "#2563eb",
      padding: 12,
      shadow: "rgba(15, 23, 42, 0.16) 0px 5px 16px",
      data: { annotation: true, annotationType: "text" },
    }),
  );
}

function makeJsonSnapshot(canvas) {
  return JSON.stringify(canvas.getObjects().filter((object) => object.data?.annotation).map((object) => object.toObject(["data"])));
}

function getAnnotationObjectJson(canvas) {
  return canvas.getObjects().filter((object) => object.data?.annotation).map((object) => object.toObject(["data"]));
}

export default function PhotoAnnotator({ imageUrl, onSave }) {
  const canvasElement = useRef(null);
  const fabricRef = useRef(null);
  const rafRef = useRef(0);
  const toolRef = useRef("draw");
  const colorRef = useRef(swatches[0].value);
  const fillRef = useRef(swatches[0].fill);
  const strokeWidthRef = useRef(5);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const isRestoringRef = useRef(false);
  const panGestureRef = useRef(null);
  const longPressRef = useRef(0);
  const [activeObjectId, setActiveObjectId] = useState("");
  const [baseImageSrc, setBaseImageSrc] = useState("");
  const [canRedo, setCanRedo] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [color, setColor] = useState(swatches[0].value);
  const [fill, setFill] = useState(swatches[0].fill);
  const [isSaving, setIsSaving] = useState(false);
  const [propertyPanel, setPropertyPanel] = useState(null);
  const [saveFlash, setSaveFlash] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [textComposer, setTextComposer] = useState(null);
  const [tool, setTool] = useState("draw");

  const activeSwatch = useMemo(() => swatches.find((item) => item.value === color) || swatches[0], [color]);

  function requestCanvasRender(canvas = fabricRef.current) {
    if (!canvas || rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      canvas.requestRenderAll();
    });
  }

  function refreshHistoryState() {
    setCanUndo(undoStackRef.current.length > 1);
    setCanRedo(redoStackRef.current.length > 0);
  }

  function pushHistory(canvas = fabricRef.current) {
    if (!canvas || isRestoringRef.current) return;
    const snapshot = makeJsonSnapshot(canvas);
    if (undoStackRef.current.at(-1) === snapshot) return;
    undoStackRef.current.push(snapshot);
    if (undoStackRef.current.length > 80) undoStackRef.current.shift();
    redoStackRef.current = [];
    refreshHistoryState();
  }

  async function setCanvasBackground(source, canvas = fabricRef.current) {
    if (!canvas || !source) return;
    const image = await FabricImage.fromURL(source);
    const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
    image.set({
      left: (canvas.width - image.width * scale) / 2,
      top: (canvas.height - image.height * scale) / 2,
      scaleX: scale,
      scaleY: scale,
      selectable: false,
      evented: false,
    });
    canvas.backgroundImage = image;
    requestCanvasRender(canvas);
  }

  function getActiveObject(canvas = fabricRef.current) {
    return canvas?.getActiveObject?.() || null;
  }

  function updatePropertyPanel(canvas = fabricRef.current) {
    const object = getActiveObject(canvas);
    if (!object || !object.data?.annotation) {
      setActiveObjectId("");
      setPropertyPanel(null);
      return;
    }

    const bounds = object.getBoundingRect();
    setActiveObjectId(object.__annotationId || "");
    setPropertyPanel({
      left: Math.min(88, Math.max(12, (bounds.left / canvas.width) * 100)),
      top: Math.min(80, Math.max(10, (bounds.top / canvas.height) * 100)),
      type: object.data.annotationType || "annotation",
    });
  }

  function selectTool(nextTool) {
    toolRef.current = nextTool;
    setTool(nextTool);
    setTextComposer(null);
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.isDrawingMode = nextTool === "draw";
    canvas.skipTargetFind = nextTool === "draw";
    canvas.selection = nextTool !== "draw";
    canvas.defaultCursor = nextTool === "draw" ? "crosshair" : "copy";
    canvas.hoverCursor = nextTool === "draw" ? "crosshair" : "move";
    if (!canvas.freeDrawingBrush) canvas.freeDrawingBrush = new PencilBrush(canvas);
    canvas.freeDrawingBrush.color = colorRef.current;
    canvas.freeDrawingBrush.width = strokeWidthRef.current;
    requestCanvasRender(canvas);
  }

  function addObject(object) {
    const canvas = fabricRef.current;
    if (!canvas || !object) return;
    object.__annotationId = makeAnnotationId();
    canvas.add(object);
    canvas.setActiveObject(object);
    pushHistory(canvas);
    updatePropertyPanel(canvas);
    requestCanvasRender(canvas);
  }

  function placeAnnotation(event) {
    const canvas = fabricRef.current;
    const activeTool = toolRef.current;
    if (!canvas || !["rect", "circle", "arrow", "text"].includes(activeTool)) return;
    if (event.target !== canvas.upperCanvasEl && event.currentTarget !== canvas.upperCanvasEl) return;
    if (canvas.findTarget(event, false)) return;

    event.preventDefault?.();
    const point = getCanvasPoint(canvas, event);
    if (activeTool === "text") {
      const rect = canvas.upperCanvasEl.getBoundingClientRect();
      setTextComposer({
        canvasPoint: point,
        left: ((event.clientX - rect.left) / rect.width) * 100,
        top: ((event.clientY - rect.top) / rect.height) * 100,
        value: "",
      });
      return;
    }

    addObject(createShape({ color: colorRef.current, fill: fillRef.current, point, strokeWidth: strokeWidthRef.current, tool: activeTool }));
  }

  function commitTextBubble() {
    if (!textComposer?.value?.trim()) {
      setTextComposer(null);
      return;
    }
    addObject(createTextBubble({ color: colorRef.current, point: textComposer.canvasPoint, text: textComposer.value }));
    setTextComposer(null);
  }

  function deleteActiveObject() {
    const canvas = fabricRef.current;
    const object = getActiveObject(canvas);
    if (!canvas || !object) return;
    canvas.remove(object);
    canvas.discardActiveObject();
    pushHistory(canvas);
    updatePropertyPanel(canvas);
    requestCanvasRender(canvas);
  }

  function duplicateActiveObject() {
    const canvas = fabricRef.current;
    const object = getActiveObject(canvas);
    if (!canvas || !object) return;
    object.clone().then((clone) => {
      clone.set({ left: (object.left || 0) + 24, top: (object.top || 0) + 24 });
      annotationControlDefaults(clone);
      addObject(clone);
    });
  }

  function updateActiveColor(nextSwatch) {
    setColor(nextSwatch.value);
    setFill(nextSwatch.fill);
    colorRef.current = nextSwatch.value;
    fillRef.current = nextSwatch.fill;
    const canvas = fabricRef.current;
    const object = getActiveObject(canvas);
    if (!canvas || !object) return;
    if (object.type === "group") {
      object.getObjects().forEach((child) => {
        if ("stroke" in child) child.set("stroke", nextSwatch.value);
        if ("fill" in child) child.set("fill", nextSwatch.value);
      });
    } else if (object.data?.annotationType === "text") {
      object.set("fill", nextSwatch.value === "#ffffff" ? "#111827" : nextSwatch.value);
    } else {
      object.set({ stroke: nextSwatch.value, fill: nextSwatch.fill });
    }
    pushHistory(canvas);
    requestCanvasRender(canvas);
  }

  function updateActiveSize(delta) {
    const nextWidth = Math.min(12, Math.max(3, strokeWidthRef.current + delta));
    strokeWidthRef.current = nextWidth;
    setStrokeWidth(nextWidth);
    const canvas = fabricRef.current;
    const object = getActiveObject(canvas);
    if (!canvas || !object) return;
    if (object.data?.annotationType === "text") {
      object.set("fontSize", Math.min(72, Math.max(18, (object.fontSize || 34) + delta * 4)));
    } else if (object.type === "group") {
      object.getObjects().forEach((child) => {
        if ("strokeWidth" in child) child.set("strokeWidth", nextWidth);
      });
    } else {
      object.set("strokeWidth", nextWidth);
    }
    if (canvas.freeDrawingBrush) canvas.freeDrawingBrush.width = nextWidth;
    pushHistory(canvas);
    requestCanvasRender(canvas);
  }

  async function restoreSnapshot(snapshot) {
    const canvas = fabricRef.current;
    if (!canvas || !snapshot) return;
    isRestoringRef.current = true;
    canvas.getObjects().filter((object) => object.data?.annotation).forEach((object) => canvas.remove(object));
    const objects = await util.enlivenObjects(JSON.parse(snapshot));
    objects.forEach((object) => {
      annotationControlDefaults(object);
      object.__annotationId = object.__annotationId || makeAnnotationId();
      canvas.add(object);
    });
    canvas.discardActiveObject();
    isRestoringRef.current = false;
    updatePropertyPanel(canvas);
    requestCanvasRender(canvas);
    refreshHistoryState();
  }

  async function undo() {
    if (undoStackRef.current.length <= 1) return;
    const current = undoStackRef.current.pop();
    redoStackRef.current.push(current);
    await restoreSnapshot(undoStackRef.current.at(-1));
  }

  async function redo() {
    const snapshot = redoStackRef.current.pop();
    if (!snapshot) return;
    undoStackRef.current.push(snapshot);
    await restoreSnapshot(snapshot);
  }

  function handleTouchGesture(event) {
    const canvas = fabricRef.current;
    if (!canvas || event.touches.length < 2) return;
    event.preventDefault();
    const [first, second] = [...event.touches];
    const midpoint = {
      x: (first.clientX + second.clientX) / 2,
      y: (first.clientY + second.clientY) / 2,
    };
    const distance = Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
    const gesture = panGestureRef.current;
    if (!gesture) {
      panGestureRef.current = { distance, midpoint, zoom: canvas.getZoom(), transform: [...canvas.viewportTransform] };
      return;
    }
    const nextZoom = Math.min(3, Math.max(0.75, gesture.zoom * (distance / gesture.distance)));
    const rect = canvas.upperCanvasEl.getBoundingClientRect();
    canvas.zoomToPoint(
      {
        x: ((midpoint.x - rect.left) / rect.width) * canvas.width,
        y: ((midpoint.y - rect.top) / rect.height) * canvas.height,
      },
      nextZoom,
    );
    const transform = canvas.viewportTransform;
    transform[4] = gesture.transform[4] + midpoint.x - gesture.midpoint.x;
    transform[5] = gesture.transform[5] + midpoint.y - gesture.midpoint.y;
    requestCanvasRender(canvas);
  }

  async function save() {
    const canvas = fabricRef.current;
    if (!canvas || isSaving) return;

    setIsSaving(true);
    setSaveFlash(true);
    const originalViewport = [...canvas.viewportTransform];
    try {
      canvas.discardActiveObject();
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      canvas.renderAll();
      const output = document.createElement("canvas");
      output.width = canvas.width;
      output.height = canvas.height;
      const context = output.getContext("2d");

      if (baseImageSrc) {
        const image = await loadHtmlImage(baseImageSrc);
        const scale = Math.min(output.width / image.naturalWidth, output.height / image.naturalHeight);
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        context.drawImage(image, (output.width - width) / 2, (output.height - height) / 2, width, height);
      } else {
        context.fillStyle = "#090e18";
        context.fillRect(0, 0, output.width, output.height);
      }

      const annotationCanvas = canvas.toCanvasElement(1);
      context.clearRect(0, 0, output.width, output.height);
      context.drawImage(annotationCanvas, 0, 0);
      const dataUrl = output.toDataURL("image/jpeg", 0.9);
      await onSave?.({ dataUrl, annotationJson: { objects: getAnnotationObjectJson(canvas), version: "ios-markup-v1" } });
      setTimeout(() => setSaveFlash(false), 700);
    } finally {
      canvas.setViewportTransform(originalViewport);
      canvas.renderAll();
      setIsSaving(false);
    }
  }

  useEffect(() => {
    if (!canvasElement.current) return undefined;

    const canvas = new Canvas(canvasElement.current, {
      width: 1040,
      height: 700,
      backgroundColor: "rgba(0,0,0,0)",
      enableRetinaScaling: true,
      preserveObjectStacking: true,
      renderOnAddRemove: false,
      selectionColor: "rgba(37, 99, 235, 0.08)",
      selectionBorderColor: "#2563eb",
      stopContextMenu: true,
    });

    canvas.freeDrawingBrush = new PencilBrush(canvas);
    canvas.freeDrawingBrush.color = colorRef.current;
    canvas.freeDrawingBrush.width = strokeWidthRef.current;
    fabricRef.current = canvas;
    selectTool("draw");

    const handlePointerDown = (event) => {
      if (["rect", "circle", "arrow", "text"].includes(toolRef.current)) placeAnnotation(event);
      const target = canvas.findTarget(event, false);
      if (target?.data?.annotation) {
        clearTimeout(longPressRef.current);
        longPressRef.current = setTimeout(() => updatePropertyPanel(canvas), 420);
      }
    };

    const handlePointerUp = () => {
      clearTimeout(longPressRef.current);
      panGestureRef.current = null;
    };

    const handleWheel = (event) => {
      event.preventDefault();
      const zoom = canvas.getZoom();
      const nextZoom = Math.min(3, Math.max(0.75, zoom * (0.999 ** event.deltaY)));
      canvas.zoomToPoint(getCanvasPoint(canvas, event), nextZoom);
      requestCanvasRender(canvas);
    };

    canvas.upperCanvasEl?.addEventListener("pointerdown", handlePointerDown, true);
    canvas.upperCanvasEl?.addEventListener("pointerup", handlePointerUp, true);
    canvas.upperCanvasEl?.addEventListener("touchend", handlePointerUp, { passive: false });
    canvas.upperCanvasEl?.addEventListener("touchcancel", handlePointerUp, { passive: false });
    canvas.upperCanvasEl?.addEventListener("touchmove", handleTouchGesture, { passive: false });
    canvas.upperCanvasEl?.addEventListener("wheel", handleWheel, { passive: false });
    canvas.on("path:created", (event) => {
      annotationControlDefaults(event.path);
      event.path.__annotationId = makeAnnotationId();
      pushHistory(canvas);
      requestCanvasRender(canvas);
    });
    canvas.on("selection:created", () => updatePropertyPanel(canvas));
    canvas.on("selection:updated", () => updatePropertyPanel(canvas));
    canvas.on("selection:cleared", () => updatePropertyPanel(canvas));
    canvas.on("object:moving", () => updatePropertyPanel(canvas));
    canvas.on("object:scaling", () => updatePropertyPanel(canvas));
    canvas.on("object:rotating", () => updatePropertyPanel(canvas));
    canvas.on("object:modified", () => pushHistory(canvas));
    canvas.on("mouse:dblclick", (event) => {
      if (event.target?.data?.annotationType === "text") event.target.enterEditing?.();
    });

    pushHistory(canvas);

    let cancelled = false;
    imageToDataUrl(imageUrl)
      .then((source) => {
        if (cancelled) return;
        setBaseImageSrc(source);
        setCanvasBackground(source, canvas);
      })
      .catch((error) => console.error(error));

    return () => {
      cancelled = true;
      clearTimeout(longPressRef.current);
      cancelAnimationFrame(rafRef.current);
      canvas.upperCanvasEl?.removeEventListener("pointerdown", handlePointerDown, true);
      canvas.upperCanvasEl?.removeEventListener("pointerup", handlePointerUp, true);
      canvas.upperCanvasEl?.removeEventListener("touchend", handlePointerUp);
      canvas.upperCanvasEl?.removeEventListener("touchcancel", handlePointerUp);
      canvas.upperCanvasEl?.removeEventListener("touchmove", handleTouchGesture);
      canvas.upperCanvasEl?.removeEventListener("wheel", handleWheel);
      canvas.dispose();
    };
  }, [imageUrl]);

  useEffect(() => {
    colorRef.current = color;
    fillRef.current = activeSwatch.fill;
    strokeWidthRef.current = strokeWidth;
    const canvas = fabricRef.current;
    if (canvas?.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = color;
      canvas.freeDrawingBrush.width = strokeWidth;
    }
  }, [activeSwatch.fill, color, strokeWidth]);

  return (
    <section className={`annotator ${saveFlash ? "saved" : ""}`}>
      <div className="canvasShell">
        {!baseImageSrc && <img className="annotationBaseImage" src={imageUrl} alt="" />}
        <canvas ref={canvasElement} />
        {textComposer && (
          <form
            className="annotationTextBubbleComposer"
            style={{ left: `${textComposer.left}%`, top: `${textComposer.top}%` }}
            onSubmit={(event) => {
              event.preventDefault();
              commitTextBubble();
            }}
          >
            <input
              autoFocus
              placeholder="Add text"
              value={textComposer.value}
              onChange={(event) => setTextComposer({ ...textComposer, value: event.target.value })}
              onBlur={commitTextBubble}
            />
          </form>
        )}
        {propertyPanel && (
          <div className="annotationPropertyPopover" style={{ left: `${propertyPanel.left}%`, top: `${propertyPanel.top}%` }}>
            <div className="miniSwatches">
              {swatches.map((item) => (
                <button
                  className={item.value === color ? "active" : ""}
                  key={item.id}
                  style={{ "--swatch": item.value }}
                  title={item.label}
                  type="button"
                  onClick={() => updateActiveColor(item)}
                />
              ))}
            </div>
            <button type="button" title="Smaller" onClick={() => updateActiveSize(-1)}>
              <Minus size={15} />
            </button>
            <button type="button" title="Bigger" onClick={() => updateActiveSize(1)}>
              <Plus size={15} />
            </button>
            <button type="button" title="Duplicate" onClick={duplicateActiveObject}>
              <Copy size={15} />
            </button>
            <button className="dangerIcon" type="button" title="Delete" onClick={deleteActiveObject}>
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>

      <div className="annotatorFloatingToolbar" aria-label="Photo annotation tools">
        <div className="annotatorToolGroup">
          {tools.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={tool === item.id ? "iconButton active" : "iconButton"}
                key={item.id}
                type="button"
                title={item.label}
                aria-label={item.label}
                onClick={() => selectTool(item.id)}
              >
                <Icon size={18} />
              </button>
            );
          })}
        </div>
        <div className="annotatorSwatches" aria-label="Annotation colors">
          {swatches.map((item) => (
            <button
              className={item.value === color ? "active" : ""}
              key={item.id}
              style={{ "--swatch": item.value }}
              title={item.label}
              type="button"
              onClick={() => updateActiveColor(item)}
            />
          ))}
        </div>
        <div className="annotatorHistoryActions">
          <button className="iconButton" type="button" title="Undo" aria-label="Undo" disabled={!canUndo} onClick={undo}>
            <Undo2 size={18} />
          </button>
          <button className="iconButton" type="button" title="Redo" aria-label="Redo" disabled={!canRedo} onClick={redo}>
            <Redo2 size={18} />
          </button>
          <button className="saveButton" type="button" disabled={isSaving} onClick={save}>
            <Check size={18} />
            {isSaving ? "Saving" : "Save"}
          </button>
        </div>
      </div>
      {activeObjectId && <span className="srOnly">Selected annotation ready for color, size, duplicate or delete.</span>}
    </section>
  );
}
