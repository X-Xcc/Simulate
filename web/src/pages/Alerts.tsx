import { useState, useEffect, useCallback } from "react";
import { Alert, AlertLevel, AlertType, PageResponse } from "../types";
import {
  Download,
  ShieldAlert,
  Video,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { cn } from "../lib/utils";
import { subscribeToAlerts, updateAlertStatus, fetchAlertsPage, exportAlerts } from "../services/dataService";

export default function Alerts() {
  const [alertsPage, setAlertsPage] = useState<PageResponse<Alert>>({ items: [], total: 0, page: 0, size: 20 });
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [isDirty, setIsDirty] = useState(false);

  const loadAlerts = useCallback(() => {
    fetchAlertsPage({
      type: filterType || undefined,
      status: filterStatus || undefined,
      page: currentPage,
      size: 20
    }).then(setAlertsPage).catch(console.error);
  }, [filterType, filterStatus, currentPage]);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  // SSE — 标记dirty不直接覆盖
  useEffect(() => {
    const unsub = subscribeToAlerts(() => setIsDirty(true));
    return unsub;
  }, []);

  const handleUpdateStatus = async (status: "confirmed" | "ignored") => {
    if (!selectedAlert) return;
    try {
      await updateAlertStatus(selectedAlert.id, status);
      loadAlerts();
    } catch (e) {
      console.error(e);
    }
  };

  const alerts = alertsPage.items;

  return (
    <div className="h-full flex flex-col gap-lg overflow-hidden">
      {/* Filter Bar */}
      <section className="flex items-center justify-between bg-surface p-md rounded-xl border border-outline-variant shrink-0">
        <div className="flex gap-md">
          <select
            value={filterType}
            onChange={e => { setFilterType(e.target.value); setCurrentPage(0); }}
            className="bg-surface-container-low border border-outline-variant rounded h-8 px-sm text-body-lg font-bold focus:ring-1 focus:ring-primary outline-none"
          >
            <option value="">所有告警类型</option>
            {Object.values(AlertType).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setCurrentPage(0); }}
            className="bg-surface-container-low border border-outline-variant rounded h-8 px-sm text-body-lg font-bold focus:ring-1 focus:ring-primary outline-none"
          >
            <option value="">所有状态</option>
            <option value="pending">待处理</option>
            <option value="confirmed">已确认</option>
            <option value="ignored">已忽略</option>
          </select>
        </div>
        <button
          onClick={() => exportAlerts({ type: filterType || undefined, status: filterStatus || undefined })}
          className="bg-surface-container-high hover:bg-surface-variant text-body-lg h-8 px-md rounded border border-outline-variant flex items-center gap-2 font-bold transition-all"
        >
          <Download size={14} /> 导出告警报告
        </button>
      </section>

      {/* SSE dirty indicator */}
      {isDirty && (
        <div
          className="bg-primary/10 text-primary text-center py-1 text-body-lg cursor-pointer rounded-lg"
          onClick={() => { setIsDirty(false); loadAlerts(); }}
        >
          有新数据，点击刷新
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex gap-lg min-h-0 overflow-hidden">
        {/* Table Panel */}
        <div className="flex-1 bg-white border border-outline-variant rounded-xl flex flex-col overflow-hidden shadow-sm">
          <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container-low sticky top-0 z-10 text-body-sm uppercase font-bold text-outline tracking-wider border-b border-outline-variant">
                <tr>
                  <th className="px-lg py-md">告警ID</th>
                  <th className="px-lg py-md">设备</th>
                  <th className="px-lg py-md">类型</th>
                  <th className="px-lg py-md">时间</th>
                  <th className="px-lg py-md">快照</th>
                  <th className="px-lg py-md">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {alerts.map((alert) => (
                  <tr
                    key={alert.id}
                    onClick={() => setSelectedAlert(alert)}
                    className={cn(
                      "cursor-pointer transition-colors text-body-lg",
                      selectedAlert?.id === alert.id ? "bg-primary-fixed" : "hover:bg-surface-container-low"
                    )}
                  >
                    <td className="px-lg py-md font-mono font-bold">{alert.id}</td>
                    <td className="px-lg py-md">{alert.cameraName}</td>
                    <td className="px-lg py-md">
                      <span className={cn(
                        "px-xs py-[2px] rounded text-body-lg font-bold border",
                        alert.level === AlertLevel.CRITICAL ? "bg-error/10 border-error/20 text-error" : "bg-warning-orange/10 border-warning-orange/20 text-warning-orange"
                      )}>
                        {alert.type}
                      </span>
                    </td>
                    <td className="px-lg py-md font-mono opacity-70">{new Date(alert.time).toLocaleTimeString()}</td>
                    <td className="px-lg py-md">
                      <div className="w-16 h-10 rounded border border-outline-variant overflow-hidden group">
                        <img src={alert.snapshotUrl} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </td>
                    <td className="px-lg py-md">
                      <span className={cn(
                        "flex items-center gap-xs font-bold",
                        alert.status === "pending" ? "text-error" : "text-outline"
                      )}>
                        <div className={cn("w-2 h-2 rounded-full", alert.status === "pending" ? "bg-error animate-pulse" : "bg-outline")} />
                        {alert.status === "pending" ? "待处理" : alert.status === "confirmed" ? "已确认" : "已忽略"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="h-12 border-t border-outline-variant bg-surface-container-lowest px-lg flex items-center justify-between text-outline text-body-sm">
            <span>第 {currentPage + 1} 页 / 共 {Math.ceil(alertsPage.total / 20) || 1} 页</span>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="h-6 w-6 rounded border border-outline-variant flex items-center justify-center hover:bg-surface-variant disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={(currentPage + 1) * 20 >= alertsPage.total}
                className="h-6 w-6 rounded border border-outline-variant flex items-center justify-center hover:bg-surface-variant disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </footer>
        </div>

        {/* Detail Panel */}
        {selectedAlert && (
          <div className="w-[360px] bg-white border border-outline-variant rounded-xl flex flex-col shadow-lg overflow-hidden shrink-0">
            <header className="p-md border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h3 className="font-bold text-body-lg">告警详细</h3>
              <span className="text-body-lg font-mono px-sm py-unit rounded bg-outline-variant/30">{selectedAlert.id}</span>
            </header>

            <div className="p-md flex-1 overflow-y-auto space-y-lg custom-scrollbar">
              {/* Snapshot */}
              <div className="rounded-xl overflow-hidden border border-outline-variant bg-dark-bg relative group">
                <img src={selectedAlert.snapshotUrl} alt="" className="w-full aspect-video object-cover opacity-90 group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 border-[3px] border-error/50 m-4 animate-pulse opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-0 left-0 right-0 p-sm video-hud flex justify-between items-end text-body-lg font-mono">
                  <span className="text-on-secondary">{new Date(selectedAlert.time).toLocaleTimeString()}</span>
                  <span className="bg-error/30 border border-error/50 text-tertiary-fixed px-xs rounded">置信度: {selectedAlert.confidence}%</span>
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-md p-md bg-surface-container rounded-xl border border-outline-variant">
                <div>
                  <p className="text-body-sm font-bold text-outline uppercase mb-unit">检测类型</p>
                  <p className={cn("font-bold text-body-lg flex items-center gap-1", selectedAlert.level === AlertLevel.CRITICAL ? "text-error" : "text-warning-orange")}>
                    <ShieldAlert size={16} /> {selectedAlert.type}
                  </p>
                </div>
                <div>
                  <p className="text-body-sm font-bold text-outline uppercase mb-unit">发生位置</p>
                  <p className="font-bold text-body-lg">{selectedAlert.cameraName}</p>
                </div>
                <div>
                  <p className="text-body-sm font-bold text-outline uppercase mb-unit">触发规则</p>
                  <p className="text-body-lg">行为异常 - 高危识别</p>
                </div>
                <div>
                  <p className="text-body-sm font-bold text-outline uppercase mb-unit">持续时间</p>
                  <p className="font-mono text-body-lg">{selectedAlert.duration || "00:00:00"}</p>
                </div>
              </div>

              {/* Status History */}
              <div className="space-y-sm">
                <h4 className="text-body-sm font-bold text-outline uppercase tracking-widest pl-1">调控动作</h4>
                <div className="flex gap-sm">
                  <button
                    onClick={() => handleUpdateStatus("ignored")}
                    disabled={selectedAlert.status !== "pending"}
                    className="flex-1 h-[44px] bg-surface-container border border-outline-variant rounded-lg font-bold text-body-lg flex items-center justify-center gap-2 hover:bg-surface-container-high transition-colors disabled:opacity-50"
                  >
                    <XCircle size={18} /> 忽略误报
                  </button>
                  <button
                    onClick={() => handleUpdateStatus("confirmed")}
                    disabled={selectedAlert.status !== "pending"}
                    className="flex-1 h-[44px] bg-primary text-on-primary rounded-lg font-bold text-body-lg flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                  >
                    <CheckCircle2 size={18} /> 确认告警
                  </button>
                </div>
                <button className="w-full h-8 mt-xs border border-primary/30 text-primary text-body-lg font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-primary/5 transition-colors">
                  <Video size={14} /> 查看录像回放
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
