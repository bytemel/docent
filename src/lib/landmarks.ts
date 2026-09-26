import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import { cumulative, haversine, nearestOnLine, routeCoords } from "./geo";
import { TILEJSON_URL } from "./map";
import { detectTurns, type Turn } from "./steps";
import { MAX_TILES, TILE_ZOOM, lngLatToTile, tileToLngLat, tilesForRoute } from "./tiles";

export { MAX_TILES, TILE_ZOOM, lngLatToTile, tileToLngLat, tilesForRoute };
import type { Landmark, LandmarkKind, LngLat, Segment } from "./types";

export interface FindLandmarksOptions {
  bufferM?: number;
  max?: number;
  signal?: AbortSignal;
}

export interface PoiCandidate {
  id: string;
  label: string;
  kind: LandmarkKind;
  weak: boolean;
  lng: number;
  lat: number;
}

const SPACING_M = 120;
const TURN_BONUS_M = 60;

export const KIND_ORDER: LandmarkKind[] = [
  "fuel",
  "worship",
  "school",
  "hospital",
  "bus",
  "bank",
  "pharmacy",
  "shop",
  "food",
  "other",
];

const CLASS_KIND = new Map<string, LandmarkKind>(Object.entries({
  fuel: "fuel",
  school: "school",
  college: "school",
  university: "school",
  kindergarten: "school",
  place_of_worship: "worship",
  hospital: "hospital",
  clinic: "hospital",
  doctors: "hospital",
  dentist: "hospital",
  pharmacy: "pharmacy",
  chemist: "pharmacy",
  bank: "bank",
  bus: "bus",
  bus_stop: "bus",
  bus_station: "bus",
  grocery: "shop",
  supermarket: "shop",
  marketplace: "shop",
  mall: "shop",
  shop: "shop",
  clothing_store: "shop",
  bakery: "shop",
  butcher: "shop",
  hardware: "shop",
  furniture: "shop",
  mobile_phone: "shop",
  restaurant: "food",
  fast_food: "food",
  cafe: "food",
  ice_cream: "food",
}) as [string, LandmarkKind][]);

const IGNORE = new Set([
  "waste_basket",
  "drinking_water",
  "toilets",
  "bench",
  "vending",
  "gate",
  "lift_gate",
  "information",
  "parking",
  "bicycle_parking",
  "atm_parking",
  "charging_station",
  "entrance",
]);

export function classifyPoi(cls: unknown, subclass: unknown): { kind: LandmarkKind; weak: boolean } | null {
  const c = typeof cls === "string" ? cls : "";
  const s = typeof subclass === "string" ? subclass : "";
  if (IGNORE.has(c) || IGNORE.has(s)) return null;
  if (c === "atm" || s === "atm") return { kind: "bank", weak: true };
  const kind = CLASS_KIND.get(s) ?? CLASS_KIND.get(c);
  return { kind: kind ?? "other", weak: false };
}

