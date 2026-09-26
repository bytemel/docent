import { rateLimit } from "./rateLimit";

export const USER_AGENT = "Docent/0.1 (+https://github.com/bytemel/docent)";
export const TIMEOUT_MS = 8000;

export const CACHE_OK = "public, s-maxage=86400, stale-while-revalidate=604800";
export const CACHE_SHORT = "public, s-maxage=300";

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return ipKey(fwd || req.headers.get("x-real-ip")?.trim() || "unknown");
}

export function ipKey(ip: string): string {
  if (!ip.includes(":") || ip.includes(".")) return ip;
  const [head] = ip.split("::");
  const groups = head.split(":").filter(Boolean);
  return `${groups.slice(0, 4).join(":")}::/64`;
}

export function ok(body: unknown, cache: string = CACHE_OK): Response {
  return Response.json(body, { headers: { "Cache-Control": cache } });
}

export function busy(): Response {
  return fail(503, "Docent is very busy today. Please try again later or drop a pin on the map.");
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
