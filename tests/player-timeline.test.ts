import { describe, expect, it } from "vitest";
import {
  buildTimeline,
  MAX_TOTAL_S,
  MIN_LEG_S,
  MIN_TOTAL_S,
  sampleTimeline,
  stepTimes,
  timeAtM,
  TRANSFER_S,
  unwarp,
  warp,
} from "@/lib/timeline";
import { haversine } from "@/lib/geo";
import type { LngLat, Mode, RouteDoc, Segment } from "@/lib/types";

function leg(mode: Mode, from: LngLat, to: LngLat, durationS: number, points = 6): Segment {
  const geometry: LngLat[] = [];
  for (let i = 0; i <= points; i++) {
    const f = i / points;
    geometry.push([from[0] + (to[0] - from[0]) * f, from[1] + (to[1] - from[1]) * f]);
  }
  return {
    id: `${mode}-${from.join()}`,
    mode,
    from: { lng: from[0], lat: from[1] },
    to: { lng: to[0], lat: to[1] },
    vias: [],
    drawn: false,
    geometry,
    distanceM: haversine(from, to),
    durationS,
  };
}

function doc(segments: Segment[]): RouteDoc {
  return {
    v: 1,
    title: "Test",
    segments,
    landmarks: [],
    steps: [],
    arrival: { note: "" },
    walker: "neutral",
    createdAt: "2026-09-26T00:00:00Z",
  };
}

const A: LngLat = [36.8065, -1.2633];
const B: LngLat = [36.803, -1.265];
const C: LngLat = [36.752, -1.268];
const D: LngLat = [36.75, -1.2662];

const multi = doc([leg("walk", A, B, 300), leg("matatu", B, C, 700), leg("walk", C, D, 150)]);

describe("buildTimeline", () => {
  it("clamps the total to 20 s for a short trip", () => {
    const tl = buildTimeline(doc([leg("walk", A, B, 120)]));
    expect(tl.totalS).toBeCloseTo(MIN_TOTAL_S, 5);
  });

  it("clamps the total to 60 s for a very long trip", () => {
    const tl = buildTimeline(doc([leg("car", A, C, 3 * 3600), leg("walk", C, D, 600)]));
    expect(tl.totalS).toBeCloseTo(MAX_TOTAL_S, 5);
  });

  it("uses real seconds divided by 30 in between", () => {
    const tl = buildTimeline(multi);
    const real = 300 + 700 + 150;
    expect(tl.realS).toBe(real);
    expect(tl.totalS).toBeCloseTo(real / 30, 5);
    expect(tl.totalS).toBeGreaterThanOrEqual(MIN_TOTAL_S);
    expect(tl.totalS).toBeLessThanOrEqual(MAX_TOTAL_S);
  });

  it("gives every leg at least 3 s", () => {
    const tl = buildTimeline(doc([leg("walk", A, B, 20), leg("car", B, C, 5000), leg("walk", C, D, 10)]));
    for (const s of tl.legSeconds) expect(s).toBeGreaterThanOrEqual(MIN_LEG_S - 1e-9);
    expect(tl.legSeconds[0]).toBeCloseTo(MIN_LEG_S, 5);
    expect(tl.totalS).toBeCloseTo(MAX_TOTAL_S, 5);
  });

  it("shares time in proportion to real duration", () => {
    const tl = buildTimeline(multi);
    expect(tl.legSeconds[1] / tl.legSeconds[0]).toBeCloseTo(700 / 300, 5);
  });

  it("adds a transfer only where the mode changes", () => {
    const same = buildTimeline(doc([leg("walk", A, B, 400), leg("walk", B, C, 900)]));
    expect(same.transfers).toHaveLength(0);
    const tl = buildTimeline(multi);
    expect(tl.transfers).toHaveLength(2);
    const pieces = tl.pieces.filter((p) => p.kind === "transfer");
    expect(pieces.map((p) => [p.fromMode, p.mode])).toEqual([
      ["walk", "matatu"],
      ["matatu", "walk"],
    ]);
    for (const p of pieces) expect(p.u1 - p.u0).toBeCloseTo(TRANSFER_S, 9);
    const mixed = buildTimeline(doc([leg("boda", A, B, 300), leg("boda", B, C, 900), leg("car", C, D, 60)]));
    expect(mixed.transfers).toHaveLength(1);
  });

  it("never goes over 60 s with many short legs", () => {
    const legs: Segment[] = [];
    for (let i = 0; i < 20; i++) {
      legs.push(leg(i % 2 ? "walk" : "matatu", [36.8 + i * 0.001, -1.2], [36.8 + (i + 1) * 0.001, -1.2], 0));
    }
    const tl = buildTimeline(doc(legs));
    expect(tl.transfers).toHaveLength(19);
    expect(tl.totalS).toBeLessThanOrEqual(MAX_TOTAL_S + 1e-9);
    expect(tl.totalS).toBeGreaterThanOrEqual(MIN_TOTAL_S);
    const s = sampleTimeline(tl, tl.totalS);
    expect(s.atM).toBeCloseTo(tl.totalM, 6);
  });

  it("survives unknown modes and broken coordinates", () => {
    const bad = leg("walk", A, B, 100);
    const d = doc([
      { ...bad, mode: "plane" as Mode },
      { ...leg("car", B, C, 400), geometry: [[NaN, -1.2], ["36.8", "-1.2"] as unknown as LngLat, B, C] },
    ]);
    const tl = buildTimeline(d);
    expect(tl.legModes).toEqual(["walk", "car"]);
    for (let i = 0; i <= 50; i++) {
      const s = sampleTimeline(tl, (tl.totalS * i) / 50);
      expect(Number.isFinite(s.pos[0]) && Number.isFinite(s.pos[1]) && Number.isFinite(s.bearing)).toBe(true);
    }
  });

  it("honours targetSeconds", () => {
    const tl = buildTimeline(multi, { targetSeconds: 30 });
    expect(tl.totalS).toBeCloseTo(30, 5);
  });
});

