/**
 * useMock — 从统一 mockStore 读取数据的 hook 层
 * 所有页面使用此 hook，保证数据一致性
 */

import { useMockStore } from "./mockStore";

const USE_MOCK = true;

export function useMockCameras() {
  return useMockStore((s) => s.cameras);
}

export function useMockAlerts() {
  const alerts = useMockStore((s) => s.alerts);
  const updateAlertStatus = useMockStore((s) => s.updateAlertStatus);
  return [alerts, updateAlertStatus] as const;
}

export function useMockSystemStatus() {
  return useMockStore((s) => s.systemStatus);
}

export function useMockAuditLogs() {
  const logs = useMockStore((s) => s.auditLogs);
  const setLogs = (_updater: typeof logs | ((prev: typeof logs) => typeof logs)) => {};
  return [logs, setLogs] as const;
}

export function useMockStatsSummary() {
  return useMockStore((s) => s.statsSummary);
}

export function useMockTrendData(range: "day" | "week" | "month" | "quarter") {
  return useMockStore((s) => s.trendData[range]);
}

export function useMockSettings() {
  return useMockStore((s) => s.settings);
}

export function useMockRegionalStats() {
  return useMockStore((s) => s.regionalStats);
}

export function useMockModelInfo() {
  return useMockStore((s) => s.modelInfo);
}

export function useMockFpsStats() {
  return useMockStore((s) => s.fpsStats);
}

export function useMockHeatmapData() {
  return useMockStore((s) => s.heatmapData);
}

export function useMockStatsCompare() {
  return useMockStore((s) => s.statsCompare);
}

export function useMockAutomationRate() {
  return useMockStore((s) => s.automationRate);
}

export function useMockAuditTrend(range: "day" | "week" = "week") {
  return useMockStore((s) => s.auditTrend[range]);
}

export { USE_MOCK };
