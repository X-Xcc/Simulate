import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip,
  BarChart, Bar, Cell
} from "recharts";
import {
  TrendingUp, Map as MapIcon, BarChart2, Download,
  AlertCircle, ShieldCheck, Target, Activity
} from "lucide-react";
import { useState, useMemo } from "react";
import { motion } from "motion/react";
import { cn } from "../lib/utils";
import {
  useMockAlerts, useMockSystemStatus, useMockStatsSummary,
  useMockTrendData, useMockModelInfo, useMockRegionalStats, useMockFpsStats,
} from "../lib/useMock";
import { useToast } from "../components/Toast";
import Prison3D from "../components/Prison3D";

export default function Analysis() {
  const toast = useToast();
  const [timeRange, setTimeRange] = useState<"week" | "month" | "quarter">("week");
  const alerts = useMockAlerts()[0];
  const status = useMockSystemStatus();
  const stats = useMockStatsSummary();
  const modelInfo = useMockModelInfo();
  const regionalData = useMockRegionalStats();
  const fpsStats = useMockFpsStats();
  const trendDataRaw = useMockTrendData(timeRange);

  const trendData = useMemo(() => {
    if (!trendDataRaw?.labels) return [];
    return trendDataRaw.labels.map((label: string, i: number) => ({
      name: label,
      alerts: Object.values(trendDataRaw.data).reduce((sum: number, arr: any) => sum + (arr[i] ?? 0), 0),
    }));
  }, [trendDataRaw]);

  const totalAlerts = alerts.length;
  const confirmedAlerts = alerts.filter(a => a.status === "confirmed").length;
  const accuracy = totalAlerts > 0 ? (confirmedAlerts / totalAlerts * 100).toFixed(1) : "0";
  const avgLatency = fpsStats?.avg ? `${(1000 / fpsStats.avg).toFixed(0)}ms` : "—";
  const behaviorCounts = stats?.behaviorCounts ?? {};
  const maxVal = Math.max(...Object.values(behaviorCounts as Record<string, number>), 1);
  const maxRegionalValue = regionalData.length > 0 ? Math.max(...regionalData.map(d => d.value)) : 1;

  const radarData = [
    { subject: "打架", A: behaviorCounts["打架"] ?? 0, fullMark: maxVal },
    { subject: "跌倒", A: behaviorCounts["跌倒"] ?? 0, fullMark: maxVal },
    { subject: "离岗", A: behaviorCounts["离岗"] ?? 0, fullMark: maxVal },
    { subject: "聚集", A: behaviorCounts["人员聚集"] ?? 0, fullMark: maxVal },
  ];

  return (
    <div className="space-y-5 max-w-[1600px] mx-auto pb-8 animate-fade-in-up">
      <header className="flex justify-between items-end">
        <div>
          <p className="text-caption font-semibold text-outline uppercase tracking-widest mb-1">数据中心 / 分析</p>
          <h2 className="text-title font-bold tracking-tight">分析看板与报表</h2>
          <p className="text-body-sm text-on-surface-variant mt-0.5">监区安全数据综合分析视图</p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-white border border-outline-variant rounded-lg p-0.5">
            {(["week", "month", "quarter"] as const).map(r => (
              <button key={r} onClick={() => setTimeRange(r)}
                className={cn("px-3 py-1.5 rounded-md text-caption font-semibold",
                  timeRange === r ? "bg-primary text-white" : "text-on-surface-variant hover:text-on-surface"
                )}>
                {r === "week" ? "近7天" : r === "month" ? "近30天" : "近90天"}
              </button>
            ))}
          </div>
          <button onClick={() => toast.show("分析报告已导出")} className="bg-primary text-white px-4 py-2 rounded-lg font-semibold text-body flex items-center gap-2 shadow-sm">
            <Download size={15} /> 导出报告
          </button>
        </div>
      </header>

      {/* 摘要卡片 */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "本周告警总数", value: totalAlerts.toString(), change: "+12.4%", icon: AlertCircle, color: "text-danger-red", bg: "bg-error-container/20" },
          { label: "AI 拦截准确率", value: `${accuracy}%`, change: "+0.8%", icon: ShieldCheck, color: "text-success-green", bg: "bg-success-green/10" },
          { label: "平均识别时延", value: avgLatency, change: "正常", icon: Target, color: "text-info-cyan", bg: "bg-info-cyan/5" },
          { label: "设备负载", value: `${status.cpuUsage}%`, change: "运行中", icon: Activity, color: "text-outline", bg: "bg-surface-container-high" },
        ].map((s, i) => (
          <div key={i} className="bg-white p-4 border border-outline-variant rounded-xl shadow-sm hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-2">
              <span className="text-caption font-semibold text-outline uppercase tracking-wider">{s.label}</span>
              <div className={cn("p-1.5 rounded-lg", s.bg)}>
                <s.icon className={s.color} size={16} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-heading font-bold font-mono tabular-nums">{s.value}</span>
              <span className="text-caption text-outline font-medium">{s.change}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* 3D 监区模型 */}
        <section className="col-span-2 bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm flex flex-col h-[420px]">
          <header className="px-4 py-2.5 border-b border-outline-variant bg-surface-container-low/50 flex justify-between items-center">
            <h3 className="font-bold text-body-lg flex items-center gap-2"><MapIcon size={16} className="text-outline" /> 监区异常活动热力图</h3>
            <span className="text-caption font-semibold text-success-green uppercase bg-success-green/10 px-2 py-0.5 rounded">Real-time</span>
          </header>
          <div className="flex-1 relative">
            <div className="absolute inset-0 p-3">
              <Prison3D />
            </div>
          </div>
        </section>

        {/* 7日趋势 */}
        <section className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm flex flex-col h-[420px]">
          <header className="px-4 py-2.5 border-b border-outline-variant bg-surface-container-low/50">
            <h3 className="font-bold text-body-lg flex items-center gap-2"><BarChart2 size={16} className="text-outline" /> 七日告警趋势</h3>
          </header>
          <div className="flex-1 p-4 chart-grid">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorAlert" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1a56db" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#1a56db" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.06)", fontSize: "12px" }} />
                <Area type="monotone" dataKey="alerts" stroke="#1a56db" strokeWidth={2} fillOpacity={1} fill="url(#colorAlert)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* 雷达图 */}
        <section className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm">
          <header className="px-4 py-2.5 border-b border-outline-variant bg-surface-container-low/50">
            <h3 className="font-bold text-body-lg">AI 识别效能分析</h3>
          </header>
          <div className="p-4 grid grid-cols-5 gap-4 items-center h-[280px]">
            <div className="col-span-3 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fontWeight: 600, fill: "#374151" }} />
                  <Radar name="检测数" dataKey="A" stroke="#1a56db" fill="#1a56db" fillOpacity={0.12} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="col-span-2 space-y-4 border-l border-outline-variant/30 pl-4">
              <div>
                <p className="text-caption text-outline font-semibold uppercase mb-0.5">总检测数</p>
                <p className="text-heading font-mono font-bold text-primary tabular-nums">{stats?.total ?? 0}</p>
              </div>
              <div>
                <p className="text-caption text-outline font-semibold uppercase mb-0.5">总告警数</p>
                <p className="text-heading font-mono font-bold text-detect-purple tabular-nums">{totalAlerts}</p>
              </div>
              <div className="pt-3 border-t border-outline-variant/20 opacity-60">
                <p className="text-caption font-semibold">模型: YOLOv8n-pose</p>
                <p className="text-caption font-semibold mt-0.5">Device: {modelInfo?.device} | {modelInfo?.precision}</p>
              </div>
            </div>
          </div>
        </section>

        {/* 区域分布 */}
        <section className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm">
          <header className="px-4 py-2.5 border-b border-outline-variant bg-surface-container-low/50">
            <h3 className="font-bold text-body-lg flex items-center gap-2"><TrendingUp size={16} className="text-outline" /> 各监区告警分布</h3>
          </header>
          <div className="p-4 flex-1 flex flex-col justify-center">
            {regionalData.map(item => (
              <div key={item.name} className="flex items-center gap-3 mb-3 last:mb-0">
                <span className="w-10 text-body-sm font-semibold text-right text-on-surface-variant">{item.name}</span>
                <div className="flex-1 h-2.5 bg-surface-container-high rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.value / maxRegionalValue) * 100}%` }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                </div>
                <span className="w-8 text-body-sm font-mono font-bold text-on-surface tabular-nums">{item.value}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
