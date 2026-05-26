// 模型微调界面 — 上传训练素材 + 配置参数 + 实时监控训练进度
// 演讲提示: "前端通过SSE实时接收训练日志和指标，
//           用户可以看到loss下降、mAP上升的过程"
import { useState, useRef, useCallback, useEffect } from "react";
import {
  Play, Square, Upload, Loader2, BrainCircuit,
  TerminalSquare, Image as ImageIcon, FileVideo,
  Cpu, Gauge, Activity, Timer, BookOpen,
  CheckCircle2, X, Download, BarChart3,
} from "lucide-react";
import { cn } from "../lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { apiUpload } from "../lib/api";
import type { TrainingStatus, TrainingLog } from "../types";

// --- Mock Training Hook ---

const LOG_POOL: Array<{ level: TrainingLog["level"]; msg: string }> = [
  { level: "TRAIN", msg: "模型加载完成: YOLOv8n-pose (5.9M params, 17 keypoints)" },
  { level: "DATA", msg: "数据集扫描完成: 发现 326 张训练图片, 82 张验证图片" },
  { level: "DATA", msg: "数据增强配置: Mosaic=0.5, MixUp=0.1, HSV=(0.015, 0.7, 0.4)" },
  { level: "INFO", msg: "Epoch 1/50 完成: train_loss=0.892, val_loss=0.914, mAP50=0.012" },
  { level: "INFO", msg: "Epoch 5/50 完成: train_loss=0.534, val_loss=0.601, mAP50=0.156" },
  { level: "INFO", msg: "Epoch 10/50 完成: train_loss=0.298, val_loss=0.352, mAP50=0.342" },
  { level: "INFO", msg: "Epoch 20/50 完成: train_loss=0.112, val_loss=0.168, mAP50=0.601" },
  { level: "INFO", msg: "Epoch 30/50 完成: train_loss=0.056, val_loss=0.094, mAP50=0.756" },
  { level: "INFO", msg: "Epoch 40/50 完成: train_loss=0.031, val_loss=0.062, mAP50=0.834" },
  { level: "WARN", msg: "学习率调整: cosine decay, lr=0.00342" },
  { level: "WARN", msg: "学习率调整: lr 衰减至 0.00081, 接近末期" },
  { level: "SYNC", msg: "GPU: RTX 5060, CUDA 12.8, 显存占用 4812MB / 8192MB" },
  { level: "SYNC", msg: "GPU 温度 67°C, 推理速度 34ms/step" },
  { level: "DATA", msg: "标签统计: 跌倒 89 例, 打架 56 例, 自杀 102 例, 聚集 79 例" },
];

// 模拟训练指标的数学模型（演示用）
// loss: 指数衰减 y=e^(-0.03x)
// mAP50: S型曲线 y=1/(1+e^(-0.08(x-60)))
// LR: 余弦退火
function useMockTraining(totalEpochs: number) {
  const [status, setStatus] = useState<TrainingStatus["status"]>("idle");
  const [logs, setLogs] = useState<TrainingLog[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const epochRef = useRef(0);
  const logIdxRef = useRef(0);
  const startTimeRef = useRef(0);
  const gpuMemoryRef = useRef(3200 + Math.floor(Math.random() * 1600));

  const stop = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    const final = epochRef.current >= totalEpochs ? "completed" : "idle";
    setStatus(final);
  }, [totalEpochs]);

  const start = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    epochRef.current = 0;
    logIdxRef.current = 0;
    startTimeRef.current = Date.now();
    setLogs([]);
    setStatus("running");

    intervalRef.current = setInterval(() => {
      epochRef.current += 1;
      const epoch = epochRef.current;
      const progress = epoch / totalEpochs;
      gpuMemoryRef.current = 3200 + Math.floor(Math.random() * 1600);

      if (epoch >= totalEpochs) {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        setStatus("completed");
      }

      // Random log append (35% chance)
      if (Math.random() < 0.35 && logIdxRef.current < LOG_POOL.length) {
        const entry = LOG_POOL[logIdxRef.current];
        logIdxRef.current += 1;
        setLogs(prev => [...prev, {
          level: entry.level,
          message: entry.msg,
          timestamp: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
        }]);
      }
    }, 100);
  }, [totalEpochs]);

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // Compute live metrics from epoch ref
  const epoch = epochRef.current;
  const progress = totalEpochs > 0 ? epoch / totalEpochs : 0;
  const loss = 0.04 + 0.96 * Math.exp(-4 * progress);
  const map50 = 0.89 / (1 + Math.exp(-10 * (progress - 0.3)));
  const lr = 0.0001 + 0.0099 * (1 + Math.cos(Math.PI * progress)) / 2;
  const elapsedSec = status === "idle" ? 0 : Math.round((Date.now() - startTimeRef.current) / 1000);
  const etaSec = progress > 0 ? Math.round(elapsedSec / progress * (1 - progress)) : 0;

  const trainingStatus: TrainingStatus = {
    status,
    current_epoch: epoch,
    total_epochs: totalEpochs,
    learning_rate: lr,
    map50,
    loss,
    elapsed_seconds: elapsedSec,
    eta_seconds: etaSec,
    gpu_memory_mb: gpuMemoryRef.current,
  };

  return { status: trainingStatus, logs, start, stop };
}

