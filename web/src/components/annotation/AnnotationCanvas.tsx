import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from "react";
import type { BBox, LabelOption } from "../../types";
import { LABEL_OPTIONS } from "../../types";

export interface CanvasHandle {
  fitToView: () => void;
  getScale: () => number;
}

interface AnnotationCanvasProps {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  bboxes: BBox[];
  selectedId: string | null;
  activeLabel: LabelOption;
  onSelect: (id: string | null) => void;
  onBBoxChange: (bboxes: BBox[]) => void;
}

type CanvasMode = "idle" | "drawing" | "dragging" | "resizing";

interface Transform {
  offsetX: number;
  offsetY: number;
  scale: number;
}

const HANDLE_SIZE = 8;
const MIN_BOX_SIZE = 5;

function generateId(): string {
  return `bbox_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const AnnotationCanvas = forwardRef<CanvasHandle, AnnotationCanvasProps>(function AnnotationCanvas({
  imageUrl,
  imageWidth,
  imageHeight,
  bboxes,
  selectedId,
  activeLabel,
  onSelect,
  onBBoxChange,
}, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const rafRef = useRef<number>(0);
  const needsRenderRef = useRef(true);

  // Transform state (pan + zoom)
  const [transform, setTransform] = useState<Transform>({ offsetX: 0, offsetY: 0, scale: 1 });
  const transformRef = useRef(transform);
  transformRef.current = transform;

  // Interaction state
  const modeRef = useRef<CanvasMode>("idle");
  const startPosRef = useRef({ x: 0, y: 0 });
  const drawingBBoxRef = useRef<BBox | null>(null);
  const dragTargetRef = useRef<{ id: string; startBBox: BBox } | null>(null);
  const resizeHandleRef = useRef<{ id: string; handle: string } | null>(null);
  const spaceDownRef = useRef(false);
  const lastPanRef = useRef({ x: 0, y: 0 });

  // Load image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      needsRenderRef.current = true;
      // Fit to canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const scaleX = canvas.width / imageWidth;
        const scaleY = canvas.height / imageHeight;
        const scale = Math.min(scaleX, scaleY) * 0.9;
        setTransform({
          offsetX: (canvas.width - imageWidth * scale) / 2,
          offsetY: (canvas.height - imageHeight * scale) / 2,
          scale,
        });
      }
    };
    img.onerror = () => {
      imageRef.current = null;
      needsRenderRef.current = true;
    };
    img.src = imageUrl;
    return () => { img.onload = null; };
  }, [imageUrl, imageWidth, imageHeight]);

  // Resize canvas to fill container (ResizeObserver catches sidebar toggle etc.)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(() => {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      needsRenderRef.current = true;
    });
    ro.observe(parent);
    // Initial size
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    return () => ro.disconnect();
  }, []);

  // Convert screen coords to image coords
  const screenToImage = useCallback((sx: number, sy: number) => {
    const t = transformRef.current;
    return {
      x: (sx - t.offsetX) / t.scale,
      y: (sy - t.offsetY) / t.scale,
    };
  }, []);

  // Convert image coords to screen coords
  const imageToScreen = useCallback((ix: number, iy: number) => {
    const t = transformRef.current;
    return {
      x: ix * t.scale + t.offsetX,
      y: iy * t.scale + t.offsetY,
    };
  }, []);

  // Get resize handle at screen position (returns handle name or null)
  const getHandleAt = useCallback((sx: number, sy: number, box: BBox): string | null => {
    const hs = HANDLE_SIZE;
    const corners = [
      { name: "nw", ix: box.x, iy: box.y },
      { name: "ne", ix: box.x + box.width, iy: box.y },
      { name: "sw", ix: box.x, iy: box.y + box.height },
      { name: "se", ix: box.x + box.width, iy: box.y + box.height },
      { name: "n", ix: box.x + box.width / 2, iy: box.y },
      { name: "s", ix: box.x + box.width / 2, iy: box.y + box.height },
      { name: "w", ix: box.x, iy: box.y + box.height / 2 },
      { name: "e", ix: box.x + box.width, iy: box.y + box.height / 2 },
    ];
    for (const c of corners) {
      const sc = imageToScreen(c.ix, c.iy);
      if (Math.abs(sx - sc.x) < hs && Math.abs(sy - sc.y) < hs) return c.name;
    }
    return null;
  }, [imageToScreen]);

  // Hit test: find box at screen position
  const getBoxAt = useCallback((sx: number, sy: number): BBox | null => {
    const img = screenToImage(sx, sy);
    // Reverse order so topmost box is selected first
    for (let i = bboxes.length - 1; i >= 0; i--) {
      const b = bboxes[i];
      if (img.x >= b.x && img.x <= b.x + b.width && img.y >= b.y && img.y <= b.y + b.height) {
        return b;
      }
    }
    return null;
  }, [bboxes, screenToImage]);

  // Render loop
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const t = transformRef.current;

    // Clear
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw image
    if (imageRef.current) {
      ctx.save();
      ctx.translate(t.offsetX, t.offsetY);
      ctx.scale(t.scale, t.scale);
      ctx.drawImage(imageRef.current, 0, 0, imageWidth, imageHeight);

      // Draw all boxes
      const allBoxes = [...bboxes];
      if (drawingBBoxRef.current) allBoxes.push(drawingBBoxRef.current);

      for (const box of allBoxes) {
        const label = LABEL_OPTIONS.find(l => l.name === box.labels[0]);
        const color = label?.color ?? "#eab308";
        const isSelected = box.id === selectedId;

        // Fill
        ctx.fillStyle = color + "20";
        ctx.fillRect(box.x, box.y, box.width, box.height);

        // Stroke
        ctx.strokeStyle = color;
        ctx.lineWidth = isSelected ? 2.5 / t.scale : 1.5 / t.scale;
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        // Label badge
        const fontSize = Math.max(12, 14 / t.scale);
        ctx.font = `bold ${fontSize}px sans-serif`;
        const text = box.labels[0] || "未标注";
        const textWidth = ctx.measureText(text).width;
        const badgeH = fontSize + 4 / t.scale;
        const badgeW = textWidth + 8 / t.scale;
        ctx.fillStyle = color;
        ctx.fillRect(box.x, box.y - badgeH, badgeW, badgeH);
        ctx.fillStyle = "#fff";
        ctx.fillText(text, box.x + 4 / t.scale, box.y - 4 / t.scale);

        // Resize handles for selected box
        if (isSelected) {
          const hs = HANDLE_SIZE / t.scale;
          const corners = [
            box.x, box.y,
            box.x + box.width, box.y,
            box.x, box.y + box.height,
            box.x + box.width, box.y + box.height,
            box.x + box.width / 2, box.y,
            box.x + box.width / 2, box.y + box.height,
            box.x, box.y + box.height / 2,
            box.x + box.width, box.y + box.height / 2,
          ];
          ctx.fillStyle = "#fff";
          ctx.strokeStyle = color;
          ctx.lineWidth = 1 / t.scale;
          for (let i = 0; i < corners.length; i += 2) {
            ctx.fillRect(corners[i] - hs / 2, corners[i + 1] - hs / 2, hs, hs);
            ctx.strokeRect(corners[i] - hs / 2, corners[i + 1] - hs / 2, hs, hs);
          }
        }
      }

      ctx.restore();
    }

    // Crosshair
    // (drawn in screen space based on last mouse position — stored separately)
  }, [bboxes, selectedId, imageWidth, imageHeight]);

  // On-demand render loop (not constant 60fps)
  useEffect(() => { needsRenderRef.current = true; }, [bboxes, selectedId]);

  useEffect(() => {
    let running = true;
    const loop = () => {
      if (needsRenderRef.current) {
        render();
        needsRenderRef.current = false;
      }
      if (running) rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  }, [render]);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Space + drag = pan
    if (spaceDownRef.current || e.button === 1) {
      lastPanRef.current = { x: e.clientX, y: e.clientY };
      modeRef.current = "dragging";
      return;
    }

    // Check selected box handles first
    if (selectedId) {
      const selBox = bboxes.find(b => b.id === selectedId);
      if (selBox) {
        const handle = getHandleAt(sx, sy, selBox);
        if (handle) {
          resizeHandleRef.current = { id: selectedId, handle };
          startPosRef.current = { x: sx, y: sy };
          modeRef.current = "resizing";
          return;
        }
      }
    }

    // Check box hit
    const hitBox = getBoxAt(sx, sy);
    if (hitBox) {
      onSelect(hitBox.id);
      dragTargetRef.current = {
        id: hitBox.id,
        startBBox: { ...hitBox },
      };
      startPosRef.current = { x: sx, y: sy };
      modeRef.current = "dragging";
      return;
    }

    // Start drawing new box
    onSelect(null);
    const imgPos = screenToImage(sx, sy);
    drawingBBoxRef.current = {
      id: generateId(),
      x: imgPos.x,
      y: imgPos.y,
      width: 0,
      height: 0,
      labels: [activeLabel.name],
      confidence: 1.0,
      source: "human",
    };
    startPosRef.current = { x: sx, y: sy };
    modeRef.current = "drawing";
  }, [bboxes, selectedId, activeLabel, screenToImage, getBoxAt, getHandleAt, onSelect]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (modeRef.current === "drawing" && drawingBBoxRef.current) {
      const startImg = screenToImage(startPosRef.current.x, startPosRef.current.y);
      const currImg = screenToImage(sx, sy);
      const b = drawingBBoxRef.current;
      b.x = Math.min(startImg.x, currImg.x);
      b.y = Math.min(startImg.y, currImg.y);
      b.width = Math.abs(currImg.x - startImg.x);
      b.height = Math.abs(currImg.y - startImg.y);
      return;
    }

    if (modeRef.current === "dragging" && dragTargetRef.current) {
      const dx = (sx - startPosRef.current.x) / transformRef.current.scale;
      const dy = (sy - startPosRef.current.y) / transformRef.current.scale;
      const start = dragTargetRef.current.startBBox;
      const newBBoxes = bboxes.map(b =>
        b.id === dragTargetRef.current!.id
          ? { ...b, x: start.x + dx, y: start.y + dy }
          : b
      );
      onBBoxChange(newBBoxes);
      return;
    }

    if (modeRef.current === "dragging" && spaceDownRef.current) {
      // Pan
      const dx = e.clientX - lastPanRef.current.x;
      const dy = e.clientY - lastPanRef.current.y;
      lastPanRef.current = { x: e.clientX, y: e.clientY };
      needsRenderRef.current = true;
      setTransform(prev => ({
        ...prev,
        offsetX: prev.offsetX + dx,
        offsetY: prev.offsetY + dy,
      }));
      return;
    }

    if (modeRef.current === "resizing" && resizeHandleRef.current) {
      const { id, handle } = resizeHandleRef.current;
      const startImg = screenToImage(startPosRef.current.x, startPosRef.current.y);
      const currImg = screenToImage(sx, sy);
      const dx = currImg.x - startImg.x;
      const dy = currImg.y - startImg.y;

      const newBBoxes = bboxes.map(b => {
        if (b.id !== id) return b;
        const nb = { ...b };
        if (handle.includes("e")) { nb.width = Math.max(MIN_BOX_SIZE, b.width + dx); }
        if (handle.includes("w")) { nb.x = b.x + dx; nb.width = Math.max(MIN_BOX_SIZE, b.width - dx); }
        if (handle.includes("s")) { nb.height = Math.max(MIN_BOX_SIZE, b.height + dy); }
        if (handle.includes("n")) { nb.y = b.y + dy; nb.height = Math.max(MIN_BOX_SIZE, b.height - dy); }
        return nb;
      });
      onBBoxChange(newBBoxes);
      startPosRef.current = { x: sx, y: sy }; // incremental
      return;
    }

    // Update cursor
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (spaceDownRef.current) {
      canvas.style.cursor = "grab";
      return;
    }
    if (selectedId) {
      const selBox = bboxes.find(b => b.id === selectedId);
      if (selBox) {
        const handle = getHandleAt(sx, sy, selBox);
        if (handle) {
          const cursors: Record<string, string> = {
            nw: "nw-resize", ne: "ne-resize", sw: "sw-resize", se: "se-resize",
            n: "n-resize", s: "s-resize", w: "w-resize", e: "e-resize",
          };
          canvas.style.cursor = cursors[handle] ?? "pointer";
          return;
        }
      }
    }
    const hit = getBoxAt(sx, sy);
    canvas.style.cursor = hit ? "move" : "crosshair";
  }, [bboxes, selectedId, screenToImage, getBoxAt, getHandleAt, onBBoxChange]);

  const handleMouseUp = useCallback(() => {
    if (modeRef.current === "drawing" && drawingBBoxRef.current) {
      const b = drawingBBoxRef.current;
      if (b.width > MIN_BOX_SIZE && b.height > MIN_BOX_SIZE) {
        onBBoxChange([...bboxes, b]);
        onSelect(b.id);
      }
      drawingBBoxRef.current = null;
    }
    modeRef.current = "idle";
    dragTargetRef.current = null;
    resizeHandleRef.current = null;
  }, [bboxes, onBBoxChange, onSelect]);

  // S4: mouseLeave cancels drawing instead of committing invalid box
  const handleMouseLeave = useCallback(() => {
    if (modeRef.current === "drawing") {
      drawingBBoxRef.current = null;
    }
    modeRef.current = "idle";
    dragTargetRef.current = null;
    resizeHandleRef.current = null;
  }, []);

  // Zoom with wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;

    needsRenderRef.current = true;
    setTransform(prev => {
      const newScale = Math.max(0.05, Math.min(20, prev.scale * factor));
      return {
        scale: newScale,
        offsetX: mx - (mx - prev.offsetX) * (newScale / prev.scale),
        offsetY: my - (my - prev.offsetY) * (newScale / prev.scale),
      };
    });
  }, []);

  // Keyboard: Space for pan mode
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) { spaceDownRef.current = true; }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") { spaceDownRef.current = false; }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // Fit to view
  const fitToView = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scaleX = canvas.width / imageWidth;
    const scaleY = canvas.height / imageHeight;
    const scale = Math.min(scaleX, scaleY) * 0.9;
    setTransform({
      offsetX: (canvas.width - imageWidth * scale) / 2,
      offsetY: (canvas.height - imageHeight * scale) / 2,
      scale,
    });
  }, [imageWidth, imageHeight]);

  // Expose fitToView via ref (K1)
  useImperativeHandle(ref, () => ({
    fitToView,
    getScale: () => transformRef.current.scale,
  }), [fitToView]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
      onContextMenu={e => e.preventDefault()}
    />
  );
});

export default AnnotationCanvas;
