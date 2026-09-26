import type { LngLat } from "./types";
import type { RoutingProfile } from "./modes";

export interface LegResult {
  geometry: LngLat[];
  distanceM: number;
}

export class RouteError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const MAX_CACHE = 200;
const cache = new Map<string, LegResult>();

const r5 = (n: number) => Math.round(n * 1e5) / 1e5;

export function routeUrl(profile: RoutingProfile, points: LngLat[]): string {
  const pts = points.map(([lng, lat]) => `${r5(lng)},${r5(lat)}`).join(";");
  return `/api/route?profile=${profile}&points=${encodeURIComponent(pts)}`;
}

export function cachedLeg(profile: RoutingProfile, points: LngLat[]): LegResult | undefined {
  return cache.get(routeUrl(profile, points));
}

export async function routeLeg(
  profile: RoutingProfile,
  points: LngLat[],
  signal?: AbortSignal,
): Promise<LegResult> {
  const url = routeUrl(profile, points);
  const hit = cache.get(url);
  if (hit) return hit;
  const res = await fetch(url, { signal });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const msg = (body as { error?: string } | null)?.error ?? "Routing failed";
    throw new RouteError(res.status, msg);
  }
  const r = body as LegResult;
  if (!r || !Array.isArray(r.geometry) || r.geometry.length < 2) throw new RouteError(502, "Bad route");
  if (cache.size >= MAX_CACHE) {
    const first = cache.keys().next().value;
    if (first !== undefined) cache.delete(first);
  }
  cache.set(url, r);
  return r;
}

export type RouteLabel = "shortest" | "fastest";

export interface RouteOption {
  id: string;
  geometry: LngLat[];
  distanceM: number;
  durationS: number;
  labels: RouteLabel[];
}

export async function routeOptions(
  profile: RoutingProfile,
  points: LngLat[],
  signal?: AbortSignal,
): Promise<RouteOption[]> {
  const leg = await routeLeg(profile, points, signal);
  return [{ id: "r0", geometry: leg.geometry, distanceM: leg.distanceM, durationS: 0, labels: ["shortest", "fastest"] }];
}
