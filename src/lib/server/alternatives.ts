import type { LngLat } from "@/lib/types";
import { bearing, cumulative, haversine, nearestOnLine, pointAt } from "@/lib/geo";
import type { Profile } from "./parse";

export interface Candidate {
  geometry: LngLat[];
  distanceM: number;
  durationS?: number;
}

export type Label = "shortest" | "fastest";

export interface RankedRoute {
  id: string;
  geometry: LngLat[];
  distanceM: number;
  durationS: number;
  labels: Label[];
}

export const MAX_ROUTES = 3;
export const MAX_PROBES = 4;
export const MAX_STRETCH = 1.4;
export const MAX_OVERLAP = 0.7;
export const MAX_BACKTRACK_M = 150;
export const SAMPLE_M = 20;
export const NEAR_M = 15;

export const PROFILE_KMH: Record<Profile, number> = { foot: 4.8, bike: 14, car: 28 };

export function probeOffsetM(straightM: number): number {
  return Math.min(1500, Math.max(120, 0.25 * straightM));
}

function offsetPoint(p: LngLat, bearingDeg: number, meters: number): LngLat {
  const R = 6371008.8;
  const br = (bearingDeg * Math.PI) / 180;
  const lat1 = (p[1] * Math.PI) / 180;
  const lng1 = (p[0] * Math.PI) / 180;
  const d = meters / R;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(br));
  const lng2 = lng1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return [(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
}

export function probePoints(main: LngLat[], from: LngLat, to: LngLat, max = MAX_PROBES): LngLat[] {
  if (main.length < 2) return [];
  const cum = cumulative(main);
  const total = cum[cum.length - 1];
  const dir = bearing(from, to);
  const offset = probeOffsetM(haversine(from, to));
  const out: LngLat[] = [];
  for (const f of [0.5, 1 / 3, 2 / 3]) {
    const at = pointAt(main, cum, total * f).pos;
    out.push(offsetPoint(at, dir + 90, offset), offsetPoint(at, dir - 90, offset));
  }
  return out.slice(0, max);
}

export function sampleLine(line: LngLat[], stepM = SAMPLE_M): LngLat[] {
  if (line.length < 2) return line.slice();
  const cum = cumulative(line);
  const total = cum[cum.length - 1];
  const out: LngLat[] = [];
  for (let m = 0; m <= total; m += stepM) out.push(pointAt(line, cum, m).pos);
  if (!out.length || haversine(out[out.length - 1], line[line.length - 1]) > 1) out.push(line[line.length - 1]);
  return out;
}

export function overlapRatio(a: LngLat[], b: LngLat[], stepM = SAMPLE_M, nearM = NEAR_M): number {
  const samples = sampleLine(a, stepM);
  if (!samples.length || b.length < 2) return 0;
  const cumB = cumulative(b);
  let near = 0;
  for (const p of samples) if (nearestOnLine(p, b, cumB).d <= nearM) near++;
  return near / samples.length;
}

export function backtrackM(line: LngLat[], stepM = SAMPLE_M, nearM = NEAR_M): number {
  const s = sampleLine(line, stepM);
  const gap = Math.ceil((nearM * 4) / stepM);
  let worst = 0;
  for (let i = 0; i < s.length; i++) {
    for (let j = s.length - 1; j > i + gap; j--) {
      if (haversine(s[i], s[j]) <= nearM) {
        worst = Math.max(worst, ((j - i) * stepM) / 2);
        break;
      }
    }
  }
  return worst;
}

export function withDuration(c: Candidate, profile: Profile): Candidate & { durationS: number } {
  const durationS =
    c.durationS !== undefined && Number.isFinite(c.durationS) && c.durationS > 0
      ? Math.round(c.durationS)
      : Math.round((c.distanceM / 1000 / PROFILE_KMH[profile]) * 3600);
  return { ...c, durationS };
}

export function isDistinct(c: Candidate, kept: Candidate[]): boolean {
  return kept.every((k) => overlapRatio(c.geometry, k.geometry) < MAX_OVERLAP);
}

export function acceptable(c: Candidate, kept: Candidate[], shortestM: number): boolean {
  if (c.geometry.length < 2 || !Number.isFinite(c.distanceM)) return false;
  if (c.distanceM > shortestM * MAX_STRETCH) return false;
  if (!isDistinct(c, kept)) return false;
  return backtrackM(c.geometry) <= MAX_BACKTRACK_M;
}

export function selectRoutes(base: Candidate[], probes: Candidate[] = []): Candidate[] {
  const valid = base.filter((c) => c.geometry.length >= 2 && Number.isFinite(c.distanceM));
  if (!valid.length) return [];
  const shortest = Math.min(...valid.map((c) => c.distanceM));
  const kept: Candidate[] = [valid[0]];
  for (const c of [...valid.slice(1), ...probes]) {
    if (kept.length >= MAX_ROUTES) break;
    if (acceptable(c, kept, shortest)) kept.push(c);
  }
  return kept;
}

export function rankRoutes(list: Candidate[], profile: Profile): RankedRoute[] {
  const timed = list.map((c) => withDuration(c, profile));
  if (!timed.length) return [];
  const minD = Math.min(...timed.map((c) => c.distanceM));
  const minT = Math.min(...timed.map((c) => c.durationS));
  const byTime = profile === "car";
  const sorted = timed
    .map((c, i) => ({ c, i }))
    .sort((a, b) =>
      byTime
        ? a.c.durationS - b.c.durationS || a.c.distanceM - b.c.distanceM || a.i - b.i
        : a.c.distanceM - b.c.distanceM || a.c.durationS - b.c.durationS || a.i - b.i,
    );
  return sorted.map(({ c }, i) => {
    const labels: Label[] = [];
    if (c.distanceM === minD) labels.push("shortest");
    if (c.durationS === minT) labels.push("fastest");
    return { id: `r${i}`, geometry: c.geometry, distanceM: Math.round(c.distanceM), durationS: c.durationS, labels };
  });
}

export async function findAlternatives(
  profile: Profile,
  points: LngLat[],
  base: Candidate[],
  probe: (points: LngLat[]) => Promise<Candidate | null>,
  maxProbes = MAX_PROBES,
): Promise<{ routes: RankedRoute[]; probes: number }> {
  let kept = selectRoutes(base);
  let used = 0;
  if (kept.length && kept.length < MAX_ROUTES && points.length === 2) {
    const vias = probePoints(kept[0].geometry, points[0], points[1], maxProbes);
    const found: Candidate[] = [];
    for (let i = 0; i < vias.length && kept.length < MAX_ROUTES; i += 2) {
      const batch = vias.slice(i, i + 2).slice(0, Math.max(0, maxProbes - used));
      if (!batch.length) break;
      used += batch.length;
      const got = await Promise.all(batch.map((v) => probe([points[0], v, points[1]]).catch(() => null)));
      for (const g of got) if (g) found.push(g);
      kept = selectRoutes(base, found);
    }
  }
  return { routes: rankRoutes(kept, profile), probes: used };
}
