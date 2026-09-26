import { describe, expect, it } from "vitest";
import { defaultOption, describeOptions, optionSeconds, optionTag, tagPoint } from "@/lib/nav";
import type { RouteOption } from "@/lib/routing";
import type { LngLat } from "@/lib/types";

const LAT0 = -1.28;
const LNG0 = 36.8;
const DEG = (6371008.8 * Math.PI) / 180;
const m = (x: number, y: number): LngLat => [LNG0 + x / (DEG * Math.cos((LAT0 * Math.PI) / 180)), LAT0 + y / DEG];

const straight: RouteOption = {
  id: "a",
  geometry: [m(0, 0), m(500, 0), m(1000, 0)],
  distanceM: 1000,
  durationS: 300,
  labels: ["shortest"],
};
const detour: RouteOption = {
  id: "b",
  geometry: [m(0, 0), m(0, 150), m(500, 150), m(1000, 150), m(1000, 0)],
  distanceM: 1300,
  durationS: 200,
  labels: ["fastest"],
};

describe("route options", () => {
  it("times each option at the activity speed", () => {
    expect(optionSeconds(straight, "walk")).toBe(750);
    expect(optionSeconds(straight, "run")).toBe(360);
    expect(optionSeconds(straight, "cycle")).toBe(240);
    expect(optionSeconds(straight, "drive")).toBe(300);
    expect(optionSeconds({ distanceM: 1400, durationS: 0 }, "drive")).toBe(180);
  });

  it("picks the shortest on foot and on a bicycle", () => {
    for (const a of ["walk", "run", "cycle"] as const) expect(defaultOption([detour, straight], a)?.id).toBe("a");
  });

  it("picks the fastest when driving", () => {
    expect(defaultOption([straight, detour], "drive")?.id).toBe("b");
    const noTimes = [{ ...straight, durationS: 0 }, { ...detour, durationS: 0 }];
    expect(defaultOption(noTimes, "drive")?.id).toBe("a");
  });

  it("works out distance differences and tags", () => {
    const views = describeOptions([detour, straight], "walk");
    expect(views.map((v) => v.id)).toEqual(["a", "b"]);
    expect(views[1].deltaM).toBe(300);
    expect(optionTag(views[0])).toBe("Shortest");
    expect(optionTag(views[1])).toBe("+300 m");
    expect(views[1].timeS).toBe(975);
    const drive = describeOptions([straight, detour], "drive");
    expect(drive.find((v) => v.id === "b")?.fastest).toBe(true);
    expect(drive.find((v) => v.id === "a")?.fastest).toBe(false);
  });

  it("handles one option and none", () => {
    expect(defaultOption([straight], "walk")?.id).toBe("a");
    expect(defaultOption([], "walk")).toBeNull();
    expect(describeOptions([], "walk")).toEqual([]);
  });

  it("puts the tag where the option differs from the others", () => {
    const p = tagPoint(detour, [straight]);
    expect(p[1]).toBeCloseTo(m(0, 150)[1], 6);
    const only = tagPoint(straight, []);
    expect(only[0]).toBeCloseTo(m(500, 0)[0], 6);
  });
});
