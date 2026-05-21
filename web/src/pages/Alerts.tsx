import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/Toast";
import { Alert, AlertLevel, AlertType } from "../types";
import {
  Download,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Filter,
  X,
  Eye,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useRealAlerts } from "../lib/useRealAlerts";

export default function Alerts() {
  const toast = useToast();
  const navigate = useNavigate();
  const { alerts, updateAlertStatus } = useRealAlerts();
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 15;

  // ┌──────────────────────────────────────────────────────┐
  // │  筛选逻辑 — 按类型(打架/跌倒) + 状态(待处理/已确认/已忽略) │
  // │  演讲提示: "两个 select 下拉框联动过滤，                  │
  // │            改变筛选条件时自动重置到第 1 页"               │
  // └──────────────────────────────────────────────────────┘
  const filteredAlerts = useMemo(() => {
    return alerts.filter(a => {
      if (filterType && a.type !== filterType) return false;
      if (filterStatus && a.status !== filterStatus) return false;
      return true;
    });
  }, [alerts, filterType, filterStatus]);

  const totalPages = Math.ceil(filteredAlerts.length / pageSize) || 1;
  const pagedAlerts = filteredAlerts.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const handleUpdateStatus = (status: "confirmed" | "ignored") => {
    if (!selectedAlert) return;
    updateAlertStatus(selectedAlert.id, status);
    setSelectedAlert(prev => prev ? { ...prev, status } : null);
  };

  const pendingCount = alerts.filter(a => a.status === "pending").length;
  const criticalCount = alerts.filter(a => a.level === AlertLevel.CRITICAL).length;

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden animate-fade-in-up">
      {/* 页头 */}
      <section className="flex items-center justify-between shrink-0">
        <div className="flex gap-2">
          <select
            value={filterType}
            onChange={e => { setFilterType(e.target.value); setCurrentPage(0); }}
            className="bg-white border border-outline-variant rounded-lg h-9 px-3 text-body font-medium focus:ring-1 focus:ring-primary outline-none shadow-sm"
          >
            <option value="">全部类型</option>
            {Object.values(AlertType).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setCurrentPage(0); }}
            className="bg-white border border-outline-variant rounded-lg h-9 px-3 text-body font-medium focus:ring-1 focus:ring-primary outline-none shadow-sm"
          >
            <option value="">全部状态</option>
            <option value="pending">待处理</option>
            <option value="confirmed">已确认</option>
            <option value="ignored">已忽略</option>
          </select>
          <button onClick={() => toast.show("告警数据已导出")} className="bg-primary text-white rounded-lg h-9 px-4 font-semibold flex items-center gap-2 text-body shadow-sm hover:shadow-md transition-all">
            <Download size={15} /> 导出
          </button>
        </div>
      </section>

      {/* 主内容区 */}
      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
        {/* ┌──────────────────────────────────────────────────────┐
        // │  告警表格 — pending 状态带红色脉冲动画                  │
        // │  演讲提示: "待处理告警左侧有红色小圆点 animate-pulse，  │
        // │            已确认/已忽略则变灰点静止，                 │
        // │            点击行可展开右侧详情面板"                   │
        // └──────────────────────────────────────────────────────┘ */}
        {/* 表格 */}
        <div className="flex-1 bg-white border border-outline-variant rounded-xl flex flex-col overflow-hidden shadow-sm">
          <div className="overflow-auto flex-1">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low sticky top-0 z-10 border-b border-outline-variant">
                <tr>
                  <th className="px-4 py-2.5 text-caption font-semibold text-outline uppercase tracking-wider">告警 ID</th>
                  <th className="px-4 py-2.5 text-caption font-semibold text-outline uppercase tracking-wider">设备</th>
                  <th className="px-4 py-2.5 text-caption font-semibold text-outline uppercase tracking-wider">类型</th>
                  <th className="px-4 py-2.5 text-caption font-semibold text-outline uppercase tracking-wider">时间</th>
                  <th className="px-4 py-2.5 text-caption font-semibold text-outline uppercase tracking-wider">置信度</th>
                  <th className="px-4 py-2.5 text-caption font-semibold text-outline uppercase tracking-wider">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50 text-body">
                {pagedAlerts.map((alert) => (
                  <tr
                    key={alert.id}
                    onClick={() => setSelectedAlert(alert)}
                    className={cn(
                      "cursor-pointer transition-colors",
                      selectedAlert?.id === alert.id
                        ? "bg-primary-container/30"
                        : "hover:bg-surface-container-low"
                    )}
                  >
                    <td className="px-4 py-2.5 font-mono text-caption text-on-surface-variant tabular-nums">
                      {alert.id.slice(-8)}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{alert.cameraName}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn(
                        "px-2 py-0.5 rounded-md text-caption font-semibold inline-flex items-center gap-1",
                        alert.level === AlertLevel.CRITICAL
                          ? "bg-red-100 text-red-700"
                          : alert.level === AlertLevel.WARNING
                            ? "bg-orange-100 text-orange-700"
                            : alert.level === AlertLevel.MINOR
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-blue-100 text-blue-700"
                      )}>
                        {alert.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-body-sm tabular-nums text-on-surface-variant">
                      {new Date(alert.time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-body-sm font-semibold tabular-nums text-on-surface">
                        {alert.confidence.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn(
                        "flex items-center gap-1.5 text-caption font-semibold",
                        alert.status === "pending" ? "text-danger-red" : "text-outline"
                      )}>
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          alert.status === "pending" ? "bg-danger-red animate-pulse" : "bg-outline"
                        )} />
                        {alert.status === "pending" ? "待处理" : alert.status === "confirmed" ? "已确认" : "已忽略"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="h-10 border-t border-outline-variant bg-surface-container-low/50 px-4 flex items-center justify-between text-caption text-outline shrink-0">
            <span>共 {filteredAlerts.length} 条 · 第 {currentPage + 1}/{totalPages} 页</span>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="h-6 w-6 rounded border border-outline-variant flex items-center justify-center hover:bg-surface-container disabled:opacity-30"
              >
                <ChevronLeft size={13} />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="h-6 w-6 rounded border border-outline-variant flex items-center justify-center hover:bg-surface-container disabled:opacity-30"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </footer>
        </div>

        {/* ┌──────────────────────────────────────────────────────┐
        // │  详情面板 — 报警快照 + HUD 叠加                       │
        // │  演讲提示: "左上角是告警截帧照片，                      │
        // │            底部 HUD 叠加了时间戳和置信度标签，           │
        // │            这张图可直接作为电子证据使用，               │
        // │            图片加载失败会自动重试 3 次(500ms 间隔)"     │
        // └──────────────────────────────────────────────────────┘ */}
        {/* 详情面板 */}
        {selectedAlert && (
          <div className="w-[360px] bg-white border border-outline-variant rounded-xl flex flex-col shadow-sm overflow-hidden shrink-0 animate-fade-in-up">
            <header className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low/50">
              <div>
                <h3 className="font-bold text-body-lg">告警详情</h3>
                <p className="text-caption text-outline font-mono mt-0.5">{selectedAlert.id}</p>
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className="p-1 rounded hover:bg-surface-container-high text-outline hover:text-on-surface transition-colors"
              >
                <X size={16} />
              </button>
            </header>

            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              {/* 快照 */}
              <div className="rounded-lg overflow-hidden border border-outline-variant bg-dark-bg relative aspect-video flex items-center justify-center">
                {selectedAlert.snapshotUrl ? (
                    <img
                      key={selectedAlert.id}
                      src={selectedAlert.snapshotUrl}
                      alt={`${selectedAlert.type} 快照`}
                      className="w-full h-full object-cover"
                      onError={e => {
                        const el = e.target as HTMLImageElement;
                        const left = (el as any)._retryLeft ?? 3;
                        if (left > 0) { (el as any)._retryLeft = left - 1; setTimeout(() => { el.src = el.src; }, 500); }
                        else { el.style.display = "none"; }
                      }}
                    />
                ) : null}
                <div className="text-center absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <Eye size={24} className="text-white/20 mb-2" />
                  <span className="text-white/30 text-body-sm font-mono">{selectedAlert.cameraName} - 告警快照</span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-2 video-hud flex justify-between items-end">
                  <span className="text-white/70 text-caption font-mono">
                    {new Date(selectedAlert.time).toLocaleString("zh-CN")}
                  </span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-caption font-semibold",
                    selectedAlert.confidence > 90 ? "bg-success-green/30 text-success-green" : "bg-warning-orange/30 text-warning-orange"
                  )}>
                    置信度 {selectedAlert.confidence.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* 元数据 */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-surface-container-low rounded-lg border border-outline-variant/50">
                <DataField label="检测类型" value={selectedAlert.type} highlight />
                <DataField label="发生位置" value={selectedAlert.cameraName} />
                <DataField label="持续时间" value={selectedAlert.duration ?? "—"} mono />
                <DataField label="告警级别" value={
                  selectedAlert.level === AlertLevel.CRITICAL ? "四级严重"
                  : selectedAlert.level === AlertLevel.WARNING ? "三级较重"
                  : selectedAlert.level === AlertLevel.MINOR ? "二级一般"
                  : "一级轻微"
                } highlight />
              </div>

              {/* 触发规则说明 */}
              <div className="p-3 bg-surface-container-low rounded-lg border border-outline-variant/50">
                <p className="text-caption font-semibold text-outline uppercase mb-1">触发规则</p>
                <p className="text-body text-on-surface">
                  {selectedAlert.type === AlertType.FIGHT && "检测到两人或以上肢体动作剧烈冲突，持续超过3秒"}
                  {selectedAlert.type === AlertType.FALL && "检测到人员姿态由站立变为水平，疑似跌倒或晕厥"}
                  {selectedAlert.type === AlertType.ABSENCE && "检测到指定岗位持续无人值守超过设定阈值"}
                  {selectedAlert.type === AlertType.CROWD && "检测到局部区域人员密度超过安全阈值"}
                </p>
              </div>
            </div>

            {/* ┌──────────────────────────────────────────────────────┐
            // │  状态操作按钮 — 忽略误报 / 确认告警 / 查看录像回放     │
            // │  演讲提示: "只有 pending 状态的告警才能操作，          │
            // │            忽略和确认都会调 updateAlertStatus 更新      │
            // │            JSON 状态，回放按钮跳转到 /monitor 页面      │
            // │            并携带 camId 和 time 参数"                  │
            // └──────────────────────────────────────────────────────┘ */}
            {/* 操作按钮 */}
            <div className="p-4 border-t border-outline-variant space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => handleUpdateStatus("ignored")}
                  disabled={selectedAlert.status !== "pending"}
                  className="flex-1 h-10 bg-surface-container border border-outline-variant rounded-lg font-semibold text-body flex items-center justify-center gap-1.5 hover:bg-surface-container-high transition-colors disabled:opacity-40"
                >
                  <XCircle size={15} /> 忽略误报
                </button>
                <button
                  onClick={() => handleUpdateStatus("confirmed")}
                  disabled={selectedAlert.status !== "pending"}
                  className="flex-1 h-10 bg-primary text-white rounded-lg font-semibold text-body flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md transition-all disabled:opacity-40"
                >
                  <CheckCircle2 size={15} /> 确认告警
                </button>
              </div>
              <button onClick={() => navigate(`/monitor?cam=${selectedAlert.cameraId}&time=${selectedAlert.time}`)} className="w-full h-9 border border-primary/20 text-primary text-body font-medium rounded-lg flex items-center justify-center gap-1.5 hover:bg-primary/5 transition-colors">
                <Eye size={14} /> 查看录像回放
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DataField({ label, value, highlight, mono }: { label: string; value: string; highlight?: boolean; mono?: boolean }) {
  return (
    <div>
      <p className="text-caption text-outline font-semibold mb-0.5">{label}</p>
      <p className={cn(
        "text-body font-medium",
        mono && "font-mono",
        highlight ? "text-danger-red" : "text-on-surface"
      )}>
        {value}
      </p>
    </div>
  );
}
