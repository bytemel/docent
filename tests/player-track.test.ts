import { describe, expect, it } from "vitest";
import {
  acceptFix,
  createNearest,
  createTrack,
  nearestInto,
  stepAtMeters,
  stepMeters,
  trackAccuracy,
} from "@/components/player/track";
import { buildTimeline } from "@/lib/timeline";
import type { RouteDoc } from "@/lib/types";

const doc: RouteDoc = {
  v: 1,
  title: "t",
  segments: [
    {
      id: "a",
      mode: "walk",
      from: { lng: 36.8, lat: -1.2 },
      to: { lng: 36.81, lat: -1.2 },
      vias: [],
      drawn: false,
      geometry: [
        [36.8, -1.2],
        [36.81, -1.2],
      ],
      distanceM: 1113,
      durationS: 835,
    },
  ],
  landmarks: [],
  steps: [
    { id: "s", kind: "start", text: "Start", atM: 0 },
    { id: "m", kind: "turn", text: "Middle", atM: 556 },
    { id: "e", kind: "arrive", text: "End", atM: 1113 },
  ],
  arrival: { note: "" },
  walker: "neutral",
  createdAt: "2026-09-26T00:00:00Z",
};

describe("acceptFix", () => {
  it("rejects poor accuracy", () => {
    const t = createTrack();
    expect(acceptFix(t, 36.8, -1.2, 150, 0)).toBe("weak");
    expect(t.has).toBe(false);
  });

  it("rejects jumps faster than 60 m/s", () => {
    const t = createTrack();
    expect(acceptFix(t, 36.8, -1.2, 10, 0)).toBe("ok");
    expect(acceptFix(t, 36.81, -1.2, 10, 1000)).toBe("jump");
    expect(t.lng).toBe(36.8);
  });

  it("weights by accuracy", () => {
    const t = createTrack();
    acceptFix(t, 36.8, -1.2, 5, 0);
    acceptFix(t, 36.8001, -1.2, 50, 1000);
    expect(t.lng - 36.8).toBeLessThan(0.00005);
    expect(trackAccuracy(t)).toBeLessThan(50);
  });
});

describe("route progress", () => {
  const tl = buildTimeline(doc);

  it("finds the nearest point on the route", () => {
    const n = nearestInto(tl, 36.805, -1.2005, createNearest());
    expect(n.d).toBeGreaterThan(50);
    expect(n.d).toBeLessThan(60);
    expect(n.lat).toBeCloseTo(-1.2, 9);
    expect(n.atM).toBeGreaterThan(540);
    expect(n.atM).toBeLessThan(570);
  });

  it("picks the step for a distance along the route", () => {
    const m = stepMeters(tl, doc.steps);
    expect(stepAtMeters(m, 10)).toBe(0);
    expect(stepAtMeters(m, 560)).toBe(1);
    expect(stepAtMeters(m, tl.totalM)).toBe(2);
  });
});
