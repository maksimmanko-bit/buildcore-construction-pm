import { useEffect, useRef, useState } from "react";
import { Circle, Download, MousePointer2, Pencil, Square, Type, Undo2 } from "lucide-react";
import { Canvas, Circle as FabricCircle, IText, PencilBrush, Rect } from "fabric";

const tools = [
  { id: "select", label: "Move", icon: MousePointer2 },
  { id: "draw", label: "Pencil", icon: Pencil },
  { id: "rect", label: "Rectangle", icon: Square },
  { id: "circle", label: "Circle", icon: Circle },
  { id: "text", label: "Text", icon: Type },
];

function getCanvasPoint(canvas, event) {
  const rect = canvas.upperCanvasEl.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

async function imageToDataUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Photo could not be loaded for annotation.");
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function loadHtmlImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Photo could not be decoded for annotation."));
    image.src = source;
  });
}

export default function PhotoAnnotator({ imageUrl, onSave }) {
  const canvasElement = useRef(null);
  const fabricRef = useRef(null);
  const layerRef = useRef(null);
  const toolRef = useRef("select");
  const colorRef = useRef("#cf2e2e");
  const textDraftRef = useRef("Note");
  const [tool, setTool] = useState("select");
  const [color, setColor] = useState("#cf2e2e");
  const [textDraft, setTextDraft] = useState("Note");
  const [baseImageSrc, setBaseImageSrc] = useState("");

  function selectTool(nextTool) {
    toolRef.current = nextTool;
    setTool(nextTool);
  }

  function insertObjectAtPointer(event) {
    const canvas = fabricRef.current;
    if (!canvas || !["rect", "circle", "text"].includes(toolRef.current)) return;

    event.preventDefault?.();
    event.stopPropagation?.();
    const sourceEvent = event.nativeEvent ?? event;
    const point = getCanvasPoint(canvas, sourceEvent);
    const activeColor = colorRef.current;
    const activeTool = toolRef.current;
    let object = null;

    if (activeTool === "rect") {
      object = new Rect({
        left: point.x,
        top: point.y,
        width: 190,
        height: 110,
        fill: "rgba(207,46,46,0.12)",
        stroke: activeColor,
        strokeWidth: 4,
        cornerStyle: "circle",
        transparentCorners: false,
        data: { annotation: true },
      });
    }

    if (activeTool === "circle") {
      object = new FabricCircle({
        left: point.x,
        top: point.y,
        radius: 55,
        fill: "rgba(207,46,46,0.12)",
        stroke: activeColor,
        strokeWidth: 4,
        cornerStyle: "circle",
        transparentCorners: false,
        data: { annotation: true },
      });
    }

    if (activeTool === "text") {
      const text = textDraftRef.current.trim();
      if (!text) return;
      object = new IText(text, {
        left: point.x,
        top: point.y,
        fill: activeColor,
        fontSize: 32,
        fontFamily: "Inter, system-ui, sans-serif",
        backgroundColor: "rgba(255,255,255,0.88)",
        padding: 8,
        cornerStyle: "circle",
        transparentCorners: false,
        data: { annotation: true },
      });
    }

    if (!object) return;
    canvas.add(object);
    canvas.setActiveObject(object);
    canvas.requestRenderAll();
    selectTool("select");
  }

  function bindAnnotationLayer(node) {
    layerRef.current = node;
    if (!node) return;
    node.onclick = insertObjectAtPointer;
    node.onmousedown = insertObjectAtPointer;
    node.onpointerdown = insertObjectAtPointer;
  }

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  useEffect(() => {
    textDraftRef.current = textDraft;
  }, [textDraft]);

  useEffect(() => {
    if (!canvasElement.current) return undefined;

    const canvas = new Canvas(canvasElement.current, {
      width: 1040,
      height: 700,
      backgroundColor: "rgba(0,0,0,0)",
      preserveObjectStacking: true,
    });

    canvas.freeDrawingBrush = new PencilBrush(canvas);
    fabricRef.current = canvas;
    const handlePointerDown = (event) => {
      const activeTool = toolRef.current;
      if (!["rect", "circle", "text"].includes(activeTool)) return;
      if (event.__buildcoreAnnotationHandled) return;
      event.__buildcoreAnnotationHandled = true;

      event.preventDefault();
      const point = getCanvasPoint(canvas, event);
      const activeColor = colorRef.current;
      let object = null;

      if (activeTool === "rect") {
        object = new Rect({
          left: point.x,
          top: point.y,
          width: 190,
          height: 110,
          fill: "rgba(207,46,46,0.12)",
          stroke: activeColor,
          strokeWidth: 4,
          cornerStyle: "circle",
          transparentCorners: false,
          data: { annotation: true },
        });
      }

      if (activeTool === "circle") {
        object = new FabricCircle({
          left: point.x,
          top: point.y,
          radius: 55,
          fill: "rgba(207,46,46,0.12)",
          stroke: activeColor,
          strokeWidth: 4,
          cornerStyle: "circle",
          transparentCorners: false,
          data: { annotation: true },
        });
      }

      if (activeTool === "text") {
        const text = textDraftRef.current.trim();
        if (!text) return;
        object = new IText(text, {
          left: point.x,
          top: point.y,
          fill: activeColor,
          fontSize: 32,
          fontFamily: "Inter, system-ui, sans-serif",
          backgroundColor: "rgba(255,255,255,0.88)",
          padding: 8,
          cornerStyle: "circle",
          transparentCorners: false,
          data: { annotation: true },
        });
      }

      if (!object) return;
      canvas.add(object);
      canvas.setActiveObject(object);
      canvas.requestRenderAll();
      selectTool("select");
    };
    ["pointerdown", "mousedown", "click"].forEach((eventName) => canvas.upperCanvasEl?.addEventListener(eventName, handlePointerDown, true));
    canvas.on("path:created", (event) => {
      event.path?.set({ data: { annotation: true } });
    });
    let cancelled = false;
    imageToDataUrl(imageUrl)
      .then((source) => {
        if (!cancelled) setBaseImageSrc(source);
      })
      .catch((error) => {
        console.error(error);
      });

    return () => {
      cancelled = true;
      ["pointerdown", "mousedown", "click"].forEach((eventName) => canvas.upperCanvasEl?.removeEventListener(eventName, handlePointerDown, true));
      canvas.dispose();
    };
  }, [imageUrl]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return undefined;

    canvas.isDrawingMode = tool === "draw";
    canvas.selection = tool === "select";
    canvas.skipTargetFind = tool !== "select";
    if (!canvas.freeDrawingBrush) canvas.freeDrawingBrush = new PencilBrush(canvas);
    canvas.freeDrawingBrush.color = color;
    canvas.freeDrawingBrush.width = 5;
    canvas.defaultCursor = tool === "draw" ? "crosshair" : tool === "select" ? "move" : "copy";
    canvas.hoverCursor = tool === "select" ? "move" : canvas.defaultCursor;
  }, [tool, color, textDraft]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return undefined;

    const handleLayerEvent = (event) => insertObjectAtPointer(event);
    ["pointerdown", "mousedown", "click"].forEach((eventName) => layer.addEventListener(eventName, handleLayerEvent, true));
    return () => ["pointerdown", "mousedown", "click"].forEach((eventName) => layer.removeEventListener(eventName, handleLayerEvent, true));
  }, [tool, color, textDraft]);

  useEffect(() => {
    const canvas = fabricRef.current;
    const upperCanvas = canvas?.upperCanvasEl;
    if (!canvas || !upperCanvas) return undefined;

    const handlePointerDown = (event) => {
      const activeTool = toolRef.current;
      if (!["rect", "circle", "text"].includes(activeTool)) return;
      if (event.__buildcoreAnnotationHandled) return;
      event.__buildcoreAnnotationHandled = true;
      event.preventDefault();

      const point = getCanvasPoint(canvas, event);
      let object = null;

      if (activeTool === "rect") {
        object = new Rect({
          left: point.x,
          top: point.y,
          width: 190,
          height: 110,
          fill: "rgba(207,46,46,0.12)",
          stroke: color,
          strokeWidth: 4,
          cornerStyle: "circle",
          transparentCorners: false,
          data: { annotation: true },
        });
      }

      if (activeTool === "circle") {
        object = new FabricCircle({
          left: point.x,
          top: point.y,
          radius: 55,
          fill: "rgba(207,46,46,0.12)",
          stroke: color,
          strokeWidth: 4,
          cornerStyle: "circle",
          transparentCorners: false,
          data: { annotation: true },
        });
      }

      if (activeTool === "text") {
        const text = textDraft.trim();
        if (!text) return;
        object = new IText(text, {
          left: point.x,
          top: point.y,
          fill: color,
          fontSize: 32,
          fontFamily: "Inter, system-ui, sans-serif",
          backgroundColor: "rgba(255,255,255,0.88)",
          padding: 8,
          cornerStyle: "circle",
          transparentCorners: false,
          data: { annotation: true },
        });
      }

      if (!object) return;
      canvas.add(object);
      canvas.setActiveObject(object);
      canvas.requestRenderAll();
      selectTool("select");
    };

    ["pointerdown", "mousedown", "click"].forEach((eventName) => upperCanvas.addEventListener(eventName, handlePointerDown, true));
    return () => ["pointerdown", "mousedown", "click"].forEach((eventName) => upperCanvas.removeEventListener(eventName, handlePointerDown, true));
  }, [tool, color, textDraft]);

  function undo() {
    const canvas = fabricRef.current;
    const objects = canvas?.getObjects() ?? [];
    const annotationObjects = objects.filter((object) => !object.data?.baseImage);
    if (annotationObjects.length) canvas.remove(annotationObjects.at(-1));
  }

  async function save() {
    const canvas = fabricRef.current;
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

    context.drawImage(canvas.lowerCanvasEl, 0, 0);
    const dataUrl = output.toDataURL("image/jpeg", 0.92);
    const annotationJson = canvas.toJSON();
    await onSave?.({ dataUrl, annotationJson });
  }

  return (
    <section className="annotator">
      <div className="annotatorToolbar" aria-label="Photo annotation tools">
        {tools.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={tool === item.id ? "iconButton active" : "iconButton"}
              type="button"
              title={item.label}
              onClick={() => selectTool(item.id)}
            >
              <Icon size={18} />
            </button>
          );
        })}
        <input aria-label="Annotation color" className="colorInput" type="color" value={color} onChange={(event) => setColor(event.target.value)} />
        {tool === "text" && (
          <input
            aria-label="Text annotation"
            className="annotationTextInput"
            placeholder="Type text, then click photo"
            value={textDraft}
            onChange={(event) => setTextDraft(event.target.value)}
          />
        )}
        <button className="iconButton" type="button" title="Undo" onClick={undo}>
          <Undo2 size={18} />
        </button>
        <button className="saveButton" type="button" onClick={save}>
          <Download size={18} />
          Save
        </button>
      </div>
      <div className="canvasShell">
        {(baseImageSrc || imageUrl) && <img className="annotationBaseImage" src={baseImageSrc || imageUrl} alt="" />}
        <canvas ref={canvasElement} />
        {["rect", "circle", "text"].includes(tool) && <div className="annotationClickLayer" ref={bindAnnotationLayer} />}
      </div>
    </section>
  );
}