describe("sampleTimeline", () => {
  const tl = buildTimeline(multi);

  it("starts at A", () => {
    const s = sampleTimeline(tl, 0);
    expect(s.pos[0]).toBeCloseTo(A[0], 9);
    expect(s.pos[1]).toBeCloseTo(A[1], 9);
    expect(s.atM).toBe(0);
    expect(s.mode).toBe("walk");
    expect(s.phase).toBe("move");
  });

  it("ends at B", () => {
    const s = sampleTimeline(tl, tl.totalS);
    expect(s.pos[0]).toBeCloseTo(D[0], 9);
    expect(s.pos[1]).toBeCloseTo(D[1], 9);
    expect(s.atM).toBeCloseTo(tl.totalM, 6);
    const after = sampleTimeline(tl, tl.totalS + 10);
    expect(after.pos).toEqual(s.pos);
  });

  it("moves forward along the route and never back", () => {
    let last = -1;
    const n = 600;
    for (let i = 0; i <= n; i++) {
      const s = sampleTimeline(tl, (tl.totalS * i) / n);
      expect(s.atM).toBeGreaterThanOrEqual(last);
      last = s.atM;
    }
    expect(last).toBeCloseTo(tl.totalM, 6);
  });

  it("stands still during a transfer", () => {
    const tr = tl.transfers[0];
    const a = sampleTimeline(tl, tr.t0 + 0.01);
    const b = sampleTimeline(tl, tr.t1 - 0.01);
    expect(a.phase).toBe("transfer");
    expect(b.phase).toBe("transfer");
    expect(a.atM).toBe(b.atM);
    expect(a.fromMode).toBe("walk");
    expect(a.mode).toBe("matatu");
    expect(b.progress).toBeGreaterThan(a.progress);
  });

  it("eases in and out but keeps a constant speed in the middle", () => {
    const early = warp(tl, 0.1) / 0.1;
    const mid = (warp(tl, 10.1) - warp(tl, 10)) / 0.1;
    const late = (tl.totalS - warp(tl, tl.totalS - 0.1)) / 0.1;
    expect(early).toBeLessThan(mid);
    expect(late).toBeLessThan(mid);
    expect((warp(tl, 12.1) - warp(tl, 12)) / 0.1).toBeCloseTo(mid, 6);
    for (const t of [0, 0.5, 3, 20, tl.totalS - 0.5, tl.totalS]) expect(unwarp(tl, warp(tl, t))).toBeCloseTo(t, 6);
  });

  it("maps distance back to time for step seeking", () => {
    const half = tl.totalM / 2;
    const t = timeAtM(tl, half);
    expect(sampleTimeline(tl, t).atM).toBeCloseTo(half, 3);
    const times = stepTimes(tl, [
      { id: "a", kind: "start", text: "", atM: 0 },
      { id: "b", kind: "arrive", text: "", atM: tl.totalM },
    ]);
    expect(times).toEqual([0, tl.totalS]);
  });

  it("starts a mode change step when the transfer starts", () => {
    const boundary = tl.legStartM[1];
    const [t] = stepTimes(tl, [{ id: "m", kind: "mode", text: "", atM: boundary + 4 }]);
    expect(t).toBeCloseTo(tl.transfers[0].t0, 6);
    const s = sampleTimeline(tl, t + 0.01);
    expect(s.phase).toBe("transfer");
  });
});
