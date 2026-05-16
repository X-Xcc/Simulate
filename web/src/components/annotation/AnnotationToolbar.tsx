import { Undo2, Trash2, Maximize, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import type { LabelOption } from "../../types";
import { LABEL_OPTIONS } from "../../types";

interface AnnotationToolbarProps {
  activeLabel: LabelOption;
  onLabelChange: (label: LabelOption) => void;
  canUndo: boolean;
  onUndo: () => void;
  onDeleteSelected: () => void;
  hasSelection: boolean;
  onFitToView: () => void;
  onExport: (format: "yolo" | "coco") => void;
  scale: number;
  onPrev: () => void;
  onNext: () => void;
  imageIndex: number;
  imageTotal: number;
  onSubmit: () => void;
  onInvalid: () => void;
}

export default function AnnotationToolbar({
  activeLabel,
  onLabelChange,
  canUndo,
  onUndo,
  onDeleteSelected,
  hasSelection,
  onFitToView,
  onExport,
  scale,
  onPrev,
  onNext,
  imageIndex,
  imageTotal,
  onSubmit,
  onInvalid,
}: AnnotationToolbarProps) {
  return (
    <div className="h-11 bg-white border-t border-outline-variant flex items-center justify-between px-4 shrink-0">
      {/* Left: navigation */}
      <div className="flex items-center gap-2">
        <button onClick={onPrev} disabled={imageIndex <= 0}
          className="p-1.5 rounded hover:bg-surface-container-low disabled:opacity-30 transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="text-body-sm font-mono text-outline tabular-nums min-w-[60px] text-center">
          {imageIndex + 1} / {imageTotal}
        </span>
        <button onClick={onNext} disabled={imageIndex >= imageTotal - 1}
          className="p-1.5 rounded hover:bg-surface-container-low disabled:opacity-30 transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Center: tools */}
      <div className="flex items-center gap-1">
        {/* Label quick-select */}
        {LABEL_OPTIONS.map(label => (
          <button
            key={label.id}
            onClick={() => onLabelChange(label)}
            className={cn(
              "px-2.5 py-1 rounded text-caption font-semibold transition-all",
              activeLabel.id === label.id
                ? "text-white"
                : "text-on-surface-variant hover:bg-surface-container-low"
            )}
            style={activeLabel.id === label.id ? { backgroundColor: label.color } : {}}
          >
            {label.name}
          </button>
        ))}

        <div className="w-px h-5 bg-outline-variant mx-1" />

        <button onClick={onUndo} disabled={!canUndo}
          className="p-1.5 rounded hover:bg-surface-container-low disabled:opacity-30 transition-colors"
          title="撤销 (Ctrl+Z)">
          <Undo2 size={15} />
        </button>
        <button onClick={onDeleteSelected} disabled={!hasSelection}
          className="p-1.5 rounded hover:bg-surface-container-low disabled:opacity-30 transition-colors text-danger-red"
          title="删除选中 (Delete)">
          <Trash2 size={15} />
        </button>
        <button onClick={onFitToView}
          className="p-1.5 rounded hover:bg-surface-container-low transition-colors"
          title="适应画布 (F)">
          <Maximize size={15} />
        </button>
      </div>

      {/* Right: zoom + export */}
      <div className="flex items-center gap-2">
        <span className="text-caption font-mono text-outline tabular-nums">
          {(scale * 100).toFixed(0)}%
        </span>
        <div className="w-px h-5 bg-outline-variant" />
        <button onClick={() => onExport("yolo")}
          className="px-2.5 py-1 bg-primary text-white rounded text-caption font-semibold hover:bg-primary/80 transition-colors flex items-center gap-1">
          <Download size={12} /> YOLO
        </button>
        <button onClick={() => onExport("coco")}
          className="px-2.5 py-1 bg-surface-container-low border border-outline-variant rounded text-caption font-semibold hover:bg-surface-container transition-colors flex items-center gap-1">
          <Download size={12} /> COCO
        </button>
        <div className="w-px h-5 bg-outline-variant" />
        <button onClick={onSubmit}
          className="px-3 py-1 bg-primary text-white rounded text-caption font-semibold hover:bg-primary/80 transition-colors">
          提交
        </button>
        <button onClick={onInvalid}
          className="px-3 py-1 text-outline hover:bg-surface-container-low rounded text-caption font-semibold transition-colors">
          无效
        </button>
      </div>
    </div>
  );
}
