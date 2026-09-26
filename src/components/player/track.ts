import { haversine } from "@/lib/geo";
import type { Timeline } from "@/lib/timeline";
import type { Step } from "@/lib/types";

export const MAX_ACC_M = 100;
export const MAX_SPEED_MS = 60;
export const SNAP_MIN_M = 25;
const DRIFT_M2S = 9;
const STALE_MS = 30000;

export interface Track {
  has: boolean;
  lng: number;
  lat: number;
  variance: number;
  t: number;
  weak: number;
  speed: number;
}

export function createTrack(): Track {
  return { has: false, lng: 0, lat: 0, variance: 0, t: 0, weak: 0, speed: 0 };
}

const scratchA: [number, number] = [0, 0];
const scratchB: [number, number] = [0, 0];

export function acceptFix(st: Track, lng: number, lat: number, acc: number, tMs: number): "ok" | "weak" | "jump" {
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || !(acc <= MAX_ACC_M)) {
    st.weak++;
    return "weak";
  }
  st.weak = 0;
  const a2 = Math.max(1, acc * acc);
  if (!st.has || tMs - st.t > STALE_MS) {
    st.has = true;
    st.lng = lng;
    st.lat = lat;
    st.variance = a2;
    st.t = tMs;
    st.speed = 0;
    return "ok";
  }
  const dt = Math.max(0.5, (tMs - st.t) / 1000);
  scratchA[0] = st.lng;
  scratchA[1] = st.lat;
  scratchB[0] = lng;
  scratchB[1] = lat;
  const d = haversine(scratchA, scratchB);
  const v = d / dt;
  if (v > MAX_SPEED_MS) return "jump";
  const p = st.variance + (DRIFT_M2S + v * v) * dt;
  const k = p / (p + a2);
  st.lng += (lng - st.lng) * k;
  st.lat += (lat - st.lat) * k;
  st.variance = (1 - k) * p;
  st.t = tMs;
  st.speed = v;
  return "ok";
}

export function trackAccuracy(st: Track): number {
  return Math.sqrt(st.variance);
}

export interface Nearest {
  d: number;
  atM: number;
  lng: number;
  lat: number;
}

export function createNearest(): Nearest {
  return { d: Infinity, atM: 0, lng: 0, lat: 0 };
}

const DEG = (Math.PI / 180) * 6371008.8;

export function nearestInto(tl: Timeline, lng: number, lat: number, out: Nearest): Nearest {
  const c = tl.coords;
  out.d = Infinity;
  out.atM = 0;
  out.lng = lng;
  out.lat = lat;
  if (c.length === 0) return out;
  const kx = Math.cos((lat * Math.PI) / 180) * DEG;
  const ky = DEG;
  if (c.length === 1) {
    out.d = Math.hypot((c[0][0] - lng) * kx, (c[0][1] - lat) * ky);
    out.lng = c[0][0];
    out.lat = c[0][1];
    return out;
  }
  for (let i = 1; i < c.length; i++) {
    const ax = (c[i - 1][0] - lng) * kx;
    const ay = (c[i - 1][1] - lat) * ky;
    const bx = (c[i][0] - lng) * kx;
    const by = (c[i][1] - lat) * ky;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const px = ax + t * dx;
    const py = ay + t * dy;
    const d = Math.hypot(px, py);
    if (d < out.d) {
      out.d = d;
      out.atM = tl.cum[i - 1] + t * (tl.cum[i] - tl.cum[i - 1]);
      out.lng = c[i - 1][0] + (c[i][0] - c[i - 1][0]) * t;
      out.lat = c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t;
    }
  }
  return out;
}

export function stepMeters(tl: Timeline, steps: Step[]): number[] {
  return steps.map((s) =>
    s.kind === "start" ? 0 : s.kind === "arrive" ? tl.totalM : Number.isFinite(s.atM) ? s.atM : Infinity,
  );
}

export function stepAtMeters(stepsM: number[], atM: number, aheadM = 15): number {
  let idx = 0;
  for (let i = 0; i < stepsM.length; i++) if (stepsM[i] <= atM + aheadM) idx = i;
  return idx;
}
