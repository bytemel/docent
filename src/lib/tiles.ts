import { bbox, cumulative, pointAt } from "./geo";
import type { LngLat } from "./types";

export const TILE_ZOOM = 14;
export const MAX_TILES = 36;

export function lngLatToTile(lng: number, lat: number, z = TILE_ZOOM): [number, number] {
  const n = 2 ** z;
  const clampedLat = Math.max(-85.0511, Math.min(85.0511, lat));
  const r = (clampedLat * Math.PI) / 180;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  return [Math.min(n - 1, Math.max(0, x)), Math.min(n - 1, Math.max(0, y))];
}

export function tileToLngLat(x: number, y: number, z = TILE_ZOOM): LngLat {
  const n = 2 ** z;
  const lng = (x / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  return [lng, lat];
}

function expand(p: LngLat, m: number): [number, number] {
  const dLat = m / 110574;
  const dLng = m / (111320 * Math.max(0.01, Math.cos((p[1] * Math.PI) / 180)));
  return [dLng, dLat];
}

function evenly<T>(items: T[], cap: number): T[] {
  if (items.length <= cap) return items;
  const out: T[] = [];
  for (let i = 0; i < cap; i++) out.push(items[Math.floor((i * items.length) / cap)]);
  return out;
}

export function tilesForRoute(coords: LngLat[], bufferM = 60, z = TILE_ZOOM, cap = MAX_TILES): [number, number][] {
  if (!coords.length) return [];
  const [minX, minY, maxX, maxY] = bbox(coords);
  const [dx, dy] = expand([minX, (minY + maxY) / 2], bufferM);
  const [x0, y0] = lngLatToTile(minX - dx, maxY + dy, z);
  const [x1, y1] = lngLatToTile(maxX + dx, minY - dy, z);
  if ((x1 - x0 + 1) * (y1 - y0 + 1) <= cap) {
    const out: [number, number][] = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push([x, y]);
    return out;
  }
  const cum = cumulative(coords);
  const total = cum[cum.length - 1];
  const seen = new Set<string>();
  const out: [number, number][] = [];
  for (let m = 0; m <= total + 1; m += 150) {
    const p = pointAt(coords, cum, m).pos;
    const [ex, ey] = expand(p, bufferM);
    for (const [ox, oy] of [[0, 0], [ex, 0], [-ex, 0], [0, ey], [0, -ey]]) {
      const t = lngLatToTile(p[0] + ox, p[1] + oy, z);
      const key = `${t[0]}/${t[1]}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(t);
      }
    }
  }
  return evenly(out, cap);
}
