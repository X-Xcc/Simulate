import { 
  ShieldAlert, 
  Accessibility, 
  UserMinus, 
  User, 
  BarChart3, 
  PieChart, 
  Activity, 
  Zap, 
  Download, 
  Calendar,
  Filter,
  MoreVertical,
  Play
} from "lucide-react";
import { useState, useEffect } from "react";
import { 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart,
  Area,
  PieChart as RePieChart,
  Pie,
  Cell
} from "recharts";
import { cn } from "../lib/utils";
import { subscribeToAlerts, subscribeToSystemStatus, fetchStatsSummary, fetchTrendData, fetchStatsCompare, exportCsv } from "../services/dataService";
import { Alert, SystemStatus, AlertType, StatsCompare } from "../types";

export default function Dashboard() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [trendData, setTrendData] = useState<{ name: string; current: number }[]>([]);
  const [compare, setCompare] = useState<StatsCompare | null>(null);

  useEffect(() => {
    const unsubAlerts = subscribeToAlerts(setAlerts);
    const unsubStatus = subscribeToSystemStatus(setStatus);
    fetchStatsSummary().then(setStats).catch(console.error);
    fetchStatsCompare().then(setCompare).catch(console.error);
    fetchTrendData("day").then(data => {
      if (data?.labels && data?.data) {
        setTrendData(data.labels.map((label: string, i: number) => ({
          name: label,
          current: data.data[i] ?? 0,
        })));
      }
    }).catch(console.error);
    return () => {
      unsubAlerts();
      unsubStatus();
    };
  }, []);

  const behaviorCounts = stats?.behaviorCounts ?? {};
  const alertCounts = {
    [AlertType.FIGHT]: behaviorCounts["打架"] ?? 0,
    [AlertType.FALL]: behaviorCounts["跌倒"] ?? 0,
    [AlertType.ABSENCE]: behaviorCounts["离岗"] ?? 0,
    [AlertType.CROWD]: behaviorCounts["人员聚集"] ?? 0,
  };

  const distributionData = [
    { name: '跌倒', value: behaviorCounts["跌倒"] ?? 0, color: '#0051ae' },
    { name: '打架', value: behaviorCounts["打架"] ?? 0, color: '#0058be' },
    { name: '离岗', value: behaviorCounts["离岗"] ?? 0, color: '#bf8700' },
    { name: '疲劳', value: behaviorCounts["疲劳"] ?? 0, color: '#c2c6d6' },
    { name: '人员聚集', value: behaviorCounts["人员聚集"] ?? 0, color: '#7c4dff' },
  ];

  const totalBehaviors = Object.values(behaviorCounts as Record<string, number>).reduce((a, b) => a + b, 0);

  const getChange = (behavior: string): string => {
    if (!compare?.[behavior]) return "—";
    const c = compare[behavior].change;
    return c > 0 ? `+${c}%` : c < 0 ? `${c}%` : "稳定";
  };

  return (
    <div className="space-y-xl max-w-[1600px] mx-auto pb-xl">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="font-bold text-title text-on-surface tracking-tight">控制台概览</h1>
          <p className="text-on-surface-variant text-body-lg mt-xs">实时监控数据与系统运行分析</p>
        </div>
        <div className="flex gap-sm">
          <button className="px-lg py-sm bg-white border border-outline-variant rounded-xl text-on-surface font-semibold flex items-center gap-sm hover:bg-surface-container-high transition-colors text-body-lg">
            <Calendar size={18} />
            过去24小时
          </button>
          <button onClick={() => exportCsv()} className="px-lg py-sm bg-primary text-white rounded-xl font-semibold flex items-center gap-sm hover:opacity-90 transition-opacity text-body-lg shadow-lg active:scale-95">
            <Download size={18} />
            导出报告
          </button>
        </div>
      </header>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-4 gap-xl">
        <MetricCard
          icon={<ShieldAlert size={20} />}
          label="打架事件"
          value={alertCounts[AlertType.FIGHT]}
          change={getChange("打架")}
          color="danger-red"
          bg="bg-error-container"
        />
        <MetricCard
          icon={<Accessibility size={20} />}
          label="人员跌倒"
          value={alertCounts[AlertType.FALL]}
          change={getChange("跌倒")}
          color="warning-orange"
          bg="bg-warning-orange/10"
        />
        <MetricCard
          icon={<UserMinus size={20} />}
          label="违规离岗"
          value={alertCounts[AlertType.ABSENCE]}
          change={getChange("离岗")}
          color="info-cyan"
          bg="bg-info-cyan/10"
        />
        <MetricCard
          icon={<User size={20} />}
          label="人员聚集"
          value={alertCounts[AlertType.CROWD]}
          change={getChange("人员聚集")}
          color="detect-purple"
          bg="bg-detect-purple/10"
        />
      </div>

      <div className="grid grid-cols-3 gap-xl">
        {/* Main Trend Chart */}
        <div className="col-span-2 bg-white p-xl rounded-xl border border-outline-variant shadow-sm flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-xl">
            <h3 className="font-bold text-body-lg text-on-surface">异常行为趋势分析</h3>
            <div className="flex gap-md">
              <div className="flex items-center gap-xs">
                <span className="w-3 h-3 bg-primary rounded-full"></span>
                <span className="text-on-surface-variant text-body-sm font-bold">当前周期</span>
              </div>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0051ae" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#0051ae" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f2f5" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 13, fill: '#727785' }}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#727785' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  cursor={{ stroke: '#adc6ff', strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="current"
                  stroke="#0051ae"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorCurrent)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribution Chart */}
        <div className="col-span-1 bg-white p-xl rounded-xl border border-outline-variant shadow-sm flex flex-col h-[400px]">
          <h3 className="font-bold text-body-lg text-on-surface mb-xl">行为分布</h3>
          <div className="flex-1 relative flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={distributionData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </RePieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <p className="font-bold text-title text-on-surface leading-none">{totalBehaviors}</p>
              <p className="text-body-lg text-outline uppercase font-bold mt-1">事件总数</p>
            </div>
            
            <div className="mt-xl w-full grid grid-cols-2 gap-y-md gap-x-xl px-md">
              {distributionData.map(item => (
                <div key={item.name} className="flex items-center gap-sm">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }}></div>
                  <span className="text-body-lg text-on-surface-variant truncate">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-xl">
        {/* System Status */}
        <div className="col-span-1 bg-white p-xl rounded-xl border border-outline-variant shadow-sm h-[400px] flex flex-col">
          <div className="flex justify-between items-center mb-xl">
            <h3 className="font-bold text-body-lg text-on-surface">系统运行状态</h3>
            <span className={cn(
              "px-md py-1 rounded-full text-body-sm font-bold",
              status && status.cpuUsage < 80 && status.memoryUsage < 80
                ? "bg-success-green/10 text-success-green"
                : "bg-warning-orange/10 text-warning-orange"
            )}>{status && status.cpuUsage < 80 && status.memoryUsage < 80 ? "正常运行" : "负载较高"}</span>
          </div>
          <div className="space-y-[28px] mt-md">
            <StatusProgress label="计算核心负载" value={status?.cpuUsage ?? 0} color="bg-primary" />
            <StatusProgress label="内存使用" value={status?.memoryUsage ?? 0} color="bg-detect-purple" />
            <StatusProgress label="存储空间" value={status?.storageUsage ?? 0} color="bg-warning-orange" />
            <StatusProgress label="GPU 算力" value={status?.gpuUsage ?? 0} color="bg-success-green" />
          </div>

          <div className="mt-auto pt-xl border-t border-outline-variant">
            <div className="grid grid-cols-2 gap-xl">
              <div>
                <p className="text-outline font-bold text-body-lg uppercase mb-1">在线设备</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-title font-bold text-on-surface font-mono">{status?.onlineDevices ?? "—"}</span>
                  <span className="text-body-sm text-outline font-mono">/ {status?.totalDevices ?? "—"}</span>
                </div>
              </div>
              <div>
                <p className="text-outline font-bold text-body-lg uppercase mb-1">活跃AI模型</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-title font-bold text-on-surface font-mono">{status?.activeModels ?? "—"}</span>
                  <span className="text-body-sm text-outline font-mono">/ {status?.totalModels ?? "—"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Alerts Table */}
        <div className="col-span-2 bg-white rounded-xl border border-outline-variant shadow-sm h-[400px] flex flex-col overflow-hidden">
          <div className="p-xl border-b border-outline-variant flex justify-between items-center bg-surface-container-low/30">
            <h3 className="font-bold text-body-lg text-on-surface">实时告警订阅</h3>
            <div className="flex gap-sm">
              <button className="p-xs text-outline hover:text-on-surface transition-colors">
                <Filter size={18} />
              </button>
              <button className="p-xs text-outline hover:text-on-surface transition-colors">
                <MoreVertical size={18} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low/50 sticky top-0 z-10 text-body-sm uppercase font-bold text-outline tracking-wider">
                <tr>
                  <th className="px-xl py-md">时间</th>
                  <th className="px-xl py-md">类型</th>
                  <th className="px-xl py-md">地点</th>
                  <th className="px-xl py-md">置信度</th>
                  <th className="px-xl py-md text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30 text-body-lg">
                {alerts.slice(0, 10).map((alert) => (
                  <tr key={alert.id} className="hover:bg-surface-container-low transition-colors group">
                    <td className="px-xl py-md font-mono font-bold">{new Date(alert.time).toLocaleTimeString()}</td>
                    <td className="px-xl py-md">
                      <span className={cn(
                        "px-sm py-1 rounded text-body-lg font-black uppercase",
                        alert.type === AlertType.FIGHT ? "bg-error-container text-on-error-container" : 
                        alert.type === AlertType.FALL ? "bg-warning-orange/10 text-warning-orange" : 
                        alert.type === AlertType.CROWD ? "bg-detect-purple/10 text-detect-purple" : 
                        "bg-info-cyan/10 text-info-cyan"
                      )}>
                        {alert.type}
                      </span>
                    </td>
                    <td className="px-xl py-md text-on-surface-variant font-medium">{alert.cameraName}</td>
                    <td className="px-xl py-md">
                      <span className={cn(
                        "font-mono font-bold",
                        alert.confidence > 95 ? "text-success-green" : "text-warning-orange"
                      )}>
                        {alert.confidence.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-xl py-md text-right">
                      <button className="text-primary font-bold hover:underline flex items-center gap-1 ml-auto group-hover:scale-105 transition-transform">
                        查看回放 <Play size={12} fill="currentColor" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, change, color, bg }: { icon: any, label: string, value: number, change: string, color: string, bg: string }) {
  const isUp = change.startsWith("+");
  const isSteady = change === "稳定";

  return (
    <div className="bg-white p-xl rounded-xl border border-outline-variant shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
      <div className="flex justify-between items-start mb-md">
        <div className={cn("p-md rounded-lg flex items-center justify-center", bg, `text-${color}`)}>
          {icon}
        </div>
        <span className={cn(
          "font-bold text-body-lg font-mono",
          isUp ? "text-danger-red" : isSteady ? "text-info-cyan" : "text-success-green"
        )}>
          {change}
        </span>
      </div>
      <p className="text-outline font-bold text-body-lg uppercase tracking-wider mb-sm">{label}</p>
      <div className="flex items-baseline gap-sm">
        <h2 className="font-mono text-title font-black text-on-surface tracking-tight">
          {value.toString().padStart(2, '0')}
        </h2>
        <span className="text-outline-variant font-bold text-body-lg uppercase">件 / 今日</span>
      </div>
      
      {/* Decorative pulse line for fights */}
      {label === "打架事件" && (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-danger-red/10 overflow-hidden">
          <div className="h-full bg-danger-red animate-[shimmer_2s_infinite]" style={{ width: '30%' }} />
        </div>
      )}
    </div>
  );
}

function StatusProgress({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div className="flex flex-col gap-sm">
      <div className="flex justify-between font-bold text-body-lg uppercase text-on-surface-variant">
        <span>{label}</span>
        <span className="font-mono">{value}%</span>
      </div>
      <div className="h-2 bg-surface-container rounded-full overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all duration-1000", color)} 
          style={{ width: `${value}%` }} 
        />
      </div>
    </div>
  );
}
