import { describe, expect, it } from "vitest";
import { stepAtMeters, stepMeters } from "@/components/player/track";
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
    { id: "b", kind: "turn", text: "Broken", atM: Number.NaN },
    { id: "e", kind: "arrive", text: "End", atM: 1113 },
  ],
  arrival: { note: "" },
  walker: "neutral",
  createdAt: "2026-09-26T00:00:00Z",
};

describe("route progress for live location", () => {
  const tl = buildTimeline(doc);
  const m = stepMeters(tl, doc.steps);

  it("picks the step for a distance along the route", () => {
    expect(stepAtMeters(m, 10)).toBe(0);
    expect(stepAtMeters(m, 560)).toBe(1);
    expect(stepAtMeters(m, tl.totalM)).toBe(3);
  });

  it("never lands on a step with a broken distance", () => {
    expect(m[2]).toBe(Infinity);
    expect(stepAtMeters(m, 900)).toBe(1);
  });
});
