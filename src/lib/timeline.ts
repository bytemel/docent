import { bearing as bearingOf, haversine } from "./geo";
import { estimateSeconds } from "./modes";
import type { LngLat, Mode, RouteDoc, Step } from "./types";

export const MIN_TOTAL_S = 20;
export const MAX_TOTAL_S = 60;
export const COMPRESSION = 30;
export const MIN_LEG_S = 3;
export const TRANSFER_S = 0.8;
export const EASE_S = 1.2;

export type Phase = "move" | "transfer";

export interface TimelinePiece {
  kind: Phase;
  u0: number;
  u1: number;
  m0: number;
  m1: number;
  segmentIndex: number;
  mode: Mode;
  fromMode: Mode;
}

export interface Timeline {
  coords: LngLat[];
  cum: number[];
  bearings: number[];
  totalM: number;
  totalS: number;
  realS: number;
  legStartM: number[];
  legEndM: number[];
  legModes: Mode[];
  legSeconds: number[];
  pieces: TimelinePiece[];
  transfers: { t0: number; t1: number }[];
  ease: number;
  k: number;
}

export interface TimelineSample {
  pos: LngLat;
  bearing: number;
  atM: number;
  segmentIndex: number;
  mode: Mode;
  fromMode: Mode;
  phase: Phase;
  progress: number;
}

function legGeometry(seg: RouteDoc["segments"][number]): LngLat[] {
  if (seg.geometry && seg.geometry.length >= 2) return seg.geometry;
  return [
    [seg.from.lng, seg.from.lat],
    [seg.to.lng, seg.to.lat],
  ];
}

function allocate(weights: number[], budget: number, min: number): number[] {
  const n = weights.length;
  const out = new Array<number>(n).fill(0);
  const active: number[] = [];
  for (let i = 0; i < n; i++) if (weights[i] >= 0) active.push(i);
  if (active.length === 0) return out;
  if (budget <= min * active.length) {
    for (const i of active) out[i] = min;
    return out;
  }
  const fixed = new Set<number>();
  for (;;) {
    const free = active.filter((i) => !fixed.has(i));
    const left = budget - min * fixed.size;
    let wsum = 0;
    for (const i of free) wsum += weights[i];
    let changed = false;
    for (const i of free) {
      const share = wsum > 0 ? (left * weights[i]) / wsum : left / free.length;
      if (share < min) {
        fixed.add(i);
        changed = true;
      }
    }
    if (!changed) {
      for (const i of free) out[i] = wsum > 0 ? (left * weights[i]) / wsum : left / free.length;
      for (const i of fixed) out[i] = min;
      return out;
    }
  }
}

