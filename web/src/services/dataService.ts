import { Camera, Alert, AuditLog, CameraStatus, SystemStatus, Settings, PageResponse, TrendData, RegionalStat, EvidenceStats, StatsCompare, AlertFilterParams, AuditFilterParams, FpsStats, StatsSummary, ModelInfo } from "../types";
import { apiGet, apiPost, apiPut, apiPatch, apiDelete, apiDownload, createSseConnection, setToken, clearToken } from "../lib/api";

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

export async function getCurrentUser(signal?: AbortSignal): Promise<{ username: string; name: string; role: string }> {
  return apiGet("/api/me", signal);
}

export function logout(): void {
  clearToken();
}

// --- Subscribe (SSE) ---

export function subscribeToCameras(callback: (cameras: Camera[]) => void): () => void {
  let activeCamIds = new Set<string>();

  // Fetch active cameras (those with live frames)
  async function refreshActive() {
    try {
      const res = await fetch("/api/cameras");
      if (res.ok) {
        const data = await res.json();
        activeCamIds = new Set(data.cameras || []);
      }
    } catch {}
  }

  // Initial fetch + periodic refresh
  refreshActive();
  const timer = setInterval(refreshActive, 5000);

  const unsub = createSseConnection({
    onCameras: (data: any) => {
      if (!Array.isArray(data)) { callback([]); return; }
      const cameras = data.map((raw: any) => transformCamera(raw, activeCamIds));
      callback(cameras);
    },
    onCameraStats: () => refreshActive(),
  });

  return () => { clearInterval(timer); unsub(); };
}

export function subscribeToAlerts(callback: (alerts: Alert[]) => void): () => void {
  return createSseConnection({
    onAlerts: (data: any) => callback(Array.isArray(data) ? data : []),
  });
}

export function subscribeToSystemStatus(callback: (status: SystemStatus) => void): () => void {
  return createSseConnection({
    onSystemMetrics: (data: any) => callback(transformSystemMetrics(data)),
  });
}

export function subscribeToAuditLogs(callback: (logs: AuditLog[]) => void): () => void {
  return createSseConnection({
    onAuditLogs: (data: any) => callback(Array.isArray(data) ? data : []),
  });
}

// --- Camera Stats ---

export function subscribeToCameraStats(callback: (stats: Record<string, number>) => void): () => void {
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

/** Lightweight: returns behaviorCounts + totals only, no detection list. */
export async function fetchStatsSummary(signal?: AbortSignal): Promise<StatsSummary> {
  return apiGet("/api/stats/summary", signal);
}

export async function fetchTrendData(range: "day" | "week" | "month" = "day", signal?: AbortSignal): Promise<{ labels: string[]; data: number[] }> {
  return apiGet(`/api/stats/trend?range=${range}`, signal);
}

export async function fetchModelInfo(signal?: AbortSignal): Promise<ModelInfo> {
  return apiGet("/api/model_info", signal);
}

// --- Write operations ---

export async function updateAlertStatus(alertId: string, status: "confirmed" | "ignored") {
  await apiPatch(`/api/alerts/${alertId}`, { status });
}

export async function addCamera(camera: any) {
  await apiPost("/api/camera_config", camera);
}

export async function updateCamera(cameraId: string, camera: any) {
  await apiPut(`/api/camera_config/${cameraId}`, camera);
}

export async function deleteCamera(cameraId: string) {
  await apiDelete(`/api/camera_config/${cameraId}`);
}

export async function testCamera(camera: { type: string; address: string | number; user?: string; password?: string }): Promise<{ reachable: boolean; message: string }> {
  return apiPost("/api/camera_config/test", camera);
}

export async function addAuditLog(log: Omit<AuditLog, "id" | "timestamp">) {
  await apiPost("/api/audit_logs", log);
}

// --- Settings ---

export async function fetchSettings(signal?: AbortSignal): Promise<Settings> {
  return apiGet("/api/settings", signal);
}

export async function updateSettings(settings: Partial<Settings>): Promise<Settings> {
  return apiPost("/api/settings", settings);
}

// --- Paged Alerts ---

export async function fetchAlertsPage(params: AlertFilterParams, signal?: AbortSignal): Promise<PageResponse<Alert>> {
  const query = new URLSearchParams();
  if (params.type) query.set("type", params.type);
  if (params.status) query.set("status", params.status);
  if (params.since) query.set("since", params.since);
  if (params.page != null) query.set("page", String(params.page));
  if (params.size != null) query.set("size", String(params.size));
  return apiGet(`/api/alerts?${query.toString()}`, signal);
}

export function exportAlerts(params?: AlertFilterParams): void {
  const query = new URLSearchParams();
  if (params?.type) query.set("type", params.type);
  if (params?.status) query.set("status", params.status);
  if (params?.since) query.set("since", params.since);
  apiDownload(`/api/alerts/export?${query.toString()}`);
}

// --- Paged Audit Logs ---

export async function fetchAuditLogsPage(params: AuditFilterParams, signal?: AbortSignal): Promise<PageResponse<AuditLog>> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.category) query.set("category", params.category);
  if (params.riskLevel) query.set("riskLevel", params.riskLevel);
  if (params.page != null) query.set("page", String(params.page));
  if (params.size != null) query.set("size", String(params.size));
  return apiGet(`/api/audit_logs?${query.toString()}`, signal);
}

