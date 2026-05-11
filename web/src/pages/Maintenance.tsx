import { useState, useEffect } from "react";
import { 
  CheckCircle2, 
  ShieldCheck, 
  RefreshCcw, 
  Activity, 
  Terminal,
  CloudDownload,
  Clock,
  Wrench
} from "lucide-react";
import { cn } from "../lib/utils";
import { subscribeToSystemStatus, fetchModelInfo } from "../services/dataService";
import { SystemStatus } from "../types";

const Gauge = ({ value, label, sub, color }: { value: number, label: string, sub: string, color: string }) => {
  const dashArray = (value / 100) * 100;
  return (
    <div className="bg-white border border-outline-variant rounded-xl p-lg flex flex-col items-center justify-center gap-md hover:shadow-md transition-shadow">
      <span className="text-body-lg font-bold text-on-surface-variant uppercase tracking-widest">{label}</span>
      <div className="relative w-[120px] h-[120px] flex items-center justify-center">
         <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
           <circle cx="18" cy="18" r="15.915" fill="none" stroke="#ecedf7" strokeWidth="3" />
           <circle cx="18" cy="18" r="15.915" fill="none" stroke="currentColor" strokeWidth="3" 
                   strokeDasharray={`${dashArray} 100`} 
                   className={color}
           />
         </svg>
         <div className="absolute inset-0 flex flex-col items-center justify-center">
           <span className="text-title font-mono font-bold leading-tight">{value}%</span>
         </div>
      </div>
      <span className={cn("text-body-lg font-bold uppercase", color)}>{sub}</span>
    </div>
  );
};

