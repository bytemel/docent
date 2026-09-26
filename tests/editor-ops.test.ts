import { describe, expect, it } from "vitest";
import type { Landmark, LngLat, Step } from "@/lib/types";
import {
  addVia,
  mergeAtStop,
  mergeLandmarks,
  mergeSteps,
  moveWaypoint,
  newSegment,
  segKey,
  setDrawn,
  splitSegment,
  waypoints,
  withRoute,
} from "@/components/editor/ops";

const A = { lng: 36.8, lat: -1.26, label: "Westlands" };
const B = { lng: 36.76, lat: -1.26, label: "Kangemi" };
const line: LngLat[] = [
  [36.8, -1.26],
  [36.79, -1.26],
  [36.78, -1.26],
  [36.77, -1.26],
  [36.76, -1.26],
];

function routed() {
  return withRoute(newSegment(A, B, "walk", "s1"), line);
}

describe("split and merge legs", () => {
  it("splits a leg at the nearest point and chains the legs", () => {
    const res = splitSegment([routed()], 0, [36.785, -1.2605], "matatu", "s2");
    expect(res).not.toBeNull();
    const [a, b] = res!.segments;
    expect(res!.stopIndex).toBe(1);
    expect(a.to).toEqual(b.from);
    expect(a.to.lng).toBeCloseTo(36.785, 5);
    expect(a.to.lat).toBeCloseTo(-1.26, 5);
    expect(a.mode).toBe("walk");
    expect(b.mode).toBe("matatu");
    expect(b.id).toBe("s2");
    expect(a.geometry[a.geometry.length - 1]).toEqual(b.geometry[0]);
    expect(a.distanceM + b.distanceM).toBeCloseTo(routed().distanceM, -1);
  });

  it("keeps vias on the side they belong to", () => {
    const seg = { ...routed(), vias: [[36.795, -1.26], [36.765, -1.26]] as LngLat[] };
    const res = splitSegment([seg], 0, [36.78, -1.26], "boda", "s2")!;
    expect(res.segments[0].vias).toEqual([[36.795, -1.26]]);
    expect(res.segments[1].vias).toEqual([[36.765, -1.26]]);
  });

  it("refuses to split at the very ends", () => {
    expect(splitSegment([routed()], 0, [36.8, -1.26])).toBeNull();
  });

  it("merges two legs back into one when the stop is removed", () => {
    const { segments } = splitSegment([routed()], 0, [36.785, -1.26], "matatu", "s2")!;
    const merged = mergeAtStop(segments, 1);
    expect(merged).toHaveLength(1);
    expect(merged[0].from).toEqual(A);
    expect(merged[0].to).toEqual(B);
    expect(merged[0].mode).toBe("walk");
    expect(merged[0].distanceM).toBeCloseTo(routed().distanceM, -1);
  });

  it("ignores merges at A or B", () => {
    const segs = [routed()];
    expect(mergeAtStop(segs, 0)).toBe(segs);
    expect(mergeAtStop(segs, 1)).toBe(segs);
  });
});

describe("points and keys", () => {
  it("moves a middle stop on both legs", () => {
    const { segments } = splitSegment([routed()], 0, [36.785, -1.26], "matatu", "s2")!;
    const moved = moveWaypoint(segments, 1, [36.7851, -1.259]);
    expect(moved[0].to.lat).toBe(-1.259);
    expect(moved[1].from.lat).toBe(-1.259);
    expect(moved[0].to.label).toBe("");
    expect(waypoints(moved)).toHaveLength(3);
  });

  it("orders vias along the line", () => {
    let segs = [routed()];
    segs = addVia(segs, "s1", [36.77, -1.2601]);
    segs = addVia(segs, "s1", [36.79, -1.2601]);
    expect(segs[0].vias).toEqual([
      [36.79, -1.2601],
      [36.77, -1.2601],
    ]);
  });

  it("changes the route key when the mode profile changes", () => {
    const s = routed();
    expect(segKey(s)).not.toBe(segKey({ ...s, mode: "car" }));
    expect(segKey({ ...s, mode: "car" })).toBe(segKey({ ...s, mode: "matatu" }));
  });

  it("stores a drawn leg from its start to its end", () => {
    const segs = setDrawn([routed()], "s1", [[36.79, -1.261], [36.77, -1.259]]);
    expect(segs[0].drawn).toBe(true);
    expect(segs[0].geometry[0]).toEqual([A.lng, A.lat]);
    expect(segs[0].geometry[segs[0].geometry.length - 1]).toEqual([B.lng, B.lat]);
  });
});

describe("keeping host edits", () => {
  it("keeps edited step text for the same id", () => {
    const old: Step[] = [
      { id: "turn-100", kind: "turn", text: "Turn left at the kiosk", atM: 100, edited: true },
      { id: "turn-200", kind: "turn", text: "Turn right", atM: 200 },
    ];
    const fresh: Step[] = [
      { id: "turn-100", kind: "turn", text: "Turn left", atM: 100 },
      { id: "turn-200", kind: "turn", text: "Turn right onto Waiyaki Way", atM: 200 },
    ];
    const out = mergeSteps(old, fresh);
    expect(out[0]).toMatchObject({ text: "Turn left at the kiosk", edited: true });
    expect(out[1].text).toBe("Turn right onto Waiyaki Way");
  });

  it("keeps host landmarks and hidden flags", () => {
    const old: Landmark[] = [
      { id: "m1", lng: 1, lat: 1, label: "Total", kind: "fuel", source: "map", hidden: true },
      { id: "h1", lng: 2, lat: 2, label: "Blue gate", kind: "host", source: "host" },
    ];
    const fresh: Landmark[] = [
      { id: "m1", lng: 1, lat: 1, label: "Total", kind: "fuel", source: "map" },
      { id: "m2", lng: 3, lat: 3, label: "Sarit", kind: "shop", source: "map" },
    ];
    const out = mergeLandmarks(old, fresh);
    expect(out.map((l) => l.id)).toEqual(["m1", "m2", "h1"]);
    expect(out[0].hidden).toBe(true);
  });
});
