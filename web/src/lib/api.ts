const currentPort = typeof window !== "undefined" ? window.location.port : "5000";
export const API_BASE = `${window.location.protocol}//${window.location.hostname}:${currentPort || "5000"}`;
export const isZeroPort = currentPort === "5001";

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

// 缓存层
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 30_000;
const pending = new Map<string, Promise<any>>();

function invalidateCache(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

async function cachedFetch<T>(path: string, fetchFn: () => Promise<T>): Promise<T> {
  const entry = cache.get(path);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data as T;
  if (pending.has(path)) return pending.get(path) as Promise<T>;
  const promise = fetchFn().then(data => {
    cache.set(path, { data, ts: Date.now() });
    pending.delete(path);
    return data;
  }).catch(err => {
    pending.delete(path);
    throw err;
  });
  pending.set(path, promise);
  return promise;
}

// SSE 连接

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

function unwrapResponse(json: any): any {
  if (json && typeof json === "object" && "data" in json) {
    return json.data;
  }
  return json;
}

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
    return unwrapResponse(json) as T;
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
  return unwrapResponse(json);
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
          resolve(unwrapResponse(json));
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
  return unwrapResponse(json);
}

export async function apiPut<T>(path: string, body: any, signal?: AbortSignal): Promise<T> {
  invalidateCache(path);
  const res = await apiFetch(path, { method: "PUT", body: JSON.stringify(body), signal });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    handleResponseError(res, err);
  }
  const json = await res.json();
  return unwrapResponse(json);
}

export async function apiDelete<T>(path: string, signal?: AbortSignal): Promise<T> {
  invalidateCache(path);
  const res = await apiFetch(path, { method: "DELETE", signal });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    handleResponseError(res, err);
  }
  const json = await res.json();
  return unwrapResponse(json);
}

// --- SSE ---

const SSE_EVENT_TYPES = ["cameras", "alerts", "system_metrics", "audit_logs", "camera_stats"] as const;
type SseEventType = typeof SSE_EVENT_TYPES[number];
type SseCallback = (data: any) => void;

const sseSubscribers = new Map<string, Set<SseCallback>>();
let sseEventSource: EventSource | null = null;
let sseReconnectTimer: ReturnType<typeof setTimeout> | null = null;

function ensureSseConnection(): void {
  if (sseEventSource && sseEventSource.readyState !== EventSource.CLOSED) return;
  if (sseReconnectTimer) { clearTimeout(sseReconnectTimer); sseReconnectTimer = null; }

  const es = new EventSource(`${API_BASE}/api/sse/stream`);

  for (const type of SSE_EVENT_TYPES) {
    es.addEventListener(type, (e: MessageEvent) => {
      const subs = sseSubscribers.get(type);
      if (!subs || subs.size === 0) return;
      let data: any;
      try {
        data = JSON.parse(e.data);
        if (typeof data === "string") data = JSON.parse(data);
      } catch { return; }
      subs.forEach(cb => { try { cb(data); } catch {} });
    });
  }

  es.onerror = () => {
    es.close();
    sseEventSource = null;
    if (sseSubscribers.size > 0) {
      sseReconnectTimer = setTimeout(ensureSseConnection, 5000);
    }
  };

  sseEventSource = es;
}

export function subscribeSse(eventType: string, callback: SseCallback): () => void {
  if (!sseSubscribers.has(eventType)) sseSubscribers.set(eventType, new Set());
  sseSubscribers.get(eventType)!.add(callback);
  ensureSseConnection();

  return () => {
    const subs = sseSubscribers.get(eventType);
    if (subs) {
      subs.delete(callback);
      if (subs.size === 0) sseSubscribers.delete(eventType);
    }
    if (sseSubscribers.size === 0 && sseEventSource) {
      sseEventSource.close();
      sseEventSource = null;
    }
  };
}

// --- Auth-aware file download ---

export function apiDownload(path: string, signal?: AbortSignal): void {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  fetch(`${API_BASE}${path}`, { headers, signal })
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
