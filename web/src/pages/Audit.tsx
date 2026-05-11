import { useState, useEffect } from "react";
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell
} from "recharts";
import {
  Activity,
  ShieldAlert,
  Search,
  Download,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "../lib/utils";
import { subscribeToAuditLogs, fetchAuditLogsPage, fetchAuditTrend, exportAuditLogs, fetchAutomationRate } from "../services/dataService";
import { AuditLog, PageResponse } from "../types";

export default function Audit() {
  const [auditTrend, setAuditTrend] = useState<{ name: string; value: number }[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [auditPage, setAuditPage] = useState<PageResponse<AuditLog>>({ items: [], total: 0, page: 0, size: 20 });
  const [automationRate, setAutomationRate] = useState(0);
  const [trendRange, setTrendRange] = useState<"day" | "week">("week");

  const loadTrend = (range: "day" | "week") => {
    setTrendRange(range);
    setAuditTrend([]);
    fetchAuditTrend(range).then(data => {
      if (data?.labels && data?.data) {
        setAuditTrend(data.labels.map((l: string, i: number) => ({ name: l, value: data.data[i] ?? 0 })));
      }
    }).catch(console.error);
  };

  // Load trend data
  useEffect(() => {
    fetchAuditTrend("week").then(data => {
      if (data?.labels && data?.data) {
        setAuditTrend(data.labels.map((l: string, i: number) => ({ name: l, value: data.data[i] ?? 0 })));
      }
    }).catch(console.error);
    fetchAutomationRate().then(d => setAutomationRate(d.rate)).catch(console.error);
  }, []);

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAuditLogsPage({ search: searchTerm || undefined, page: 0, size: 20 }).then(setAuditPage);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // SSE live updates
  useEffect(() => {
    const unsub = subscribeToAuditLogs(() => {
      fetchAuditLogsPage({ search: searchTerm || undefined, page: 0, size: 20 }).then(setAuditPage);
    });
    return () => unsub();
  }, []);

  const highRiskCount = auditPage.items.filter(l => l.riskLevel === 'high').length;

  // Weekly report: aggregate from auditPage.items by category
  const weeklyReports = (() => {
    const highItems = auditPage.items.filter(l => l.riskLevel === "high");
    if (highItems.length === 0 && auditPage.total === 0) {
      return null; // no data
    }
    const categories: Record<string, { count: number; detail: string }> = {};
    for (const item of auditPage.items) {
      if (!categories[item.category]) {
        categories[item.category] = { count: 0, detail: item.action };
      }
      categories[item.category].count++;
    }
    const entries = Object.entries(categories);
    if (entries.length === 0) return null;
    return entries.slice(0, 3).map(([cat, info]) => ({
      title: cat,
      risk: highItems.some(h => h.category === cat) ? "high" : "medium",
      color: highItems.some(h => h.category === cat) ? "border-danger-red" : "border-warning-orange",
      detail: `${cat}相关操作 ${info.count} 次，最近：${info.detail}`,
    }));
  })();

  return (
    <div className="space-y-lg flex flex-col h-full overflow-hidden">
      {/* Metrics */}
      <section className="grid grid-cols-3 gap-xl shrink-0">
        {[
          { label: "本期操作总量", value: auditPage.total.toLocaleString(), change: "总计", icon: Activity, color: "text-primary", bg: "bg-primary/10" },
          { label: "高危预警次数", value: highRiskCount.toString(), change: "当前页高危", icon: ShieldAlert, color: "text-danger-red", bg: "bg-error-container/40" },
          { label: "系统自动化率", value: `${automationRate}%`, change: "核心稳定", icon: CheckCircle2, color: "text-success-green", bg: "bg-success-green/10", bar: automationRate },
        ].map(s => (
          <div key={s.label} className="bg-white p-lg border border-outline-variant rounded-xl shadow-sm hover:shadow-md transition-all">
             <div className="flex justify-between items-start mb-md">
                <div>
                   <p className="text-body-lg font-bold text-on-surface-variant uppercase tracking-widest mb-unit">{s.label}</p>
                   <h3 className={cn("text-title font-bold font-mono tracking-tighter", s.color)}>{s.value}</h3>
                </div>
                <div className={cn("p-sm rounded-lg", s.bg)}>
                   <s.icon className={s.color} size={20} />
                </div>
             </div>
             <div className="flex items-center gap-xs text-body-lg font-bold opacity-60">
                {s.change}
             </div>
             {s.bar && (
               <div className="mt-md w-full h-1 bg-surface-container rounded-full overflow-hidden">
                  <div className="bg-success-green h-full" style={{ width: `${s.bar}%` }} />
               </div>
             )}
          </div>
        ))}
      </section>

      <div className="grid grid-cols-12 gap-lg shrink-0">
         {/* Active Trends Chart */}
         <section className="col-span-8 bg-white border border-outline-variant rounded-xl p-lg shadow-sm flex flex-col h-[300px]">
            <header className="flex justify-between items-center mb-xl">
               <h3 className="font-bold flex items-center gap-2">管理人员活跃趋势 <span className="text-body-lg opacity-40">(近7日)</span></h3>
               <div className="flex bg-surface-container-high rounded-full p-1 h-8">
                  <button onClick={() => loadTrend("day")} className={cn("px-lg rounded-full text-body-lg font-bold", trendRange === "day" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-white/50")}>按日</button>
                  <button onClick={() => loadTrend("week")} className={cn("px-lg rounded-full text-body-lg font-bold", trendRange === "week" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-white/50")}>按周</button>
               </div>
            </header>
            <div className="flex-1 chart-grid rounded-lg pt-4 px-lg relative">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={auditTrend.length > 0 ? auditTrend : [{ name: "暂无", value: 0 }]}>
                     <XAxis dataKey="name" hide />
                     <Tooltip
                        contentStyle={{ backgroundColor: '#080c14', border: 'none', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', color: '#fff' }}
                        cursor={{ fill: 'rgba(0,81,174,0.05)' }}
                     />
                     <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {auditTrend.map((_entry, index) => (
                           <Cell key={`cell-${index}`} fill={index === auditTrend.length - 1 ? '#0051ae' : '#adc6ff'} />
                        ))}
                     </Bar>
                  </BarChart>
               </ResponsiveContainer>
               <div className="flex justify-between text-body-lg font-bold text-outline px-lg mt-md">
                   {auditTrend.length > 0 && (
                     <>
                       <span>{auditTrend[0]?.name}</span>
                       <span>{auditTrend[Math.floor(auditTrend.length / 2)]?.name}</span>
                       <span>{auditTrend[auditTrend.length - 1]?.name}</span>
                     </>
                   )}
               </div>
            </div>
         </section>

         {/* Weekly Reports */}
         <section className="col-span-4 bg-white border border-outline-variant rounded-xl p-lg shadow-sm flex flex-col h-[300px]">
            <h3 className="font-bold mb-lg">每周异常行为周报</h3>
            <div className="flex-1 overflow-y-auto space-y-md custom-scrollbar pr-1">
               {weeklyReports ? weeklyReports.map(r => (
                 <div key={r.title} className={cn("p-md rounded-xl bg-surface-container-low border-l-4", r.color)}>
                    <div className="flex justify-between items-center mb-xs">
                       <span className="font-bold text-body-lg">{r.title}</span>
                       <span className={cn("text-body-lg font-black uppercase px-sm py-unit rounded", r.risk === "high" ? "bg-error text-white" : r.risk === "medium" ? "bg-warning-orange text-white" : "bg-info-cyan text-white")}>{r.risk}</span>
                    </div>
                    <p className="text-body-lg leading-relaxed opacity-70">{r.detail}</p>
                 </div>
               )) : (
                 <div className="text-center text-outline text-body-lg py-xl">暂无数据</div>
               )}
            </div>
         </section>
      </div>

      {/* Main Table */}
      <section className="flex-1 bg-white border border-outline-variant rounded-xl shadow-sm overflow-hidden flex flex-col min-h-0">
         <header className="px-lg py-md border-b border-outline-variant bg-surface-container-lowest flex justify-between items-center shrink-0">
            <h3 className="font-bold">详细操作审计日志</h3>
            <div className="flex gap-md">
               <div className="relative group">
                  <Search className="absolute left-sm top-1/2 -translate-y-1/2 text-outline" size={16} />
                  <input
                    type="text"
                    placeholder="搜索日志..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="bg-surface-container-high border border-outline-variant rounded-full h-8 pl-xl pr-md text-body-lg w-48 focus:w-64 transition-all"
                  />
               </div>
               <button
                 onClick={() => exportAuditLogs()}
                 className="bg-primary text-on-primary px-lg h-8 rounded-lg font-bold text-body-lg flex items-center gap-2"
               >
                 <Download size={16} /> 导出数据
               </button>
            </div>
         </header>
         <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse">
               <thead className="bg-surface-container-low sticky top-0 z-10 text-body-sm uppercase font-bold text-outline tracking-widest border-b border-outline-variant">
                  <tr>
                    <th className="px-lg py-md">时间戳</th>
                    <th className="px-lg py-md">操作员 ID</th>
                    <th className="px-lg py-md">类别</th>
                    <th className="px-lg py-md">详细说明</th>
                    <th className="px-lg py-md">风险级别</th>
                    <th className="px-lg py-md text-right">状态</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-outline-variant/30 text-[12.5px]">
                  {auditPage.items.map((log) => (
                    <tr key={log.id} className="hover:bg-surface-container-low transition-colors group">
                      <td className="px-lg py-md font-mono text-on-surface-variant">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="px-lg py-md flex items-center gap-sm">
                        <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-body-lg font-black", log.operatorId.startsWith('A') ? "bg-primary/20 text-primary" : "bg-outline/20 text-outline")}>{log.operatorId}</div>
                        <span className="font-bold">{log.operatorName}</span>
                      </td>
                      <td className="px-lg py-md">
                        <span className="px-lg py-unit bg-surface-container-highest rounded-full text-body-sm font-bold text-outline uppercase">{log.category}</span>
                      </td>
                      <td className="px-lg py-md opacity-80">{log.action}</td>
                      <td className="px-lg py-md uppercase">
                         <span className={cn("text-body-sm font-black flex items-center gap-1", log.riskLevel === 'high' ? 'text-error' : log.riskLevel === 'medium' ? 'text-warning-orange' : 'text-info-cyan')}>
                           <div className={cn("w-1.5 h-1.5 rounded-full", log.riskLevel === 'high' ? "bg-error animate-pulse" : log.riskLevel === 'medium' ? "bg-warning-orange" : "bg-info-cyan")} />
                           {log.riskLevel}
                         </span>
                      </td>
                      <td className="px-lg py-md text-right">
                         {log.status ? (
                           <span className="text-success-green"><CheckCircle2 size={18} /></span>
                         ) : (
                           <span className="text-warning-orange"><AlertTriangle size={18} /></span>
                         )}
                      </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </section>
    </div>
  );
}
