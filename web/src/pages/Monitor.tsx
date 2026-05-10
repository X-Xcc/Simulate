import { useState, useEffect } from "react";
import { Users, VideoOff, Triangle, AlertCircle, PlayCircle, Maximize2 } from "lucide-react";
import { Camera, Alert, CameraStatus, AlertLevel } from "../types";
import { motion } from "motion/react";
import { cn, formatDate } from "../lib/utils";
import { subscribeToCameras, subscribeToAlerts, subscribeToCameraStats } from "../services/dataService";
import { useNavigate } from "react-router-dom";

export default function Monitor() {
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [cameraStats, setCameraStats] = useState<Record<string, number>>({});

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);

    const unsubCameras = subscribeToCameras(setCameras);
    const unsubAlerts = subscribeToAlerts(setAlerts);
    const unsubStats = subscribeToCameraStats(setCameraStats);

    return () => {
      clearInterval(timer);
      unsubCameras();
      unsubAlerts();
      unsubStats();
    };
  }, []);

  const activeAlertsCount = alerts.filter(a => a.status === 'pending').length;

  return (
    <div className="h-full flex flex-col gap-sm -m-xl p-xs bg-[#080c14] min-h-[calc(100vh-52px)]">
      {/* Mini HUD */}
      <div className="flex justify-between items-center px-md py-1 border-b border-white/5">
        <div className="flex items-center gap-lg">
          <div className="flex items-center gap-xs">
            <span className="text-[10px] text-outline font-bold uppercase tracking-widest">ACTIVE_ALERTS</span>
            <span className="text-[12px] font-mono font-bold text-error">{activeAlertsCount.toString().padStart(2, '0')}</span>
          </div>
          <div className="flex items-center gap-xs">
            <span className="text-[10px] text-outline font-bold uppercase tracking-widest">FPS</span>
            <span className="text-[12px] font-mono font-bold text-success-green">—</span>
          </div>
        </div>
        <button 
          onClick={() => navigate("/monitor/fullscreen")}
          className="flex items-center gap-2 px-sm py-[2px] bg-primary text-white rounded text-[11px] font-bold hover:bg-primary/90 transition-all active:scale-95"
        >
          <Maximize2 size={12} /> 进入大屏模式
        </button>
      </div>

      <div className="flex-1 flex gap-xs min-h-0">
        {/* Camera Grid - Expanded */}
        <div className="flex-1 grid grid-cols-3 grid-rows-2 gap-xs">
          {cameras.map((cam) => {
            const camAlert = alerts.find(a => a.cameraId === cam.id && a.status === 'pending' && a.level === AlertLevel.CRITICAL);
            return (
              <div 
                key={cam.id}
                className={cn(
                  "relative bg-black rounded border border-white/10 overflow-hidden group transition-all",
                  camAlert && "border-error ring-1 ring-error shadow-[inset_0_0_20px_rgba(186,26,26,0.3)]"
                )}
              >
                {cam.status === CameraStatus.SIGNAL_LOST ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-outline gap-sm bg-[#0a0f18]">
                    <VideoOff size={32} className="opacity-30" />
                    <span className="text-[11px] font-mono tracking-widest opacity-40">SIGNAL LOST</span>
                  </div>
                ) : (
                  <>
                    <img 
                      src={cam.streamUrl}
                      alt={cam.name}
                      className={cn(
                        "absolute inset-0 w-full h-full object-cover transition-opacity duration-700",
                        camAlert ? "opacity-70" : "opacity-60 group-hover:opacity-100"
                      )}
                    />
                    {camAlert && (
                      <motion.div 
                        animate={{ opacity: [0.1, 0.3, 0.1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="absolute inset-0 bg-error/20"
                      />
                    )}
                  </>
                )}

                <div className="absolute top-sm left-sm flex flex-col gap-1 pointer-events-none">
                  <div className={cn(
                    "px-1.5 py-[2px] border rounded backdrop-blur-md text-[10px] font-bold",
                    camAlert ? "bg-error text-white border-error shadow-lg" : "bg-black/60 text-white/80 border-white/10"
                  )}>
                    {cam.name}
                  </div>
                </div>
                
                <div className={cn(
                  "absolute top-sm right-sm w-1.5 h-1.5 rounded-full",
                  cam.status === CameraStatus.ONLINE ? "bg-success-green shadow-[0_0_8px_#1a7f37]" : "bg-outline"
                )} />

                <div className="absolute bottom-0 left-0 w-full p-2 bg-gradient-to-t from-black/80 to-transparent flex justify-between items-end text-[10px] font-mono pointer-events-none">
                  <div className="flex gap-md text-white/60">
                    <span className="flex items-center gap-xs">
                      <Users size={12} className="text-primary" /> {cameraStats[cam.id] ?? 0}
                    </span>
                  </div>
                  <span className={cn("text-white/40", camAlert && "text-error font-bold opacity-100")}>
                    {camAlert ? "DETECTED" : "LIVE"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
