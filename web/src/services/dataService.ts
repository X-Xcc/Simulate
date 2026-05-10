import { Camera, Alert, AuditLog, CameraStatus, SystemStatus, Settings, PageResponse, TrendData, RegionalStat, EvidenceStats, StatsCompare, AlertFilterParams, AuditFilterParams } from "../types";
import { apiGet, apiPost, apiPatch, apiDelete, createSseConnection, setToken, clearToken } from "../lib/api";

// --- Auth ---

export async function login(username: string, password: string): Promise<void> {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "登录失败" }));
    throw new Error(err.error || "登录失败");
  }
  const data = await res.json();
  setToken(data.token);
}

export async function getCurrentUser(): Promise<{ username: string; name: string; role: string }> {
  return apiGet("/api/me");
}

export function logout(): void {
  clearToken();
}

// --- Subscribe (SSE) ---

export function subscribeToCameras(callback: (cameras: Camera[]) => void): () => void {
  apiGet<any[]>("/api/camera_config").then((data) => {
    callback(Array.isArray(data) ? data.map(transformCamera) : []);
  }).catch(console.error);

  return createSseConnection({
    onCameras: (data: any) => callback(Array.isArray(data) ? data.map(transformCamera) : []),
  });
}

export function subscribeToAlerts(callback: (alerts: Alert[]) => void): () => void {
  apiGet<any[]>("/api/alerts").then((data) => {
    callback(Array.isArray(data) ? data : []);
  }).catch(console.error);

  return createSseConnection({
    onAlerts: (data: any) => callback(Array.isArray(data) ? data : []),
  });
}

export function subscribeToSystemStatus(callback: (status: SystemStatus) => void): () => void {
  apiGet<any>("/api/system_metrics").then((data) => {
    callback(transformSystemMetrics(data));
  }).catch(console.error);

  return createSseConnection({
    onSystemMetrics: (data: any) => callback(transformSystemMetrics(data)),
  });
}

export function subscribeToAuditLogs(callback: (logs: AuditLog[]) => void): () => void {
  apiGet<any[]>("/api/audit_logs").then((data) => {
    callback(Array.isArray(data) ? data : []);
  }).catch(console.error);

  return createSseConnection({
    onAuditLogs: (data: any) => callback(Array.isArray(data) ? data : []),
  });
}

// --- Camera Stats ---

export function subscribeToCameraStats(callback: (stats: Record<string, number>) => void): () => void {
  // Initial fetch
  apiGet<any>("/api/camera_stats").then((data) => {
    if (data?.cameras) {
      const map: Record<string, number> = {};
      for (const c of data.cameras) {
        map[c.camId] = c.personCount ?? 0;
      }
      callback(map);
    }
  }).catch(console.error);

  // SSE live updates
  return createSseConnection({
    onCameraStats: (data: any) => {
      if (data?.cameras) {
        const map: Record<string, number> = {};
        for (const c of data.cameras) {
          map[c.camId] = c.personCount ?? 0;
        }
        callback(map);
      }
    },
  });
}

// --- Stats ---

export async function fetchStats(): Promise<any> {
  return apiGet("/api/stats");
}

export async function fetchTrendData(range: "day" | "week" | "month" = "day"): Promise<{ labels: string[]; data: number[] }> {
  return apiGet(`/api/stats/trend?range=${range}`);
}

export async function fetchModelInfo(): Promise<any> {
  return apiGet("/api/model_info");
}

// --- Write operations ---

export async function updateAlertStatus(alertId: string, status: "confirmed" | "ignored") {
  await apiPatch(`/api/alerts/${alertId}`, { status });
}

export async function addCamera(camera: any) {
  await apiPost("/api/camera_config", camera);
}

export async function deleteCamera(cameraId: string) {
  await apiDelete(`/api/camera_config/${cameraId}`);
}

export async function addAuditLog(log: Omit<AuditLog, "id" | "timestamp">) {
  await apiPost("/api/audit_logs", log);
}

// --- Settings ---

export async function fetchSettings(): Promise<Settings> {
  return apiGet("/api/settings");
}

export async function updateSettings(settings: Partial<Settings>): Promise<Settings> {
  return apiPost("/api/settings", settings);
}

// --- Paged Alerts ---

export async function fetchAlertsPage(params: AlertFilterParams): Promise<PageResponse<Alert>> {
  const query = new URLSearchParams();
  if (params.type) query.set("type", params.type);
  if (params.status) query.set("status", params.status);
  if (params.since) query.set("since", params.since);
  if (params.page != null) query.set("page", String(params.page));
  if (params.size != null) query.set("size", String(params.size));
  return apiGet(`/api/alerts?${query.toString()}`);
}

export function exportAlerts(params?: AlertFilterParams): void {
  const query = new URLSearchParams();
  if (params?.type) query.set("type", params.type);
  if (params?.status) query.set("status", params.status);
  if (params?.since) query.set("since", params.since);
  window.open(`/api/alerts/export?${query.toString()}`, "_blank");
}

// --- Paged Audit Logs ---

export async function fetchAuditLogsPage(params: AuditFilterParams): Promise<PageResponse<AuditLog>> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.category) query.set("category", params.category);
  if (params.riskLevel) query.set("riskLevel", params.riskLevel);
  if (params.page != null) query.set("page", String(params.page));
  if (params.size != null) query.set("size", String(params.size));
  return apiGet(`/api/audit_logs?${query.toString()}`);
}

export async function fetchAuditTrend(range: "day" | "week" = "day"): Promise<TrendData> {
  return apiGet(`/api/audit_logs/trend?range=${range}`);
}

export function exportAuditLogs(params?: AuditFilterParams): void {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.category) query.set("category", params.category);
  if (params?.riskLevel) query.set("riskLevel", params.riskLevel);
  window.open(`/api/audit_logs/export?${query.toString()}`, "_blank");
}

// --- Regional / Evidence / Compare ---

export async function fetchRegionalStats(): Promise<RegionalStat[]> {
  return apiGet("/api/stats/regional");
}

export async function fetchEvidenceStats(): Promise<EvidenceStats> {
  return apiGet("/api/evidence/stats");
}

export async function fetchStatsCompare(): Promise<StatsCompare> {
  return apiGet("/api/stats/compare");
}

// --- Transformers ---

function transformCamera(raw: any): Camera {
  return {
    id: raw.id || "",
    name: raw.name || "未命名",
    sn: raw.id || "",
    status: CameraStatus.ONLINE,
    streamUrl: raw.id ? `/video_feed?cam=${raw.id}` : "",
    lastOnline: new Date().toISOString(),
    personCount: raw.personCount ?? 0,
    location: raw.type || "未分类",
  };
}

function transformSystemMetrics(raw: any): SystemStatus {
  return {
    cpuUsage: raw.cpuPercent ?? 0,
    memoryUsage: raw.memoryPercent ?? 0,
    storageUsage: raw.diskPercent ?? 0,
    gpuUsage: raw.gpuPercent ?? 0,
    version: raw.version ?? "unknown",
    lastUpdate: new Date().toLocaleString(),
    services: (raw.services ?? []).map((s: any) => ({
      name: s.name ?? s.serviceName ?? "Unknown",
      uptime: s.uptime ?? "-",
      status: s.status ?? "unknown",
      health: s.health ?? (s.status === "Running" ? "healthy" : "warning"),
    })),
  };
}
