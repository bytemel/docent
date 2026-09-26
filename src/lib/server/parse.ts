import type { LngLat } from "@/lib/types";

export const MIN_POINTS = 2;
export const MAX_POINTS = 25;

const NUM = /^-?\d{1,3}(\.\d{1,10})?$/;

export function validLng(n: number): boolean {
  return Number.isFinite(n) && n >= -180 && n <= 180;
}

export function validLat(n: number): boolean {
  return Number.isFinite(n) && n >= -90 && n <= 90;
}

export function parseNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = raw.trim();
  if (!NUM.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parsePoints(raw: string): LngLat[] | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 1200) return null;
  const parts = raw.split(";");
  if (parts.length < MIN_POINTS || parts.length > MAX_POINTS) return null;
  const out: LngLat[] = [];
  for (const part of parts) {
    const pair = part.split(",");
    if (pair.length !== 2) return null;
    const lng = parseNumber(pair[0]);
    const lat = parseNumber(pair[1]);
    if (lng === null || lat === null || !validLng(lng) || !validLat(lat)) return null;
    out.push([lng, lat]);
  }
  return out;
}

export function parseLatLng(latRaw: string | null, lngRaw: string | null): { lat: number; lng: number } | null {
  const lat = parseNumber(latRaw);
  const lng = parseNumber(lngRaw);
  if (lat === null || lng === null || !validLat(lat) || !validLng(lng)) return null;
  return { lat, lng };
}

export type Profile = "foot" | "car" | "bike";

export function parseProfile(raw: string | null): Profile | null {
  return raw === "foot" || raw === "car" || raw === "bike" ? raw : null;
}

export function parseQuery(raw: string | null): string | null {
  if (raw == null) return null;
  const q = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (q.length < 2 || q.length > 120) return null;
  return q;
}
