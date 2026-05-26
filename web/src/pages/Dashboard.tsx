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
  AlertTriangle,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
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
import { exportCsv } from "../services/dataService";
import { AlertType, Alert as RealAlert } from "../types";
import { subscribeSse } from "../lib/api";
import {
  useMockSystemStatus,
  useMockTrendData,
  useMockAlerts,
} from "../lib/useMock";

/* ── palette ── */
const C = {
  fight:   { line: "#e54d4d", fill: "rgba(229,77,77,0.08)",  bg: "bg-error-container",    text: "text-danger-red",    badge: "bg-error-container text-danger-red" },
  fall:    { line: "#e5952e", fill: "rgba(229,149,46,0.08)", bg: "bg-warning-container",  text: "text-warning-orange", badge: "bg-warning-container text-warning-orange" },
  absent:  { line: "#06b6d4", fill: "rgba(6,182,212,0.08)",  bg: "bg-info-cyan/5",        text: "text-info-cyan",      badge: "bg-info-cyan/10 text-info-cyan" },
  crowd:   { line: "#8b5cf6", fill: "rgba(139,92,246,0.08)", bg: "bg-detect-purple/10",   text: "text-detect-purple",  badge: "bg-detect-purple/10 text-detect-purple" },
};

const TREND_COLORS: Record<string, string> = {
  "打架": "#e54d4d",
  "跌倒": "#e5952e",
  "自杀": "#ef4444",
  "人员聚集": "#8b5cf6",
};

const TREND_FILLS: Record<string, string> = {
  "打架": "url(#gradFight)",
  "跌倒": "url(#gradFall)",
  "自杀": "url(#gradAbsent)",
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
    <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-outline-variant px-4 py-3 min-w-[140px]">
      <p className="text-xs font-semibold text-outline mb-2">{label}</p>
      <div className="space-y-1.5">
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TREND_COLORS[p.name] }}/>
              <span className="text-xs text-on-surface-variant">{p.name}</span>
            </div>
            <span className="text-xs font-semibold text-on-surface">{p.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-outline-variant flex justify-between">
        <span className="text-xs text-outline">合计</span>
        <span className="text-xs font-bold text-on-surface">{total}</span>
      </div>
    </div>
  );
}

