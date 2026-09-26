import { describe, expect, it } from "vitest";
import { cumulative, lineLength, pointAt } from "@/lib/geo";
import { snapToRoute } from "@/lib/liveFilter";
import { buildNavRoute, navProgress, needsApproach, rejoinAt, snapWindow, trimPart, type NavRoute } from "@/lib/nav";
import { buildSteps } from "@/lib/steps";
import type { LngLat, Mode, Segment } from "@/lib/types";

const LAT0 = -1.28;
const LNG0 = 36.8;
const DEG = (6371008.8 * Math.PI) / 180;
const m = (x: number, y: number): LngLat => [LNG0 + x / (DEG * Math.cos((LAT0 * Math.PI) / 180)), LAT0 + y / DEG];

function line(points: [number, number][], step = 20): LngLat[] {
  const out: LngLat[] = [];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / step));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) out.push(m(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n));
  }
  return out;
}

function seg(id: string, mode: Mode, pts: [number, number][], from?: string, to?: string): Segment {
  const geometry = line(pts);
  const a = geometry[0];
  const b = geometry[geometry.length - 1];
  return {
    id,
    mode,
    from: { lng: a[0], lat: a[1], label: from },
    to: { lng: b[0], lat: b[1], label: to },
    vias: [],
    drawn: false,
    geometry,
    distanceM: lineLength(geometry),
    durationS: 0,
  };
}

function walkRoute(route: NavRoute, offsetM = 0) {
  let prog = 0;
  const trace: { atM: number; arrived: boolean }[] = [];
  for (let d = 0; d <= route.totalM; d += 10) {
    const p = pointAt(route.coords, route.cum, d).pos;
    const q: LngLat = [p[0] + offsetM / (DEG * Math.cos((LAT0 * Math.PI) / 180)), p[1]];
    const snap = snapToRoute({ lng: q[0], lat: q[1], acc: 8 }, route.coords, route.cum, snapWindow(prog, "walk"));
    if (snap.snapped) prog = snap.atM;
    const st = navProgress(route, { atM: snap.atM, offRouteM: snap.offRouteM, acc: 8 }, "walk", 0);
    trace.push({ atM: snap.atM, arrived: st.arrived });
  }
  return trace;
}

describe("start gap", () => {
  it("builds an approach once the start is further than the off route distance", () => {
    expect(needsApproach(m(0, 60), m(0, 0), "walk")).toBe(true);
    expect(needsApproach(m(0, 30), m(0, 0), "walk")).toBe(false);
    expect(needsApproach(m(0, 55), m(0, 0), "drive")).toBe(false);
  });
});

describe("loops and out and back routes", () => {
  it("does not arrive at the start of a loop", () => {
    const segments = [seg("l", "walk", [[0, 0], [300, 0], [300, 300], [0, 300], [0, 2]], undefined, "Home")];
    const route = buildNavRoute([{ segments, steps: buildSteps(segments, []) }]);
    const start = snapToRoute({ lng: m(0, 0)[0], lat: m(0, 0)[1], acc: 8 }, route.coords, route.cum, snapWindow(0, "walk"));
    expect(start.atM).toBeLessThan(5);
    expect(navProgress(route, { atM: start.atM, offRouteM: start.offRouteM }, "walk", 0).arrived).toBe(false);
    const trace = walkRoute(route);
    expect(trace.findIndex((t) => t.arrived)).toBeGreaterThan(trace.length - 4);
  });

  it("follows the return leg of an out and back route", () => {
    const segments = [seg("o", "walk", [[0, 0], [500, 0], [500, 8], [0, 8]], undefined, "Gate")];
    const route = buildNavRoute([{ segments, steps: buildSteps(segments, []) }]);
    const trace = walkRoute(route, 3);
    for (let i = 1; i < trace.length; i++) expect(trace[i].atM).toBeGreaterThanOrEqual(trace[i - 1].atM - 1);
    expect(trace[Math.floor(trace.length * 0.75)].atM).toBeGreaterThan(route.totalM * 0.6);
    expect(trace.slice(0, -3).some((t) => t.arrived)).toBe(false);
    expect(trace[trace.length - 1].arrived).toBe(true);
    const p = m(250, 2);
    const unwindowed = snapToRoute({ lng: p[0], lat: p[1], acc: 8 }, route.coords, route.cum);
    const windowed = snapToRoute({ lng: p[0], lat: p[1], acc: 8 }, route.coords, route.cum, snapWindow(750, "walk"));
    expect(unwindowed.atM).toBeCloseTo(250, -1);
    expect(windowed.atM).toBeCloseTo(758, -1);
  });
});

describe("rejoining a shared route", () => {
  const segments = [
    seg("w1", "walk", [[0, 0], [400, 0]], "Mpaka Road", "Westlands stage"),
    seg("mt", "matatu", [[400, 0], [2400, 0]], "Westlands stage", "Kangemi stage"),
    seg("w2", "walk", [[2400, 0], [2400, 300]], "Kangemi stage", "Blue gate"),
  ];
  const steps = buildSteps(segments, []);

  it("finds the nearest point ahead of progress, not behind it", () => {
    const coords = segments.flatMap((s, i) => (i ? s.geometry.slice(1) : s.geometry));
    const cum = cumulative(coords);
    const behind = rejoinAt(coords, cum, 0, m(100, 50));
    expect(behind.atM).toBeCloseTo(100, -1);
    const ahead = rejoinAt(coords, cum, 900, m(100, 50));
    expect(ahead.atM).toBeCloseTo(900, -1);
  });

  it("keeps the host's route and steps from the cut onwards", () => {
    const rest = trimPart({ segments, steps }, 1000);
    expect(rest.rejoin).toBe(true);
    expect(rest.segments.map((s) => s.mode)).toEqual(["matatu", "walk"]);
    expect(lineLength(rest.segments[0].geometry)).toBeCloseTo(1400, -1);
    expect(rest.steps.every((s) => s.kind !== "start" && s.atM >= 0)).toBe(true);
    expect(rest.steps.find((s) => s.kind === "arrive")?.atM).toBeCloseTo(1700, -1);
    const approach = [seg("ap", "walk", [[1000, 60], [1000, 0]])];
    const route = buildNavRoute([{ segments: approach, steps: buildSteps(approach, []) }, rest], { arrivalNote: "Ring the bell." });
    const join = route.maneuvers.find((x) => x.kind === "join")!;
    expect(join.text).toBe("Rejoin the route");
    expect(join.now).toBe("You are back on the route.");
    expect(route.maneuvers.find((x) => x.kind === "alight")?.text).toBe("Get off at Kangemi stage");
    expect(route.maneuvers[route.maneuvers.length - 1].now).toBe("You have arrived. Ring the bell.");
    expect(route.totalM).toBeCloseTo(60 + 1700, -1);
  });
});
