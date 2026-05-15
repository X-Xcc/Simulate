import {
  ShieldAlert,
  Accessibility,
  UserMinus,
  Users,
  Download,
  Play,
  Activity,
  Cpu,
  HardDrive,
  Zap,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/Toast";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart as RePieChart,
  Pie,
  Cell,
} from "recharts";
import { cn } from "../lib/utils";
import { subscribeToAlerts, subscribeToSystemStatus, fetchStatsSummary, fetchTrendData, exportCsv } from "../services/dataService";
import { Alert, SystemStatus, AlertType, StatsSummary } from "../types";
import { ErrorBanner } from "../components/LoadingError";

/* ── palette ── */
const C = {
  fight:   { line: "#ef4444", fill: "rgba(239,68,68,0.08)", bg: "bg-red-50",    text: "text-red-600",    badge: "bg-red-100 text-red-700" },
  fall:    { line: "#3b82f6", fill: "rgba(59,130,246,0.08)", bg: "bg-blue-50",   text: "text-blue-600",   badge: "bg-blue-100 text-blue-700" },
  absent:  { line: "#f59e0b", fill: "rgba(245,158,11,0.08)", bg: "bg-amber-50",  text: "text-amber-600",  badge: "bg-amber-100 text-amber-700" },
  crowd:   { line: "#8b5cf6", fill: "rgba(139,92,246,0.08)", bg: "bg-violet-50", text: "text-violet-600", badge: "bg-violet-100 text-violet-700" },
};

const TREND_COLORS: Record<string, string> = {
  "打架": C.fight.line,
  "跌倒": C.fall.line,
  "离岗": C.absent.line,
  "人员聚集": C.crowd.line,
};

const TREND_FILLS: Record<string, string> = {
  "打架": "url(#gradFight)",
  "跌倒": "url(#gradFall)",
  "离岗": "url(#gradAbsent)",
  "人员聚集": "url(#gradCrowd)",
};

const TYPE_STYLE: Record<string, typeof C.fight> = {
  [AlertType.FIGHT]: C.fight,
  [AlertType.FALL]: C.fall,
  [AlertType.ABSENCE]: C.absent,
  [AlertType.CROWD]: C.crowd,
};

const RANGE_OPTIONS = [
  { key: "day" as const,   label: "24小时" },
  { key: "week" as const,  label: "7天" },
  { key: "month" as const, label: "30天" },
];

