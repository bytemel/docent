import { parseGoogleUrl } from "@/lib/placeInput";
import { USER_AGENT } from "./http";

export const RESOLVE_HOSTS = new Set(["maps.app.goo.gl", "goo.gl", "google.com", "www.google.com", "maps.google.com"]);
export const MAX_HOPS = 4;
export const RESOLVE_TIMEOUT_MS = 5000;

export type Resolved = { lng: number; lat: number; label?: string } | { query: string };

export function allowedUrl(u: URL): boolean {
  return (
    (u.protocol === "https:" || u.protocol === "http:") &&
    RESOLVE_HOSTS.has(u.hostname.toLowerCase()) &&
    u.port === "" &&
    u.username === "" &&
    u.password === ""
  );
}

export function startUrl(raw: string): URL | null {
  const s = raw.trim();
  if (!s || s.length > 2048) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (!allowedUrl(u)) return null;
    u.protocol = "https:";
    return u;
  } catch {
    return null;
  }
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export async function resolveLink(raw: string, fetchImpl: FetchLike = fetch): Promise<Resolved | null> {
  let u = startUrl(raw);
  if (!u) return null;
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const host = u.hostname.toLowerCase();
    if (host === "consent.google.com") {
      const next = u.searchParams.get("continue");
      if (!next) return null;
      try {
        u = new URL(next);
      } catch {
        return null;
      }
      continue;
    }
    const parsed = parseGoogleUrl(u);
    if (parsed && !("query" in parsed)) return parsed;
    if (parsed && "query" in parsed) return { query: parsed.query };
    if (!allowedUrl(u) || hop === MAX_HOPS) break;
    u.protocol = "https:";
    let res: Response;
    try {
      res = await fetchImpl(u.toString(), {
        redirect: "manual",
        signal: AbortSignal.timeout(RESOLVE_TIMEOUT_MS),
        headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      });
    } catch {
      break;
    }
    const loc = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!loc) break;
    try {
      u = new URL(loc, u);
    } catch {
      break;
    }
  }
  return null;
}
