import { useState, useEffect, useRef, useCallback } from "react";
import {
  VideoOff, Loader2, CameraOff,
  AlertTriangle, Volume2, CheckCircle2,
} from "lucide-react";
import { cn } from "../lib/utils";
import { fetchCameras, takeScreenshot } from "../services/dataService";
import { useAlarmSound } from "../hooks/useAlarmSound";
import { useMockStore } from "../lib/mockStore";
import { Camera, Alert, AlertLevel, AlertType } from "../types";

type GridMode = 2 | 4 | 6;
type AlarmType = "fight" | "fall" | "suicide" | "gathering";

// ── 报警类型配置 ──

const ALARM_CONFIGS: Record<AlarmType, {
  hex: string; label: string; msg: string;
}> = {
  fight: {
    hex: "#c13737", label: "打架报警",
    msg: "区域 A 检测到打架行为 — 连续拳击动作，双方肢体冲突特征明显",
  },
  fall: {
    hex: "#f97316", label: "跌倒报警",
    msg: "区域 B 检测到跌倒事件 — 人员姿态异常，身体重心急剧下降",
  },
  suicide: {
    hex: "#7c3aed", label: "自杀报警",
    msg: "区域 C 检测到自残风险 — 异常姿态动作，疑似自我伤害行为",
  },
  gathering: {
    hex: "#eab308", label: "异常聚集报警",
    msg: "区域 D 检测到异常聚集 — 同一区域人数超过阈值，持续聚集",
  },
};

// AlarmType → (AlertType, AlertLevel) 映射
const ALARM_TO_ALERT: Record<AlarmType, { type: AlertType; level: AlertLevel }> = {
  fight:     { type: AlertType.FIGHT,  level: AlertLevel.CRITICAL },
  fall:      { type: AlertType.FALL,   level: AlertLevel.WARNING },
  suicide:   { type: AlertType.FIGHT,  level: AlertLevel.CRITICAL },
  gathering: { type: AlertType.CROWD,  level: AlertLevel.MINOR },
};

// ── 实时截帧 ──────────────────────────────────────────────────────────────

/** 从摄像头槽位捕获当前帧，返回 base64 jpeg data URL；失败返回 null */
function captureFrame(slotId: string): string | null {
  try {
    const slot = document.getElementById(slotId);
    if (!slot) return null;

    // 优先找 <video>（LiveCameraSlot）
    const video = slot.querySelector("video") as HTMLVideoElement | null;
    if (video && video.readyState >= 2 && video.videoWidth > 0) {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      return canvas.toDataURL("image/jpeg", 0.85);
    }

    // 回退到 <img>（MJPEG 流 / video_feed）
    const img = slot.querySelector("img") as HTMLImageElement | null;
    if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      try {
        ctx.drawImage(img, 0, 0);
        return canvas.toDataURL("image/jpeg", 0.85);
      } catch {
        // 跨域 <img> 会被 canvas 污染，忽略走 fallback
        return null;
      }
    }
  } catch {
    // 任何异常都静默回退
  }
  return null;
}

// ── 报警覆盖层（单个弹窗） ──

function AlarmCard({ alarmType, onAck }: { alarmType: AlarmType; onAck: () => void }) {
  const cfg = ALARM_CONFIGS[alarmType];
  const c = cfg.hex;
  return (
    <div className="bg-white rounded-xl shadow-2xl max-w-[320px] w-[85%] overflow-hidden animate-fade-in-up"
      style={{ border: `2px solid ${c}`, boxShadow: `0 0 20px ${c}80, 0 0 60px ${c}40` }}>
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ backgroundColor: c }}>
        <AlertTriangle size={18} className="text-white animate-pulse" />
        <div className="flex-1">
          <h3 className="text-white font-bold text-body-sm">{cfg.label}</h3>
          <p className="text-white/80 text-[10px]">检测到异常行为，请立即处理</p>
        </div>
        <Volume2 size={16} className="text-white animate-pulse" />
      </div>
      <div className="p-4 space-y-3">
        <div className="border rounded-lg p-3" style={{ backgroundColor: `${c}0d`, borderColor: `${c}33` }}>
          <p className="font-semibold text-caption" style={{ color: c }}>{cfg.msg}</p>
        </div>
        <button onClick={onAck}
          className="w-full py-2 rounded-lg font-bold text-caption text-white transition-all active:scale-95 shadow-lg flex items-center justify-center gap-1.5 hover:opacity-90"
          style={{ backgroundColor: c, boxShadow: `0 4px 14px ${c}4d` }}>
          <CheckCircle2 size={15} /> 确认处理
        </button>
      </div>
    </div>
  );
}

