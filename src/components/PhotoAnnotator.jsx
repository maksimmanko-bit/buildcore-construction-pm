import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Check, Circle, Copy, Hand, Maximize2, Minus, Pencil, Plus, Redo2, Square, Trash2, Type, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { Canvas, Circle as FabricCircle, FabricImage, Group, IText, Line, PencilBrush, Rect, Triangle, util } from "fabric";

const tools = [
  { id: "draw", label: "Pen", icon: Pencil },
  { id: "arrow", label: "Arrow", icon: ArrowUpRight },
  { id: "circle", label: "Circle", icon: Circle },
  { id: "rect", label: "Rectangle", icon: Square },
  { id: "text", label: "Text", icon: Type },
];

const swatches = [
  { id: "blue", label: "Blue", value: "#0a84ff", fill: "rgba(10,132,255,0.1)" },
  { id: "red", label: "Red", value: "#ff3b30", fill: "rgba(255,59,48,0.1)" },
  { id: "yellow", label: "Yellow", value: "#ffcc00", fill: "rgba(255,204,0,0.14)" },
  { id: "green", label: "Green", value: "#34c759", fill: "rgba(52,199,89,0.1)" },
  { id: "white", label: "White", value: "#ffffff", fill: "rgba(255,255,255,0.16)" },
  { id: "black", label: "Black", value: "#1c1c1e", fill: "rgba(28,28,30,0.1)" },
];

const markupShadow = "rgba(15, 23, 42, 0.2) 0px 4px 12px";

function getCanvasPoint(canvas, event) {
  try {
    const pointer = canvas.getPointer(event, false);
    if (Number.isFinite(pointer?.x) && Number.isFinite(pointer?.y)) return pointer;
  } catch {
    // Fall back to manual pointer math for browser events Fabric cannot normalize.
  }
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
    borderColor: "#0a84ff",
    cornerColor: "#ffffff",
    cornerStrokeColor: "#0a84ff",
    cornerSize: 11,
    cornerStyle: "circle",
    padding: 4,
    transparentCorners: false,
    data: { ...(object.data || {}), annotation: true },
  });
  object.setControlsVisibility?.({ mt: true, mb: true, ml: true, mr: true, bl: true, br: true, tl: true, tr: true, mtr: true });
  return object;
}

function createArrow({ color, point, strokeWidth }) {
  const width = 112;
  const line = new Line([0, 0, 118, 0], {
    stroke: color,
    strokeWidth,
    strokeLineCap: "round",
    strokeLineJoin: "round",
    selectable: false,
    evented: false,
    strokeUniform: true,
    shadow: markupShadow,
  });
  const head = new Triangle({
    left: 118,
    top: 0,
    width: Math.max(18, strokeWidth * 4),
    height: Math.max(22, strokeWidth * 4.8),
    angle: 90,
    fill: color,
    originX: "center",
    originY: "center",
    selectable: false,
    evented: false,
    shadow: markupShadow,
  });
  return annotationControlDefaults(
    new Group([line, head], {
      left: point.x - width / 2,
      top: point.y,
      angle: -16,
      objectCaching: true,
      data: { annotation: true, annotationType: "arrow" },
    }),
  );
}

