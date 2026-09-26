import { describe, expect, it } from "vitest";
import { canPrefetch, isShellAsset, PREFETCH_TILE_CAP, routePageUrl, tileUrlsForLine } from "@/lib/offline";
import { parseSaved, SAVED_MAX, withRoute, type SavedRoute } from "@/lib/saved";
import type { LngLat } from "@/lib/types";

const r = (d: string, title = d): SavedRoute => ({ title, d, savedAt: "2026-09-26T09:00:00.000Z", distance: "7.3 km" });

describe("saved routes", () => {
  it("puts the newest first and removes duplicates by link", () => {
    const list = withRoute([r("a"), r("b"), r("c")], r("b", "B again"));
    expect(list.map((x) => x.d)).toEqual(["b", "a", "c"]);
    expect(list[0].title).toBe("B again");
  });
  it(`keeps at most ${SAVED_MAX}`, () => {
    let list: SavedRoute[] = [];
    for (let i = 0; i < 30; i++) list = withRoute(list, r(`d${i}`));
    expect(list).toHaveLength(SAVED_MAX);
    expect(list[0].d).toBe("d29");
  });
  it("survives bad storage", () => {
    expect(parseSaved(null)).toEqual([]);
    expect(parseSaved("not json")).toEqual([]);
    expect(parseSaved('{"a":1}')).toEqual([]);
    expect(parseSaved(JSON.stringify([r("a"), { d: 5 }, null, "x"]))).toEqual([r("a")]);
  });
});

describe("offline helpers", () => {
  it("prefetches on Wi-Fi or when Data Saver is off", () => {
    expect(canPrefetch(undefined)).toBe(true);
    expect(canPrefetch({ saveData: false, type: "cellular" })).toBe(true);
    expect(canPrefetch({ saveData: true, type: "cellular" })).toBe(false);
    expect(canPrefetch({ saveData: true, type: "wifi" })).toBe(true);
  });
  it("lists tiles from zoom 12 to 14, the tile server maximum, and caps them", () => {
    const line: LngLat[] = [[36.8065, -1.2633], [36.7518, -1.2681]];
    const urls = tileUrlsForLine(line, "https://tiles.openfreemap.org/planet/v/{z}/{x}/{y}.pbf");
    expect(urls.length).toBeGreaterThan(10);
    expect(urls.length).toBeLessThanOrEqual(PREFETCH_TILE_CAP);
    expect(urls[0]).toMatch(/\/12\/\d+\/\d+\.pbf$/);
    expect(urls.some((u) => /\/14\/\d+\/\d+\.pbf$/.test(u))).toBe(true);
    expect(urls.some((u) => /\/1[56]\/\d+\/\d+\.pbf$/.test(u))).toBe(false);
    const far: LngLat[] = [[36.8, -1.28], [37.9, -0.4]];
    expect(tileUrlsForLine(far, "t/{z}/{x}/{y}")).toHaveLength(PREFETCH_TILE_CAP);
  });
  it("caches only static shell assets, never router data requests", () => {
    const o = "https://docent.example";
    expect(isShellAsset(`${o}/_next/static/chunks/a.js`, o)).toBe(true);
    expect(isShellAsset(`${o}/maplibre/maplibre-gl-worker.mjs?v=6.11.2`, o)).toBe(true);
    expect(isShellAsset("https://tiles.openfreemap.org/styles/dark", o)).toBe(true);
    expect(isShellAsset(`${o}/r?d=abc&_rsc=1x2y`, o)).toBe(false);
    expect(isShellAsset(`${o}/?_rsc=1x2y`, o)).toBe(false);
    expect(isShellAsset(`${o}/api/search?q=x`, o)).toBe(false);
    expect(isShellAsset("https://evil.example/_next/static/a.js", o)).toBe(false);
  });
  it("builds the page URL the service worker stores", () => {
    expect(routePageUrl("abc", "https://docent.example")).toBe("https://docent.example/r?d=abc");
  });
});