export async function fetchAuditTrend(range: "day" | "week" = "day", signal?: AbortSignal): Promise<TrendData> {
  return apiGet(`/api/audit_logs/trend?range=${range}`, signal);
}

export function exportAuditLogs(params?: AuditFilterParams): void {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.category) query.set("category", params.category);
  if (params?.riskLevel) query.set("riskLevel", params.riskLevel);
  apiDownload(`/api/audit_logs/export?${query.toString()}`);
}

// --- Regional / Evidence / Compare ---

export async function fetchRegionalStats(signal?: AbortSignal): Promise<RegionalStat[]> {
  return apiGet("/api/stats/regional", signal);
}

export async function fetchEvidenceStats(signal?: AbortSignal): Promise<EvidenceStats> {
  return apiGet("/api/evidence/stats", signal);
}

export async function fetchStatsCompare(signal?: AbortSignal): Promise<StatsCompare> {
  return apiGet("/api/stats/compare", signal);
}

export async function fetchFpsStats(signal?: AbortSignal): Promise<FpsStats> {
  return apiGet("/api/stats/fps", signal);
}

export async function fetchAutomationRate(signal?: AbortSignal): Promise<{ rate: number }> {
  return apiGet("/api/audit_logs/automation_rate", signal);
}

export function exportCsv(): void {
  apiDownload("/api/export/csv");
}

// --- Transformers ---

function transformCamera(raw: any, activeCamIds?: Set<string>): Camera {
  const isActive = activeCamIds ? activeCamIds.has(raw.id || "") : false;
  return {
    id: raw.id || "",
    name: raw.name || "未命名",
    type: raw.type || "usb",
    address: raw.address ?? "",
    user: raw.user,
    password: raw.password,
    status: isActive ? CameraStatus.ONLINE : (raw.status ?? CameraStatus.OFFLINE),
    streamUrl: raw.id ? `/video_feed?cam=${raw.id}` : "",
    personCount: raw.personCount ?? 0,
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
    engine: raw.engine,
    onlineDevices: raw.onlineDevices,
    totalDevices: raw.totalDevices,
    activeModels: raw.activeModels,
    totalModels: raw.totalModels,
    dataDirSizeMb: raw.dataDirSizeMb,
    detectionCount: raw.detectionCount,
    services: (raw.services ?? []).map((s: any) => ({
      name: s.name ?? s.serviceName ?? "Unknown",
      uptime: s.uptime ?? "-",
      status: s.status ?? "unknown",
      health: s.health ?? (s.status === "Running" ? "healthy" : "warning"),
    })),
  };
}
