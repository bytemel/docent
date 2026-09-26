import type { LngLat } from "@/lib/types";
import type { Profile } from "./parse";
import { validLat, validLng } from "./parse";

export interface RouteResult {
  geometry: LngLat[];
  distanceM: number;
}

export interface SearchResult {
  label: string;
  sub: string;
  lng: number;
  lat: number;
}

const ORS_PROFILE: Record<Profile, string> = {
  foot: "foot-walking",
  car: "driving-car",
  bike: "cycling-regular",
};

export function osrmUrl(profile: Profile, points: LngLat[]): string {
  const coords = points.map(([lng, lat]) => `${lng},${lat}`).join(";");
  return `https://routing.openstreetmap.de/routed-${profile}/route/v1/driving/${coords}?overview=full&geometries=geojson`;
}

export function orsRequest(profile: Profile, points: LngLat[], key: string): { url: string; init: RequestInit } {
  return {
    url: `https://api.openrouteservice.org/v2/directions/${ORS_PROFILE[profile]}/geojson`,
    init: {
      method: "POST",
      headers: { Authorization: key, "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: points }),
    },
  };
}

function cleanLine(raw: unknown): LngLat[] | null {
  if (!Array.isArray(raw)) return null;
  const out: LngLat[] = [];
  for (const c of raw) {
    if (!Array.isArray(c) || c.length < 2) return null;
    const lng = Number(c[0]);
    const lat = Number(c[1]);
    if (!validLng(lng) || !validLat(lat)) return null;
    out.push([Math.round(lng * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6]);
  }
  return out.length >= 2 ? out : null;
}

export function parseOsrm(json: unknown): RouteResult | null {
  const j = json as { code?: string; routes?: { geometry?: { coordinates?: unknown }; distance?: unknown }[] };
  if (!j || j.code !== "Ok" || !Array.isArray(j.routes) || !j.routes[0]) return null;
  const geometry = cleanLine(j.routes[0].geometry?.coordinates);
  const distanceM = Number(j.routes[0].distance);
  if (!geometry || !Number.isFinite(distanceM)) return null;
  return { geometry, distanceM: Math.round(distanceM) };
}

export function parseOrs(json: unknown): RouteResult | null {
  const j = json as {
    features?: { geometry?: { coordinates?: unknown }; properties?: { summary?: { distance?: unknown } } }[];
  };
  const f = j?.features?.[0];
  if (!f) return null;
  const geometry = cleanLine(f.geometry?.coordinates);
  const distanceM = Number(f.properties?.summary?.distance ?? 0);
  if (!geometry || !Number.isFinite(distanceM)) return null;
  return { geometry, distanceM: Math.round(distanceM) };
}

interface PhotonProps {
  name?: string;
  street?: string;
  housenumber?: string;
  district?: string;
  locality?: string;
  city?: string;
  county?: string;
  state?: string;
  country?: string;
}

interface PhotonFeature {
  properties?: PhotonProps;
  geometry?: { coordinates?: unknown };
}

function features(json: unknown): PhotonFeature[] {
  const f = (json as { features?: unknown })?.features;
  return Array.isArray(f) ? (f as PhotonFeature[]) : [];
}

function point(f: PhotonFeature): { lng: number; lat: number } | null {
  const c = f.geometry?.coordinates;
  if (!Array.isArray(c) || c.length < 2) return null;
  const lng = Number(c[0]);
  const lat = Number(c[1]);
  if (!validLng(lng) || !validLat(lat)) return null;
  return { lng, lat };
}

function uniq(parts: (string | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const s = p?.trim();
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
  }
  return out;
}

export function parsePhotonSearch(json: unknown): SearchResult[] {
  const out: SearchResult[] = [];
  const seen = new Set<string>();
  for (const f of features(json)) {
    const p = f.properties ?? {};
    const pt = point(f);
    if (!pt) continue;
    const street = p.street ? uniq([p.street, p.housenumber]).join(" ") : undefined;
    const label = (p.name || street || p.district || p.locality || p.city || "").trim();
    if (!label) continue;
    const sub = uniq([p.name ? street : undefined, p.district ?? p.locality, p.city ?? p.county])
      .filter((s) => s.toLowerCase() !== label.toLowerCase())
      .join(", ");
    const key = `${label}|${sub}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, sub, lng: pt.lng, lat: pt.lat });
  }
  return out;
}

export function parsePhotonReverse(json: unknown): { label: string } {
  const p = features(json)[0]?.properties ?? {};
  const label = (p.name || p.street || p.district || p.locality || p.city || "").trim();
  return { label };
}
