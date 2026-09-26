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

export function osrmUrl(profile: Profile, points: LngLat[], alternatives = false): string {
  const coords = points.map(([lng, lat]) => `${lng},${lat}`).join(";");
  const alt = alternatives && points.length === 2 ? "&alternatives=3" : "";
  return `https://routing.openstreetmap.de/routed-${profile}/route/v1/driving/${coords}?overview=full&geometries=geojson${alt}`;
}

export function orsRequest(
  profile: Profile,
  points: LngLat[],
  key: string,
  alternatives = false,
): { url: string; init: RequestInit } {
  const body: Record<string, unknown> = { coordinates: points, radiuses: points.map(() => -1) };
  if (alternatives && points.length === 2) {
    body.alternative_routes = { target_count: 3, weight_factor: 1.6, share_factor: 0.6 };
  }
  return {
    url: `https://api.openrouteservice.org/v2/directions/${ORS_PROFILE[profile]}/geojson`,
    init: {
      method: "POST",
      headers: { Authorization: key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
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

export interface RouteCandidate {
  geometry: LngLat[];
  distanceM: number;
  durationS?: number;
}

function duration(raw: unknown): number | undefined {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

export function parseOsrmAll(json: unknown): RouteCandidate[] {
  const j = json as { code?: string; routes?: { geometry?: { coordinates?: unknown }; distance?: unknown; duration?: unknown }[] };
  if (!j || j.code !== "Ok" || !Array.isArray(j.routes)) return [];
  const out: RouteCandidate[] = [];
  for (const r of j.routes) {
    const geometry = cleanLine(r?.geometry?.coordinates);
    const distanceM = Number(r?.distance);
    if (!geometry || !Number.isFinite(distanceM)) continue;
    out.push({ geometry, distanceM: Math.round(distanceM), durationS: duration(r.duration) });
  }
  return out;
}

export function parseOrsAll(json: unknown): RouteCandidate[] {
  const j = json as {
    features?: { geometry?: { coordinates?: unknown }; properties?: { summary?: { distance?: unknown; duration?: unknown } } }[];
  };
  if (!Array.isArray(j?.features)) return [];
  const out: RouteCandidate[] = [];
  for (const f of j.features) {
    const geometry = cleanLine(f?.geometry?.coordinates);
    const distanceM = Number(f?.properties?.summary?.distance ?? 0);
    if (!geometry || !Number.isFinite(distanceM)) continue;
    out.push({ geometry, distanceM: Math.round(distanceM), durationS: duration(f.properties?.summary?.duration) });
  }
  return out;
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

export interface RankedResult extends SearchResult {
  cc: string;
}

export function photonRanked(json: unknown): RankedResult[] {
  const feats = features(json);
  const base = parsePhotonSearch(json);
  return base.map((r) => {
    const f = feats.find((x) => {
      const p = point(x);
      return p && p.lng === r.lng && p.lat === r.lat;
    });
    const cc = String((f?.properties as { countrycode?: string } | undefined)?.countrycode ?? "").toLowerCase();
    return { ...r, cc };
  });
}

interface OrsGeoProps {
  name?: string;
  street?: string;
  neighbourhood?: string;
  locality?: string;
  county?: string;
  region?: string;
  country_code?: string;
  country_a?: string;
}

export function orsGeocodeUrl(q: string, bias: { lat: number; lng: number }, key: string, kenyaOnly: boolean): string {
  const p = new URLSearchParams({
    api_key: key,
    text: q,
    "focus.point.lat": bias.lat.toFixed(4),
    "focus.point.lon": bias.lng.toFixed(4),
    size: "6",
  });
  if (kenyaOnly) p.set("boundary.country", "KE");
  return `https://api.openrouteservice.org/geocode/autocomplete?${p.toString()}`;
}

export function parseOrsGeocode(json: unknown): RankedResult[] {
  const out: RankedResult[] = [];
  for (const f of features(json)) {
    const p = (f.properties ?? {}) as OrsGeoProps;
    const pt = point(f);
    const label = (p.name ?? "").trim();
    if (!pt || !label) continue;
    const sub = uniq([p.street, p.neighbourhood, p.locality ?? p.county, p.locality ? undefined : p.region])
      .filter((s) => s.toLowerCase() !== label.toLowerCase())
      .join(", ");
    const cc = (p.country_code ?? (p.country_a === "KEN" ? "ke" : p.country_a ?? "")).toLowerCase();
    out.push({ label, sub, lng: pt.lng, lat: pt.lat, cc });
  }
  return out;
}

export function nominatimUrl(q: string): string {
  const p = new URLSearchParams({ q, format: "jsonv2", limit: "5", countrycodes: "ke", addressdetails: "1" });
  return `https://nominatim.openstreetmap.org/search?${p.toString()}`;
}

interface NominatimRow {
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  address?: Record<string, string | undefined>;
}

export function parseNominatim(json: unknown): RankedResult[] {
  if (!Array.isArray(json)) return [];
  const out: RankedResult[] = [];
  for (const row of json as NominatimRow[]) {
    const lat = Number(row?.lat);
    const lng = Number(row?.lon);
    if (!validLat(lat) || !validLng(lng)) continue;
    const a = row.address ?? {};
    const label = (row.name || row.display_name?.split(",")[0] || "").trim();
    if (!label) continue;
    const sub = uniq([a.road, a.suburb ?? a.neighbourhood, a.city ?? a.town ?? a.county])
      .filter((s) => s.toLowerCase() !== label.toLowerCase())
      .join(", ");
    out.push({ label, sub, lng, lat, cc: (a.country_code ?? "").toLowerCase() });
  }
  return out;
}

function metres(a: RankedResult, b: RankedResult): number {
  const dx = (a.lng - b.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180);
  const dy = (a.lat - b.lat) * 110540;
  return Math.hypot(dx, dy);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function mergeResults(lists: RankedResult[][], max = 8): SearchResult[] {
  const kept: RankedResult[] = [];
  for (const list of lists) {
    for (const r of list) {
      if (kept.some((k) => norm(k.label) === norm(r.label) && metres(k, r) < 150)) continue;
      kept.push(r);
    }
  }
  const ke = kept.filter((r) => r.cc === "ke");
  const rest = kept.filter((r) => r.cc !== "ke");
  return [...ke, ...rest].slice(0, max).map(({ label, sub, lng, lat }) => ({ label, sub, lng, lat }));
}
