// Admin API client — used only inside /admin/* routes.
// Token NEVER touches localStorage.
// Flow: login → setTokenCache(token) seeds in-memory cache + sets httpOnly cookie.
// On page refresh: in-memory cache is empty → apiFetch lazily calls GET /api/admin-auth to restore
// the token from the httpOnly cookie. Falls back to redirect-to-login on 401.
const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

// One-time cleanup: remove stale admin_token from localStorage if it exists from an older build
if (typeof window !== "undefined") {
  try { localStorage.removeItem("admin_token"); } catch { /* ignore */ }
}

let _memToken: string | null = null;
let _restorePromise: Promise<void> | null = null;

/** Seed the in-memory token cache immediately after a successful login. */
export function setTokenCache(token: string) {
  _memToken = token;
}

export function clearTokenCache() {
  _memToken = null;
  _restorePromise = null;
}

async function _restoreFromCookie(): Promise<void> {
  try {
    const res = await fetch("/api/admin-auth", { method: "GET" });
    if (res.ok) {
      const body = await res.json() as { token: string | null };
      if (body.token) _memToken = body.token;
    }
  } catch {
    // network error — leave _memToken null, apiFetch will handle the 401
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Lazily restore token from httpOnly cookie after a page refresh
  if (!_memToken) {
    if (!_restorePromise) _restorePromise = _restoreFromCookie();
    await _restorePromise;
  }
  const token = _memToken;
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  // Token expired or invalid — clear cache and redirect to login
  if (res.status === 401 && typeof window !== "undefined") {
    _memToken = null;
    _restorePromise = null;
    window.location.href = "/admin/login";
    return undefined as T;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Like apiFetch but does NOT set Content-Type — lets the browser set multipart boundary for file uploads. */
export async function apiFetchForm<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!_memToken) {
    if (!_restorePromise) _restorePromise = _restoreFromCookie();
    await _restorePromise;
  }
  const token = _memToken;
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401 && typeof window !== "undefined") {
    _memToken = null;
    _restorePromise = null;
    window.location.href = "/admin/login";
    return undefined as T;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function adminLogin(email: string, password: string) {
  // Goes through Next.js API proxy — same origin, works on mobile/devtunnels.
  // The proxy calls NestJS server-to-server, avoiding direct browser→NestJS connection.
  const res = await fetch("/api/admin-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? "Invalid credentials");
  }
  return res.json() as Promise<{ access_token: string }>;
}
