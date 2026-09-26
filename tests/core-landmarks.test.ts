import { PbfWriter } from "pbf";
import { describe, expect, it } from "vitest";
import { haversine } from "@/lib/geo";
import {
  classifyPoi,
  decodePoiTile,
  lngLatToTile,
  MAX_TILES,
  poiName,
  rankLandmarks,
  tileToLngLat,
  tilesForRoute,
  type PoiCandidate,
} from "@/lib/landmarks";
import type { LngLat } from "@/lib/types";

const LAT0 = -1.28;
const LNG0 = 36.8;
const DEG = (6371008.8 * Math.PI) / 180;
const m = (x: number, y: number): LngLat => [LNG0 + x / (DEG * Math.cos((LAT0 * Math.PI) / 180)), LAT0 + y / DEG];

describe("tile math", () => {
  it("finds the z14 tile for central Nairobi", () => {
    expect(lngLatToTile(36.8, -1.265, 14)).toEqual([9866, 8249]);
    expect(lngLatToTile(0, 0, 1)).toEqual([1, 1]);
  });
  it("converts tile corners back to coordinates", () => {
    const [lng, lat] = tileToLngLat(9866, 8249, 14);
    expect(lng).toBeLessThanOrEqual(36.8);
    expect(lat).toBeGreaterThanOrEqual(-1.265);
    const [lng2, lat2] = tileToLngLat(9867, 8250, 14);
    expect(lng2).toBeGreaterThan(36.8);
    expect(lat2).toBeLessThan(-1.265);
  });
  it("covers a short route with a few tiles, including the buffer", () => {
    const tiles = tilesForRoute([[36.8, -1.265], [36.805, -1.266]], 60);
    expect(tiles).toContainEqual([9866, 8249]);
    expect(tiles.length).toBeLessThanOrEqual(4);
    const [west] = tileToLngLat(9866, 8249, 14);
    const nearEdge = tilesForRoute([[west + 0.0002, -1.262], [west + 0.0003, -1.263]], 60);
    expect(nearEdge).toContainEqual([9865, 8249]);
    expect(nearEdge).toContainEqual([9866, 8249]);
  });
  it("samples along the line and caps tiles for a long route", () => {
    const long: LngLat[] = [[36.8, -1.28], [37.3, -0.9], [37.9, -0.4]];
    const tiles = tilesForRoute(long, 60);
    expect(tiles.length).toBeLessThanOrEqual(MAX_TILES);
    expect(tiles.length).toBeGreaterThan(10);
    expect(tiles).toContainEqual(lngLatToTile(36.8, -1.28));
  });
  it("returns nothing for an empty route", () => {
    expect(tilesForRoute([], 60)).toEqual([]);
  });
});

describe("classifyPoi", () => {
  const cases: [string, string, string | null, boolean?][] = [
    ["fuel", "fuel", "fuel"],
    ["fuel", "charging_station", null],
    ["place_of_worship", "christian", "worship"],
    ["place_of_worship", "muslim", "worship"],
    ["school", "school", "school"],
    ["school", "kindergarten", "school"],
    ["college", "university", "school"],
    ["college", "college", "school"],
    ["hospital", "hospital", "hospital"],
    ["hospital", "clinic", "hospital"],
    ["pharmacy", "pharmacy", "pharmacy"],
    ["shop", "chemist", "pharmacy"],
    ["bank", "bank", "bank"],
    ["atm", "atm", "bank", true],
    ["bus", "bus_stop", "bus"],
    ["bus", "bus_station", "bus"],
    ["grocery", "supermarket", "shop"],
    ["grocery", "marketplace", "shop"],
    ["shop", "mall", "shop"],
    ["shop", "electronics", "shop"],
    ["restaurant", "restaurant", "food"],
    ["fast_food", "fast_food", "food"],
    ["cafe", "cafe", "food"],
    ["lodging", "hotel", "other"],
    ["office", "company", "other"],
    ["waste_basket", "waste_basket", null],
    ["toilets", "toilets", null],
    ["gate", "gate", null],
    ["constructor", "__proto__", "other"],
  ];
  it.each(cases)("maps %s / %s", (cls, sub, kind, weak) => {
    const r = classifyPoi(cls, sub);
    if (kind === null) expect(r).toBeNull();
    else expect(r).toEqual({ kind, weak: weak ?? false });
  });
  it("tolerates missing values", () => {
    expect(classifyPoi(undefined, undefined)).toEqual({ kind: "other", weak: false });
    expect(classifyPoi(3, null)).toEqual({ kind: "other", weak: false });
  });
});

describe("poiName", () => {
  it("prefers English names", () => {
    expect(poiName({ name: "Kanisa", "name:en": "Church" })).toBe("Church");
    expect(poiName({ name: "Kanisa", name_en: "Church" })).toBe("Church");
    expect(poiName({ name: " Kanisa " })).toBe("Kanisa");
    expect(poiName({ name: "" })).toBe("");
    expect(poiName({ name: 5 })).toBe("");
  });
});

interface FixtureFeature {
  id?: number;
  x: number;
  y: number;
  props: Record<string, string>;
}

