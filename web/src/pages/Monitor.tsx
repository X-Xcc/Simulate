import { useState, useEffect, useRef, useCallback } from "react";
import {
  VideoOff, Loader2, CameraOff,
} from "lucide-react";
import { cn } from "../lib/utils";
import { fetchCameras } from "../services/dataService";
import { Camera } from "../types";

type GridMode = 2 | 4 | 6;

export default function Monitor() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);

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
    const iv = setInterval(load, 10000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  // 网格模式，默认2窗口
  const [gridMode, setGridMode] = useState<GridMode>(2);

  const gridCols: Record<GridMode, string> = { 2: "grid-cols-2", 4: "grid-cols-2", 6: "grid-cols-3" };
  const gridRows: Record<GridMode, string> = { 2: "grid-rows-1", 4: "grid-rows-2", 6: "grid-rows-2" };

  const visibleCameras = cameras.slice(0, gridMode);
  // 始填满 gridMode 个槽位（不足的用空位占位）
  const slots = Array.from({ length: gridMode }, (_, i) => visibleCameras[i] ?? null);

  // 摄像头显示名称：视频1、视频2...
  const getDisplayName = (cam: Camera) => {
    const idx = cameras.findIndex(c => c.id === cam.id);
    return `视频${idx + 1}`;
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-3 animate-fade-in-up">
      {/* 顶栏 */}
      <header className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {([2, 4, 6] as GridMode[]).map(n => (
            <button key={n} onClick={() => setGridMode(n)}
              className={cn(
                "h-8 px-3 rounded-lg text-caption font-semibold border transition-all",
                gridMode === n
                  ? "bg-primary text-white border-primary"
                  : "bg-white border-outline-variant text-on-surface-variant hover:bg-surface-container-high"
              )}>
              {n === 2 ? "2窗口" : n === 4 ? "4窗口" : "6窗口"}
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
        ) : (
          <div className={cn("grid gap-1.5 h-full", gridCols[gridMode], gridRows[gridMode])}>
            {slots.map((cam, i) => {
              if (i === 0) {
                return <LiveCameraSlot key="live" name="视频1 (本地)" />;
              }
              return cam ? (
                <CameraSlot
                  key={cam.id}
                  name={getDisplayName(cam)}
                  streamUrl={cam.streamUrl}
                  isOnline={cam.status === "online"}
                />
              ) : (
                <EmptySlot key={`e-${i}`} index={i} isFirstEmpty={i === visibleCameras.length} />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

// ── 空槽位 ──

function EmptySlot({ index, isFirstEmpty }: { index: number; isFirstEmpty: boolean }) {
  if (isFirstEmpty) {
    return (
      <div className="relative bg-zinc-900/80 rounded-lg border border-white/[0.04] overflow-hidden group hover:border-primary/40 hover:shadow-[0_0_20px_rgba(26,86,219,0.15)] transition-all duration-300">
        <img
          src="/video_feed?cam=0"
          alt="检测流"
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-success-green animate-pulse" />
          <span className="px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded text-white/80 text-caption font-mono font-semibold">
            检测流
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-zinc-900/80 rounded-lg border border-white/[0.04] flex items-center justify-center">
      <div className="text-center">
        <VideoOff size={32} className="mx-auto text-white/[0.06]" />
        <span className="block mt-1 text-white/15 text-caption">视频{index + 1}</span>
      </div>
    </div>
  );
}

// ── 本地实时摄像头 ──

function LiveCameraSlot({ name }: { name: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState("");

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setError(null);
    } catch (e: any) {
      const name = e?.name ?? "";
      if (name === "NotAllowedError") {
        setError("摄像头权限被拒绝，请在浏览器设置中允许访问");
      } else if (name === "NotFoundError") {
        setError("未检测到摄像头设备");
      } else {
        setError(`摄像头错误: ${e?.message ?? "未知错误"}`);
      }
    }
  }, []);

  useEffect(() => { startCamera(); }, [startCamera]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="relative bg-zinc-900 rounded-lg overflow-hidden group border border-white/[0.04] hover:border-primary/40 hover:shadow-[0_0_20px_rgba(26,86,219,0.15)] transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900"
        style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.015) 10px, rgba(255,255,255,0.015) 20px)" }} />
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-center px-4">
            <CameraOff size={32} className="mx-auto text-red-400/60 mb-2" />
            <p className="text-white/50 text-body-sm">{error}</p>
          </div>
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
        <span className={cn("w-2 h-2 rounded-full", error ? "bg-red-400" : "bg-success-green animate-pulse")} />
        <span className="px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded text-white/80 text-caption font-mono font-semibold">
          {name}
        </span>
      </div>
      <div className="absolute top-2 right-2 z-10">
        <span className="px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded text-white/60 text-caption font-mono tabular-nums">
          {now}
        </span>
      </div>
    </div>
  );
}

// ── 摄像头卡片（独立组件避免闭包 stale） ──

function CameraSlot({
  name, streamUrl, isOnline,
}: {
  name: string;
  streamUrl: string;
  isOnline: boolean;
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
      {streamUrl ? (
        <img
          src={streamUrl}
          alt={name}
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <VideoOff size={28} className="mx-auto text-white/[0.08]" />
            <span className="block mt-1 text-white/20 text-caption">无视频源</span>
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
    </div>
  );
}