/* ── main component ── */
export default function Dashboard() {
  const toast = useToast();
  const navigate = useNavigate();

  // ┌──────────────────────────────────────────────────────┐
  // │  SSE 订阅手动报警 — 底层是单例 EventSource            │
  // │  演讲提示: "5种事件(摄像头/告警/系统指标/审计/统计)    │
  // │            共享一条 SSE 连接，subscribeSse 内部用       │
  // │            引用计数管理，第一个订阅者创建连接，          │
  // │            最后一个归零时断开"                          │
  // └──────────────────────────────────────────────────────┘
  const [manualAlerts, setManualAlerts] = useState<RealAlert[]>([]);

  useEffect(() => {
    return subscribeSse("alerts", (data: any) => {
      if (!Array.isArray(data)) return;
      const manual = data.filter((a: any) => a.snapshotUrl && a.message?.startsWith("手动报警"));
      setManualAlerts(manual);
    });
  }, []);
  const [mockAlerts] = useMockAlerts();
  const mergedAlerts = useMemo(() => {
    return mockAlerts.slice(0, 10);
  }, [mockAlerts]);

  const status = useMockSystemStatus();
  const [trendRange, setTrendRange] = useState<"day" | "week" | "month">("week");
  const trendDataRaw = useMockTrendData(trendRange);
  const monthDataRaw = useMockTrendData("month");

  // 趋势数据转换 + 派生分布
  const { trendData, trendKeys } = useMemo(() => {
    if (!trendDataRaw?.labels) return { trendData: [], trendKeys: [] as string[] };
    const keys = Object.keys(trendDataRaw.data);
    return {
      trendKeys: keys,
      trendData: trendDataRaw.labels.map((label: string, i: number) => {
        const point: Record<string, any> = { name: label };
        for (const key of keys) point[key] = trendDataRaw.data[key][i] ?? 0;
        return point;
      }),
    };
  }, [trendDataRaw]);

  // 从月度趋势数据求和，派生卡片计数（与趋势图/饼图同源）
  const monthlyCounts = useMemo(() => {
    if (!monthDataRaw?.data) return { "打架": 0, "跌倒": 0, "自杀": 0, "人员聚集": 0 };
    const counts: Record<string, number> = {};
    for (const [key, vals] of Object.entries(monthDataRaw.data)) {
      counts[key] = (vals as number[]).reduce((s, v) => s + v, 0);
    }
    return counts;
  }, [monthDataRaw]);

  const enrichedBehaviorCounts = useMemo(() => {
    const base = { ...monthlyCounts };
    const typeToKey: Record<string, string> = {
      "打架": "打架", "跌倒": "跌倒", "自杀": "自杀", "人员聚集": "人员聚集",
    };
    for (const a of manualAlerts) {
      const key = typeToKey[a.type] ?? a.type;
      base[key] = (base[key] ?? 0) + 1;
    }
    return base;
  }, [monthlyCounts, manualAlerts]);

  const cards = useMemo(() => [
    { key: "fight",  icon: <ShieldAlert size={22}/>,  label: "打架事件", count: enrichedBehaviorCounts["打架"] ?? 0, style: C.fight },
    { key: "fall",   icon: <Accessibility size={22}/>, label: "人员跌倒", count: enrichedBehaviorCounts["跌倒"] ?? 0, style: C.fall },
    { key: "absent", icon: <UserMinus size={22}/>,    label: "自杀行为", count: enrichedBehaviorCounts["自杀"] ?? 0, style: C.absent },
    { key: "crowd",  icon: <Users size={22}/>,        label: "人员聚集", count: enrichedBehaviorCounts["人员聚集"] ?? 0, style: C.crowd },
  ], [enrichedBehaviorCounts]);

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
      { name: "自杀",     value: totals["自杀"] ?? 0,     color: C.absent.line },
      { name: "人员聚集", value: totals["人员聚集"] ?? 0, color: C.crowd.line },
    ];
  }, [trendData, trendKeys]);

  const totalBehaviors = useMemo(() =>
    distributionData.reduce((sum, d) => sum + d.value, 0),
  [distributionData]);

  return (
    <div className="space-y-5 max-w-[1600px] mx-auto pb-8">
      {/* header */}
      <header className="flex justify-between items-end pt-1">
        <div className="flex gap-2.5">
          <button onClick={() => { exportCsv(); toast.show("报告已导出成功"); }}
            className="h-9 px-5 bg-gradient-to-r from-primary to-blue-500 text-white rounded-lg text-[13px] font-semibold flex items-center gap-2 hover:shadow-lg hover:shadow-primary/20 transition-all shadow-md cursor-pointer">
            <Download size={14}/> 导出报告
          </button>
        </div>
      </header>

      {/* ┌──────────────────────────────────────────────────────┐
      // │  4 张指标卡片 — 打架/跌倒/离岗/聚集                   │
      // └──────────────────────────────────────────────────────┘ */}
      <div className="grid grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.key}
            className={cn("relative bg-white rounded-xl border border-outline-variant p-5 hover:shadow-lg transition-all duration-300 overflow-hidden group cursor-default", c.style.bg)}>
            {/* 顶部装饰线 */}
            <div className="absolute left-0 top-0 right-0 h-[3px] rounded-t-xl" style={{ background: `linear-gradient(90deg, ${c.style.line}, transparent)` }}/>
            {/* 图标区 */}
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4 shadow-sm", c.style.bg)}>
              <div className={cn("", c.style.text)}>{c.icon}</div>
            </div>
            <p className="text-[11px] font-semibold text-outline uppercase tracking-wider mb-1">{c.label}</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[28px] font-bold text-on-surface font-tabular-nums tracking-tight leading-none">
                {c.count.toString().padStart(2, "0")}
              </span>
              <span className="text-[11px] text-outline font-medium">件/本月</span>
            </div>
          </div>
        ))}
      </div>

      {/* trend + distribution row */}
      <div className="grid grid-cols-3 gap-4">
        {/* ┌──────────────────────────────────────────────────────┐
        // │  AreaChart 趋势图 — 多系列面积图                      │
        // └──────────────────────────────────────────────────────┘ */}
        <div className="col-span-2 bg-white rounded-xl border border-outline-variant p-5 flex flex-col h-[440px] shadow-sm">
          <div className="flex justify-between items-center mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp size={16} className="text-primary"/>
              </div>
              <h3 className="text-[15px] font-bold text-on-surface tracking-tight">异常行为趋势</h3>
            </div>
            <div className="flex items-center gap-4">
              {/* legend */}
              <div className="flex gap-4 mr-2">
                {trendKeys.map(key => (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TREND_COLORS[key] }}/>
                    <span className="text-[12px] font-medium text-on-surface-variant">{key}</span>
                  </div>
                ))}
              </div>
              {/* range toggle */}
              <div className="flex bg-surface-container-low rounded-lg p-0.5">
                {RANGE_OPTIONS.map(opt => (
                  <button key={opt.key} onClick={() => setTrendRange(opt.key)}
                    className={cn(
                      "px-3 py-1 text-[12px] font-medium rounded-md transition-all cursor-pointer",
                      trendRange === opt.key
                        ? "bg-white text-on-surface shadow-sm"
                        : "text-on-surface-variant hover:text-on-surface"
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
                    <stop offset="0%" stopColor="#e54d4d" stopOpacity={0.12}/>
                    <stop offset="100%" stopColor="#e54d4d" stopOpacity={0.01}/>
                  </linearGradient>
                  <linearGradient id="gradFall" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e5952e" stopOpacity={0.12}/>
                    <stop offset="100%" stopColor="#e5952e" stopOpacity={0.01}/>
                  </linearGradient>
                  <linearGradient id="gradAbsent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.12}/>
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.01}/>
                  </linearGradient>
                  <linearGradient id="gradCrowd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.12}/>
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8eaf2"/>
                <XAxis dataKey="name" axisLine={false} tickLine={false}
                       tick={{ fontSize: 11, fill: "#a0a8b8" }} dy={8}/>
                <YAxis axisLine={false} tickLine={false}
                       tick={{ fontSize: 11, fill: "#a0a8b8" }} dx={-4}
                       allowDecimals={false}/>
                <Tooltip content={<ChartTooltip/>}
                  cursor={{ stroke: "#e4e7ee", strokeWidth: 1, strokeDasharray: "4 4" }}/>
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

        {/* ┌──────────────────────────────────────────────────────┐
        // │  PieChart 饼图 — 行为分布                              │
        // └──────────────────────────────────────────────────────┘ */}
        <div className="bg-white rounded-xl border border-outline-variant p-5 flex flex-col h-[440px] shadow-sm">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Activity size={16} className="text-primary"/>
            </div>
            <h3 className="text-[15px] font-bold text-on-surface tracking-tight">行为分布</h3>
          </div>
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
                         contentStyle={{ borderRadius: 10, border: "1px solid #e4e7ee", fontSize: 12 }}/>
              </RePieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-[28px] font-bold text-on-surface leading-none">{totalBehaviors}</p>
                <p className="text-[11px] text-outline font-medium mt-1.5">事件总数</p>
              </div>
            </div>
          </div>
          <div className="shrink-0 grid grid-cols-2 gap-x-4 gap-y-2.5 pt-3 border-t border-outline-variant/50">
            {distributionData.map(item => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }}/>
                  <span className="text-[12px] text-on-surface-variant">{item.name}</span>
                </div>
                <span className="text-[12px] font-semibold text-on-surface font-tabular-nums">
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
        <div className="bg-white rounded-xl border border-outline-variant p-5 h-[360px] flex flex-col shadow-sm">
          <div className="flex justify-between items-center mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Cpu size={16} className="text-primary"/>
              </div>
              <h3 className="text-[15px] font-bold text-on-surface tracking-tight">系统状态</h3>
            </div>
            <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full",
              status && status.cpuUsage < 80 && status.memoryUsage < 80
                ? "bg-success-green/10 text-success-green" : "bg-warning-container text-warning-orange"
            )}>{status && status.cpuUsage < 80 && status.memoryUsage < 80 ? "正常" : "负载高"}</span>
          </div>
          <div className="space-y-5 flex-1">
            <StatusRow icon={<Cpu size={14}/>}       label="CPU 负载"  value={status?.cpuUsage ?? 0}     color="#4f6ef7"/>
            <StatusRow icon={<Activity size={14}/>}   label="内存使用"  value={status?.memoryUsage ?? 0}  color="#8b5cf6"/>
            <StatusRow icon={<HardDrive size={14}/>}  label="存储空间"  value={status?.storageUsage ?? 0} color="#f59e0b"/>
            <StatusRow icon={<Zap size={14}/>}        label="GPU 算力"  value={status?.gpuUsage ?? 0}     color="#10b981"/>
          </div>
          <div className="mt-auto pt-4 border-t border-outline-variant/50 grid grid-cols-2 gap-4">
            <MiniStat label="在线设备" value={status?.onlineDevices} total={status?.totalDevices}/>
            <MiniStat label="AI 模型"  value={status?.activeModels}   total={status?.totalModels}/>
          </div>
        </div>

        {/* ┌──────────────────────────────────────────────────────┐
        // │  实时告警表格 — 最近 10 条                              │
        // └──────────────────────────────────────────────────────┘ */}
        <div className="col-span-2 bg-white rounded-xl border border-outline-variant h-[360px] flex flex-col overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-outline-variant/50 flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-danger-red/10 flex items-center justify-center">
                <AlertTriangle size={16} className="text-danger-red"/>
              </div>
              <h3 className="text-[15px] font-bold text-on-surface tracking-tight">实时告警</h3>
            </div>
            <span className="text-[11px] text-outline/70">最近 10 条</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low sticky top-0 z-10">
                <tr className="text-[11px] uppercase font-semibold text-outline tracking-wider">
                  <th className="px-5 py-2.5">时间</th>
                  <th className="px-5 py-2.5">类型</th>
                  <th className="px-5 py-2.5">地点</th>
                  <th className="px-5 py-2.5">置信度</th>
                  <th className="px-5 py-2.5 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50 text-[13px]">
                {mergedAlerts.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-outline/60">暂无告警</td></tr>
                ) : mergedAlerts.map(a => {
                  const s = TYPE_STYLE[a.type] ?? C.crowd;
                  return (
                    <tr key={a.id} className="hover:bg-surface-container-low transition-colors group">
                      <td className="px-5 py-3 font-mono text-[12px] text-on-surface-variant font-medium">
                        {new Date(a.time).toLocaleTimeString()}
                      </td>
                      <td className="px-5 py-3">
                        <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-md", s.badge)}>
                          {a.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-on-surface-variant">{a.cameraName}</td>
                      <td className="px-5 py-3">
                        <span className={cn("font-mono text-[12px] font-semibold",
                          a.confidence > 95 ? "text-success-green" : "text-warning-orange"
                        )}>{a.confidence.toFixed(1)}%</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => navigate(`/monitor?cam=${a.cameraId}&time=${a.time}`)}
                          className="text-primary/80 text-[12px] font-semibold hover:text-primary flex items-center gap-1 ml-auto cursor-pointer transition-colors">
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

function StatusRow({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: number, color: string }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <div className="flex items-center gap-1.5 text-on-surface-variant">
          <span className="text-outline">{icon}</span>
          <span className="text-xs font-medium">{label}</span>
        </div>
        <span className="text-xs font-semibold text-on-surface font-mono">{value}%</span>
      </div>
      <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
             style={{ width: `${value}%`, backgroundColor: color }}/>
      </div>
    </div>
  );
}

function MiniStat({ label, value, total }: { label: string, value?: number | string, total?: number | string }) {
  return (
    <div>
      <p className="text-xs text-outline font-medium mb-0.5">{label}</p>
      <div className="flex items-baseline gap-0.5">
        <span className="text-xl font-bold text-on-surface font-tabular-nums">{value ?? "—"}</span>
        <span className="text-xs text-outline font-mono">/ {total ?? "—"}</span>
      </div>
    </div>
  );
}