function makeTile(features: FixtureFeature[], extent = 4096): Uint8Array {
  const keys: string[] = [];
  const values: string[] = [];
  const idx = (list: string[], v: string) => {
    let i = list.indexOf(v);
    if (i < 0) i = list.push(v) - 1;
    return i;
  };
  const encoded = features.map((f) => ({
    ...f,
    tags: Object.entries(f.props).flatMap(([k, v]) => [idx(keys, k), idx(values, v)]),
  }));
  const zig = (n: number) => (n << 1) ^ (n >> 31);
  const pbf = new PbfWriter();
  pbf.writeMessage(3, (_: unknown, p: PbfWriter) => {
    p.writeVarintField(15, 2);
    p.writeStringField(1, "poi");
    for (const f of encoded) {
      p.writeMessage(2, (_2: unknown, q: PbfWriter) => {
        if (f.id !== undefined) q.writeVarintField(1, f.id);
        q.writePackedVarint(2, f.tags);
        q.writeVarintField(3, 1);
        q.writePackedVarint(4, [9, zig(f.x), zig(f.y)]);
      }, null);
    }
    for (const k of keys) p.writeStringField(3, k);
    for (const v of values) p.writeMessage(4, (_3: unknown, q: PbfWriter) => q.writeStringField(1, v), null);
    p.writeVarintField(5, extent);
  }, null);
  return pbf.finish();
}

describe("decodePoiTile", () => {
  it("reads named features, maps classes and places them in the tile", () => {
    const buf = makeTile([
      { id: 53394003821, x: 2048, y: 2048, props: { class: "fuel", subclass: "fuel", name: "Total", name_en: "Total" } },
      { id: 2, x: 0, y: 0, props: { class: "place_of_worship", subclass: "christian", name: "Kanisa", "name:en": "PCEA Church" } },
      { id: 3, x: 100, y: 100, props: { class: "school", subclass: "school" } },
      { id: 4, x: 100, y: 100, props: { class: "waste_basket", subclass: "waste_basket", name: "Bin" } },
      { x: 4095, y: 4095, props: { class: "cafe", subclass: "cafe", name: "Java House" } },
    ]);
    const out = decodePoiTile(buf, 9866, 8249, 14);
    expect(out.map((c) => [c.label, c.kind])).toEqual([
      ["Total", "fuel"],
      ["PCEA Church", "worship"],
      ["Java House", "food"],
    ]);
    expect(out[0].id).toBe("osm-53394003821");
    const centre = tileToLngLat(9866.5, 8249.5, 14);
    expect(haversine([out[0].lng, out[0].lat], centre)).toBeLessThan(1);
    const corner = tileToLngLat(9866, 8249, 14);
    expect(haversine([out[1].lng, out[1].lat], corner)).toBeLessThan(1);
    expect(out[2].id).toMatch(/^poi-[0-9a-z]+$/);
    expect(decodePoiTile(buf, 9866, 8249, 14)[2].id).toBe(out[2].id);
  });
  it("returns nothing when there is no poi layer", () => {
    expect(decodePoiTile(new PbfWriter().finish(), 0, 0, 14)).toEqual([]);
  });
});

describe("rankLandmarks", () => {
  const line = [m(0, 0), m(0, 1000)];
  const c = (id: string, x: number, y: number, kind: PoiCandidate["kind"], weak = false): PoiCandidate => {
    const [lng, lat] = m(x, y);
    return { id, label: id, kind, weak, lng, lat };
  };

  it("drops features outside the buffer", () => {
    const out = rankLandmarks([c("near", 30, 100, "shop"), c("far", 100, 300, "fuel")], line, [], { bufferM: 60 });
    expect(out.map((l) => l.id)).toEqual(["near"]);
    expect(out[0].source).toBe("map");
  });
  it("keeps one per 120 m, preferring the better kind", () => {
    const out = rankLandmarks([c("cafe", 10, 100, "food"), c("fuel", -10, 150, "fuel"), c("church", 10, 400, "worship")], line, []);
    expect(out.map((l) => l.id)).toEqual(["fuel", "church"]);
  });
  it("uses an ATM only when nothing else is near", () => {
    const out = rankLandmarks([c("atm1", 5, 100, "bank", true), c("shop", 5, 160, "shop"), c("atm2", 5, 600, "bank", true)], line, []);
    expect(out.map((l) => l.id)).toEqual(["shop", "atm2"]);
  });
  it("gives a bonus to features near a turn", () => {
    const turn = { pos: m(0, 500) };
    const out = rankLandmarks([c("tailor", 10, 510, "other"), c("kiosk", 10, 440, "shop")], line, [turn]);
    expect(out.map((l) => l.id)).toEqual(["tailor"]);
    expect(rankLandmarks([c("tailor", 10, 510, "other"), c("kiosk", 10, 440, "shop")], line, []).map((l) => l.id)).toEqual(["kiosk"]);
  });
  it("returns at most max, in route order, without duplicates", () => {
    const many = Array.from({ length: 8 }, (_, i) => c(`s${i}`, 5, 950 - i * 130, "shop"));
    const out = rankLandmarks([...many, many[0]], line, [], { max: 5 });
    expect(out).toHaveLength(5);
    const ys = out.map((l) => l.lat);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    expect(new Set(out.map((l) => l.id)).size).toBe(5);
  });
  it("handles a degenerate route", () => {
    expect(rankLandmarks([c("a", 0, 0, "shop")], [m(0, 0)], [])).toEqual([]);
  });
});