/* ── custom tooltip ── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: any) => s + (p.value ?? 0), 0);
  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 px-4 py-3 min-w-[140px]">
      <p className="text-xs font-semibold text-gray-400 mb-2">{label}</p>
      <div className="space-y-1.5">
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TREND_COLORS[p.name] }}/>
              <span className="text-xs text-gray-500">{p.name}</span>
            </div>
            <span className="text-xs font-semibold text-gray-800">{p.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between">
        <span className="text-xs text-gray-400">合计</span>
        <span className="text-xs font-bold text-gray-700">{total}</span>
      </div>
    </div>
  );
}

/* ── main component ── */
export default function Dashboard() {
  const toast = useToast();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [trendData, setTrendData] = useState<Record<string, any>[]>([]);
  const [trendKeys, setTrendKeys] = useState<string[]>([]);
  const [trendRange, setTrendRange] = useState<"day" | "week" | "month">("week");
  const [error, setError] = useState<string | null>(null);
  const trendAbortRef = useRef<AbortController | null>(null);

  const loadTrend = (range: "day" | "week" | "month") => {
    trendAbortRef.current?.abort();
    setTrendRange(range);
    const ac = new AbortController();
    trendAbortRef.current = ac;
    fetchTrendData(range, ac.signal).then(data => {
      if (data?.labels && data?.data) {
        const keys = Object.keys(data.data);
        setTrendKeys(keys);
        setTrendData(data.labels.map((label: string, i: number) => {
          const point: Record<string, any> = { name: label };
          for (const key of keys) point[key] = data.data[key][i] ?? 0;
          return point;
        }));
      }
      setError(null);
    }).catch(err => { if (err.name !== 'AbortError') { setError(err.message); console.error(err); } });
    return () => ac.abort();
  };

  useEffect(() => {
    const ac = new AbortController();
    const s = ac.signal;
    const unsubAlerts = subscribeToAlerts(setAlerts);
    const unsubStatus = subscribeToSystemStatus(setStatus);
    fetchStatsSummary(s).then(s => { setStats(s); setError(null); }).catch(err => { if (err.name !== 'AbortError') { setError(err.message); console.error(err); } });
    const trendCleanup = loadTrend("week");
    return () => { ac.abort(); unsubAlerts(); unsubStatus(); trendCleanup(); };
  }, []);

  const behaviorCounts = stats?.behaviorCounts ?? {};
  const compareData = stats?.compare ?? null;

  const cards = useMemo(() => [
    { key: "fight",  icon: <ShieldAlert size={22}/>,  label: "打架事件", count: behaviorCounts["打架"] ?? 0, change: getChange(compareData, "打架"),   style: C.fight },
    { key: "fall",   icon: <Accessibility size={22}/>, label: "人员跌倒", count: behaviorCounts["跌倒"] ?? 0, change: getChange(compareData, "跌倒"),   style: C.fall },
    { key: "absent", icon: <UserMinus size={22}/>,    label: "违规离岗", count: behaviorCounts["离岗"] ?? 0, change: getChange(compareData, "离岗"),   style: C.absent },
    { key: "crowd",  icon: <Users size={22}/>,        label: "人员聚集", count: behaviorCounts["人员聚集"] ?? 0, change: getChange(compareData, "人员聚集"), style: C.crowd },
  ], [behaviorCounts, compareData]);

  const distributionData = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const point of trendData) {
      for (const key of trendKeys) {
        totals[key] = (totals[key] ?? 0) + (point[key] ?? 0);
      }
    }
    return [
      { name: "跌倒",     value: totals["跌倒"] ?? 0,     color: C.fall.line },
      { name: "打架",     value: totals["打架"] ?? 0,     color: C.fight.line },
      { name: "离岗",     value: totals["离岗"] ?? 0,     color: C.absent.line },
      { name: "人员聚集", value: totals["人员聚集"] ?? 0, color: C.crowd.line },
    ];
  }, [trendData, trendKeys]);

  const totalBehaviors = useMemo(() =>
    distributionData.reduce((sum, d) => sum + d.value, 0),
  [distributionData]);

  // 今日数据（用于卡片标题）
  const todayCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return alerts.filter(a => a.time?.startsWith(today)).length;
  }, [alerts]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-8 px-1">
      {/* header */}
      <header className="flex justify-between items-end pt-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">控制台概览</h1>
          <p className="text-gray-400 text-sm mt-0.5">实时监控数据与系统运行分析</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { exportCsv(); toast.show("报告已导出成功"); }}
            className="h-9 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 hover:bg-blue-700 transition-colors shadow-sm active:scale-95 cursor-pointer">
            <Download size={15}/> 导出报告
          </button>
        </div>
      </header>

      {error && <ErrorBanner message={error} onRetry={() => { setError(null); loadTrend(trendRange); }} />}

      {/* metric cards */}
      <div className="grid grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.key}
            className={cn("relative bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow overflow-hidden group cursor-default")}>
            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                 style={{ backgroundColor: c.style.line }}/>
            <div className="flex items-start justify-between mb-3">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", c.style.bg, c.style.text)}>
                {c.icon}
              </div>
              <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full",
                c.change.startsWith("+") ? "bg-red-50 text-red-500"
                : c.change.startsWith("—") ? "bg-gray-100 text-gray-400"
                : "bg-emerald-50 text-emerald-600"
              )}>{c.change}</span>
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{c.label}</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-gray-900 font-tabular-nums tracking-tight">
                {c.count.toString().padStart(2, "0")}
              </span>
              <span className="text-xs text-gray-300 font-medium">件/今日</span>
            </div>
          </div>
        ))}
      </div>

      {/* trend + distribution row */}
      <div className="grid grid-cols-3 gap-4">
        {/* trend chart */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-100 p-5 flex flex-col h-[460px]">
          <div className="flex justify-between items-center mb-5">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-gray-400"/>
              <h3 className="text-base font-bold text-gray-800">异常行为趋势分析</h3>
            </div>
            <div className="flex items-center gap-3">
              {/* legend */}
              <div className="flex gap-4 mr-3">
                {trendKeys.map(key => (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TREND_COLORS[key] }}/>
                    <span className="text-xs font-medium text-gray-500">{key}</span>
                  </div>
                ))}
              </div>
              {/* range toggle */}
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                {RANGE_OPTIONS.map(opt => (
                  <button key={opt.key} onClick={() => loadTrend(opt.key)}
                    className={cn(
                      "px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer",
                      trendRange === opt.key
                        ? "bg-white text-gray-800 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    )}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="gradFight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.15}/>
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.01}/>
                  </linearGradient>
                  <linearGradient id="gradFall" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.15}/>
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.01}/>
                  </linearGradient>
                  <linearGradient id="gradAbsent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.15}/>
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.01}/>
                  </linearGradient>
                  <linearGradient id="gradCrowd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.15}/>
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                <XAxis dataKey="name" axisLine={false} tickLine={false}
                       tick={{ fontSize: 12, fill: "#94a3b8" }} dy={8}/>
                <YAxis axisLine={false} tickLine={false}
                       tick={{ fontSize: 12, fill: "#94a3b8" }} dx={-4}
                       allowDecimals={false}/>
                <Tooltip content={<ChartTooltip/>}
                  cursor={{ stroke: "#cbd5e1", strokeWidth: 1, strokeDasharray: "4 4" }}/>
                {trendKeys.map(key => (
                  <Area key={key} type="monotone" dataKey={key}
                        stroke={TREND_COLORS[key]} strokeWidth={2.5}
                        fill={TREND_FILLS[key]}
                        dot={false}
                        activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff", fill: TREND_COLORS[key] }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* distribution */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col h-[460px]">
          <h3 className="text-base font-bold text-gray-800 mb-2">行为分布</h3>
          <div className="flex-1 relative min-h-0 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie data={distributionData} innerRadius="58%" outerRadius="82%"
                     paddingAngle={2} dataKey="value" cornerRadius={4}
                     label={({ name, percent }) => percent > 0.05 ? name : ""}
                     labelLine={{ strokeWidth: 1, stroke: "#cbd5e1" }}>
                  {distributionData.map((e, i) => <Cell key={i} fill={e.color}/>)}
                </Pie>
                <Tooltip formatter={(v: number, n: string) => [`${v} 件`, n]}
                         contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13 }}/>
              </RePieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-900 leading-none">{totalBehaviors}</p>
                <p className="text-xs text-gray-400 font-medium mt-1">事件总数</p>
              </div>
            </div>
          </div>
          <div className="shrink-0 grid grid-cols-2 gap-x-4 gap-y-2.5 pt-3 border-t border-gray-50">
            {distributionData.map(item => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }}/>
                  <span className="text-xs text-gray-500">{item.name}</span>
                </div>
                <span className="text-xs font-semibold text-gray-700 font-tabular-nums">
                  {totalBehaviors > 0 ? Math.round(item.value / totalBehaviors * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* status + alerts row */}
      <div className="grid grid-cols-3 gap-4">
        {/* system status */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 h-[380px] flex flex-col">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-base font-bold text-gray-800">系统运行状态</h3>
            <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full",
              status && status.cpuUsage < 80 && status.memoryUsage < 80
                ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
            )}>{status && status.cpuUsage < 80 && status.memoryUsage < 80 ? "正常运行" : "负载较高"}</span>
          </div>
          <div className="space-y-5 flex-1">
            <StatusRow icon={<Cpu size={14}/>}       label="CPU 负载"  value={status?.cpuUsage ?? 0}     color="#3b82f6"/>
            <StatusRow icon={<Activity size={14}/>}   label="内存使用"  value={status?.memoryUsage ?? 0}  color="#8b5cf6"/>
            <StatusRow icon={<HardDrive size={14}/>}  label="存储空间"  value={status?.storageUsage ?? 0} color="#f59e0b"/>
            <StatusRow icon={<Zap size={14}/>}        label="GPU 算力"  value={status?.gpuUsage ?? 0}     color="#10b981"/>
          </div>
          <div className="mt-auto pt-4 border-t border-gray-50 grid grid-cols-2 gap-4">
            <MiniStat label="在线设备" value={status?.onlineDevices} total={status?.totalDevices}/>
            <MiniStat label="AI 模型"  value={status?.activeModels}   total={status?.totalModels}/>
          </div>
        </div>

        {/* live alerts */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-100 h-[380px] flex flex-col overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50 flex justify-between items-center">
            <h3 className="text-base font-bold text-gray-800">实时告警</h3>
            <span className="text-xs text-gray-400">最近 10 条</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/60 sticky top-0 z-10">
                <tr className="text-xs uppercase font-semibold text-gray-400 tracking-wider">
                  <th className="px-5 py-2.5">时间</th>
                  <th className="px-5 py-2.5">类型</th>
                  <th className="px-5 py-2.5">地点</th>
                  <th className="px-5 py-2.5">置信度</th>
                  <th className="px-5 py-2.5 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                {alerts.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-300">暂无告警</td></tr>
                ) : alerts.slice(0, 10).map(a => {
                  const s = TYPE_STYLE[a.type] ?? C.crowd;
                  return (
                    <tr key={a.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-5 py-3 font-mono text-xs text-gray-600 font-medium">
                        {new Date(a.time).toLocaleTimeString()}
                      </td>
                      <td className="px-5 py-3">
                        <span className={cn("text-xs font-semibold px-2 py-0.5 rounded", s.badge)}>
                          {a.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500">{a.cameraName}</td>
                      <td className="px-5 py-3">
                        <span className={cn("font-mono text-xs font-semibold",
                          a.confidence > 95 ? "text-emerald-500" : "text-amber-500"
                        )}>{a.confidence.toFixed(1)}%</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => navigate(`/monitor?cam=${a.cameraId}&time=${a.time}`)}
                          className="text-blue-600 text-xs font-semibold hover:text-blue-700 flex items-center gap-0.5 ml-auto cursor-pointer">
                          回放 <Play size={10} fill="currentColor"/>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── helpers ── */

function getChange(compare: Record<string, { change: number }> | null | undefined, behavior: string): string {
  if (!compare?.[behavior]) return "—";
  const c = compare[behavior].change;
  return c > 0 ? `+${c}%` : c < 0 ? `${c}%` : "稳定";
}

function StatusRow({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: number, color: string }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <div className="flex items-center gap-1.5 text-gray-500">
          <span className="text-gray-400">{icon}</span>
          <span className="text-xs font-medium">{label}</span>
        </div>
        <span className="text-xs font-semibold text-gray-700 font-mono">{value}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
             style={{ width: `${value}%`, backgroundColor: color }}/>
      </div>
    </div>
  );
}

function MiniStat({ label, value, total }: { label: string, value?: number | string, total?: number | string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 font-medium mb-0.5">{label}</p>
      <div className="flex items-baseline gap-0.5">
        <span className="text-xl font-bold text-gray-900 font-tabular-nums">{value ?? "—"}</span>
        <span className="text-xs text-gray-300 font-mono">/ {total ?? "—"}</span>
      </div>
    </div>
  );
}
