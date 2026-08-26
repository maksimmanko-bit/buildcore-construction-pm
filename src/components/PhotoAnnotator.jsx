import { useEffect, useRef, useState } from "react";
import { Circle, Download, MousePointer2, Pencil, Square, Type, Undo2 } from "lucide-react";
import { Canvas, Circle as FabricCircle, FabricImage, IText, PencilBrush, Rect } from "fabric";

const tools = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "draw", label: "Pencil", icon: Pencil },
  { id: "rect", label: "Rectangle", icon: Square },
  { id: "circle", label: "Circle", icon: Circle },
  { id: "text", label: "Text", icon: Type },
];

export default function PhotoAnnotator({ imageUrl, onSave }) {
  const canvasElement = useRef(null);
  const fabricRef = useRef(null);
  const [tool, setTool] = useState("select");
  const [color, setColor] = useState("#cf2e2e");

  useEffect(() => {
    if (!canvasElement.current) return undefined;

    const canvas = new Canvas(canvasElement.current, {
      width: 920,
      height: 620,
      backgroundColor: "#090e18",
      preserveObjectStacking: true,
    });

    canvas.freeDrawingBrush = new PencilBrush(canvas);
    fabricRef.current = canvas;

    FabricImage.fromURL(imageUrl, { crossOrigin: "anonymous" }).then((img) => {
      const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
      img.set({
        left: (canvas.width - img.width * scale) / 2,
        top: (canvas.height - img.height * scale) / 2,
        scaleX: scale,
        scaleY: scale,
        selectable: false,
        evented: false,
      });
      canvas.backgroundImage = img;
      canvas.requestRenderAll();
    });

    return () => canvas.dispose();
  }, [imageUrl]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return undefined;

    canvas.isDrawingMode = tool === "draw";
    canvas.selection = tool === "select";
    if (!canvas.freeDrawingBrush) canvas.freeDrawingBrush = new PencilBrush(canvas);
    canvas.freeDrawingBrush.color = color;
    canvas.freeDrawingBrush.width = 5;

    const handleClick = (event) => {
      const point = canvas.getPointer(event.e);

      if (tool === "rect") {
        canvas.add(
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
        canvas.add(
          new FabricCircle({
            left: point.x,
            top: point.y,
            radius: 55,
            fill: "rgba(207,46,46,0.12)",
            stroke: color,
            strokeWidth: 4,
          }),
        );
      }

      if (tool === "text") {
        canvas.add(
          new IText("Note", {
            left: point.x,
            top: point.y,
            fill: color,
            fontSize: 32,
            fontFamily: "Inter, system-ui, sans-serif",
            backgroundColor: "rgba(255,255,255,0.86)",
            padding: 8,
          }),
        );
      }

      canvas.requestRenderAll();
    };

    canvas.on("mouse:down", handleClick);
    return () => canvas.off("mouse:down", handleClick);
  }, [tool, color]);

  function undo() {
    const canvas = fabricRef.current;
    const objects = canvas?.getObjects() ?? [];
    if (objects.length) canvas.remove(objects.at(-1));
  }

  async function save() {
    const canvas = fabricRef.current;
    const dataUrl = canvas.toDataURL({ format: "jpeg", quality: 0.92, multiplier: 1 });
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
              onClick={() => setTool(item.id)}
            >
              <Icon size={18} />
            </button>
          );
        })}
        <input aria-label="Annotation color" className="colorInput" type="color" value={color} onChange={(event) => setColor(event.target.value)} />
        <button className="iconButton" type="button" title="Undo" onClick={undo}>
          <Undo2 size={18} />
        </button>
        <button className="saveButton" type="button" onClick={save}>
          <Download size={18} />
          Save
        </button>
      </div>
      <div className="canvasShell">
        <canvas ref={canvasElement} />
      </div>
    </section>
  );
}
