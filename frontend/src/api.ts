const API = '/api/v1';

const STORAGE_KEY = 'cb-auth-token';

let _memoryToken: string | null = null;

// Restore token from localStorage on module load
if (typeof window !== 'undefined') {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) _memoryToken = saved;
}

export function setToken(t: string | null) {
  _memoryToken = t;
  if (t) {
    localStorage.setItem(STORAGE_KEY, t);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function getToken(): string | null {
  return _memoryToken;
}

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? match[1] : '';
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const csrf = getCsrfToken();
  if (csrf) headers['X-CSRF-Token'] = csrf;
  const controller = new AbortController();
  const isLongRunning = path.startsWith('/docker/') || path.startsWith('/laravel/composer-') || path.startsWith('/laravel/ensure-');
  const timeout = isLongRunning ? 300000 : opts.body instanceof FormData ? 60000 : 30000;
  const t = setTimeout(() => controller.abort(), timeout);

  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { ...opts, headers, signal: controller.signal });
  } catch (e) {
    clearTimeout(t);
    if ((e as Error).name === 'AbortError') {
      const label = isLongRunning ? 'Long-running operation' : 'Request';
      throw new ApiError(408, `${label} timed out after ${timeout / 1000}s. The server may be overloaded.`);
    }
    throw new ApiError(0, (e as Error).message || 'Network error');
  }
  clearTimeout(t);

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    // Detect HTML response from nginx catch-all (backend down / timeout)
    if (/^\s*<(!doctype|html)/i.test(text)) {
      const snippet = text.slice(0, 120).replace(/\s+/g, ' ').trim();
      throw new ApiError(res.status, `Server returned HTML (status ${res.status}). The API endpoint may not be reachable. Response starts with: "${snippet}..."`);
    }
    throw new ApiError(res.status, text || 'Request failed');
  }
  if (!res.ok) {
    let detail = 'Request failed';
    if (data) {
      if (typeof data.detail === 'string') {
        detail = data.detail;
      } else if (Array.isArray(data.detail)) {
        detail = data.detail.map((d: any) => d.msg || d.message).join('. ');
      } else if (typeof data.detail === 'object' && data.detail !== null) {
        detail = data.detail.message || JSON.stringify(data.detail);
      }
    }
    throw new ApiError(res.status, detail);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, isForm?: boolean) => {
    const opts: RequestInit = { method: 'POST' };
    if (body !== undefined) {
      if (isForm) {
        opts.body = body as FormData;
      } else {
        opts.body = JSON.stringify(body);
      }
    }
    return request<T>(path, opts);
  },
  patch: <T>(path: string, body?: unknown) => {
    const opts: RequestInit = { method: 'PATCH' };
    if (body !== undefined) {
      opts.body = JSON.stringify(body);
    }
    return request<T>(path, opts);
  },
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export const apiPut = <T>(path: string, body?: unknown) => {
  return request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });
};

export function getWsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const token = getToken();
  if (token) {
    return `${proto}//${location.host}/api/v1/terminal/ws?token=${encodeURIComponent(token)}`;
  }
  return `${proto}//${location.host}/api/v1/terminal/ws`;
}