function hashId(label: string, lng: number, lat: number): string {
  const s = `${label}|${lng.toFixed(4)}|${lat.toFixed(4)}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `poi-${(h >>> 0).toString(36)}`;
}

export function poiName(props: Record<string, unknown>): string {
  for (const k of ["name:en", "name_en", "name"]) {
    const v = props[k];
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 80);
  }
  return "";
}

const GENERIC_NAMES = new Set([
  "school",
  "church",
  "mosque",
  "temple",
  "hospital",
  "clinic",
  "pharmacy",
  "chemist",
  "bank",
  "atm",
  "fuel",
  "petrol station",
  "shop",
  "supermarket",
  "market",
  "bus stop",
  "bus station",
  "stage",
  "restaurant",
  "cafe",
]);

const KIND_NOUN: Record<LandmarkKind, string> = {
  fuel: "petrol station",
  school: "school",
  worship: "place of worship",
  hospital: "hospital",
  pharmacy: "pharmacy",
  bank: "bank",
  bus: "bus stop",
  shop: "shop",
  food: "place to eat",
  other: "place",
  host: "place",
};

export function namePoi(label: string, kind: LandmarkKind): { label: string; generic: boolean } {
  const key = label.trim().toLowerCase();
  if (!GENERIC_NAMES.has(key)) return { label, generic: false };
  const noun = KIND_NOUN[kind];
  return { label: noun === key ? label : `${label} (${noun})`, generic: true };
}

export function decodePoiTile(buf: ArrayBuffer | Uint8Array, x: number, y: number, z = TILE_ZOOM): PoiCandidate[] {
  const tile = new VectorTile(new PbfReader(buf instanceof Uint8Array ? buf : new Uint8Array(buf)));
  const layer = tile.layers.poi;
  if (!layer) return [];
  const out: PoiCandidate[] = [];
  for (let i = 0; i < layer.length; i++) {
    const f = layer.feature(i);
    const props = f.properties as Record<string, unknown>;
    const name = poiName(props);
    if (!name) continue;
    const cls = classifyPoi(props.class, props.subclass);
    if (!cls) continue;
    const { label, generic } = namePoi(name, cls.kind);
    const pt = f.loadGeometry()[0]?.[0];
    if (!pt) continue;
    const [lng, lat] = tileToLngLat(x + pt.x / layer.extent, y + pt.y / layer.extent, z);
    const id = f.id !== undefined ? `osm-${f.id}` : hashId(label, lng, lat);
    out.push({ id, label, kind: cls.kind, weak: cls.weak || generic, lng, lat });
  }
  return out;
}

const SAME_NAME_M = 500;

function sameNameKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function rankLandmarks(
  candidates: PoiCandidate[],
  coords: LngLat[],
  turns: Pick<Turn, "pos">[],
  opts: { bufferM?: number; max?: number } = {},
): Landmark[] {
  const bufferM = opts.bufferM ?? 60;
  const max = opts.max ?? 14;
  if (coords.length < 2 || max <= 0) return [];
  const cum = cumulative(coords);
  const seen = new Set<string>();
  const ranked: { c: PoiCandidate; atM: number; score: number }[] = [];
  for (const c of candidates) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    const p: LngLat = [c.lng, c.lat];
    const { d, atM } = nearestOnLine(p, coords, cum);
    if (d > bufferM) continue;
    const kindIndex = KIND_ORDER.indexOf(c.kind);
    const base = c.weak ? KIND_ORDER.length : kindIndex < 0 ? KIND_ORDER.length - 1 : kindIndex;
    const nearTurn = turns.some((t) => haversine(t.pos, p) <= TURN_BONUS_M);
    ranked.push({ c, atM, score: base - (nearTurn ? 3 : 0) + d / 1000 });
  }
  ranked.sort((a, b) => a.score - b.score);
  const picked: typeof ranked = [];
  for (const r of ranked) {
    if (picked.length >= max) break;
    if (picked.some((p) => Math.abs(p.atM - r.atM) < SPACING_M)) continue;
    const name = sameNameKey(r.c.label);
    if (picked.some((p) => sameNameKey(p.c.label) === name && haversine([p.c.lng, p.c.lat], [r.c.lng, r.c.lat]) < SAME_NAME_M))
      continue;
    picked.push(r);
  }
  return picked
    .sort((a, b) => a.atM - b.atM)
    .map(({ c }) => ({ id: c.id, lng: c.lng, lat: c.lat, label: c.label, kind: c.kind, source: "map" as const }));
}

let templatePromise: Promise<string> | null = null;

function tileTemplate(): Promise<string> {
  if (!templatePromise) {
    templatePromise = fetch(TILEJSON_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`TileJSON ${r.status}`);
        return r.json() as Promise<{ tiles?: unknown }>;
      })
      .then((j) => {
        const t = Array.isArray(j.tiles) ? j.tiles[0] : null;
        if (typeof t !== "string" || !t.startsWith("https://") || !t.includes("{z}")) throw new Error("No tiles URL");
        return t;
      })
      .catch((e) => {
        templatePromise = null;
        throw e;
      });
  }
  return templatePromise;
}

export async function findLandmarks(segments: Segment[], opts: FindLandmarksOptions = {}): Promise<Landmark[]> {
  const { bufferM = 60, max = 14, signal } = opts;
  const coords = routeCoords(segments);
  if (coords.length < 2) return [];
  const template = await tileTemplate();
  signal?.throwIfAborted();
  const tiles = tilesForRoute(coords, bufferM);
  const results = await Promise.allSettled(
    tiles.map(async ([x, y]) => {
      const url = template.replace("{z}", String(TILE_ZOOM)).replace("{x}", String(x)).replace("{y}", String(y));
      const res = await fetch(url, { signal });
      if (!res.ok) return [];
      return decodePoiTile(await res.arrayBuffer(), x, y);
    }),
  );
  signal?.throwIfAborted();
  const candidates = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  return rankLandmarks(candidates, coords, detectTurns(segments), { bufferM, max });
}