export function buildTimeline(doc: RouteDoc, opts: { targetSeconds?: number } = {}): Timeline {
  const coords: LngLat[] = [];
  const legStartIdx: number[] = [];
  const legModes: Mode[] = [];
  for (const seg of doc.segments) {
    const g = legGeometry(seg);
    let start = coords.length;
    for (let j = 0; j < g.length; j++) {
      const c = g[j];
      const last = coords[coords.length - 1];
      if (last && last[0] === c[0] && last[1] === c[1]) {
        if (j === 0) start = coords.length - 1;
        continue;
      }
      coords.push([c[0], c[1]]);
    }
    legStartIdx.push(start);
    legModes.push(seg.mode);
  }
  const cum: number[] = coords.length ? [0] : [];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + haversine(coords[i - 1], coords[i]));
  const bearings: number[] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const d = cum[i + 1] - cum[i];
    bearings.push(d > 0 ? bearingOf(coords[i], coords[i + 1]) : i > 0 ? bearings[i - 1] : 0);
  }
  if (coords.length === 1) bearings.push(0);
  const totalM = cum[cum.length - 1] ?? 0;
  const n = doc.segments.length;
  const legStartM = legStartIdx.map((idx) => cum[Math.max(0, Math.min(idx, cum.length - 1))] ?? 0);
  const legEndM = legStartM.map((_, i) => (i + 1 < n ? legStartM[i + 1] : totalM));

  const realLeg = doc.segments.map((s, i) => {
    if (s.durationS > 0) return s.durationS;
    const len = s.distanceM > 0 ? s.distanceM : legEndM[i] - legStartM[i];
    return estimateSeconds(s.mode, len);
  });
  let realS = 0;
  for (const r of realLeg) realS += r;

  let transferCount = 0;
  for (let i = 1; i < n; i++) if (legModes[i] !== legModes[i - 1]) transferCount++;
  const transferTotal = transferCount * TRANSFER_S;

  const target =
    opts.targetSeconds && opts.targetSeconds > 0
      ? opts.targetSeconds
      : Math.min(MAX_TOTAL_S, Math.max(MIN_TOTAL_S, realS / COMPRESSION));
  const weights = realLeg.map((r, i) => (legEndM[i] - legStartM[i] > 0 ? Math.max(r, 0.001) : -1));
  const legSeconds = allocate(weights, Math.max(0, target - transferTotal), MIN_LEG_S);

  const pieces: TimelinePiece[] = [];
  let u = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0 && legModes[i] !== legModes[i - 1]) {
      pieces.push({
        kind: "transfer",
        u0: u,
        u1: u + TRANSFER_S,
        m0: legStartM[i],
        m1: legStartM[i],
        segmentIndex: i,
        mode: legModes[i],
        fromMode: legModes[i - 1],
      });
      u += TRANSFER_S;
    }
    if (legSeconds[i] > 0) {
      pieces.push({
        kind: "move",
        u0: u,
        u1: u + legSeconds[i],
        m0: legStartM[i],
        m1: legEndM[i],
        segmentIndex: i,
        mode: legModes[i],
        fromMode: legModes[i],
      });
      u += legSeconds[i];
    }
  }
  const totalS = u;
  const ease = Math.min(EASE_S, totalS / 4);
  const k = totalS > ease ? totalS / (totalS - ease) : 1;
  const tl: Timeline = {
    coords,
    cum,
    bearings,
    totalM,
    totalS,
    realS,
    legStartM,
    legEndM,
    legModes,
    legSeconds,
    pieces,
    transfers: [],
    ease,
    k,
  };
  tl.transfers = pieces
    .filter((p) => p.kind === "transfer")
    .map((p) => ({ t0: unwarp(tl, p.u0), t1: unwarp(tl, p.u1) }));
  return tl;
}

export function warp(tl: Timeline, t: number): number {
  const T = tl.totalS;
  const r = tl.ease;
  if (t <= 0) return 0;
  if (t >= T) return T;
  if (r <= 0) return t;
  if (t < r) return (tl.k * t * t) / (2 * r);
  if (t <= T - r) return tl.k * (t - r / 2);
  const d = T - t;
  return tl.k * (T - r - (d * d) / (2 * r));
}

export function unwarp(tl: Timeline, u: number): number {
  const T = tl.totalS;
  const r = tl.ease;
  if (u <= 0) return 0;
  if (u >= T) return T;
  if (r <= 0) return u;
  const uu = u / tl.k;
  if (uu < r / 2) return Math.sqrt(2 * r * uu);
  if (uu <= T - (3 * r) / 2) return uu + r / 2;
  return T - Math.sqrt(Math.max(0, 2 * r * (T - r - uu)));
}

function indexAt(tl: Timeline, m: number): number {
  const cum = tl.cum;
  let lo = 0;
  let hi = cum.length - 1;
  if (hi <= 0) return 0;
  if (m >= cum[hi]) return hi - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= m) lo = mid;
    else hi = mid;
  }
  return lo;
}

