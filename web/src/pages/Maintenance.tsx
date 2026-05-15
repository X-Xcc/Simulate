import { useState, useEffect } from "react";
import {
  ShieldCheck,
  RefreshCcw,
  Activity,
  Terminal,
  CloudDownload,
  Clock,
  Wrench,
  Server,
  Cpu,
  HardDrive,
  Zap,
  Loader2,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useMockSystemStatus, useMockModelInfo } from "../lib/useMock";
import { useToast } from "../components/Toast";

const Gauge = ({ value, label, sub, color, icon: Icon }: { value: number; label: string; sub: string; color: string; icon: any }) => {
  const dashArray = (value / 100) * 100;
  return (
    <div className="bg-white border border-outline-variant rounded-xl p-4 flex flex-col items-center gap-2 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-1.5">
        <Icon size={14} className="text-outline" />
        <span className="text-caption font-semibold text-outline uppercase tracking-wider">{label}</span>
      </div>
      <div className="relative w-[100px] h-[100px] flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f3f4f6" strokeWidth="2.5" />
          <circle cx="18" cy="18" r="15.915" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeDasharray={`${dashArray} 100`}
            strokeLinecap="round"
            className={color}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-heading font-mono font-bold leading-tight tabular-nums">{value}%</span>
        </div>
      </div>
      <span className={cn("text-caption font-semibold", color)}>{sub}</span>
    </div>
  );
};