// --- Helpers ---

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function LogLevelTag({ level }: { level: TrainingLog["level"] }) {
  const colors: Record<string, string> = {
    INFO: "text-success-green",
    TRAIN: "text-primary",
    DATA: "text-white/40",
    WARN: "text-danger-red",
    SYNC: "text-info-cyan",
  };
  return <span className={cn("shrink-0 font-mono text-[10px] font-bold", colors[level])}>[{level}]</span>;
}

const SCENE_TAGS = ["监舍走廊", "夜间场景", "操场", "食堂", "车间"];

// --- Component ---

export default function ModelTraining() {
  const [totalEpochs, setTotalEpochs] = useState(50);
  const [prompt, setPrompt] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const { status, logs, start, stop } = useMockTraining(totalEpochs);

  const isTraining = status.status === "running";
  const isCompleted = status.status === "completed";
  const canStart = uploadDone && !isTraining;
  const progressPct = totalEpochs > 0 ? Math.round((status.current_epoch / totalEpochs) * 100) : 0;

  // ── 训练完成弹窗 ───────────────────────────────────────────────────────
  const [showDoneDialog, setShowDoneDialog] = useState(false);
  const prevStatusRef = useRef<TrainingStatus["status"]>("idle");

  useEffect(() => {
    if (prevStatusRef.current === "running" && status.status === "completed") {
      setShowDoneDialog(true);
    }
    prevStatusRef.current = status.status;
  }, [status.status]);

  // Auto-scroll logs
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  // Cleanup preview URL
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const uploadFile = async (file: File) => {
    // Revoke old preview
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setUploadedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);
    setUploadProgress(0);
    setUploadDone(false);
    setUploadError(null);

    try {
      await apiUpload("/api/upload_training_resource", file, (pct) => {
        setUploadProgress(pct);
      });
      setUploadDone(true);
    } catch (err: any) {
      setUploadDone(false);
      setUploadError(err?.message || "上传失败");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = Array.from(e.dataTransfer.files)[0];
    if (file) uploadFile(file);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFile(e.target.files[0]);
      e.target.value = "";
    }
  }, []);

  const appendTag = (tag: string) => {
    setPrompt(prev => prev ? prev + " " + tag : tag);
  };

  const isImage = uploadedFile?.type.startsWith("image");
  const isVideo = uploadedFile?.type.startsWith("video");

  return (
    <div className="space-y-5 max-w-[1600px] mx-auto pb-8 animate-fade-in-up">

      <div className="flex flex-col lg:flex-row gap-5">
        {/* 左侧面板 */}
        <aside className="w-full lg:w-[340px] bg-white border border-outline-variant rounded-xl p-4 flex flex-col gap-4 shrink-0 shadow-sm">

          {/* 资源上传区 */}
          <div>
            <h2 className="text-heading font-bold flex items-center gap-2">
              <Upload size={18} className="text-primary" /> 资源上传
            </h2>
            <p className="text-caption text-outline mt-0.5">上传 1 个视频或图片素材</p>
          </div>
          <div
            className={cn(
              "min-h-[160px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-4 cursor-pointer transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-outline-variant hover:border-primary/50",
              uploading && "pointer-events-none opacity-60"
            )}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" accept="video/*,image/*" className="hidden" onChange={handleFileSelect} />
            {uploading ? (
              <>
                <Loader2 size={24} className="animate-spin text-primary mb-2" />
                <span className="font-semibold text-body-sm">上传中...</span>
                <div className="w-3/4 h-1.5 bg-surface-container-high rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
                </div>
                <span className="text-caption text-outline mt-1">{uploadProgress}%</span>
              </>
            ) : uploadedFile && previewUrl ? (
              <>
                {isImage ? (
                  <img src={previewUrl} alt={uploadedFile.name} className="w-full max-h-[120px] object-contain rounded-lg mb-2" />
                ) : isVideo ? (
                  <video src={previewUrl} muted loop autoPlay className="w-full max-h-[120px] object-contain rounded-lg mb-2" />
                ) : (
                  <FileVideo size={24} className="text-primary/40 mb-2" />
                )}
                <span className="font-semibold text-body-sm text-on-surface truncate max-w-full">{uploadedFile.name}</span>
                <span className="text-caption text-outline">{formatSize(uploadedFile.size)}</span>
                {uploadDone && <span className="text-caption text-success-green font-semibold mt-1">上传完成</span>}
                {uploadError && <span className="text-caption text-danger-red font-semibold mt-1">{uploadError}</span>}
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center mb-2">
                  <Upload size={20} />
                </div>
                <span className="font-semibold text-body-sm">上传训练素材</span>
                <p className="text-caption text-outline mt-1">拖拽或<span className="text-primary font-semibold">点击选择</span></p>
              </>
            )}
          </div>

          {/* 场景描述 */}
          <div>
            <h3 className="text-caption font-semibold text-outline mb-1.5 flex items-center gap-1.5">
              <BookOpen size={14} /> 场景描述 (Prompt Tuning)
            </h3>
            <textarea
              value={prompt}
              onChange={e => { if (e.target.value.length <= 2048) setPrompt(e.target.value); }}
              placeholder="请输入针对该视频场景的微调指令或行为描述词..."
              className="w-full h-20 bg-surface-container-low rounded-lg border border-outline-variant p-2.5 text-body-sm resize-none focus:outline-none focus:border-primary transition-colors placeholder:text-outline"
            />
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {SCENE_TAGS.map(tag => (
                <button key={tag} onClick={() => appendTag(tag)}
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-container-high text-on-surface-variant hover:bg-primary/10 hover:text-primary transition-colors border border-outline-variant">
                  {tag}
                </button>
              ))}
            </div>
            <div className="text-right text-[10px] text-outline mt-1 tabular-nums">{prompt.length}/2048</div>
          </div>

          {/* 训练参数 — epochs滑块(1-200) + 场景描述输入
              演讲提示: "用户描述监控场景如'夜间走廊光线较暗'，帮助模型适配" */}
          <div>
            <h3 className="text-caption font-semibold text-outline mb-1.5 flex items-center gap-1.5">
              <Gauge size={14} /> 训练参数
            </h3>
            <div className="flex items-center gap-3">
              <label className="text-caption text-on-surface-variant shrink-0">Epochs</label>
              <input type="range" min={1} max={200} value={totalEpochs}
                onChange={e => setTotalEpochs(Number(e.target.value))}
                className="flex-1 accent-primary h-1" />
              <span className="bg-primary/10 text-primary font-mono text-caption font-bold px-2 py-0.5 rounded-full tabular-nums">{totalEpochs}</span>
            </div>
            <div className="bg-info-cyan/5 border border-info-cyan/20 rounded-lg px-3 py-2 mt-2 text-caption text-info-cyan">
              建议初始训练设为 40-60 epochs（当前 {totalEpochs}），观察收敛后再调整
            </div>
          </div>

          {/* 启动按钮 */}
          <button
            onClick={isTraining ? stop : start}
            disabled={!canStart && !isTraining}
            className={cn(
              "w-full py-2.5 rounded-xl font-semibold text-body shadow-sm transition-all flex items-center justify-center gap-2",
              isTraining
                ? "bg-danger-red text-white hover:bg-red-700 active:scale-95"
                : canStart
                  ? "bg-primary text-white hover:shadow-md active:scale-95"
                  : "bg-surface-container-high text-outline cursor-not-allowed"
            )}
          >
            {isTraining
              ? <><Square size={14} /> 停止训练</>
              : isCompleted
                ? <><Play size={16} /> 重新训练</>
                : <><Play size={16} /> 开始训练</>
            }
          </button>
        </aside>

        {/* 右侧主区域 */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">

          {/* 训练进度条 */}
          <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-caption font-semibold text-outline">训练进度</span>
              <span className="font-mono text-caption text-primary font-bold tabular-nums">{progressPct}%</span>
            </div>
            <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
              <div className={cn(
                "h-full rounded-full transition-all duration-100",
                isCompleted ? "bg-success-green" : isTraining ? "bg-primary animate-pulse" : "bg-primary"
              )} style={{ width: `${progressPct}%` }} />
            </div>
            <div className="flex justify-between mt-1 text-caption text-outline">
              <span>{isTraining ? "训练中..." : isCompleted ? "训练完成" : "等待开始"}</span>
              <span className="tabular-nums">已用 {formatDuration(status.elapsed_seconds)}</span>
            </div>
          </div>

          {/* 指标卡片 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Current Epoch */}
            <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Activity size={13} className="text-primary" />
                <span className="text-[10px] font-semibold text-outline uppercase tracking-wide">Current Epoch</span>
              </div>
              <div className="font-mono text-body-sm font-bold tabular-nums">{status.current_epoch}/{status.total_epochs}</div>
            </div>

            {/* Learning Rate */}
            <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Gauge size={13} className="text-info-cyan" />
                <span className="text-[10px] font-semibold text-outline uppercase tracking-wide">Learning Rate</span>
              </div>
              <div className="font-mono text-body-sm font-bold tabular-nums">{status.learning_rate.toFixed(6)}</div>
            </div>

            {/* mAP@.5 */}
            <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Cpu size={13} className="text-success-green" />
                <span className="text-[10px] font-semibold text-outline uppercase tracking-wide">mAP@.5</span>
              </div>
              <div className="font-mono text-body-sm font-bold tabular-nums">{status.map50.toFixed(4)}</div>
            </div>

            {/* Loss */}
            <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Activity size={13} className="text-warning-orange" />
                <span className="text-[10px] font-semibold text-outline uppercase tracking-wide">Loss</span>
              </div>
              <div className="font-mono text-body-sm font-bold tabular-nums">{status.loss.toFixed(4)}</div>
            </div>

            {/* Remaining */}
            <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Timer size={13} className="text-detect-purple" />
                <span className="text-[10px] font-semibold text-outline uppercase tracking-wide">Remaining</span>
              </div>
              <div className="font-mono text-body-sm font-bold tabular-nums">{formatDuration(status.eta_seconds)}</div>
            </div>
          </div>

          {/* 实时日志终端 */}
          <div className="bg-dark-bg rounded-xl border border-white/10 shadow-lg flex flex-col overflow-hidden" style={{ height: 300 }}>
            <div className="bg-black/40 px-3 py-2 border-b border-white/10 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-1.5">
                <TerminalSquare size={12} className="text-success-green" />
                <span className="text-white font-semibold text-caption">训练日志</span>
              </div>
              <div className="flex items-center gap-1">
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isTraining ? "bg-success-green animate-pulse" : "bg-white/20"
                )} />
                <span className={cn(
                  "font-bold text-[10px] tracking-wider",
                  isTraining ? "text-success-green" : "text-white/30"
                )}>
                  {isTraining ? "LIVE" : "IDLE"}
                </span>
              </div>
            </div>
            <div className="p-3 flex-1 font-mono text-[11px] space-y-0.5 overflow-y-auto custom-scrollbar">
              {logs.length === 0 ? (
                <div className="flex items-center justify-center h-full text-white/15 text-body-sm">
                  点击"开始训练"后，日志将在此实时滚动
                </div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="flex gap-2">
                    <LogLevelTag level={log.level} />
                    <span className="text-white/30 shrink-0 tabular-nums">{log.timestamp}</span>
                    <span className={cn("text-white/60", log.level === "WARN" && "text-danger-red font-bold")}>{log.message}</span>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </div>

      {/* 训练完成弹窗 */}
      <AnimatePresence>
        {showDoneDialog && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
            onClick={() => setShowDoneDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-[440px] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* 渐变横幅 */}
              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={24} className="text-white" />
                  <div>
                    <div className="text-white font-bold text-lg">训练完成</div>
                    <div className="text-white/70 text-body-sm">模型已成功完成微调</div>
                  </div>
                </div>
                <button onClick={() => setShowDoneDialog(false)} className="text-white/80 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              {/* 指标卡片 */}
              <div className="grid grid-cols-3 gap-3 px-6 py-5">
                <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                  <BarChart3 size={18} className="text-emerald-500 mx-auto mb-1" />
                  <div className="font-mono font-bold text-body text-gray-800">{status.map50.toFixed(4)}</div>
                  <div className="text-[10px] text-gray-500 font-semibold">mAP@0.5</div>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
                  <Activity size={18} className="text-amber-500 mx-auto mb-1" />
                  <div className="font-mono font-bold text-body text-gray-800">{status.loss.toFixed(4)}</div>
                  <div className="text-[10px] text-gray-500 font-semibold">Final Loss</div>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                  <Timer size={18} className="text-blue-500 mx-auto mb-1" />
                  <div className="font-mono font-bold text-body text-gray-800">{formatDuration(status.elapsed_seconds)}</div>
                  <div className="text-[10px] text-gray-500 font-semibold">训练时长</div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-3 px-6 pb-6">
                <button
                  onClick={() => { setShowDoneDialog(false); start(); }}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold text-body flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
                >
                  重新训练
                </button>
                <button
                  onClick={() => setShowDoneDialog(false)}
                  className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold text-body flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-shadow"
                >
                   确认完成
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
