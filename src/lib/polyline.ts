import type { LngLat } from "./types";

const FACTOR = 1e5;

function encodeValue(v: number): string {
  let n = v < 0 ? ~(v << 1) : v << 1;
  let out = "";
  while (n >= 0x20) {
    out += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
    n >>>= 5;
  }
  return out + String.fromCharCode(n + 63);
}

export function roundCoord(v: number): number {
  return Math.round(v * FACTOR) / FACTOR;
}

export function encodePolyline(coords: LngLat[]): string {
  let out = "";
  let pLat = 0;
  let pLng = 0;
  for (const [lng, lat] of coords) {
    const iLat = Math.round(lat * FACTOR);
    const iLng = Math.round(lng * FACTOR);
    out += encodeValue(iLat - pLat) + encodeValue(iLng - pLng);
    pLat = iLat;
    pLng = iLng;
  }
  return out;
}

export function decodePolyline(str: string, maxPoints = Infinity): LngLat[] | null {
  if (typeof str !== "string") return null;
  const out: LngLat[] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  const readValue = (): number | null => {
    let result = 0;
    let shift = 0;
    for (;;) {
      if (i >= str.length || shift > 30) return null;
      const b = str.charCodeAt(i++) - 63;
      if (b < 0 || b > 63) return null;
      result |= (b & 0x1f) << shift;
      shift += 5;
      if (b < 0x20) break;
    }
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < str.length) {
    const dLat = readValue();
    const dLng = readValue();
    if (dLat === null || dLng === null) return null;
    lat += dLat;
    lng += dLng;
    out.push([lng / FACTOR, lat / FACTOR]);
    if (out.length > maxPoints) return null;
  }
  return out;
}