export default function Maintenance() {
  const toast = useToast();
  const [checking, setChecking] = useState(false);
  const status = useMockSystemStatus();
  const modelInfo = useMockModelInfo();

  return (
    <div className="max-w-[1400px] mx-auto space-y-5 h-full flex flex-col min-h-0 animate-fade-in-up">
      <header className="flex justify-between items-center shrink-0">
        <div>
          <p className="text-caption font-semibold text-outline uppercase tracking-widest mb-1">系统管理 / 运维</p>
          <h2 className="text-title font-bold tracking-tight flex items-center gap-2">
            <Wrench size={22} className="text-primary" /> 运维中心与监控
          </h2>
          <p className="text-body-sm text-on-surface-variant mt-0.5">实时系统物理资源监控与服务节点健康度</p>
        </div>
        <button onClick={() => toast.show("数据已刷新")} className="bg-primary text-white px-4 py-2 rounded-lg font-semibold text-body flex items-center gap-2 shadow-sm">
          <RefreshCcw size={15} /> 全局刷新
        </button>
      </header>

      {/* 仪表盘 */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        <Gauge value={status.cpuUsage} label="CPU" sub={status.cpuUsage > 80 ? "负载较高" : "正常"} color={status.cpuUsage > 80 ? "text-danger-red" : "text-primary"} icon={Cpu} />
        <Gauge value={status.memoryUsage} label="内存" sub={status.memoryUsage > 85 ? "高负载" : "正常"} color={status.memoryUsage > 85 ? "text-danger-red" : status.memoryUsage > 70 ? "text-warning-orange" : "text-success-green"} icon={HardDrive} />
        <Gauge value={status.storageUsage} label="存储" sub={status.storageUsage > 90 ? "不足" : "充足"} color={status.storageUsage > 90 ? "text-danger-red" : "text-info-cyan"} icon={Server} />
        <Gauge value={status.gpuUsage} label="GPU" sub={status.gpuUsage > 80 ? "满载" : "空闲"} color="text-success-green" icon={Zap} />
      </div>

      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        {/* 服务列表 */}
        <section className="col-span-8 bg-white border border-outline-variant rounded-xl flex flex-col overflow-hidden shadow-sm">
          <header className="px-4 py-2.5 border-b border-outline-variant bg-surface-container-low/50 flex justify-between items-center">
            <h3 className="font-bold text-body-lg flex items-center gap-2"><Activity size={16} className="text-outline" /> 核心服务节点</h3>
            <span className="text-caption text-outline font-mono">同步间隔: 2s</span>
          </header>
          <div className="flex-1 overflow-auto divide-y divide-outline-variant/30">
            {status.services.map(s => (
              <div key={s.name} className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-container-low transition-colors">
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    s.health === "healthy" ? "bg-success-green" : "bg-warning-orange animate-pulse"
                  )} />
                  <div>
                    <span className="font-semibold text-body text-on-surface">{s.name}</span>
                    <div className="flex items-center gap-3 text-caption text-outline mt-0.5">
                      <span className="flex items-center gap-1"><Clock size={9} /> {s.uptime}</span>
                      <span className="flex items-center gap-1"><Terminal size={9} /> Node</span>
                    </div>
                  </div>
                </div>
                <span className={cn(
                  "text-caption font-semibold uppercase px-2 py-0.5 rounded",
                  s.health === "healthy"
                    ? "text-success-green bg-success-green/10"
                    : "text-warning-orange bg-warning-orange/10"
                )}>
                  {s.health === "healthy" ? "Running" : "Degraded"}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 系统信息 */}
        <section className="col-span-4 space-y-4">
          <div className="bg-white border border-outline-variant rounded-xl p-4 shadow-sm">
            <h3 className="font-bold text-body-lg mb-3 flex items-center gap-2 text-primary"><ShieldCheck size={16} /> 系统版本</h3>
            <div className="space-y-2.5">
              {[
                { label: "当前版本", value: status.version },
                { label: "核心引擎", value: status.engine ?? "—" },
                { label: "AI 模型", value: modelInfo?.model_size_mb ? `YOLOv8n (${modelInfo.model_size_mb}MB)` : "—" },
                { label: "推理设备", value: modelInfo?.device ?? "—" },
                { label: "精度模式", value: modelInfo?.precision ?? "—" },
              ].map(i => (
                <div key={i.label} className="flex justify-between items-center text-body-sm">
                  <span className="text-outline font-medium">{i.label}</span>
                  <span className="font-mono font-semibold tabular-nums">{i.value}</span>
                </div>
              ))}
              <button disabled={checking} onClick={() => {
                setChecking(true);
                setTimeout(() => { setChecking(false); toast.show("当前已是最新版本 v3.2.1"); }, 2000);
              }} className="w-full mt-3 bg-primary text-white h-9 rounded-lg font-semibold text-body flex items-center justify-center gap-2 shadow-sm disabled:opacity-50">
                {checking ? <Loader2 size={15} className="animate-spin" /> : <CloudDownload size={15} />}
                {checking ? "检查中..." : "检查系统更新"}
              </button>
            </div>
          </div>

          <div className="gradient-primary p-4 rounded-xl shadow-md text-white">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck size={22} className="opacity-80" />
              <h3 className="text-heading font-bold">Security Status</h3>
            </div>
            <p className="text-body opacity-80 leading-relaxed mb-3">
              系统受保护状态。数据目录 {status.dataDirSizeMb ?? 0}MB，累计检测 {status.detectionCount ?? 0} 次。
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/10 p-2.5 rounded-lg backdrop-blur-sm">
                <p className="text-caption font-semibold opacity-60 uppercase mb-0.5">数据目录</p>
                <p className="text-heading font-mono font-bold tabular-nums">{status.dataDirSizeMb ?? 0} MB</p>
              </div>
              <div className="bg-white/10 p-2.5 rounded-lg backdrop-blur-sm">
                <p className="text-caption font-semibold opacity-60 uppercase mb-0.5">检测总数</p>
                <p className="text-heading font-mono font-bold tabular-nums">{status.detectionCount ?? 0}</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <footer className="mt-auto pt-3 border-t border-outline-variant/30 flex justify-between items-center text-caption font-semibold text-outline uppercase tracking-wider shrink-0 pb-6">
        <span>Build: {status.version}</span>
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-success-green" /> 核心维护控制台已就绪</span>
      </footer>
    </div>
  );
}
