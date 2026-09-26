import type { LngLat } from "./types";

const R = 6371008.8;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function haversine(a: LngLat, b: LngLat): number {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function bearing(a: LngLat, b: LngLat): number {
  const y = Math.sin(toRad(b[0] - a[0])) * Math.cos(toRad(b[1]));
  const x =
    Math.cos(toRad(a[1])) * Math.sin(toRad(b[1])) -
    Math.sin(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.cos(toRad(b[0] - a[0]));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function turnAngle(inBearing: number, outBearing: number): number {
  let d = outBearing - inBearing;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

export function cumulative(coords: LngLat[]): number[] {
  const out = [0];
  for (let i = 1; i < coords.length; i++) out.push(out[i - 1] + haversine(coords[i - 1], coords[i]));
  return out;
}

export function lineLength(coords: LngLat[]): number {
  const c = cumulative(coords);
  return c[c.length - 1] ?? 0;
}

export function pointAt(
  coords: LngLat[],
  cum: number[],
  meters: number,
): { pos: LngLat; bearing: number; index: number } {
  if (coords.length === 0) return { pos: [0, 0], bearing: 0, index: 0 };
  if (coords.length === 1) return { pos: coords[0], bearing: 0, index: 0 };
  const total = cum[cum.length - 1];
  const m = Math.max(0, Math.min(total, meters));
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= m) lo = mid;
    else hi = mid;
  }
  const a = coords[lo];
  const b = coords[hi];
  const span = cum[hi] - cum[lo];
  const t = span > 0 ? (m - cum[lo]) / span : 0;
  return { pos: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], bearing: bearing(a, b), index: lo };
}

function project(p: LngLat, lat0: number): [number, number] {
  return [toRad(p[0]) * R * Math.cos(toRad(lat0)), toRad(p[1]) * R];
}

export function distanceToSegment(p: LngLat, a: LngLat, b: LngLat): { d: number; t: number } {
  const lat0 = p[1];
  const [px, py] = project(p, lat0);
  const [ax, ay] = project(a, lat0);
  const [bx, by] = project(b, lat0);
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return { d: Math.hypot(px - cx, py - cy), t };
}

export function nearestOnLine(
  p: LngLat,
  coords: LngLat[],
  cum = cumulative(coords),
): { d: number; atM: number } {
  let best = { d: Infinity, atM: 0 };
  for (let i = 1; i < coords.length; i++) {
    const { d, t } = distanceToSegment(p, coords[i - 1], coords[i]);
    if (d < best.d) best = { d, atM: cum[i - 1] + t * (cum[i] - cum[i - 1]) };
  }
  if (coords.length === 1) best = { d: haversine(p, coords[0]), atM: 0 };
  return best;
}

export function simplify(coords: LngLat[], toleranceM: number): LngLat[] {
  if (coords.length <= 2) return coords.slice();
  const keep = new Uint8Array(coords.length);
  keep[0] = 1;
  keep[coords.length - 1] = 1;
  const stack: [number, number][] = [[0, coords.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const { d } = distanceToSegment(coords[i], coords[s], coords[e]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx >= 0 && maxD > toleranceM) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return coords.filter((_, i) => keep[i]);
}

export function bbox(coords: LngLat[]): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of coords) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

export function routeCoords(segments: { geometry: LngLat[] }[]): LngLat[] {
  const out: LngLat[] = [];
  for (const s of segments) {
    for (const c of s.geometry) {
      const last = out[out.length - 1];
      if (!last || last[0] !== c[0] || last[1] !== c[1]) out.push(c);
    }
  }
  return out;
}

export function formatDistance(m: number): string {
  const rounded = Math.round(m / 10) * 10;
  if (rounded < 1000) return `${rounded} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

export function formatDuration(s: number): string {
  const min = Math.max(1, Math.round(s / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}
