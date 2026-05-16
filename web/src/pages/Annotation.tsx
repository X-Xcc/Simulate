import { useState, useEffect, useCallback, useRef } from "react";
import { Download } from "lucide-react";
import { useToast } from "../components/Toast";
import { useTheme } from "../components/ThemeProvider";
import AnnotationCanvas from "../components/annotation/AnnotationCanvas";
import type { CanvasHandle } from "../components/annotation/AnnotationCanvas";
import ImageSidebar from "../components/annotation/ImageSidebar";
import PropertyPanel from "../components/annotation/PropertyPanel";
import AnnotationToolbar from "../components/annotation/AnnotationToolbar";
import {
  fetchAnnotationImages,
  fetchAnnotation,
  saveAnnotation,
  uploadAnnotationImage,
  exportAnnotation,
} from "../services/dataService";
import type { BBox, AnnotationData, ImageItem, LabelOption } from "../types";
import { LABEL_OPTIONS } from "../types";

export default function Annotation() {
  const toast = useToast();
  const { theme } = useTheme();

  // Image list
  const [images, setImages] = useState<ImageItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedFilenames, setSelectedFilenames] = useState<Set<string>>(new Set());

  // Current image
  const [currentFilename, setCurrentFilename] = useState<string | null>(null);
  const [annotationData, setAnnotationData] = useState<AnnotationData | null>(null);
  const [bboxes, setBboxes] = useState<BBox[]>([]);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [activeLabel, setActiveLabel] = useState<LabelOption>(LABEL_OPTIONS[0]);

  // Undo history
  const [history, setHistory] = useState<BBox[][]>([]);

  // Upload
  const [uploading, setUploading] = useState(false);

  // Save timer
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Canvas ref
  const canvasRef = useRef<CanvasHandle>(null);

  // --- Data loading ---

  // Load image list
  const loadImages = useCallback(async () => {
    try {
      const list = await fetchAnnotationImages();
      setImages(list);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  // Auto-select first image
  useEffect(() => {
    if (images.length > 0 && !currentFilename) {
      setCurrentFilename(images[0].filename);
    }
  }, [images, currentFilename]);

  // Load annotation for current image
  useEffect(() => {
    if (!currentFilename) return;
    const ctrl = new AbortController();
    fetchAnnotation(currentFilename, ctrl.signal).then(data => {
      setAnnotationData(data);
      setBboxes(data?.bboxes ?? []);
      setSelectedBoxId(null);
      setHistory([]);
    }).catch(() => {});
    return () => ctrl.abort();
  }, [currentFilename]);

  // Sync currentIndex
  useEffect(() => {
    if (currentFilename) {
      const idx = images.findIndex(i => i.filename === currentFilename);
      if (idx >= 0) setCurrentIndex(idx);
    }
  }, [currentFilename, images]);

  // --- Save logic ---

  const doSave = useCallback(async (newBboxes: BBox[], status?: "reviewed" | "unlabeled") => {
    if (!currentFilename) return;
    try {
      const labels = [...new Set(newBboxes.flatMap(b => b.labels).filter(Boolean))];
      await saveAnnotation(currentFilename, {
        imageFilename: currentFilename,
        imageWidth: annotationData?.imageWidth ?? 1920,
        imageHeight: annotationData?.imageHeight ?? 1080,
        status: status ?? (newBboxes.length > 0 ? "reviewed" : "unlabeled"),
        labels,
        bboxes: newBboxes,
        annotator: "admin",
        annotatedAt: new Date().toISOString(),
      });
      setImages(prev => prev.map(img =>
        img.filename === currentFilename
          ? { ...img, hasAnnotation: newBboxes.length > 0 }
          : img
      ));
    } catch {
      toast.show("保存失败", "error");
    }
  }, [currentFilename, annotationData, toast]);

  // Auto-save with debounce
  const scheduleSave = useCallback((newBboxes: BBox[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      doSave(newBboxes);
    }, 1000);
  }, [doSave]);

  // --- BBox operations ---

  const commitChange = useCallback((updater: (prev: BBox[]) => BBox[]) => {
    setBboxes(prev => {
      const next = updater(prev);
      setHistory(h => [...h.slice(-20), prev]);
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setBboxes(prev);
    scheduleSave(prev);
  }, [history, scheduleSave]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedBoxId) return;
    commitChange(prev => prev.filter(b => b.id !== selectedBoxId));
    setSelectedBoxId(null);
  }, [selectedBoxId, commitChange]);

  const handleDelete = useCallback((boxId: string) => {
    commitChange(prev => prev.filter(b => b.id !== boxId));
    if (selectedBoxId === boxId) setSelectedBoxId(null);
  }, [selectedBoxId, commitChange]);

  const handleLabelChange = useCallback((boxId: string, label: string) => {
    commitChange(prev => prev.map(b =>
      b.id === boxId ? { ...b, labels: [label] } : b
    ));
  }, [commitChange]);

  // --- Image navigation ---

  const navigateToIndex = useCallback((idx: number) => {
    if (idx >= 0 && idx < images.length) {
      setCurrentIndex(idx);
      setCurrentFilename(images[idx].filename);
    }
  }, [images]);

  const handlePrev = useCallback(() => navigateToIndex(currentIndex - 1), [currentIndex, navigateToIndex]);
  const handleNext = useCallback(() => navigateToIndex(currentIndex + 1), [currentIndex, navigateToIndex]);

  // --- Workflow ---

  const handleSubmit = useCallback(async () => {
    if (!currentFilename) return;
    await doSave(bboxes, "reviewed");
    toast.show("已提交");
    if (currentIndex < images.length - 1) {
      navigateToIndex(currentIndex + 1);
    } else {
      toast.show("已是最后一张");
    }
  }, [currentFilename, bboxes, doSave, toast, currentIndex, images, navigateToIndex]);

  const handleInvalid = useCallback(() => {
    toast.show("已跳过");
    if (currentIndex < images.length - 1) {
      navigateToIndex(currentIndex + 1);
    } else {
      toast.show("已是最后一张");
    }
  }, [toast, currentIndex, images, navigateToIndex]);

  // --- Upload ---

  const handleUpload = useCallback(async (files: FileList) => {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadAnnotationImage(file);
      }
      await loadImages();
      toast.show(`上传完成`);
    } catch {
      toast.show("上传失败", "error");
    } finally {
      setUploading(false);
    }
  }, [loadImages, toast]);

  // --- Multi-select (passthrough — not implementing batch ops) ---

  const handleMultiSelect = useCallback((filename: string, ctrl: boolean, shift: boolean) => {
    if (ctrl) {
      setSelectedFilenames(prev => {
        const next = new Set(prev);
        if (next.has(filename)) next.delete(filename); else next.add(filename);
        return next;
      });
    } else if (shift && currentFilename) {
      const startIdx = images.findIndex(i => i.filename === currentFilename);
      const endIdx = images.findIndex(i => i.filename === filename);
      const [lo, hi] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
      const range = images.slice(lo, hi + 1).map(i => i.filename);
      setSelectedFilenames(prev => new Set([...prev, ...range]));
    } else {
      setSelectedFilenames(new Set());
      setCurrentFilename(filename);
    }
  }, [currentFilename, images]);

  // --- Export ---

  const handleExport = useCallback((format: "yolo" | "coco") => {
    exportAnnotation(format);
    toast.show(`正在导出 ${format.toUpperCase()} 格式...`);
  }, [toast]);

  // --- Keyboard shortcuts ---

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        handleDeleteSelected();
      } else if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleUndo();
      } else if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (currentFilename) {
          doSave(bboxes);
          toast.show("已保存");
        }
      } else if (e.key === "e" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleExport("yolo");
      } else if (e.key === "a" || e.key === "A") {
        handlePrev();
      } else if (e.key === "d" || e.key === "D") {
        handleNext();
      } else if (e.key === "f" || e.key === "F") {
        canvasRef.current?.fitToView();
      } else if (e.key === "Escape") {
        setSelectedBoxId(null);
      } else if (e.key >= "1" && e.key <= "4") {
        const idx = parseInt(e.key) - 1;
        if (LABEL_OPTIONS[idx]) setActiveLabel(LABEL_OPTIONS[idx]);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleDeleteSelected, handleUndo, handleExport, handlePrev, handleNext, currentFilename, bboxes, doSave, toast]);

  // --- Read canvas scale ---
  const [canvasScale, setCanvasScale] = useState(1);
  const prevScaleRef = useRef(1);
  useEffect(() => {
    const iv = setInterval(() => {
      const s = canvasRef.current?.getScale();
      if (s && s !== prevScaleRef.current) {
        prevScaleRef.current = s;
        setCanvasScale(s);
      }
    }, 200);
    return () => clearInterval(iv);
  }, []);

  // --- Cleanup save timer ---
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // --- Render ---

  const imageUrl = currentFilename ? `/api/images/${encodeURIComponent(currentFilename)}` : "";
  const isDark = theme === "dark";

  return (
    <div className="flex flex-col h-full animate-fade-in-up">
      {/* Page header */}
      <section className="flex justify-between items-end shrink-0 mb-4">
        <div>
          <p className="text-caption font-semibold text-outline uppercase tracking-widest mb-1">
            数据中心 / 标注
          </p>
          <h2 className="text-title font-bold tracking-tight">数据标注</h2>
          <p className="text-body-sm text-on-surface-variant mt-0.5">
            手动标注训练数据，导出 YOLO/COCO 格式
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleExport("yolo")}
            className="bg-primary text-white px-4 py-2 rounded-lg font-semibold text-body flex items-center gap-2 shadow-sm">
            <Download size={15} /> 导出 YOLO
          </button>
          <button onClick={() => handleExport("coco")}
            className="bg-white border border-outline-variant px-4 py-2 rounded-lg font-semibold text-body flex items-center gap-2">
            <Download size={15} /> 导出 COCO
          </button>
        </div>
      </section>

      {/* Main layout: 3-column + toolbar */}
      <div className="flex flex-1 min-h-0 rounded-xl overflow-hidden border border-outline-variant shadow-sm">
        {/* Left sidebar */}
        <ImageSidebar
          images={images}
          currentFilename={currentFilename}
          selectedFilenames={selectedFilenames}
          onSelect={setCurrentFilename}
          onMultiSelect={handleMultiSelect}
          onUpload={handleUpload}
          uploading={uploading}
        />

        {/* Center: canvas + toolbar */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className={`flex-1 min-h-0 ${isDark ? "bg-[#111]" : "bg-[#f5f5f5]"}`}>
            {currentFilename ? (
              <AnnotationCanvas
                key={currentFilename}
                ref={canvasRef}
                imageUrl={imageUrl}
                imageWidth={annotationData?.imageWidth ?? 1920}
                imageHeight={annotationData?.imageHeight ?? 1080}
                bboxes={bboxes}
                selectedId={selectedBoxId}
                activeLabel={activeLabel}
                onSelect={setSelectedBoxId}
                onBBoxChange={(newBboxes) => commitChange(() => newBboxes)}
              />
            ) : (
              <div className={`w-full h-full flex items-center justify-center ${isDark ? "text-white/30" : "text-outline"} text-body`}>
                上传图片开始标注
              </div>
            )}
          </div>
          <AnnotationToolbar
            activeLabel={activeLabel}
            onLabelChange={setActiveLabel}
            canUndo={history.length > 0}
            onUndo={handleUndo}
            onDeleteSelected={handleDeleteSelected}
            hasSelection={!!selectedBoxId}
            onFitToView={() => canvasRef.current?.fitToView()}
            onExport={handleExport}
            scale={canvasScale}
            onPrev={handlePrev}
            onNext={handleNext}
            imageIndex={currentIndex}
            imageTotal={images.length}
            onSubmit={handleSubmit}
            onInvalid={handleInvalid}
          />
        </div>

        {/* Right panel */}
        <PropertyPanel
          bboxes={bboxes}
          selectedId={selectedBoxId}
          activeLabel={activeLabel}
          onSelect={setSelectedBoxId}
          onLabelChange={handleLabelChange}
          onDelete={handleDelete}
          onActiveLabelChange={setActiveLabel}
        />
      </div>
    </div>
  );
}
