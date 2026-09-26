import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LngLat } from "@/lib/types";
import { lineLength } from "@/lib/geo";
import {
  backtrackM,
  findAlternatives,
  overlapRatio,
  probeOffsetM,
  probePoints,
  rankRoutes,
  selectRoutes,
  type Candidate,
} from "@/lib/server/alternatives";
import { parseOrsAll, parseOsrmAll } from "@/lib/server/providers";
import { resetRateLimits } from "@/lib/server/rateLimit";

const A: LngLat = [36.8, -1.26];
const B: LngLat = [36.76, -1.26];
const cand = (geometry: LngLat[], durationS?: number): Candidate => ({ geometry, distanceM: lineLength(geometry), durationS });
const main = cand([A, [36.78, -1.26], B]);
const north = cand([A, [36.79, -1.252], [36.77, -1.252], B]);
const south = cand([A, [36.79, -1.268], [36.77, -1.268], B]);
const twin = cand([A, [36.78, -1.26004], B]);
const far = cand([A, [36.78, -1.22], B]);

describe("overlap maths", () => {
  it("measures how much of a line runs along another", () => {
    expect(overlapRatio(main.geometry, main.geometry)).toBe(1);
    expect(overlapRatio(twin.geometry, main.geometry)).toBeGreaterThan(0.95);
    expect(overlapRatio(north.geometry, main.geometry)).toBeLessThan(0.2);
    const half = cand([A, [36.78, -1.26], [36.77, -1.265], B]);
    const r = overlapRatio(half.geometry, main.geometry);
    expect(r).toBeGreaterThan(0.35);
    expect(r).toBeLessThan(0.7);
  });

  it("spots a route that doubles back", () => {
    const spur: LngLat[] = [A, [36.78, -1.26], [36.78, -1.2573], [36.78, -1.26], B];
    expect(backtrackM(spur)).toBeGreaterThan(150);
    expect(backtrackM(main.geometry)).toBe(0);
    expect(backtrackM(north.geometry)).toBeLessThan(150);
  });

  it("offsets probes by a quarter of the trip within limits", () => {
    expect(probeOffsetM(200)).toBe(120);
    expect(probeOffsetM(4000)).toBe(1000);
    expect(probeOffsetM(20000)).toBe(1500);
    const pts = probePoints(main.geometry, A, B);
    expect(pts).toHaveLength(4);
    expect(pts[0][1]).not.toBeCloseTo(pts[1][1], 3);
  });
});

describe("choosing routes", () => {
  it("drops near duplicates and long detours", () => {
    const kept = selectRoutes([main, twin], [far, north, south]);
    expect(kept).toEqual([main, north, south]);
  });

  it("drops a detour that doubles back", () => {
    const spur = cand([A, [36.79, -1.252], [36.785, -1.24], [36.79, -1.252], [36.77, -1.252], B]);
    expect(selectRoutes([main], [spur])).toEqual([main]);
  });

  it("ranks by distance on foot and by time in a car, with labels", () => {
    const slowShort = { ...main, durationS: 900 };
    const fastLong = { ...north, durationS: 600 };
    const foot = rankRoutes([fastLong, slowShort], "foot");
    expect(foot.map((r) => r.labels)).toEqual([["shortest"], ["fastest"]]);
    expect(foot[0].distanceM).toBe(Math.round(main.distanceM));
    const car = rankRoutes([slowShort, fastLong], "car");
    expect(car[0].labels).toEqual(["fastest"]);
    expect(car[0].id).toBe("r0");
    const both = rankRoutes([main], "bike");
    expect(both[0].labels).toEqual(["shortest", "fastest"]);
    expect(both[0].durationS).toBe(Math.round((main.distanceM / 1000 / 14) * 3600));
  });

  it("caps probes at four calls and stops once three routes are found", async () => {
    const probe = vi.fn(async () => null);
    const res = await findAlternatives("foot", [A, B], [main], probe);
    expect(probe).toHaveBeenCalledTimes(4);
    expect(res.probes).toBe(4);
    expect(res.routes).toHaveLength(1);
    const found = [north, south];
    const probe2 = vi.fn(async () => found.shift() ?? null);
    const res2 = await findAlternatives("foot", [A, B], [main], probe2);
    expect(probe2).toHaveBeenCalledTimes(2);
    expect(res2.routes).toHaveLength(3);
  });

  it("does not probe when the trip already has vias", async () => {
    const probe = vi.fn(async () => north);
    await findAlternatives("foot", [A, [36.78, -1.26], B], [main], probe);
    expect(probe).not.toHaveBeenCalled();
  });
});

