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

// --- In-memory cache for GET requests ---

const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 30_000; // 30s
const pending = new Map<string, Promise<any>>();

function cacheKey(path: string): string {
  return path;
}

/** Invalidate all cache entries matching a path prefix. Call after mutations. */
function invalidateCache(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

async function cachedFetch<T>(path: string, fetchFn: () => Promise<T>): Promise<T> {
  const key = cacheKey(path);

  // 1. Cache hit (within TTL)
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data as T;

  // 2. Deduplicate concurrent requests to same URL
  if (pending.has(key)) return pending.get(key) as Promise<T>;

  // 3. New request
  const promise = fetchFn().then(data => {
    cache.set(key, { data, ts: Date.now() });
    pending.delete(key);
    return data;
  }).catch(err => {
    pending.delete(key);
    throw err;
  });
  pending.set(key, promise);
  return promise;
}

// --- REST fetch wrapper ---

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

// --- Typed API helpers ---

function handleResponseError(res: Response, body: any): never {
  if (res.status === 401) {
    clearToken();
    cache.clear();
    pending.clear();
    window.dispatchEvent(new Event("rtk:token-invalid"));
  }
  throw new Error(body.error || body.message || "请求失败");
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return cachedFetch(path, async () => {
    const res = await apiFetch(path, { signal });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      handleResponseError(res, err);
    }
    const json = await res.json();
    return (json.data !== undefined ? json.data : json) as T;
  });
}

export async function apiPost<T>(path: string, body: any, signal?: AbortSignal): Promise<T> {
  invalidateCache(path);
  const res = await apiFetch(path, { method: "POST", body: JSON.stringify(body), signal });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    handleResponseError(res, err);
  }
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

/** Upload a file via multipart/form-data. */
export async function apiUpload<T>(path: string, file: File, onProgress?: (pct: number) => void): Promise<T> {
  const token = getToken();
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}${path}`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(json.data !== undefined ? json.data : json);
        } else {
          reject(new Error(json.error || json.message || "上传失败"));
        }
      } catch {
        reject(new Error("上传失败"));
      }
    };

    xhr.onerror = () => reject(new Error("网络错误"));
    xhr.onabort = () => reject(new Error("上传已取消"));

    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

export async function apiPatch<T>(path: string, body: any, signal?: AbortSignal): Promise<T> {
  invalidateCache(path);
  const res = await apiFetch(path, { method: "PATCH", body: JSON.stringify(body), signal });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    handleResponseError(res, err);
  }
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

export async function apiPut<T>(path: string, body: any, signal?: AbortSignal): Promise<T> {
  invalidateCache(path);
  const res = await apiFetch(path, { method: "PUT", body: JSON.stringify(body), signal });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    handleResponseError(res, err);
  }
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

export async function apiDelete<T>(path: string, signal?: AbortSignal): Promise<T> {
  invalidateCache(path);
  const res = await apiFetch(path, { method: "DELETE", signal });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    handleResponseError(res, err);
  }
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

// --- SSE connection — singleton EventSource shared by all subscribers ---

export type SseCallback = (data: any) => void;

const SSE_EVENT_TYPES = ["cameras", "alerts", "system_metrics", "audit_logs", "camera_stats"] as const;

const sseSubscribers = new Map<string, Set<SseCallback>>();
let sseEventSource: EventSource | null = null;
let sseSubscriberCount = 0;
let sseReconnectTimer: ReturnType<typeof setTimeout> | null = null;

function ensureSseConnection(): void {
  if (sseEventSource && sseEventSource.readyState !== EventSource.CLOSED) return;
  if (sseReconnectTimer) { clearTimeout(sseReconnectTimer); sseReconnectTimer = null; }

  const es = new EventSource(`${API_BASE}/api/sse/stream`);

  es.addEventListener("system_metrics", (e: MessageEvent) => handleSseEvent("system_metrics", e));
  es.addEventListener("cameras", (e: MessageEvent) => handleSseEvent("cameras", e));
  es.addEventListener("alerts", (e: MessageEvent) => handleSseEvent("alerts", e));
  es.addEventListener("audit_logs", (e: MessageEvent) => handleSseEvent("audit_logs", e));
  es.addEventListener("camera_stats", (e: MessageEvent) => handleSseEvent("camera_stats", e));

  es.onerror = () => {
    es.close();
    sseEventSource = null;
    // Auto-reconnect if subscribers still active
    if (sseSubscriberCount > 0) {
      sseReconnectTimer = setTimeout(() => ensureSseConnection(), 3000);
    }
  };

  sseEventSource = es;
}

function handleSseEvent(eventType: string, e: MessageEvent) {
  const subs = sseSubscribers.get(eventType);
  if (!subs || subs.size === 0) return;
  let data: any;
  try {
    data = JSON.parse(e.data);
    // Backend double-JSON-encodes SSE data — first parse yields a string
    if (typeof data === "string") {
      data = JSON.parse(data);
    }
  } catch (err) {
    console.error("SSE parse error", eventType, err);
    return;
  }
  subs.forEach(cb => { try { cb(data); } catch (err) { console.error("SSE callback error", eventType, err); } });
}

export function subscribeSse(eventType: string, callback: SseCallback): () => void {
  if (!sseSubscribers.has(eventType)) {
    sseSubscribers.set(eventType, new Set());
  }
  sseSubscribers.get(eventType)!.add(callback);
  sseSubscriberCount++;

  // Lazy-start after first subscriber registers
  ensureSseConnection();

  return () => {
    const subs = sseSubscribers.get(eventType);
    if (subs) {
      subs.delete(callback);
      if (subs.size === 0) sseSubscribers.delete(eventType);
    }
    sseSubscriberCount--;
    if (sseSubscriberCount <= 0 && sseEventSource) {
      sseEventSource.close();
      sseEventSource = null;
    }
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

// --- Auth-aware file download ---

export function apiDownload(path: string, signal?: AbortSignal): void {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  fetch(path, { headers, signal })
    .then(res => res.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "";
      a.click();
      URL.revokeObjectURL(url);
    })
    .catch(err => { if ((err as Error).name !== 'AbortError') console.error(err); });
}

// --- Detection control ---

export async function startDetection(): Promise<{ status: string; pid?: number; message?: string }> {
  const res = await apiFetch("/api/detection/start", { method: "POST" });
  const body = await res.json();
  if (!res.ok) handleResponseError(res, body);
  return body.data;
}

export async function stopDetection(): Promise<{ status: string; pid?: number }> {
  const res = await apiFetch("/api/detection/stop", { method: "POST" });
  const body = await res.json();
  if (!res.ok) handleResponseError(res, body);
  return body.data;
}

export async function getDetectionStatus(): Promise<{ running: boolean }> {
  const res = await apiFetch("/api/detection/status");
  const body = await res.json();
  if (!res.ok) handleResponseError(res, body);
  return body.data;
}
