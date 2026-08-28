import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Circle, MousePointer2, Palette, Pencil, Square, Type, Undo2 } from "lucide-react";
import { Canvas, Circle as FabricCircle, Group, IText, Line, PencilBrush, Rect, Triangle } from "fabric";

const tools = [
  { id: "select", label: "Move", icon: MousePointer2 },
  { id: "draw", label: "Draw", icon: Pencil },
  { id: "arrow", label: "Arrow", icon: ArrowUpRight },
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

function annotationControlDefaults(object) {
  object.set({
    borderColor: "#2563eb",
    cornerColor: "#ffffff",
    cornerStrokeColor: "#2563eb",
    cornerSize: 13,
    cornerStyle: "circle",
    transparentCorners: false,
    data: { annotation: true },
  });
  return object;
}

function createAnnotationObject({ color, point, text, tool }) {
  if (tool === "rect") {
    return annotationControlDefaults(
      new Rect({
        left: point.x,
        top: point.y,
        width: 190,
        height: 110,
        fill: "rgba(207,46,46,0.12)",
        stroke: color,
        strokeWidth: 4,
      }),
    );
  }

  if (tool === "circle") {
    return annotationControlDefaults(
      new FabricCircle({
        left: point.x,
        top: point.y,
        radius: 58,
        fill: "rgba(207,46,46,0.12)",
        stroke: color,
        strokeWidth: 4,
      }),
    );
  }

  if (tool === "arrow") {
    const line = new Line([0, 0, 168, 0], {
      stroke: color,
      strokeWidth: 7,
      strokeLineCap: "round",
      selectable: false,
      evented: false,
    });
    const head = new Triangle({
      left: 168,
      top: 0,
      width: 30,
      height: 34,
      angle: 90,
      fill: color,
      originX: "center",
      originY: "center",
      selectable: false,
      evented: false,
    });
    return annotationControlDefaults(
      new Group([line, head], {
        left: point.x,
        top: point.y,
        angle: -18,
      }),
    );
  }

  if (tool === "text") {
    const cleanText = text.trim();
    if (!cleanText) return null;
    return annotationControlDefaults(
      new IText(cleanText, {
        left: point.x,
        top: point.y,
        fill: color,
        fontSize: 34,
        fontFamily: "Inter, system-ui, sans-serif",
        fontWeight: 800,
        backgroundColor: "rgba(255,255,255,0.9)",
        padding: 9,
      }),
    );
  }

  return null;
}

export default function PhotoAnnotator({ imageUrl, onSave }) {
  const canvasElement = useRef(null);
  const fabricRef = useRef(null);
  const annotationLayerRef = useRef(null);
  const toolRef = useRef("select");
  const colorRef = useRef("#cf2e2e");
  const textDraftRef = useRef("");
  const [tool, setTool] = useState("select");
  const [color, setColor] = useState("#cf2e2e");
  const [textDraft, setTextDraft] = useState("");
  const [baseImageSrc, setBaseImageSrc] = useState("");
  const [canUndo, setCanUndo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  function syncUndoState(canvas = fabricRef.current) {
    const hasAnnotations = (canvas?.getObjects() ?? []).some((object) => object.data?.annotation);
    setCanUndo(hasAnnotations);
  }

  function selectTool(nextTool) {
    toolRef.current = nextTool;
    setTool(nextTool);
  }

  function placeAnnotationFromEvent(rawEvent) {
    const canvas = fabricRef.current;
    const activeTool = toolRef.current;
    if (!canvas || !["rect", "circle", "arrow", "text"].includes(activeTool)) return;

    rawEvent.preventDefault?.();
    rawEvent.stopPropagation?.();
    const point = getCanvasPoint(canvas, rawEvent);
    const object = createAnnotationObject({
      color: colorRef.current,
      point,
      text: textDraftRef.current,
      tool: activeTool,
    });

    if (!object) return;
    canvas.add(object);
    canvas.setActiveObject(object);
    canvas.requestRenderAll();
    syncUndoState(canvas);
    selectTool("select");
  }

  function bindAnnotationLayer(node) {
    annotationLayerRef.current = node;
    if (!node) return;
    const handler = (event) => placeAnnotationFromEvent(event);
    node.onpointerdown = handler;
    node.onmousedown = handler;
    node.onclick = handler;
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
      enableRetinaScaling: false,
      preserveObjectStacking: true,
      renderOnAddRemove: true,
      selectionColor: "rgba(37, 99, 235, 0.08)",
      selectionBorderColor: "#2563eb",
    });

    canvas.freeDrawingBrush = new PencilBrush(canvas);
    fabricRef.current = canvas;
    const handleCanvasPointerDown = (event) => {
      placeAnnotationFromEvent(event);
    };
    canvas.upperCanvasEl?.addEventListener("pointerdown", handleCanvasPointerDown, true);
    canvas.on("path:created", (event) => {
      annotationControlDefaults(event.path);
      syncUndoState(canvas);
    });
    canvas.on("object:removed", () => syncUndoState(canvas));
    canvas.on("object:added", () => syncUndoState(canvas));

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
      canvas.upperCanvasEl?.removeEventListener("pointerdown", handleCanvasPointerDown, true);
      canvas.dispose();
    };
  }, [imageUrl]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = tool === "draw";
    canvas.selection = tool === "select";
    canvas.skipTargetFind = tool !== "select";
    if (!canvas.freeDrawingBrush) canvas.freeDrawingBrush = new PencilBrush(canvas);
    canvas.freeDrawingBrush.color = color;
    canvas.freeDrawingBrush.width = 5.5;
    canvas.defaultCursor = tool === "draw" ? "crosshair" : tool === "select" ? "move" : "copy";
    canvas.hoverCursor = tool === "select" ? "move" : canvas.defaultCursor;
    canvas.requestRenderAll();
  }, [tool, color]);

  function undo() {
    const canvas = fabricRef.current;
    const annotationObjects = (canvas?.getObjects() ?? []).filter((object) => object.data?.annotation);
    const lastObject = annotationObjects.at(-1);
    if (!canvas || !lastObject) return;
    canvas.remove(lastObject);
    canvas.requestRenderAll();
    syncUndoState(canvas);
  }

  async function save() {
    const canvas = fabricRef.current;
    if (!canvas || isSaving) return;

    setIsSaving(true);
    try {
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
      const annotationJson = canvas.toJSON(["data"]);
      await onSave?.({ dataUrl, annotationJson });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="annotator">
      <div className="annotatorToolbar" aria-label="Photo annotation tools">
        <div className="annotatorToolGroup">
          {tools.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={tool === item.id ? "iconButton active" : "iconButton"}
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
        <label className="annotatorColorPicker" title="Annotation color">
          <Palette size={16} />
          <input aria-label="Annotation color" type="color" value={color} onChange={(event) => setColor(event.target.value)} />
        </label>
        {tool === "text" && (
          <input
            aria-label="Text annotation"
            className="annotationTextInput"
            placeholder="Type text, then tap photo"
            value={textDraft}
            onChange={(event) => setTextDraft(event.target.value)}
          />
        )}
        <button className="iconButton" type="button" title="Undo" aria-label="Undo" disabled={!canUndo} onClick={undo}>
          <Undo2 size={18} />
        </button>
        <button className="saveButton" type="button" disabled={isSaving} onClick={save}>
          <Check size={18} />
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
      <div className="annotatorHint">
        {tool === "select" && "Drag annotations to move or resize them."}
        {tool === "draw" && "Press and drag to draw. Lift to stop."}
        {tool === "arrow" && "Tap the photo to place an arrow."}
        {tool === "rect" && "Tap the photo to place a rectangle."}
        {tool === "circle" && "Tap the photo to place a circle."}
        {tool === "text" && "Enter text, then tap the photo."}
      </div>
      <div
        className="canvasShell"
        onMouseDownCapture={(event) => {
          if (!["rect", "circle", "arrow", "text"].includes(toolRef.current)) return;
          placeAnnotationFromEvent(event.nativeEvent);
        }}
        onPointerDownCapture={(event) => {
          if (!["rect", "circle", "arrow", "text"].includes(toolRef.current)) return;
          placeAnnotationFromEvent(event.nativeEvent);
        }}
      >
        {(baseImageSrc || imageUrl) && <img className="annotationBaseImage" src={baseImageSrc || imageUrl} alt="" />}
        <canvas ref={canvasElement} />
        {["rect", "circle", "arrow", "text"].includes(tool) && (
          <button
            aria-label={`Place ${tool} annotation`}
            className="annotationClickLayer"
            ref={bindAnnotationLayer}
            type="button"
          />
        )}
      </div>
    </section>
  );
}