export default function Maintenance() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [modelInfo, setModelInfo] = useState<any>(null);

  useEffect(() => {
    const ac = new AbortController();
    const unsub = subscribeToSystemStatus(setStatus);
    fetchModelInfo(ac.signal).then(setModelInfo).catch(err => { if (err.name !== 'AbortError') console.error(err); });
    return () => { ac.abort(); unsub(); };
  }, []);

  if (!status) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-outline font-bold animate-pulse">正在初始化系统监控...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-xl h-full flex flex-col min-h-0">
      <header className="flex justify-between items-center shrink-0">
        <div>
           <h2 className="text-title-lg font-black tracking-tight flex items-center gap-2"><Wrench size={24} className="text-primary" /> 运维中心与监控</h2>
           <p className="text-on-surface-variant text-body-lg opacity-70">实时系统物理资源监控与服务节点健康度</p>
        </div>
        <button className="bg-primary text-on-primary px-lg py-sm rounded-lg font-bold text-body-lg flex items-center gap-2 shadow-lg hover:shadow-xl transition-all">
          <RefreshCcw size={18} /> 全局状态刷新
        </button>
      </header>

      {/* Metrics Gauges */}
      <div className="grid grid-cols-4 gap-lg shrink-0">
        <Gauge value={status.cpuUsage} label="CPU 利用率" sub={status.cpuUsage > 80 ? "负载压力较大" : "核心负载正常"} color={status.cpuUsage > 80 ? "text-error" : "text-primary"} />
        <Gauge value={status.memoryUsage} label="内存驻留" sub={status.memoryUsage > 80 ? "高负载预警" : "分配正常"} color={status.memoryUsage > 80 ? "text-warning-orange" : "text-warning-orange"} />
        <Gauge value={status.storageUsage} label="存储资源" sub={status.storageUsage > 90 ? "空间严重不足" : "可用空间充足"} color={status.storageUsage > 90 ? "text-error" : "text-info-cyan"} />
        <Gauge value={status.gpuUsage} label="GPU 算力" sub={status.gpuUsage > 80 ? "推理任务满载" : "算力空闲"} color="text-success-green" />
      </div>

      <div className="grid grid-cols-12 gap-xl flex-1 min-h-0">
        {/* Core Services */}
        <section className="col-span-8 bg-white border border-outline-variant rounded-xl flex flex-col overflow-hidden shadow-sm">
           <header className="px-lg py-md border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2"><Activity size={18} className="text-outline" /> 核心服务节点监控</h3>
              <span className="text-body-lg font-bold text-outline uppercase tracking-widest">Live Sync Interval: 2s</span>
           </header>
           <div className="flex-1 overflow-auto divide-y divide-outline-variant/30">
              {status.services.map(s => (
                <div key={s.name} className="flex items-center justify-between px-lg py-md hover:bg-surface-container-low transition-colors">
                  <div className="flex items-center gap-md">
                     <div className={cn(
                       "w-2.5 h-2.5 rounded-full shadow-[0_0_12px_rgba(0,0,0,0.1)]",
                       s.health === 'healthy' ? "bg-success-green shadow-success-green/20" : "bg-warning-orange animate-pulse shadow-warning-orange/20"
                     )} />
                     <div className="flex flex-col">
                        <span className="font-bold text-body-lg text-on-surface">{s.name}</span>
                        <div className="flex items-center gap-3 text-body-lg opacity-40 font-mono mt-0.5">
                           <span className="flex items-center gap-1"><Clock size={10} /> {s.uptime}</span>
                           <span className="flex items-center gap-1"><Terminal size={10} /> Node</span>
                        </div>
                     </div>
                  </div>
                  <div className="text-right">
                     <span className={cn(
                       "text-body-sm font-black uppercase px-sm py-1 rounded ring-1",
                       s.health === 'healthy' ? "text-success-green ring-success-green/20 bg-success-green/10" : "text-warning-orange ring-warning-orange/20 bg-warning-orange/10"
                     )}>{s.health === 'healthy' ? "Running" : "Degraded"}</span>
                  </div>
                </div>
              ))}
           </div>
        </section>

        {/* System Info */}
        <section className="col-span-4 space-y-lg">
           <div className="bg-white border border-outline-variant rounded-xl p-lg shadow-sm">
              <h3 className="font-bold mb-lg flex items-center gap-2 text-primary"><ShieldCheck size={18} /> 系统版本与认证</h3>
              <div className="space-y-md">
                 {[
                   { label: "当前版本", value: status.version },
                   { label: "核心引擎", value: status.engine ?? "—" },
                   { label: "AI 模型集", value: modelInfo?.model_size_mb ? `YOLOv8n (${modelInfo.model_size_mb}MB)` : "—" },
                   { label: "最后更新", value: status.lastUpdate },
                 ].map(i => (
                   <div key={i.label} className="flex justify-between items-baseline border-b border-outline-variant/30 pb-sm last:border-0 last:pb-0">
                      <span className="text-body-lg font-bold text-outline uppercase">{i.label}</span>
                      <span className="text-body-lg font-mono font-bold">{i.value}</span>
                   </div>
                 ))}
                 <button className="w-full mt-xl bg-primary text-on-primary h-[44px] rounded-lg font-bold text-body-lg flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95">
                   <CloudDownload size={18} /> 检查系统更新
                 </button>
              </div>
           </div>

           <div className="bg-gradient-to-br from-primary to-secondary p-lg rounded-xl shadow-lg text-on-primary">
              <div className="flex items-center gap-3 mb-md">
                 <ShieldCheck size={28} className="opacity-80" />
                 <h3 className="text-heading font-black tracking-tight">Security Audit</h3>
              </div>
              <p className="text-body-lg opacity-80 leading-relaxed mb-xl">系统处于受保护状态。数据目录 {status.dataDirSizeMb ?? 0}MB，累计检测 {status.detectionCount ?? 0} 次。所有操作均已记录在审计日志中。</p>
              <div className="grid grid-cols-2 gap-md">
                 <div className="bg-white/10 p-md rounded-lg backdrop-blur-md">
                    <p className="text-body-lg font-bold opacity-60 uppercase mb-unit">数据目录大小</p>
                    <p className="text-title font-mono font-bold">{status.dataDirSizeMb ?? "—"} MB</p>
                 </div>
                 <div className="bg-white/10 p-md rounded-lg backdrop-blur-md">
                    <p className="text-body-lg font-bold opacity-60 uppercase mb-unit">检测总数</p>
                    <p className="text-title font-mono font-bold">{status.detectionCount ?? "—"}</p>
                 </div>
              </div>
           </div>
        </section>
      </div>

      <footer className="mt-auto pt-lg border-t border-outline-variant/30 flex justify-between items-center text-body-sm font-bold text-outline uppercase tracking-[0.2em] shrink-0 pb-xl">
         <span>Build: {status.version ?? "—"}</span>
         <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-success-green" /> 核心维护控制台已就绪</span>
      </footer>
    </div>
  );
}
