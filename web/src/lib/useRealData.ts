/**
 * 真实数据 hooks — 替代 useMock.ts 中的同名函数
 * 每个 hook: REST 初始加载 + SSE 实时更新
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { apiGet, subscribeSse } from "./api";
import type {
  SystemStatus, TrendData, ModelInfo, FpsStats,
  RegionalStat, AuditLog, PageResponse,
} from "../types";

// ── SystemStatus ────────────────────────────────────────────────────────────────

export function useRealSystemStatus() {
  const [metrics, setMetrics] = useState({ cpuUsage: 0, memoryUsage: 0, storageUsage: 0, gpuUsage: 0 });
  const [info, setInfo] = useState<{ version: string; engine?: string; dataDirSizeMb?: number; detectionCount?: number; onlineDevices?: number; totalDevices?: number }>({ version: "—" });

  useEffect(() => {
    apiGet<{ data: any }>("/api/system_info").then(r => {
      if (r.data) setInfo({
        version: r.data.status || "—",
        engine: r.data.engine,
        dataDirSizeMb: r.data.dataDirSizeMb,
        detectionCount: r.data.detectionCount,
        onlineDevices: r.data.onlineDevices,
        totalDevices: r.data.totalDevices,
      });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    return subscribeSse("system_metrics", (data: any) => {
      if (!data) return;
      setMetrics({
        cpuUsage: data.cpuPercent ?? 0,
        memoryUsage: data.memoryPercent ?? 0,
        storageUsage: data.diskPercent ?? 0,
        gpuUsage: data.gpuPercent ?? 0,
      });
    });
  }, []);

  return useMemo(() => ({
    cpuUsage: metrics.cpuUsage,
    memoryUsage: metrics.memoryUsage,
    storageUsage: metrics.storageUsage,
    gpuUsage: metrics.gpuUsage,
    version: info.version,
    engine: info.engine,
    dataDirSizeMb: info.dataDirSizeMb ?? 0,
    detectionCount: info.detectionCount ?? 0,
    onlineDevices: info.onlineDevices ?? 0,
    totalDevices: info.totalDevices ?? 0,
    activeModels: info.totalDevices ?? 1,
    totalModels: info.totalDevices ?? 1,
    services: [] as { name: string; uptime: string; health: 'healthy' | 'warning' | 'error' }[],
  }), [metrics, info]);
}

// ── ModelInfo ─────────────────────────────────────────────────────────────────

export function useRealModelInfo() {
  const [modelInfo, setModelInfo] = useState<ModelInfo>({ model_size_mb: 0, device: "—", precision: "—" });

  useEffect(() => {
    apiGet<{ data: ModelInfo }>("/api/model_info")
      .then(r => { if (r.data) setModelInfo(r.data); })
      .catch(() => {});
  }, []);

  return modelInfo;
}

// ── TrendData ────────────────────────────────────────────────────────────────

export function useRealTrendData(range: "day" | "week" | "month" | "quarter") {
  const [trendData, setTrendData] = useState<TrendData>({ labels: [], data: {} });

  useEffect(() => {
    const apiRange = range === "quarter" ? "month" : range;
    apiGet<{ data: { labels: string[]; data: Record<string, number[]> } }>(`/api/stats/trend?range=${apiRange}`)
      .then(r => {
        if (r.data) setTrendData(r.data);
      }).catch(() => {});
  }, [range]);

  return trendData;
}

// ── RegionalStats ─────────────────────────────────────────────────────────────

export function useRealRegionalStats() {
  const [regionalStats, setRegionalStats] = useState<RegionalStat[]>([]);

  useEffect(() => {
    apiGet<{ data: RegionalStat[] }>("/api/stats/regional")
      .then(r => { if (r.data) setRegionalStats(r.data); })
      .catch(() => {});
  }, []);

  return regionalStats;
}

// ── FpsStats ────────────────────────────────────────────────────────────────

export function useRealFpsStats() {
  const [fpsStats, setFpsStats] = useState<FpsStats>({ avg: 0, min: 0, max: 0, count: 0 });

  useEffect(() => {
    apiGet<{ data: FpsStats }>("/api/stats/fps")
      .then(r => { if (r.data) setFpsStats(r.data); })
      .catch(() => {});
  }, []);

  return fpsStats;
}

// ── AuditLogs ────────────────────────────────────────────────────────────────

export function useRealAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    apiGet<PageResponse<AuditLog>>("/api/audit_logs?page=0&size=200", ac.signal)
      .then(r => { setLogs(r.items ?? []); setLoading(false); })
      .catch(() => setLoading(false));
    return () => ac.abort();
  }, []);

  useEffect(() => {
    return subscribeSse("audit_logs", (data: any) => {
      if (!Array.isArray(data)) return;
      setLogs(data);
    });
  }, []);

  const setLogsUpdater = useCallback((_updater: AuditLog[] | ((prev: AuditLog[]) => AuditLog[])) => {
    // noop — real data from SSE
  }, []);

  return [logs, setLogsUpdater] as const;
}

// ── AuditTrend ────────────────────────────────────────────────────────────────

export function useRealAuditTrend(range: "day" | "week" = "week") {
  const [trend, setTrend] = useState<{ labels: string[]; data: number[] }>({ labels: [], data: [] });

  useEffect(() => {
    apiGet<{ data: { labels: string[]; data: number[] } }>(`/api/audit_logs/trend?range=${range}`)
      .then(r => { if (r.data) setTrend(r.data); })
      .catch(() => {});
  }, [range]);

  return trend;
}

// ── AutomationRate ─────────────────────────────────────────────────────────────

export function useRealAutomationRate() {
  const [rate, setRate] = useState({ rate: 0 });

  useEffect(() => {
    fetch("/api/audit_logs/automation_rate")
      .then(r => r.json())
      .then(j => { if (j.rate !== undefined) setRate(j); })
      .catch(() => {});
  }, []);

  return rate;
}
