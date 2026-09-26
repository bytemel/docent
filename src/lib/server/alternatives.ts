import type { LngLat } from "@/lib/types";
import { bearing, cumulative, haversine, lineLength, pointAt } from "@/lib/geo";
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

export const MAX_SAMPLES = 400;
export const PROBE_LIMIT_M = 80_000;

export function sampleStep(totalM: number, minStepM = SAMPLE_M): number {
  return Math.max(minStepM, totalM / MAX_SAMPLES);
}

export function sampleLine(line: LngLat[], stepM = SAMPLE_M): LngLat[] {
  if (line.length < 2) return line.slice();
  const out: LngLat[] = [line[0]];
  let carry = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const len = haversine(a, b);
    let at = stepM - carry;
    while (at <= len) {
      const t = at / len;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      at += stepM;
    }
    carry = len - (at - stepM);
  }
  const last = line[line.length - 1];
  if (haversine(out[out.length - 1], last) > 1) out.push(last);
  return out;
}

const KX = 111320;
const KY = 110540;
const CELL_M = 100;

interface Grid {
  k: number;
  cells: Map<string, number[]>;
  xs: Float64Array;
  ys: Float64Array;
}

const grids = new WeakMap<LngLat[], Grid>();

function gridFor(line: LngLat[]): Grid {
  const hit = grids.get(line);
  if (hit) return hit;
  const lat0 = line.reduce((acc, p) => acc + p[1], 0) / line.length;
  const k = Math.cos((lat0 * Math.PI) / 180) * KX;
  const xs = new Float64Array(line.length);
  const ys = new Float64Array(line.length);
  line.forEach((p, i) => {
    xs[i] = p[0] * k;
    ys[i] = p[1] * KY;
  });
  const cells = new Map<string, number[]>();
  for (let i = 1; i < line.length; i++) {
    const cx0 = Math.floor(Math.min(xs[i - 1], xs[i]) / CELL_M);
    const cx1 = Math.floor(Math.max(xs[i - 1], xs[i]) / CELL_M);
    const cy0 = Math.floor(Math.min(ys[i - 1], ys[i]) / CELL_M);
    const cy1 = Math.floor(Math.max(ys[i - 1], ys[i]) / CELL_M);
    if ((cx1 - cx0 + 1) * (cy1 - cy0 + 1) > 400) {
      const n = Math.ceil(Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]) / CELL_M) + 1;
      for (let s = 0; s <= n; s++) {
        const x = xs[i - 1] + ((xs[i] - xs[i - 1]) * s) / n;
        const y = ys[i - 1] + ((ys[i] - ys[i - 1]) * s) / n;
        const key = `${Math.floor(x / CELL_M)}:${Math.floor(y / CELL_M)}`;
        const list = cells.get(key);
        if (!list) cells.set(key, [i]);
        else if (list[list.length - 1] !== i) list.push(i);
      }
      continue;
    }
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const key = `${cx}:${cy}`;
        const list = cells.get(key);
        if (list) list.push(i);
        else cells.set(key, [i]);
      }
    }
  }
  const g = { k, cells, xs, ys };
  grids.set(line, g);
  return g;
}

function nearLine(p: LngLat, g: Grid, nearM: number): boolean {
  const x = p[0] * g.k;
  const y = p[1] * KY;
  const cx = Math.floor(x / CELL_M);
  const cy = Math.floor(y / CELL_M);
  const r = Math.ceil(nearM / CELL_M);
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      const list = g.cells.get(`${cx + dx}:${cy + dy}`);
      if (!list) continue;
      for (const i of list) {
        const ax = g.xs[i - 1];
        const ay = g.ys[i - 1];
        const vx = g.xs[i] - ax;
        const vy = g.ys[i] - ay;
        const len2 = vx * vx + vy * vy;
        const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / len2)) : 0;
        if (Math.hypot(x - (ax + t * vx), y - (ay + t * vy)) <= nearM) return true;
      }
    }
  }
  return false;
}

const samplesCache = new WeakMap<LngLat[], { step: number; samples: LngLat[] }>();

function samplesFor(line: LngLat[], minStepM: number): LngLat[] {
  const hit = samplesCache.get(line);
  const step = sampleStep(lineLength(line), minStepM);
  if (hit && hit.step === step) return hit.samples;
  const samples = sampleLine(line, step);
  samplesCache.set(line, { step, samples });
  return samples;
}

export function overlapRatio(a: LngLat[], b: LngLat[], stepM = SAMPLE_M, nearM = NEAR_M): number {
  if (a.length < 2 || b.length < 2) return 0;
  const samples = samplesFor(a, stepM);
  if (!samples.length) return 0;
  const g = gridFor(b);
  let near = 0;
  for (const p of samples) if (nearLine(p, g, nearM)) near++;
  return near / samples.length;
}

export function backtrackM(line: LngLat[], stepM = SAMPLE_M, nearM = NEAR_M): number {
  if (line.length < 3) return 0;
  const step = sampleStep(lineLength(line), stepM);
  const s = samplesFor(line, stepM);
  const tol = nearM + step / 2;
  let worst = 0;
  for (let i = 1; i < s.length - 1; i++) {
    const turn = Math.abs(((bearing(s[i], s[i + 1]) - bearing(s[i - 1], s[i]) + 540) % 360) - 180);
    if (turn < 150) continue;
    let k = 1;
    while (i - k >= 0 && i + k < s.length && haversine(s[i - k], s[i + k]) <= tol) k++;
    worst = Math.max(worst, (k - 1) * step + step / 2);
    i += k - 1;
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
  if (kept.length && kept.length < MAX_ROUTES && points.length === 2 && kept[0].distanceM <= PROBE_LIMIT_M) {
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
