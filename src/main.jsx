import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import AppErrorBoundary from "./components/AppErrorBoundary.jsx";
import "./styles.css";

function recoverFromStaleBuild(errorLike) {
  const message = String(errorLike?.message || errorLike?.reason?.message || errorLike?.reason || errorLike || "");
  const isStaleChunk =
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("ChunkLoadError") ||
    message.includes("error loading dynamically imported module");

  if (!isStaleChunk) return;
  const key = "buildcore-stale-build-reload";
  if (sessionStorage.getItem(key) === "1") return;
  sessionStorage.setItem(key, "1");
  window.location.reload();
}

window.addEventListener("error", (event) => recoverFromStaleBuild(event.error || event.message));
window.addEventListener("unhandledrejection", (event) => recoverFromStaleBuild(event));
window.setTimeout(() => sessionStorage.removeItem("buildcore-stale-build-reload"), 10000);

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