// ── 报警覆盖层（多个报警叠加） ──

function AlarmOverlay({ alarms, onAck }: { alarms: AlarmType[]; onAck: (type: AlarmType) => void }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center backdrop-blur-[2px]"
      style={{ animation: "alarm-flash-overlay 0.6s ease-in-out infinite" }}>
      <div className="flex flex-col items-center gap-2">
        {alarms.map(type => (
          <AlarmCard key={type} alarmType={type} onAck={() => onAck(type)} />
        ))}
      </div>
    </div>
  );
}

// ── 主组件 ──

export default function Monitor() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [gridMode, setGridMode] = useState<GridMode>(2);
  const [activeAlarms, setActiveAlarms] = useState<Set<AlarmType>>(new Set());

  useAlarmSound(activeAlarms.size > 0);

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

  const handleAlarmTrigger = useCallback(async (type: AlarmType) => {
    setActiveAlarms(prev => {
      const next = new Set(prev);
      next.add(type);
      return next;
    });

    // 本地截帧（用于 Monitor 页面弹窗即时展示）
    const captured = captureFrame("cam-slot-0") || captureFrame("cam-slot-empty") || "";

    const { type: alertType, level } = ALARM_TO_ALERT[type];
    const cfg = ALARM_CONFIGS[type];
    const cam = cameras[0];
    const alert: Alert = {
      id: `ALT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      cameraId: cam?.id ?? "cam-001",
      cameraName: cam?.name ?? "视频1",
      type: alertType,
      level,
      time: new Date().toISOString(),
      snapshotUrl: captured,
      status: "pending",
      confidence: +(85 + Math.random() * 14).toFixed(1),
      duration: "00:00:00",
      message: cfg.msg,
    };
    useMockStore.getState().addAlert(alert);

    // 等后端截图写盘完成后再触发 Evidence 刷新，避免 404 竞态
    try {
      await takeScreenshot(type);
    } catch (err) {
      console.warn("截图失败:", err);
    }
    useMockStore.setState(s => ({ evidenceBump: s.evidenceBump + 1 }));
  }, [cameras]);

  const handleAlarmAcknowledge = useCallback((type: AlarmType) => {
    setActiveAlarms(prev => {
      const next = new Set(prev);
      next.delete(type);
      return next;
    });
  }, []);

  // Alt+X/C/V/B 快捷键触发报警
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      console.log("[alarm-hotkey]", e.key, "alt=", e.altKey);
      if (!e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      const map: Record<string, AlarmType> = { x: "fight", c: "fall", v: "suicide", b: "gathering" };
      const type = map[e.key.toLowerCase()];
      if (type) { e.preventDefault(); console.log("[alarm-hotkey] triggered:", type); handleAlarmTrigger(type); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleAlarmTrigger]);

  const gridCols: Record<GridMode, string> = { 2: "grid-cols-2", 4: "grid-cols-2", 6: "grid-cols-3" };
  const gridRows: Record<GridMode, string> = { 2: "grid-rows-1", 4: "grid-rows-2", 6: "grid-rows-2" };

  const visibleCameras = cameras.slice(0, gridMode);
  const slots = Array.from({ length: gridMode }, (_, i) => visibleCameras[i] ?? null);

  const getDisplayName = (cam: Camera) => {
    const idx = cameras.findIndex(c => c.id === cam.id);
    return `视频${idx + 1}`;
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-3 animate-fade-in-up">
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
          <div className="flex flex-col h-full min-h-0 gap-1.5">
            <div className={cn("grid gap-1.5 flex-1 min-h-0", gridCols[gridMode], gridRows[gridMode])}>
              {slots.map((cam, i) => {
                if (i === 0) {
                  return <LiveCameraSlot key="live" name="视频1 (本地)" activeAlarms={activeAlarms} onAck={handleAlarmAcknowledge} />;
                }
                return cam ? (
                  <CameraSlot
                    key={cam.id}
                    name={getDisplayName(cam)}
                    streamUrl={cam.streamUrl}
                    isOnline={cam.status === "online"}
                    go2rtcId={cam.go2rtcId}
                    cameraId={cam.id}
                  />
                ) : (
                  <EmptySlot key={`e-${i}`} index={i} isFirstEmpty={i === visibleCameras.length}
                    activeAlarms={activeAlarms} onAck={handleAlarmAcknowledge} />
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ── 空槽位 ──

function EmptySlot({ index, isFirstEmpty, activeAlarms, onAck }: {
  index: number; isFirstEmpty: boolean; activeAlarms: Set<AlarmType>; onAck: (type: AlarmType) => void;
}) {
  if (isFirstEmpty) {
    return (
      <div id="cam-slot-empty" className="relative bg-zinc-900/80 rounded-lg border border-white/[0.04] overflow-hidden group hover:border-primary/40 hover:shadow-[0_0_20px_rgba(26,86,219,0.15)] transition-all duration-300">
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
        {activeAlarms.size > 0 && (
          <AlarmOverlay alarms={[...activeAlarms]} onAck={onAck} />
        )}
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

function LiveCameraSlot({ name, activeAlarms, onAck }: {
  name: string; activeAlarms: Set<AlarmType>; onAck: (type: AlarmType) => void;
}) {
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
      streamRef.current?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    };
  }, []);

  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div id="cam-slot-0" className="relative bg-zinc-900 rounded-lg overflow-hidden group border border-white/[0.04] hover:border-primary/40 hover:shadow-[0_0_20px_rgba(26,86,219,0.15)] transition-all duration-300">
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
      {activeAlarms.size > 0 && (
        <AlarmOverlay alarms={[...activeAlarms]} onAck={onAck} />
      )}
    </div>
  );
}

// ── 摄像头卡片 ──

function CameraSlot({
  name, streamUrl, isOnline, go2rtcId, cameraId,
}: {
  name: string;
  streamUrl: string;
  isOnline: boolean;
  go2rtcId?: string;
  cameraId: string;
}) {
  const [now, setNow] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasGo2rtc = !!go2rtcId;
  const go2rtcUrl = `http://${window.location.hostname}:1984/ui.html?src=${go2rtcId || "cam_" + cameraId}`;
  const fallbackUrl = `/video_feed?cam=${cameraId}`;

  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!hasGo2rtc) return;
    loadTimerRef.current = setTimeout(() => {
      setLoadFailed(true);
    }, 3000);
    return () => {
      if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    };
  }, [hasGo2rtc]);

  const handleIframeLoad = () => {
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
  };

  return (
    <div id={`cam-slot-${cameraId}`} className="relative bg-zinc-900 rounded-lg overflow-hidden group border border-white/[0.04] hover:border-primary/40 hover:shadow-[0_0_20px_rgba(26,86,219,0.15)] transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900"
        style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.015) 10px, rgba(255,255,255,0.015) 20px)" }} />
      {hasGo2rtc && !loadFailed ? (
        <iframe
          src={go2rtcUrl}
          className="absolute inset-0 w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin"
          allow="autoplay"
          onLoad={handleIframeLoad}
        />
      ) : (
        <img
          src={fallbackUrl}
          alt={name}
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
        <span className={cn("w-2 h-2 rounded-full", isOnline ? "bg-success-green animate-pulse" : "bg-outline")} />
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
