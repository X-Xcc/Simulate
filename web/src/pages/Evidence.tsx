import { useState, useEffect } from "react";
import { 
  Calendar, 
  Archive, 
  Download, 
  History, 
  FileVideo, 
  Play, 
  Clock, 
  ShieldCheck, 
  UserCircle 
} from "lucide-react";
import { cn } from "../lib/utils";
import { subscribeToAlerts, fetchEvidenceStats } from "../services/dataService";
import { Alert, AlertLevel, EvidenceStats } from "../types";

export default function Evidence() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [evStats, setEvStats] = useState<EvidenceStats | null>(null);

  useEffect(() => {
    const unsub = subscribeToAlerts(setAlerts);
    fetchEvidenceStats().then(setEvStats).catch(console.error);
    return () => unsub();
  }, []);

  const filteredAlerts = activeTab === 1 ? alerts.filter(a => a.level === AlertLevel.CRITICAL) : alerts;

  const criticalClips = alerts.filter(a => a.level === AlertLevel.CRITICAL);

  return (
    <div className="space-y-lg flex flex-col h-full overflow-hidden">
      <section className="flex justify-between items-end shrink-0">
        <div>
           <p className="text-[10px] text-outline font-bold uppercase mb-unit">系统管理 / 视频证据</p>
           <h2 className="text-title-lg font-bold">视频证据与调阅中心</h2>
           <p className="text-on-surface-variant text-[12px] opacity-70">整合关键告警切片、全时段录像回放及司法级证据存储</p>
        </div>
        <div className="flex gap-sm">
           <button className="bg-white border border-outline-variant px-lg py-sm rounded-lg font-bold text-[13px] flex items-center gap-2 hover:bg-surface-container-low transition-all">
             <Calendar size={18} /> 历史日历
           </button>
           <button className="bg-primary text-on-primary px-lg py-sm rounded-lg font-bold text-[13px] flex items-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95">
             <Archive size={18} /> 一键备份
           </button>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-4 gap-md shrink-0">
         {[
           { label: "今日告警证据", value: alerts.length.toString(), sub: `↑ ${alerts.length > 0 ? "12%" : "0%"} 较昨日`, color: "text-error" },
           { label: "已归档证据", value: (evStats?.archived ?? 0).toLocaleString(), sub: "总存储 12.4TB", color: "text-on-surface" },
           { label: "关键冲突切片", value: criticalClips.length.toString(), sub: "待人工审核", color: "text-warning-orange" },
           { label: "设备在线率", value: "99.8%", sub: "实时节点拓扑", color: "text-info-cyan" },
         ].map(s => (
           <div key={s.label} className="bg-white p-lg border border-outline-variant rounded-xl shadow-sm">
             <div className="text-on-surface-variant text-[11px] font-bold uppercase mb-md">{s.label}</div>
             <div className="flex items-baseline gap-2">
               <span className={cn("text-[26px] font-mono font-bold leading-none", s.color)}>{s.value}</span>
               <span className="text-[10px] text-outline font-medium">{s.sub}</span>
             </div>
           </div>
         ))}
      </section>

      <div className="flex-1 grid grid-cols-12 gap-lg min-h-0 min-h-0 overflow-hidden">
        {/* Left: Timeline */}
        <aside className="col-span-3 bg-white border border-outline-variant rounded-xl p-md flex flex-col overflow-hidden">
          <h3 className="font-bold flex items-center gap-2 mb-md text-primary">
            <Clock size={16} /> 快速检索时间轴
          </h3>
          <div className="flex-1 space-y-md overflow-y-auto pr-1 custom-scrollbar">
             <div className="border border-outline-variant rounded-lg p-sm">
                <p className="text-[10px] text-outline font-bold uppercase mb-unit">选择日期</p>
                <div className="flex justify-between items-center text-[13px] font-mono">2024-05-22 <Calendar size={16} className="text-outline" /></div>
             </div>
             <div>
               <p className="text-[10px] text-outline font-bold uppercase mb-sm">当日高频时段</p>
               <div className="space-y-sm">
                  {alerts.slice(0, 5).map((a, i) => (
                    <div key={a.id} className="flex gap-sm p-sm hover:bg-surface-container-low transition-colors rounded-lg cursor-pointer group">
                      <div className={cn("w-1 h-10 rounded-full shrink-0", a.level === AlertLevel.CRITICAL ? "bg-error" : "bg-warning-orange")} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <span className="text-[12px] font-mono font-bold">{new Date(a.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <p className="text-[11px] opacity-60 truncate">{a.cameraName} - {a.type}</p>
                      </div>
                    </div>
                  ))}
               </div>
             </div>
          </div>
        </aside>

        {/* Right: Grid */}
        <div className="col-span-9 flex flex-col gap-md min-h-0">
           <header className="bg-white border border-outline-variant rounded-lg px-lg py-sm flex justify-between items-center shadow-sm">
             <div className="flex gap-lg">
                {["全部切片", "高危告警"].map((l, i) => (
                  <button key={l} onClick={() => setActiveTab(i)} className={cn("text-[12px] font-bold py-1 border-b-2 transition-all", activeTab === i ? "border-primary text-primary" : "border-transparent text-outline hover:text-on-surface")}>{l}</button>
                ))}
             </div>
           </header>

           <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-md pr-1 custom-scrollbar">
              {filteredAlerts.map(a => (
                <div key={a.id} className="group relative bg-black aspect-video rounded-xl overflow-hidden border border-outline-variant shadow-sm h-fit">
                   <img src={a.snapshotUrl} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" />
                   <div className="absolute inset-0 video-hud flex flex-col justify-between p-sm">
                      <div className="flex justify-between items-start">
                         <span className={cn(
                           "px-sm py-unit rounded-full text-[9px] font-black uppercase flex items-center gap-1",
                           a.level === AlertLevel.CRITICAL ? "bg-error text-white" : "bg-warning-orange text-white"
                         )}>
                           {a.level === AlertLevel.CRITICAL && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
                           {a.type}
                         </span>
                         <button onClick={() => window.open(a.snapshotUrl, "_blank")} className="bg-black/50 text-white p-1 rounded hover:bg-primary transition-colors opacity-0 group-hover:opacity-100"><Download size={14} /></button>
                      </div>
                      <div className="translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                         <div className="text-white text-[12px] font-bold truncate mb-unit">{a.cameraName}</div>
                         <div className="flex justify-between items-baseline">
                            <span className="text-white/60 font-mono text-[10px]">{new Date(a.time).toLocaleTimeString()}</span>
                            <span className="text-white/40 text-[9px] font-mono">#{a.id}</span>
                         </div>
                      </div>
                   </div>
                   <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center ring-4 ring-white/10 scale-0 group-hover:scale-100 transition-transform duration-300">
                         <Play size={24} fill="white" className="text-white ml-1" />
                      </div>
                   </div>
                </div>
              ))}
              <div className="border-2 border-dashed border-outline-variant rounded-xl flex flex-col items-center justify-center gap-md bg-surface-container-low hover:bg-surface-container-high transition-all cursor-pointer group aspect-video">
                 <div className="w-12 h-12 rounded-full border-2 border-outline-variant group-hover:border-primary group-hover:bg-primary/5 flex items-center justify-center transition-all">
                    <FileVideo className="text-outline group-hover:text-primary transition-all" />
                 </div>
                 <span className="text-[12px] font-bold text-outline group-hover:text-primary">手动调阅全量视频</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
