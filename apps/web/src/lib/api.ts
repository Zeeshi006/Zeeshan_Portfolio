// API client — all data fetched server-side via ISR

const API_URL = process.env["API_URL"] ?? "http://localhost:3001";

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { tags?: string[] } = {},
): Promise<T> {
  const { tags, ...rest } = options;

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    next: tags ? { tags } : undefined,
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`API ${path} → ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}
