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
} from "../lib/useMock";
import { useRealAlerts } from "../lib/useRealAlerts";

/* ── palette ── */
const C = {
  fight:   { line: "#ef4444", fill: "rgba(239,68,68,0.08)",  bg: "bg-red-50",    text: "text-red-600",    badge: "bg-red-100 text-red-700" },
  fall:    { line: "#f97316", fill: "rgba(249,115,22,0.08)", bg: "bg-orange-50", text: "text-orange-600", badge: "bg-orange-100 text-orange-700" },
  absent:  { line: "#3b82f6", fill: "rgba(59,130,246,0.08)", bg: "bg-blue-50",   text: "text-blue-600",   badge: "bg-blue-100 text-blue-700" },
  crowd:   { line: "#eab308", fill: "rgba(234,179,8,0.08)",  bg: "bg-yellow-50", text: "text-yellow-600", badge: "bg-yellow-100 text-yellow-700" },
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
  "自杀": { line: "#7c3aed", fill: "rgba(124,58,237,0.08)", bg: "bg-purple-50", text: "text-purple-600", badge: "bg-purple-100 text-purple-700" },
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
  const { alerts } = useRealAlerts();

  const mergedAlerts = useMemo(() => {
    return [...manualAlerts, ...alerts].slice(0, 10);
  }, [manualAlerts, alerts]);

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
    if (!monthDataRaw?.data) return { "打架": 0, "跌倒": 0, "离岗": 0, "人员聚集": 0 };
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
    { key: "absent", icon: <UserMinus size={22}/>,    label: "违规离岗", count: enrichedBehaviorCounts["离岗"] ?? 0, style: C.absent },
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
      { name: "离岗",     value: totals["离岗"] ?? 0,     color: C.absent.line },
      { name: "人员聚集", value: totals["人员聚集"] ?? 0, color: C.crowd.line },
    ];
  }, [trendData, trendKeys]);

  const totalBehaviors = useMemo(() =>
    distributionData.reduce((sum, d) => sum + d.value, 0),
  [distributionData]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-8 px-1">
      {/* header */}
      <header className="flex justify-between items-end pt-2">
        <div className="flex gap-2">
          <button onClick={() => { exportCsv(); toast.show("报告已导出成功"); }}
            className="h-9 px-4 bg-primary text-white rounded-lg text-sm font-medium flex items-center gap-1.5 hover:bg-primary/90 transition-colors shadow-sm active:scale-95 cursor-pointer">
            <Download size={15}/> 导出报告
          </button>
        </div>
      </header>

      {/* ┌──────────────────────────────────────────────────────┐
      // │  4 张指标卡片 — 打架/跌倒/离岗/聚集                   │
      // │  演讲提示: "数据来自 /api/stats 的 behaviorCounts，    │
      // │            apiGet 内置 30 秒内存缓存 + 并发去重，       │
      // │            10 个组件同时请求同一个 URL 只发 1 次 HTTP"  │
      // └──────────────────────────────────────────────────────┘ */}
      <div className="grid grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.key}
            className={cn("relative bg-white rounded-xl border border-outline-variant p-5 hover:shadow-md transition-shadow overflow-hidden group cursor-default")}>
            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                 style={{ backgroundColor: c.style.line }}/>
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-4", c.style.bg, c.style.text)}>
              {c.icon}
            </div>
            <p className="text-xs font-semibold text-outline mb-1">{c.label}</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-on-surface font-tabular-nums tracking-tight">
                {c.count.toString().padStart(2, "0")}
              </span>
              <span className="text-xs text-outline font-medium">件/本月</span>
            </div>
          </div>
        ))}
      </div>

      {/* trend + distribution row */}
      <div className="grid grid-cols-3 gap-4">
        {/* ┌──────────────────────────────────────────────────────┐
        // │  AreaChart 趋势图 — 多系列面积图                      │
        // │  演讲提示: "Recharts AreaChart，打架/跌倒/离岗/聚集    │
        // │            四条曲线叠加，支持 24h/7d/30d 时间范围切换，  │
        // │            渐变填充区域降低视觉噪声"                     │
        // └──────────────────────────────────────────────────────┘ */}
        <div className="col-span-2 bg-white rounded-xl border border-outline-variant p-5 flex flex-col h-[460px]">
          <div className="flex justify-between items-center mb-5">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-outline"/>
              <h3 className="text-base font-bold text-on-surface">异常行为趋势分析</h3>
            </div>
            <div className="flex items-center gap-3">
              {/* legend */}
              <div className="flex gap-4 mr-3">
                {trendKeys.map(key => (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TREND_COLORS[key] }}/>
                    <span className="text-xs font-medium text-on-surface-variant">{key}</span>
                  </div>
                ))}
              </div>
              {/* range toggle */}
              <div className="flex bg-surface-container-high rounded-lg p-0.5">
                {RANGE_OPTIONS.map(opt => (
                  <button key={opt.key} onClick={() => setTrendRange(opt.key)}
                    className={cn(
                      "px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer",
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
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.15}/>
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.01}/>
                  </linearGradient>
                  <linearGradient id="gradFall" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.15}/>
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0.01}/>
                  </linearGradient>
                  <linearGradient id="gradAbsent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.15}/>
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.01}/>
                  </linearGradient>
                  <linearGradient id="gradCrowd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#eab308" stopOpacity={0.15}/>
                    <stop offset="100%" stopColor="#eab308" stopOpacity={0.01}/>
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

        {/* ┌──────────────────────────────────────────────────────┐
        // │  PieChart 饼图 — 行为分布                              │
        // │  演讲提示: "中心大数字是所有事件总数，                   │
        // │            外圈环形图各扇区是跌倒/打架/离岗/聚集占比"     │
        // └──────────────────────────────────────────────────────┘ */}
        {/* distribution */}
        <div className="bg-white rounded-xl border border-outline-variant p-5 flex flex-col h-[460px]">
          <h3 className="text-base font-bold text-on-surface mb-2">行为分布</h3>
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
                <p className="text-3xl font-bold text-on-surface leading-none">{totalBehaviors}</p>
                <p className="text-xs text-outline font-medium mt-1">事件总数</p>
              </div>
            </div>
          </div>
          <div className="shrink-0 grid grid-cols-2 gap-x-4 gap-y-2.5 pt-3 border-t border-outline-variant">
            {distributionData.map(item => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }}/>
                  <span className="text-xs text-on-surface-variant">{item.name}</span>
                </div>
                <span className="text-xs font-semibold text-on-surface font-tabular-nums">
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
        <div className="bg-white rounded-xl border border-outline-variant p-5 h-[380px] flex flex-col">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-base font-bold text-on-surface">系统运行状态</h3>
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
          <div className="mt-auto pt-4 border-t border-outline-variant grid grid-cols-2 gap-4">
            <MiniStat label="在线设备" value={status?.onlineDevices} total={status?.totalDevices}/>
            <MiniStat label="AI 模型"  value={status?.activeModels}   total={status?.totalModels}/>
          </div>
        </div>

        {/* ┌──────────────────────────────────────────────────────┐
        // │  实时告警表格 — 最近 10 条                              │
        // │  演讲提示: "报警触发时 Python 端自动截帧，                │
        // │            snapshotUrl 保存到 JSON，点回放按钮            │
        // │            跳转 /monitor?cam=&time= 看当时的画面"        │
        // └──────────────────────────────────────────────────────┘ */}
        {/* live alerts */}
        <div className="col-span-2 bg-white rounded-xl border border-outline-variant h-[380px] flex flex-col overflow-hidden">
          <div className="px-5 py-3.5 border-b border-outline-variant flex justify-between items-center">
            <h3 className="text-base font-bold text-on-surface">实时告警</h3>
            <span className="text-xs text-outline">最近 10 条</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low sticky top-0 z-10">
                <tr className="text-xs uppercase font-semibold text-outline tracking-wider">
                  <th className="px-5 py-2.5">时间</th>
                  <th className="px-5 py-2.5">类型</th>
                  <th className="px-5 py-2.5">地点</th>
                  <th className="px-5 py-2.5">置信度</th>
                  <th className="px-5 py-2.5 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant text-sm">
                {alerts.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-outline">暂无告警</td></tr>
                ) : mergedAlerts.map(a => {
                  const s = TYPE_STYLE[a.type] ?? C.crowd;
                  return (
                    <tr key={a.id} className="hover:bg-surface-container-low transition-colors group">
                      <td className="px-5 py-3 font-mono text-xs text-on-surface-variant font-medium">
                        {new Date(a.time).toLocaleTimeString()}
                      </td>
                      <td className="px-5 py-3">
                        <span className={cn("text-xs font-semibold px-2 py-0.5 rounded", s.badge)}>
                          {a.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-on-surface-variant">{a.cameraName}</td>
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
