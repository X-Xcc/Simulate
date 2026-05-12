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

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return cachedFetch(path, async () => {
    const res = await apiFetch(path, { signal });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || err.message || "请求失败");
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
    throw new Error(err.error || err.message || "请求失败");
  }
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

export async function apiPatch<T>(path: string, body: any, signal?: AbortSignal): Promise<T> {
  invalidateCache(path);
  const res = await apiFetch(path, { method: "PATCH", body: JSON.stringify(body), signal });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || "请求失败");
  }
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

export async function apiPut<T>(path: string, body: any, signal?: AbortSignal): Promise<T> {
  invalidateCache(path);
  const res = await apiFetch(path, { method: "PUT", body: JSON.stringify(body), signal });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || "请求失败");
  }
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

export async function apiDelete<T>(path: string, signal?: AbortSignal): Promise<T> {
  invalidateCache(path);
  const res = await apiFetch(path, { method: "DELETE", signal });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || "请求失败");
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
const SSE_MAX_ERRORS = 3;
let sseErrorCount = 0;

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

  es.onerror = () => {
    sseErrorCount++;
    console.error(`SSE connection error (${sseErrorCount}/${SSE_MAX_ERRORS})`);
    if (sseErrorCount >= SSE_MAX_ERRORS) {
      sseErrorCount = 0;
      const token = getToken();
      if (!token) return;
      // Verify auth via HEAD; if 401, clear token to trigger logout
      fetch(`${API_BASE}/api/me`, { method: 'HEAD', headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => {
          if (res.status === 401) {
            clearToken();
            if (sseEventSource) { sseEventSource.close(); sseEventSource = null; }
          }
        })
        .catch(() => { sseErrorCount = 0; });
    }
  };

  sseEventSource = es;
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
