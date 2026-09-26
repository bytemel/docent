import { rateLimit } from "./rateLimit";

export const USER_AGENT = "Docent/0.1 (+https://github.com/bytemel/docent)";
export const TIMEOUT_MS = 8000;

export const CACHE_OK = "public, s-maxage=86400, stale-while-revalidate=604800";

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export function ok(body: unknown): Response {
  return Response.json(body, { headers: { "Cache-Control": CACHE_OK } });
}

export function fail(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export function limited(req: Request, name: string, limit: number): Response | null {
  if (rateLimit(`${name}:${clientIp(req)}`, limit, 60_000)) return null;
  return Response.json(
    { error: "Too many requests. Please wait a minute and try again." },
    { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } },
  );
}

export async function fetchJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new UpstreamError(res.status);
  return res.json();
}

export class UpstreamError extends Error {
  status: number;
  constructor(status: number) {
    super(`Upstream error ${status}`);
    this.status = status;
  }
}
