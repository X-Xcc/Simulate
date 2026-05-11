import { useState, useEffect } from "react";
import { 
  Maximize2, 
  Settings, 
  Bell, 
  SunMoon, 
  UserCircle, 
  Activity, 
  Shield, 
  AlertCircle,
  Users,
  VideoOff,
  SignalLow,
  CheckCircle2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";
import { subscribeToCameras, subscribeToAlerts, subscribeToCameraStats, fetchStatsSummary, subscribeToSystemStatus, fetchFpsStats, getCurrentUser } from "../services/dataService";
import { Camera, Alert, AlertLevel, CameraStatus, SystemStatus } from "../types";

export default function MonitorBigScreen() {
  const navigate = useNavigate();
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [cameraStats, setCameraStats] = useState<Record<string, number>>({});
  const [totalDetections, setTotalDetections] = useState(0);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<{name: string; role: string} | null>(null);

  useEffect(() => {
    const unsubCameras = subscribeToCameras(setCameras);
    const unsubAlerts = subscribeToAlerts(setAlerts);
    const unsubStats = subscribeToCameraStats(setCameraStats);
    const unsubStatus = subscribeToSystemStatus(setSystemStatus);
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    // Fetch total detections
    fetchStatsSummary().then((s) => {
      const counts = s?.behaviorCounts || {};
      setTotalDetections(Object.values(counts).reduce((a: number, b: any) => a + (b as number), 0));
    }).catch(() => {});

    fetchFpsStats().then(d => setFps(d.avg)).catch(console.error);
    getCurrentUser().then(setCurrentUser).catch(console.error);

    return () => {
      unsubCameras();
      unsubAlerts();
      unsubStats();
      unsubStatus();
      clearInterval(timer);
    };
  }, []);

  const activeAlerts = alerts.filter(a => a.level === AlertLevel.CRITICAL).slice(0, 5);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#080c14] text-[#ecefff] overflow-hidden font-sans select-none">
      {/* Top HUD Bar */}
      <header className="flex justify-between items-center h-[52px] px-lg w-full bg-[#080c14] border-b border-white/5 shrink-0">
        <div className="flex items-center gap-xl">
          <span className="text-title font-black text-primary tracking-tighter">长明灯</span>
          <div className="h-4 w-px bg-white/10"></div>
          <div className="flex items-center gap-lg">
            <div className="flex flex-col">
              <span className="text-body-lg text-outline font-bold uppercase tracking-widest">累计检测</span>
              <span className="font-mono text-body-lg text-primary-fixed leading-none">{totalDetections.toLocaleString()}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-body-lg text-outline font-bold uppercase tracking-widest">活跃告警</span>
              <span className="font-mono text-body-lg text-error leading-none">{alerts.length.toString().padStart(2, '0')}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-lg">
           <div className="flex items-center gap-sm px-md py-1 bg-white/5 rounded border border-white/5">
              <span className="text-body-lg text-outline font-bold">FPS</span>
              <span className="text-body-lg font-mono text-success-green">{fps ?? "—"}</span>
           </div>
           <div className="flex items-center gap-md text-outline">
              <Bell size={18} />
              <SunMoon size={18} />
              <div className="h-6 w-px bg-white/10"></div>
              <div className="flex flex-col items-end leading-none">
                 <span className="text-body-lg font-bold text-primary">{currentUser?.name ?? "—"}</span>
                 <span className="text-body-lg uppercase mt-unit">{currentUser?.role ?? "—"}</span>
              </div>
              <button 
                onClick={() => navigate(-1)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="退出大屏模式"
              >
                <Maximize2 size={18} className="rotate-45" />
              </button>
           </div>
        </div>
      </header>

      <main className="flex-1 flex w-full p-xs gap-xs overflow-hidden">
        {/* 3x2 Video Matrix - Full Width Expansion */}
        <div className="flex-1 grid grid-cols-3 grid-rows-2 gap-xs">
          {cameras.slice(0, 6).map((cam) => (
            <div key={cam.id} className="h-full w-full">
              <CameraPanel camera={cam} personCount={cameraStats[cam.id] ?? 0} />
            </div>
          ))}
          {/* Fill if less than 6 */}
          {Array.from({ length: Math.max(0, 6 - cameras.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-zinc-900 flex items-center justify-center border border-white/5">
              <VideoOff size={48} className="text-white/10" />
            </div>
          ))}
        </div>
      </main>

      {/* Footer State Bar */}
      <footer className="fixed bottom-lg right-lg flex items-center gap-sm bg-black/60 backdrop-blur-md px-md py-1.5 rounded-full border border-white/5 pointer-events-none z-50">
        <div className="flex items-center gap-sm">
           <div className="w-2 h-2 rounded-full bg-success-green animate-pulse"></div>
           <span className="text-body-lg font-bold text-white/80 font-mono">CORE ENGINE ACTIVE</span>
        </div>
        <div className="h-3 w-px bg-white/10"></div>
        <span className="text-body-lg text-white/40 font-mono">{systemStatus?.version ?? "—"}</span>
      </footer>
    </div>
  );
}

function CameraPanel({ camera, personCount }: { camera: Camera; personCount: number }) {
  return (
    <div className="relative group bg-black overflow-hidden flex flex-col border border-white/5">
      {/* Scanline Effect Overlay (CSS-only) */}
      <div className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-b from-transparent via-primary/5 to-transparent h-1/4 animate-[shimmer_3s_infinite]" />
      
      {camera.streamUrl ? (
        <img src={camera.streamUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all duration-500" alt="" />
      ) : (
        <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-white/20 text-body-lg font-mono">NO SIGNAL</div>
      )}
      
      {/* HUD Info Overlay */}
      <div className="absolute inset-0 flex flex-col justify-between p-sm pointer-events-none">
        <div className="flex justify-between items-start">
           <div className="flex items-center gap-xs px-1.5 py-1 bg-black/60 backdrop-blur rounded border border-white/10">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                camera.status === CameraStatus.ONLINE ? "bg-success-green box-shadow-[0_0_8px_#1a7f37]" : "bg-error animate-pulse"
              )}></div>
              <span className="text-body-lg font-mono font-bold text-white/90">CAM {camera.id.slice(-4).toUpperCase()}</span>
           </div>
           
           <div className="flex items-center gap-sm">
              {camera.status === CameraStatus.ONLINE && (
                <div className="px-1.5 py-1 bg-primary/20 backdrop-blur rounded border border-primary/20 flex items-center gap-1">
                  <Users size={10} className="text-primary" />
                  <span className="text-body-lg font-mono font-bold text-primary">{personCount.toString().padStart(2, '0')}</span>
                </div>
              )}
           </div>
        </div>

        <div className="flex justify-between items-end bg-gradient-to-t from-black/80 via-black/40 to-transparent p-xs -m-sm">
          <div className="flex flex-col">
            <span className="text-body-lg font-bold text-white/80">{camera.name}</span>
            <span className="text-body-lg font-mono text-white/40 uppercase">{camera.name}</span>
          </div>
          <span className={cn(
            "text-body-lg font-black uppercase tracking-widest",
            camera.status === CameraStatus.ONLINE ? "text-success-green" : "text-error"
          )}>
            {camera.status}
          </span>
        </div>
      </div>
    </div>
  );
}
