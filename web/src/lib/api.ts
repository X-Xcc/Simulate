const API_BASE = "";

// JWT Token management
export function getToken(): string | null {
  return localStorage.getItem("jwt_token");
}

export function setToken(token: string): void {
  localStorage.setItem("jwt_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("jwt_token");
}

// REST fetch wrapper
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  return response;
}

// Typed API helpers
export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || "请求失败");
  }
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

export async function apiPost<T>(path: string, body: any): Promise<T> {
  const res = await apiFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || "请求失败");
  }
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

export async function apiPatch<T>(path: string, body: any): Promise<T> {
  const res = await apiFetch(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || "请求失败");
  }
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

export async function apiPut<T>(path: string, body: any): Promise<T> {
  const res = await apiFetch(path, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || "请求失败");
  }
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await apiFetch(path, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || "请求失败");
  }
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

// SSE connection — singleton EventSource shared by all subscribers
export type SseCallback = (data: any) => void;

const SSE_EVENT_TYPES = ["cameras", "alerts", "system_metrics", "audit_logs", "camera_stats"] as const;

const sseSubscribers = new Map<string, Set<SseCallback>>();
let sseEventSource: EventSource | null = null;
let sseCleanup: (() => void) | null = null;

function ensureSseConnection(): void {
  if (sseEventSource) return;

  const es = new EventSource(`${API_BASE}/api/sse/stream`);

  for (const eventType of SSE_EVENT_TYPES) {
    es.addEventListener(eventType, (e: MessageEvent) => {
      const subs = sseSubscribers.get(eventType);
      if (!subs || subs.size === 0) return;
      let data: any;
      try { data = JSON.parse(e.data); } catch (err) { console.error("SSE parse error", eventType, err); return; }
      subs.forEach(cb => { try { cb(data); } catch (err) { console.error("SSE callback error", eventType, err); } });
    });
  }

  es.onerror = () => console.error("SSE connection error");

  sseEventSource = es;
}

export function subscribeSse(eventType: string, callback: SseCallback): () => void {
  if (!sseSubscribers.has(eventType)) {
    sseSubscribers.set(eventType, new Set());
  }
  sseSubscribers.get(eventType)!.add(callback);

  // Lazy-start after first subscriber registers
  ensureSseConnection();

  return () => {
    sseSubscribers.get(eventType)?.delete(callback);
    // Don't close EventSource — other subscribers may still need it
  };
}

/** @deprecated — use subscribeSse per event type instead */
export function createSseConnection(callbacks: {
  onCameras?: SseCallback;
  onAlerts?: SseCallback;
  onSystemMetrics?: SseCallback;
  onAuditLogs?: SseCallback;
  onCameraStats?: SseCallback;
}): () => void {
  const unsubs: (() => void)[] = [];
  if (callbacks.onCameras) unsubs.push(subscribeSse("cameras", callbacks.onCameras));
  if (callbacks.onAlerts) unsubs.push(subscribeSse("alerts", callbacks.onAlerts));
  if (callbacks.onSystemMetrics) unsubs.push(subscribeSse("system_metrics", callbacks.onSystemMetrics));
  if (callbacks.onAuditLogs) unsubs.push(subscribeSse("audit_logs", callbacks.onAuditLogs));
  if (callbacks.onCameraStats) unsubs.push(subscribeSse("camera_stats", callbacks.onCameraStats));
  return () => unsubs.forEach(fn => fn());
}

// Auth-aware file download
export function apiDownload(path: string): void {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  fetch(path, { headers })
    .then(res => res.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "";
      a.click();
      URL.revokeObjectURL(url);
    })
    .catch(console.error);
}
