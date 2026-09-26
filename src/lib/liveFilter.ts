import { cumulative, haversine, nearestOnLine, pointAt } from "./geo";
import type { LiveFix } from "./live";
import { MODES } from "./modes";
import type { LngLat, Mode } from "./types";

export const FILTER = {
  maxAccM: 100,
  maxSpeedMps: 60,
  minNoiseMps: 3,
  resetAfterRejects: 3,
  snapMinM: 25,
} as const;

export interface FilterOptions {
  maxAccM?: number;
  maxSpeedMps?: number;
}

export interface SmoothState {
  lng: number;
  lat: number;
  variance: number;
  t: number;
}

export interface LiveFilter {
  push(fix: LiveFix): LiveFix | null;
  reset(): void;
}

export interface Snap {
  pos: LngLat;
  atM: number;
  offRouteM: number;
  snapped: boolean;
}

export interface RouteLeg {
  mode: Mode;
  startM: number;
  endM: number;
}

export interface Progress {
  leftM: number;
  etaS: number;
  leg: number;
}

function validFix(fix: LiveFix): boolean {
  return (
    Number.isFinite(fix.lng) &&
    Number.isFinite(fix.lat) &&
    Number.isFinite(fix.acc) &&
    Number.isFinite(fix.t) &&
    Math.abs(fix.lng) <= 180 &&
    Math.abs(fix.lat) <= 90 &&
    fix.acc >= 0
  );
}

export function isPlausibleFix(fix: LiveFix, prev: LiveFix | null, opts: FilterOptions = {}): boolean {
  if (!validFix(fix) || fix.acc > (opts.maxAccM ?? FILTER.maxAccM)) return false;
  if (!prev) return true;
  if (fix.t <= prev.t) return false;
  const dt = Math.max(1, (fix.t - prev.t) / 1000);
  return haversine([prev.lng, prev.lat], [fix.lng, fix.lat]) / dt <= (opts.maxSpeedMps ?? FILTER.maxSpeedMps);
}

export function smoothFix(state: SmoothState | null, fix: LiveFix): SmoothState {
  const r = Math.max(1, fix.acc) ** 2;
  if (!state) return { lng: fix.lng, lat: fix.lat, variance: r, t: fix.t };
  const dt = Math.max(0, (fix.t - state.t) / 1000);
  const q = Math.max(FILTER.minNoiseMps, fix.speed ?? 0);
  const variance = state.variance + dt * q * q;
  const k = variance / (variance + r);
  return {
    lng: state.lng + k * (fix.lng - state.lng),
    lat: state.lat + k * (fix.lat - state.lat),
    variance: (1 - k) * variance,
    t: fix.t,
  };
}

export function createLiveFilter(opts: FilterOptions = {}): LiveFilter {
  let prev: LiveFix | null = null;
  let state: SmoothState | null = null;
  let rejects = 0;
  return {
    push(fix) {
      if (!validFix(fix) || fix.acc > (opts.maxAccM ?? FILTER.maxAccM)) return null;
      if (prev && fix.t <= prev.t) return null;
      if (!isPlausibleFix(fix, prev, opts)) {
        rejects++;
        if (rejects < FILTER.resetAfterRejects) return null;
        state = null;
      }
      rejects = 0;
      prev = fix;
      state = smoothFix(state, fix);
      return { ...fix, lng: state.lng, lat: state.lat, acc: Math.sqrt(state.variance) };
    },
    reset() {
      prev = null;
      state = null;
      rejects = 0;
    },
  };
}

export function snapToRoute(
  fix: Pick<LiveFix, "lng" | "lat" | "acc">,
  coords: LngLat[],
  cum: number[] = cumulative(coords),
): Snap {
  const raw: LngLat = [fix.lng, fix.lat];
  if (coords.length === 0) return { pos: raw, atM: 0, offRouteM: Infinity, snapped: false };
  const near = nearestOnLine(raw, coords, cum);
  const snapped = near.d <= Math.max(FILTER.snapMinM, fix.acc);
  return { pos: snapped ? pointAt(coords, cum, near.atM).pos : raw, atM: near.atM, offRouteM: near.d, snapped };
}

export function progressAlong(atM: number, legs: RouteLeg[]): Progress {
  if (legs.length === 0) return { leftM: 0, etaS: 0, leg: 0 };
  const total = legs[legs.length - 1].endM;
  const m = Math.max(0, Math.min(total, atM));
  let leg = legs.findIndex((l) => m < l.endM);
  if (leg < 0) leg = legs.length - 1;
  let etaS = 0;
  for (let i = leg; i < legs.length; i++) {
    const from = i === leg ? m : legs[i].startM;
    const meters = Math.max(0, legs[i].endM - from);
    etaS += meters / (MODES[legs[i].mode].speedKmh / 3.6);
  }
  return { leftM: total - m, etaS: Math.round(etaS), leg };
}