export function lngLatAt(tl: Timeline, meters: number, out: LngLat): LngLat {
  const { coords, cum } = tl;
  if (coords.length === 0) {
    out[0] = 0;
    out[1] = 0;
    return out;
  }
  if (coords.length === 1) {
    out[0] = coords[0][0];
    out[1] = coords[0][1];
    return out;
  }
  const m = Math.max(0, Math.min(tl.totalM, meters));
  const i = indexAt(tl, m);
  const a = coords[i];
  const b = coords[i + 1];
  const span = cum[i + 1] - cum[i];
  const f = span > 0 ? (m - cum[i]) / span : 0;
  out[0] = a[0] + (b[0] - a[0]) * f;
  out[1] = a[1] + (b[1] - a[1]) * f;
  return out;
}

export function bearingAtM(tl: Timeline, meters: number): number {
  if (tl.bearings.length === 0) return 0;
  const m = Math.max(0, Math.min(tl.totalM, meters));
  return tl.bearings[Math.min(indexAt(tl, m), tl.bearings.length - 1)];
}

const scratchA: LngLat = [0, 0];
const scratchB: LngLat = [0, 0];

export function headingBetween(tl: Timeline, fromM: number, toM: number): number {
  const a = Math.max(0, Math.min(tl.totalM, fromM));
  const b = Math.max(0, Math.min(tl.totalM, toM));
  if (b - a < 1) return bearingAtM(tl, a);
  lngLatAt(tl, a, scratchA);
  lngLatAt(tl, b, scratchB);
  return bearingOf(scratchA, scratchB);
}

export function createSample(): TimelineSample {
  return {
    pos: [0, 0],
    bearing: 0,
    atM: 0,
    segmentIndex: 0,
    mode: "walk",
    fromMode: "walk",
    phase: "move",
    progress: 0,
  };
}

export function sampleTimelineInto(tl: Timeline, tSeconds: number, out: TimelineSample): TimelineSample {
  const pieces = tl.pieces;
  if (pieces.length === 0) {
    lngLatAt(tl, 0, out.pos);
    out.bearing = 0;
    out.atM = 0;
    out.segmentIndex = 0;
    out.mode = tl.legModes[0] ?? "walk";
    out.fromMode = out.mode;
    out.phase = "move";
    out.progress = 1;
    return out;
  }
  const u = warp(tl, tSeconds);
  let p = pieces[pieces.length - 1];
  for (let i = 0; i < pieces.length; i++) {
    if (u < pieces[i].u1) {
      p = pieces[i];
      break;
    }
  }
  const span = p.u1 - p.u0;
  const f = span > 0 ? Math.max(0, Math.min(1, (u - p.u0) / span)) : 1;
  const m = p.kind === "move" ? p.m0 + (p.m1 - p.m0) * f : p.m0;
  lngLatAt(tl, m, out.pos);
  out.bearing = p.kind === "move" ? bearingAtM(tl, m) : bearingAtM(tl, Math.max(0, m - 0.5));
  out.atM = m;
  out.segmentIndex = p.segmentIndex;
  out.mode = p.mode;
  out.fromMode = p.fromMode;
  out.phase = p.kind;
  out.progress = f;
  return out;
}

export function sampleTimeline(tl: Timeline, tSeconds: number): TimelineSample {
  return sampleTimelineInto(tl, tSeconds, createSample());
}

export function timeAtM(tl: Timeline, meters: number): number {
  if (meters <= 0) return 0;
  if (meters >= tl.totalM) return tl.totalS;
  for (const p of tl.pieces) {
    if (p.kind !== "move") continue;
    if (meters >= p.m0 && meters <= p.m1 && p.m1 > p.m0) {
      return unwarp(tl, p.u0 + ((meters - p.m0) / (p.m1 - p.m0)) * (p.u1 - p.u0));
    }
  }
  return tl.totalS;
}

export function stepTimes(tl: Timeline, steps: Step[]): number[] {
  return steps.map((s) => (s.kind === "start" ? 0 : s.kind === "arrive" ? tl.totalS : timeAtM(tl, s.atM)));
}

export function transferAt(tl: Timeline, t: number): { t0: number; t1: number } | null {
  for (const tr of tl.transfers) if (t >= tr.t0 && t < tr.t1) return tr;
  return null;
}
