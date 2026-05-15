import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Maximize2, Minimize2, Play, Pause, ChevronLeft, ChevronRight,
  VideoOff, Monitor as MonitorIcon, Clock, Loader2,
} from "lucide-react";
import { cn } from "../lib/utils";
import { fetchCameras } from "../services/dataService";
import { Camera } from "../types";

type GridMode = 1 | 4 | 9 | 16;

export default function Monitor() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();

  // 加载真实摄像头列表
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchCameras();
        if (!cancelled) { setCameras(data); setLoading(false); }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    // 每 10 秒刷新在线状态
    const iv = setInterval(load, 10000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  // 网格模式
  const [gridMode, setGridMode] = useState<GridMode>(4);
  // 全屏单卡
  const [fullscreenId, setFullscreenId] = useState<string | null>(null);
  // 时间轴
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0-100
  const animRef = useRef<number | null>(null);

  // 从 URL 参数定位摄像头（来自 Dashboard/Alerts 跳转）
  useEffect(() => {
    const camId = searchParams.get("cam");
    if (camId) {
      setFullscreenId(camId);
    }
  }, [searchParams]);

  // 播放动画：requestAnimationFrame 驱动进度条
  useEffect(() => {
    if (!isPlaying) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setProgress(p => {
        if (p >= 100) { setIsPlaying(false); return 100; }
        return Math.min(100, p + dt / 200); // ~20秒走满（demo用快一点）
      });
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [isPlaying]);

  // 进度条点击
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setProgress(Math.max(0, Math.min(100, pct)));
  }, []);

  // 格式化时间
  const formatTime = (pct: number) => {
    const totalSec = (pct / 100) * 86400;
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = Math.floor(totalSec % 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const dateStr = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });

  const gridCols: Record<GridMode, string> = { 1: "grid-cols-1", 4: "grid-cols-2", 9: "grid-cols-3", 16: "grid-cols-4" };
  const gridRows: Record<GridMode, string> = { 1: "grid-rows-1", 4: "grid-rows-2", 9: "grid-rows-3", 16: "grid-rows-4" };

  const visibleCameras = fullscreenId
    ? cameras.filter(c => c.id === fullscreenId)
    : cameras.slice(0, gridMode);
  const emptySlots = Math.max(0, (fullscreenId ? 1 : gridMode) - visibleCameras.length);

  return (
    <div className="flex flex-col h-full min-h-0 gap-3 animate-fade-in-up">
      {/* 顶栏 */}
      <header className="flex items-center justify-between shrink-0">
        <div>
          <p className="text-caption font-semibold text-outline uppercase tracking-widest mb-1">监控中心 / 实时</p>
          <h2 className="text-title font-bold tracking-tight">视频上墙</h2>
        </div>
        <div className="flex items-center gap-2">
          {([1, 4, 9, 16] as GridMode[]).map(n => (
            <button key={n} onClick={() => { setGridMode(n); setFullscreenId(null); }}
              className={cn(
                "h-8 px-3 rounded-lg text-caption font-semibold border transition-all",
                gridMode === n && !fullscreenId
                  ? "bg-primary text-white border-primary"
                  : "bg-white border-outline-variant text-on-surface-variant hover:bg-surface-container-high"
              )}>
              {n === 1 ? "1×1" : n === 4 ? "2×2" : n === 9 ? "3×3" : "4×4"}
            </button>
          ))}
        </div>
      </header>

      {/* 视频网格 */}
      <main className="flex-1 min-h-0">
        {loading ? (
          <div className="h-full flex items-center justify-center bg-zinc-900/80 rounded-lg border border-white/[0.04]">
            <div className="text-center">
              <Loader2 size={32} className="animate-spin mx-auto mb-2 text-primary" />
              <p className="text-white/40 text-body-sm">加载摄像头列表...</p>
            </div>
          </div>
        ) : cameras.length === 0 ? (
          <div className="h-full flex items-center justify-center bg-zinc-900/80 rounded-lg border border-white/[0.04]">
            <div className="text-center">
              <VideoOff size={48} className="mx-auto mb-2 text-white/[0.08]" />
              <p className="text-white/40 text-body">暂无摄像头设备</p>
              <p className="text-white/25 text-caption mt-1">请先在设备管理中添加摄像头</p>
            </div>
          </div>
        ) : (
          <div className={cn("grid gap-1.5 h-full", gridCols[gridMode], gridRows[gridMode])}>
            {visibleCameras.map(cam => (
              <CameraSlot
                key={cam.id}
                name={cam.name}
                id={cam.id}
                streamUrl={cam.streamUrl}
                isOnline={cam.status === "online"}
                isFullscreen={fullscreenId === cam.id}
                onToggleFullscreen={() => setFullscreenId(fullscreenId === cam.id ? null : cam.id)}
                fullscreenActive={!!fullscreenId}
              />
            ))}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <div key={`e-${i}`} className="bg-zinc-900/80 rounded-lg border border-white/[0.04] flex items-center justify-center">
                <VideoOff size={32} className="text-white/[0.06]" />
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 底部时间轴 */}
      <footer className="shrink-0 bg-white border border-outline-variant rounded-xl p-3 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-body-sm text-on-surface-variant">
            <Clock size={14} className="text-outline" />
            <span className="font-mono tabular-nums">{dateStr} {formatTime(progress)} 至 23:59:59</span>
          </div>
          <span className="text-caption text-outline font-mono">{fullscreenId ? "1路" : `${gridMode}路`}画面</span>
        </div>
        {/* 进度条 */}
        <div onClick={handleProgressClick}
          className="relative h-2 bg-surface-container-high rounded-full cursor-pointer group mb-3">
          <div className="h-full bg-primary rounded-full transition-none" style={{ width: `${progress}%` }} />
          <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white border-2 border-primary rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${progress}% - 7px)` }} />
        </div>
        {/* 控制按钮 */}
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setProgress(p => Math.max(0, p - 0.5))}
            className="p-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-colors" title="上一帧">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setIsPlaying(!isPlaying)}
            className={cn("p-2.5 rounded-xl transition-all",
              isPlaying ? "bg-danger-red/10 text-danger-red hover:bg-danger-red/20" : "bg-primary text-white hover:shadow-md"
            )} title={isPlaying ? "暂停" : "播放"}>
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button onClick={() => setProgress(p => Math.min(100, p + 0.5))}
            className="p-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-colors" title="下一帧">
            <ChevronRight size={16} />
          </button>
        </div>
      </footer>
    </div>
  );
}

// ── 摄像头卡片（独立组件避免闭包 stale） ──

function CameraSlot({
  name, id, streamUrl, isOnline, isFullscreen, onToggleFullscreen, fullscreenActive,
}: {
  name: string;
  id: string;
  streamUrl: string;
  isOnline: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  fullscreenActive: boolean;
}) {
  const [now, setNow] = useState("");

  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="relative bg-zinc-900 rounded-lg overflow-hidden group border border-white/[0.04] hover:border-primary/40 hover:shadow-[0_0_20px_rgba(26,86,219,0.15)] transition-all duration-300">
      {/* 占位背景 */}
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900"
        style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.015) 10px, rgba(255,255,255,0.015) 20px)" }} />
      {/* MJPEG 视频流 */}
      {isOnline && streamUrl ? (
        <img
          src={streamUrl}
          alt={name}
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <VideoOff size={fullscreenActive ? 48 : 28} className="mx-auto text-white/[0.08]" />
            {!isOnline && <span className="block mt-1 text-white/20 text-caption">离线</span>}
          </div>
        </div>
      )}
      {/* 左上角名称 + 在线状态 */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
        <span className={cn("w-2 h-2 rounded-full", isOnline ? "bg-success-green animate-pulse" : "bg-outline")} />
        <span className="px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded text-white/80 text-caption font-mono font-semibold">
          {name}
        </span>
      </div>
      {/* 右上角时间戳 */}
      <div className="absolute top-2 right-2 z-10">
        <span className="px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded text-white/60 text-caption font-mono tabular-nums">
          {now}
        </span>
      </div>
      {/* 右下角全屏按钮 */}
      <button onClick={onToggleFullscreen}
        className="absolute bottom-2 right-2 z-10 p-1.5 bg-black/50 backdrop-blur-sm rounded text-white/50 hover:text-white hover:bg-primary/80 opacity-0 group-hover:opacity-100 transition-all"
        title={isFullscreen ? "退出全屏" : "全屏"}>
        {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </button>
    </div>
  );
}