describe("provider parsing", () => {
  it("reads every OSRM and ORS route", () => {
    expect(
      parseOsrmAll({
        code: "Ok",
        routes: [
          { distance: 100, duration: 80, geometry: { coordinates: [A, B] } },
          { distance: 120, geometry: { coordinates: [A, B] } },
        ],
      }),
    ).toEqual([
      { geometry: [A, B], distanceM: 100, durationS: 80 },
      { geometry: [A, B], distanceM: 120, durationS: undefined },
    ]);
    expect(parseOrsAll({ features: [{ properties: { summary: { distance: 50, duration: 40 } }, geometry: { coordinates: [A, B] } }] })).toEqual([
      { geometry: [A, B], distanceM: 50, durationS: 40 },
    ]);
  });
});

describe("route API with alternatives", () => {
  beforeEach(() => resetRateLimits());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const osrm = (routes: Candidate[]) =>
    Response.json({ code: "Ok", routes: routes.map((r) => ({ distance: r.distanceM, duration: 600, geometry: { coordinates: r.geometry } })) });

  it("returns ranked options and probes for a third", async () => {
    vi.stubEnv("ORS_API_KEY", "");
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(url);
        if (url.includes("alternatives=3")) return osrm([main, north]);
        return osrm([south]);
      }),
    );
    const { GET } = await import("@/app/api/route/route");
    const res = await GET(new Request("http://x/api/route?profile=foot&points=36.8,-1.26;36.76,-1.26&alt=1"));
    const body = (await res.json()) as { routes: { id: string; distanceM: number; labels: string[] }[] };
    expect(res.status).toBe(200);
    expect(body.routes).toHaveLength(3);
    expect(body.routes[0].labels).toContain("shortest");
    expect(body.routes.map((r) => r.distanceM)).toEqual([...body.routes.map((r) => r.distanceM)].sort((a, b) => a - b));
    expect(urls.length).toBeLessThanOrEqual(5);
  });

  it("keeps the single route shape without alt", async () => {
    vi.stubEnv("ORS_API_KEY", "");
    vi.stubGlobal("fetch", vi.fn(async () => osrm([main])));
    const { GET } = await import("@/app/api/route/route");
    const res = await GET(new Request("http://x/api/route?profile=foot&points=36.8,-1.26;36.76,-1.26"));
    const body = (await res.json()) as { geometry: LngLat[]; routes?: unknown };
    expect(body.geometry).toHaveLength(3);
    expect(body.routes).toBeUndefined();
  });
});

describe("editor option stats", async () => {
  const { newSegment, optionStats, withRoute } = await import("@/components/editor/ops");
  it("shows each option with the same distance the leg gets when picked", () => {
    const seg = withRoute(newSegment({ lng: A[0], lat: A[1] }, { lng: B[0], lat: B[1] }, "walk", "s1"), main.geometry);
    const list = [
      { id: "r0", geometry: main.geometry, distanceM: main.distanceM, durationS: 3300, labels: ["shortest"] },
      { id: "r1", geometry: north.geometry, distanceM: north.distanceM, durationS: 3700, labels: [] },
    ];
    const stats = optionStats(seg, list, "r0");
    expect(stats.r0).toEqual({ distanceM: seg.distanceM, durationS: seg.durationS });
    expect(stats.r1.distanceM).toBe(withRoute(seg, north.geometry).distanceM);
    expect(stats.r1.durationS).toBeGreaterThan(stats.r0.durationS);
  });
});