function createShape({ color, fill, point, strokeWidth, tool }) {
  if (tool === "rect") {
    return annotationControlDefaults(
      new Rect({
        left: point.x - 58,
        top: point.y - 34,
        width: 116,
        height: 68,
        fill,
        stroke: color,
        strokeWidth,
        rx: 14,
        ry: 14,
        strokeUniform: true,
        objectCaching: true,
        shadow: markupShadow,
        data: { annotation: true, annotationType: "rect" },
      }),
    );
  }

  if (tool === "circle") {
    return annotationControlDefaults(
      new FabricCircle({
        left: point.x - 38,
        top: point.y - 38,
        radius: 38,
        fill,
        stroke: color,
        strokeWidth,
        strokeUniform: true,
        objectCaching: true,
        shadow: markupShadow,
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
      fontSize: 28,
      fontFamily: "Inter, system-ui, sans-serif",
      fontWeight: 850,
      backgroundColor: "rgba(255,255,255,0.88)",
      borderColor: "#0a84ff",
      padding: 12,
      objectCaching: true,
      shadow: markupShadow,
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

function fitCanvasSize(image) {
  const maxSide = 1600;
  const width = image.naturalWidth || image.width || 1;
  const height = image.naturalHeight || image.height || 1;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
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
  const isPanningRef = useRef(null);
  const panGestureRef = useRef(null);
  const longPressRef = useRef(0);
  const [activeObjectId, setActiveObjectId] = useState("");
  const [baseImageSrc, setBaseImageSrc] = useState("");
  const [canRedo, setCanRedo] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 1040, height: 700 });
  const [color, setColor] = useState(swatches[0].value);
  const [fill, setFill] = useState(swatches[0].fill);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [textComposer, setTextComposer] = useState(null);
  const [tool, setTool] = useState("draw");
  const [zoom, setZoom] = useState(1);

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

  async function prepareBaseImage(source, canvas = fabricRef.current) {
    if (!canvas || !source) return;
    const image = await loadHtmlImage(source);
    const size = fitCanvasSize(image);
    const imageWidth = image.naturalWidth || image.width || size.width;
    const imageHeight = image.naturalHeight || image.height || size.height;
    setCanvasSize(size);
    canvas.setDimensions(size);
    const fabricImage = new FabricImage(image, {
      left: 0,
      top: 0,
      originX: "left",
      originY: "top",
      scaleX: size.width / imageWidth,
      scaleY: size.height / imageHeight,
      selectable: false,
      evented: false,
    });
    canvas.set("backgroundImage", fabricImage);
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.backgroundVpt = true;
    canvas.calcOffset();
    requestCanvasRender(canvas);
  }

  function getActiveObject(canvas = fabricRef.current) {
    return canvas?.getActiveObject?.() || null;
  }

  function updatePropertyPanel(canvas = fabricRef.current) {
    const object = getActiveObject(canvas);
    if (!object || !object.data?.annotation) {
      setActiveObjectId("");
      return;
    }

    setActiveObjectId(object.__annotationId || "");
  }

  function selectTool(nextTool) {
    toolRef.current = nextTool;
    setTool(nextTool);
    const canvas = fabricRef.current;
    if (nextTool === "text" && canvas) {
      setTextComposer((current) => current || { canvasPoint: { x: canvas.width / 2, y: canvas.height / 2 }, value: "" });
    } else {
      setTextComposer(null);
    }
    if (!canvas) return;
    canvas.isDrawingMode = nextTool === "draw";
    canvas.skipTargetFind = nextTool === "draw" || nextTool === "pan";
    canvas.selection = false;
    canvas.defaultCursor = nextTool === "draw" ? "crosshair" : nextTool === "pan" ? "grab" : "copy";
    canvas.hoverCursor = nextTool === "draw" ? "crosshair" : nextTool === "pan" ? "grab" : "move";
    if (!canvas.freeDrawingBrush) canvas.freeDrawingBrush = new PencilBrush(canvas);
    canvas.freeDrawingBrush.color = colorRef.current;
    canvas.freeDrawingBrush.width = strokeWidthRef.current;
    requestCanvasRender(canvas);
  }

  function setCanvasZoom(nextZoom, anchor = null) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const safeZoom = Math.min(3, Math.max(0.75, nextZoom));
    const point = anchor || { x: canvas.width / 2, y: canvas.height / 2 };
    canvas.zoomToPoint(point, safeZoom);
    setZoom(safeZoom);
    requestCanvasRender(canvas);
  }

  function resetCanvasZoom() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    setZoom(1);
    requestCanvasRender(canvas);
  }

  function startPan(event) {
    const canvas = fabricRef.current;
    if (!canvas || toolRef.current !== "pan") return false;
    const rect = canvas.upperCanvasEl.getBoundingClientRect();
    isPanningRef.current = {
      pointerId: event.pointerId ?? "mouse",
      startX: event.clientX,
      startY: event.clientY,
      scaleX: canvas.width / rect.width,
      scaleY: canvas.height / rect.height,
      transform: [...canvas.viewportTransform],
    };
    if (event.pointerId != null) canvas.upperCanvasEl.setPointerCapture?.(event.pointerId);
    canvas.defaultCursor = "grabbing";
    canvas.hoverCursor = "grabbing";
    event.preventDefault?.();
    event.stopPropagation?.();
    return true;
  }

  function movePan(event) {
    const canvas = fabricRef.current;
    const pan = isPanningRef.current;
    if (!canvas || !pan || pan.pointerId !== (event.pointerId ?? "mouse")) return;
    const transform = [...pan.transform];
    transform[4] += (event.clientX - pan.startX) * pan.scaleX;
    transform[5] += (event.clientY - pan.startY) * pan.scaleY;
    canvas.setViewportTransform(transform);
    event.preventDefault?.();
    requestCanvasRender(canvas);
  }

  function stopPan(event) {
    const canvas = fabricRef.current;
    const pan = isPanningRef.current;
    if (!canvas || !pan) return;
    if (typeof pan.pointerId === "number") canvas.upperCanvasEl.releasePointerCapture?.(pan.pointerId);
    isPanningRef.current = null;
    if (toolRef.current === "pan") {
      canvas.defaultCursor = "grab";
      canvas.hoverCursor = "grab";
    }
    event?.preventDefault?.();
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

    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
    const point = getCanvasPoint(canvas, event);
    if (activeTool === "text") {
      setTextComposer((current) => ({ canvasPoint: point, value: current?.value || "" }));
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
    setZoom(nextZoom);
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
      const dataUrl = canvas.toDataURL({ format: "jpeg", quality: 0.9, multiplier: 1 });
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
      width: canvasSize.width,
      height: canvasSize.height,
      backgroundColor: "rgba(0,0,0,0)",
      enableRetinaScaling: true,
      preserveObjectStacking: true,
      renderOnAddRemove: false,
      selection: false,
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
      if (startPan(event)) return;
    };

    const handlePointerUp = () => {
      clearTimeout(longPressRef.current);
      stopPan();
      panGestureRef.current = null;
    };

    const handlePointerMove = (event) => movePan(event);

    const handleWheel = (event) => {
      event.preventDefault();
      const zoom = canvas.getZoom();
      const nextZoom = Math.min(3, Math.max(0.75, zoom * (0.999 ** event.deltaY)));
      canvas.zoomToPoint(getCanvasPoint(canvas, event), nextZoom);
      setZoom(nextZoom);
      requestCanvasRender(canvas);
    };

    canvas.upperCanvasEl?.addEventListener("pointerdown", handlePointerDown, true);
    canvas.upperCanvasEl?.addEventListener("pointermove", handlePointerMove, true);
    canvas.upperCanvasEl?.addEventListener("pointerup", handlePointerUp, true);
    canvas.upperCanvasEl?.addEventListener("touchend", handlePointerUp, { passive: false });
    canvas.upperCanvasEl?.addEventListener("touchcancel", handlePointerUp, { passive: false });
    canvas.upperCanvasEl?.addEventListener("touchmove", handleTouchGesture, { passive: false });
    canvas.upperCanvasEl?.addEventListener("wheel", handleWheel, { passive: false });
    canvas.on("mouse:down", (event) => {
      const activeTool = toolRef.current;
      if (activeTool === "pan") {
        startPan(event.e);
        return;
      }
      if (["rect", "circle", "arrow", "text"].includes(activeTool)) {
        if (!event.target || !event.target.data?.annotation) placeAnnotation(event.e);
        return;
      }
      if (event.target?.data?.annotation) {
        clearTimeout(longPressRef.current);
        longPressRef.current = setTimeout(() => updatePropertyPanel(canvas), 420);
      }
    });
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
        prepareBaseImage(source, canvas);
      })
      .catch((error) => console.error(error));

    return () => {
      cancelled = true;
      clearTimeout(longPressRef.current);
      stopPan();
      cancelAnimationFrame(rafRef.current);
      canvas.upperCanvasEl?.removeEventListener("pointerdown", handlePointerDown, true);
      canvas.upperCanvasEl?.removeEventListener("pointermove", handlePointerMove, true);
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
      <div className="canvasShell" style={{ "--annotation-aspect": canvasSize.width / canvasSize.height, aspectRatio: `${canvasSize.width} / ${canvasSize.height}` }}>
        <canvas ref={canvasElement} />
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
        <div className="annotatorDesktopNav" aria-label="Desktop image navigation">
          <button className={tool === "pan" ? "iconButton active" : "iconButton"} type="button" title="Hand tool" aria-label="Hand tool" onClick={() => selectTool("pan")}>
            <Hand size={18} />
          </button>
          <button className="iconButton" type="button" title="Zoom out" aria-label="Zoom out" onClick={() => setCanvasZoom(zoom - 0.18)}>
            <ZoomOut size={18} />
          </button>
          <span className="annotatorZoomValue">{Math.round(zoom * 100)}%</span>
          <button className="iconButton" type="button" title="Zoom in" aria-label="Zoom in" onClick={() => setCanvasZoom(zoom + 0.18)}>
            <ZoomIn size={18} />
          </button>
          <button className="iconButton" type="button" title="Reset zoom" aria-label="Reset zoom" onClick={resetCanvasZoom}>
            <Maximize2 size={18} />
          </button>
        </div>
        {tool === "text" ? (
          <form
            className="annotatorTextInputBar"
            onSubmit={(event) => {
              event.preventDefault();
              commitTextBubble();
            }}
          >
            <input
              autoFocus
              placeholder="Type text, then tap Add"
              value={textComposer?.value || ""}
              onChange={(event) => setTextComposer((current) => ({ canvasPoint: current?.canvasPoint || { x: canvasSize.width / 2, y: canvasSize.height / 2 }, value: event.target.value }))}
            />
            <button type="submit">Add</button>
          </form>
        ) : (
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
        )}
        {activeObjectId && tool !== "text" && (
          <div className="annotatorSelectionActions" aria-label="Selected annotation actions">
            <button className="iconButton" type="button" title="Smaller" onClick={() => updateActiveSize(-1)}>
              <Minus size={17} />
            </button>
            <button className="iconButton" type="button" title="Bigger" onClick={() => updateActiveSize(1)}>
              <Plus size={17} />
            </button>
            <button className="iconButton" type="button" title="Duplicate" onClick={duplicateActiveObject}>
              <Copy size={17} />
            </button>
            <button className="iconButton dangerIcon" type="button" title="Delete" onClick={deleteActiveObject}>
              <Trash2 size={17} />
            </button>
          </div>
        )}
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
