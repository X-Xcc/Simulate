import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip,
  BarChart, Bar, Cell
} from "recharts";
import { 
  TrendingUp, 
  Map as MapIcon, 
  BarChart2, 
  Radar as RadarIcon, 
  Download, 
  Calendar,
  AlertCircle,
  ShieldCheck,
  Target,
  Router,
  Activity
} from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { cn } from "../lib/utils";
import { subscribeToAlerts, subscribeToSystemStatus, fetchStatsSummary, fetchTrendData, fetchModelInfo, fetchRegionalStats, fetchFpsStats } from "../services/dataService";
import { Alert, SystemStatus, RegionalStat, StatsSummary, ModelInfo, FpsStats } from "../types";
import { ErrorBanner } from "../components/LoadingError";

export default function Analysis() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [trendData, setTrendData] = useState<{ name: string; alerts: number }[]>([]);
  const [regionalData, setRegionalData] = useState<RegionalStat[]>([]);
  const [fpsStats, setFpsStats] = useState<FpsStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    const s = ac.signal;
    const unsubAlerts = subscribeToAlerts(setAlerts);
    const unsubStatus = subscribeToSystemStatus(setStatus);
    fetchStatsSummary(s).then(setStats).catch(err => { if (err.name !== 'AbortError') { setError(err.message); console.error(err); } });
    fetchModelInfo(s).then(setModelInfo).catch(err => { if (err.name !== 'AbortError') { setError(err.message); console.error(err); } });
    fetchRegionalStats(s).then(setRegionalData).catch(err => { if (err.name !== 'AbortError') { setError(err.message); console.error(err); } });
    fetchFpsStats(s).then(setFpsStats).catch(err => { if (err.name !== 'AbortError') console.error(err); });
    fetchTrendData("week", s).then(data => {
      if (data?.labels && data?.data) {
        setTrendData(data.labels.map((label: string, i: number) => ({
          name: label,
          alerts: data.data[i] ?? 0,
        })));
      }
    }).catch(err => { if (err.name !== 'AbortError') console.error(err); });
    return () => {
      ac.abort();
      unsubAlerts();
      unsubStatus();
    };
  }, []);

  const totalAlerts = alerts.length;
  const confirmedAlerts = alerts.filter(a => a.status === "confirmed").length;
  const accuracy = totalAlerts > 0 ? (confirmedAlerts / totalAlerts * 100).toFixed(1) : "N/A";
  const cpuUsage = status?.cpuUsage ?? 0;
  const avgLatency = fpsStats?.avg ? `${(1000 / fpsStats.avg).toFixed(0)}ms` : "—";

  // Radar data from behaviorCounts
  const behaviorCounts = stats?.behaviorCounts ?? {};
  const maxVal = Math.max(...Object.values(behaviorCounts as Record<string, number>), 1);
  const maxRegionalValue = regionalData.length > 0 ? Math.max(...regionalData.map(d => d.value)) : 1;
  const radarData = [
    { subject: '打架', A: behaviorCounts["打架"] ?? 0, fullMark: maxVal },
    { subject: '跌倒', A: behaviorCounts["跌倒"] ?? 0, fullMark: maxVal },
    { subject: '离岗', A: behaviorCounts["离岗"] ?? 0, fullMark: maxVal },
    { subject: '疲劳', A: behaviorCounts["疲劳"] ?? 0, fullMark: maxVal },
    { subject: '人员聚集', A: behaviorCounts["人员聚集"] ?? 0, fullMark: maxVal },
  ];

  return (
    <div className="space-y-xl max-w-[1600px] mx-auto pb-xl">
      <header className="flex justify-between items-end">
        <div>
           <h2 className="text-title-lg font-black tracking-tight">分析看板与报表</h2>
           <p className="text-on-surface-variant text-body-lg opacity-70">监区安全数据综合分析视图（v.3.2）</p>
        </div>
        <div className="flex gap-sm">
           <button className="bg-white border border-outline-variant px-lg py-sm rounded-lg font-bold text-body-lg flex items-center gap-2" aria-label="近7天数据">
             <Calendar size={18} /> 近7天数据
           </button>
           <button className="bg-primary text-on-primary px-lg py-sm rounded-lg font-bold text-body-lg flex items-center gap-2 shadow-sm" aria-label="导出分析报告">
             <Download size={18} /> 导出分析报告
           </button>
        </div>
      </header>

      {error && <ErrorBanner message={error} />}

      {/* Summary Row */}
      <div className="grid grid-cols-4 gap-xl">
         {[
           { label: "本周告警总数", value: totalAlerts.toLocaleString(), change: "+12.4%", trend: "up", icon: AlertCircle, color: "text-danger-red", bg: "bg-error-container/20" },
           { label: "AI 拦截准确率", value: `${accuracy}%`, change: "+0.8%", trend: "up", icon: ShieldCheck, color: "text-success-green", bg: "bg-success-green/10" },
           { label: "平均识别时延", value: avgLatency, change: "-", trend: "none", icon: Target, color: "text-info-cyan", bg: "bg-info-cyan/10" },
           { label: "设备实时负载", value: `${cpuUsage}%`, change: "正常运行", trend: "none", icon: Router, color: "text-outline", bg: "bg-surface-container-highest" },
         ].map((s, i) => (
           <div key={i} className="bg-white p-lg border border-outline-variant rounded-xl shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
             <div className="flex justify-between items-start mb-md">
                <span className="text-body-lg font-bold text-on-surface-variant uppercase tracking-widest">{s.label}</span>
                <div className={cn("p-sm rounded-lg transition-transform group-hover:scale-110", s.bg)}>
                  <s.icon className={s.color} size={20} />
                </div>
             </div>
             <div className="flex items-baseline gap-2">
                <span className="text-title font-bold font-mono tracking-tighter">{s.value}</span>
                <span className={cn("text-body-lg font-black", s.trend === "up" ? "text-error" : s.trend === "down" ? "text-success-green" : "text-outline")}>
                  {s.change}
                </span>
             </div>
             <div className={cn("absolute bottom-0 left-0 right-0 h-1", s.bg)} />
           </div>
         ))}
      </div>

      <div className="grid grid-cols-3 gap-xl">
        {/* Heatmap Section */}
        <section className="col-span-2 bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm flex flex-col h-[500px]">
          <header className="px-lg py-md border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
            <h3 className="font-bold flex items-center gap-2"><MapIcon size={18} className="text-outline" /> 监区异常活动热力图</h3>
            <span className="text-body-sm font-bold text-success-green uppercase bg-success-green/10 px-sm py-unit rounded ring-1 ring-success-green/20">Real-time Feed</span>
          </header>
          <div className="flex-1 relative bg-surface-container-low p-md">
            <div 
              className="w-full h-full rounded-lg border border-outline-variant/30 chart-grid relative overflow-hidden flex items-center justify-center bg-white"
              style={{
                background: `
                  radial-gradient(ellipse 80% 60% at 30% 40%, rgba(186,26,26,0.15) 0%, transparent 60%),
                  radial-gradient(ellipse 70% 50% at 60% 30%, rgba(191,135,0,0.12) 0%, transparent 55%),
                  linear-gradient(135deg, #f8f9fc 0%, #e8ecf4 100%)
                `,
              }}
            >
               {/* Simplified Heatmap Blobs Simulation */}
               <motion.div animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.2, 1] }} transition={{ duration: 3, repeat: Infinity }} className="absolute w-64 h-64 bg-error/20 blur-[60px] rounded-full left-[20%] top-[30%]" />
               <motion.div animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.3, 1] }} transition={{ duration: 4, repeat: Infinity }} className="absolute w-80 h-80 bg-warning-orange/20 blur-[80px] rounded-full right-[10%] top-[20%]" />
               
               {/* Legend */}
               <div className="absolute bottom-md right-md bg-white/90 backdrop-blur-md border border-outline-variant p-sm rounded-lg shadow-xl">
                 <p className="text-body-lg font-bold text-on-surface-variant uppercase mb-xs">活动密度</p>
                 <div className="w-[120px] h-2 bg-gradient-to-r from-success-green via-warning-orange to-danger-red rounded-full mb-1" />
                 <div className="flex justify-between text-body-lg font-bold font-mono opacity-50 uppercase"><span>Low</span><span>High</span></div>
               </div>
            </div>
          </div>
        </section>

        {/* 7 Day Trend */}
        <section className="col-span-1 bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm flex flex-col h-[500px]">
          <header className="px-lg py-md border-b border-outline-variant bg-surface-container-low">
            <h3 className="font-bold flex items-center gap-2"><BarChart2 size={18} className="text-outline" /> 七日告警趋势</h3>
          </header>
          <div className="flex-1 p-lg chart-grid">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorAlert" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0051ae" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#0051ae" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#727785' }} />
                <Tooltip />
                <Area type="monotone" dataKey="alerts" stroke="#0051ae" strokeWidth={3} fillOpacity={1} fill="url(#colorAlert)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-2 gap-xl">
        {/* Radar Performance */}
        <section className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm flex flex-col">
          <header className="px-lg py-md border-b border-outline-variant bg-surface-container-low">
            <h3 className="font-bold flex items-center gap-2"><RadarIcon size={18} className="text-outline" /> AI 识别效能 (精确率/召回率)</h3>
          </header>
          <div className="p-xl grid grid-cols-5 gap-8 items-center h-[300px]">
            <div className="col-span-3 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e1e2ec" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 13, fontWeight: 700, fill: '#191c22' }} />
                  <Radar name="Precision" dataKey="A" stroke="#0051ae" fill="#0051ae" fillOpacity={0.15} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="col-span-2 space-y-lg border-l border-outline-variant/30 pl-lg">
               <div>
                  <p className="text-body-lg font-bold text-outline uppercase mb-xs">总检测数</p>
                  <p className="text-title font-mono font-bold text-primary">{stats?.totalDetections ?? 0} <span className="text-body-lg text-success-green">总检测</span></p>
               </div>
               <div>
                  <p className="text-body-lg font-bold text-outline uppercase mb-xs">总告警数</p>
                  <p className="text-title font-mono font-bold text-detect-purple">{totalAlerts} <span className="text-body-lg text-success-green">总告警</span></p>
               </div>
               <div className="pt-md border-t border-outline-variant/20 opacity-50">
                  <p className="text-body-lg font-bold flex items-center gap-1 uppercase">
                    <Activity size={10} /> Model: {modelInfo?.model_size_mb ? `YOLOv8 (${modelInfo.model_size_mb}MB)` : status?.version ?? "YOLOv8"}
                  </p>
                  {modelInfo?.device && (
                    <p className="text-body-lg font-bold flex items-center gap-1 uppercase mt-1">
                      Device: {modelInfo.device} | Precision: {modelInfo.precision ?? "fp16"}
                    </p>
                  )}
               </div>
            </div>
          </div>
        </section>

        {/* Regional Bar Distribution */}
        <section className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm flex flex-col">
          <header className="px-lg py-md border-b border-outline-variant bg-surface-container-low">
            <h3 className="font-bold flex items-center gap-2"><TrendingUp size={18} className="text-outline" /> 各监区告警风险分布</h3>
          </header>
          <div className="p-xl flex-1 flex flex-col justify-center">
            {regionalData.length === 0 ? (
              <p className="text-center text-on-surface-variant text-body-lg opacity-50">暂无监区分布数据</p>
            ) : (
            regionalData.map(item => (
              <div key={item.name} className="flex items-center gap-md mb-md last:mb-0">
                <span className="w-16 text-body-lg font-bold text-right text-on-surface-variant">{item.name}</span>
                <div className="flex-1 h-3 bg-surface-container-highest rounded-full overflow-hidden">
                   <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.value / maxRegionalValue) * 100}%` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: item.color }} 
                   />
                </div>
                <span className="w-12 text-body-lg font-mono font-black text-on-surface">{item.value}</span>
              </div>
            ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
