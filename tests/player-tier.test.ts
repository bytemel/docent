import { describe, expect, it } from "vitest";
import { lowerTier, pickTier, shouldDowngrade } from "@/lib/tier";

describe("pickTier", () => {
  it("gives basic when the user asks for reduced motion", () => {
    expect(pickTier({ reducedMotion: true, webgl2: true, deviceMemory: 8, cores: 8 })).toBe("basic");
  });

  it("gives basic without WebGL2", () => {
    expect(pickTier({ reducedMotion: false, webgl2: false, deviceMemory: 8, cores: 8 })).toBe("basic");
  });

  it("gives 2d on low memory or few cores", () => {
    expect(pickTier({ reducedMotion: false, webgl2: true, deviceMemory: 2, cores: 8 })).toBe("2d");
    expect(pickTier({ reducedMotion: false, webgl2: true, deviceMemory: 1, cores: 8 })).toBe("2d");
    expect(pickTier({ reducedMotion: false, webgl2: true, deviceMemory: 8, cores: 4 })).toBe("2d");
  });

  it("gives 3d on a capable device", () => {
    expect(pickTier({ reducedMotion: false, webgl2: true, deviceMemory: 4, cores: 8 })).toBe("3d");
  });

  it("gives 3d when memory and cores are unknown", () => {
    expect(pickTier({ reducedMotion: false, webgl2: true })).toBe("3d");
  });
});

describe("shouldDowngrade", () => {
  it("is true when the average is under 30 fps", () => {
    expect(shouldDowngrade([24, 28, 25, 31])).toBe(true);
  });

  it("is false at 30 fps and above", () => {
    expect(shouldDowngrade([30, 30, 30])).toBe(false);
    expect(shouldDowngrade([60, 58, 59, 61, 60])).toBe(false);
  });

  it("uses the average, not one bad frame", () => {
    expect(shouldDowngrade([60, 12, 60, 60])).toBe(false);
  });

  it("waits for enough samples", () => {
    expect(shouldDowngrade([])).toBe(false);
    expect(shouldDowngrade([10, 10])).toBe(false);
  });

  it("ignores bad values", () => {
    expect(shouldDowngrade([NaN, 60, 60, 60, Infinity])).toBe(false);
  });
});

describe("lowerTier", () => {
  it("drops one tier at a time", () => {
    expect(lowerTier("3d")).toBe("2d");
    expect(lowerTier("2d")).toBe("basic");
    expect(lowerTier("basic")).toBe("basic");
  });
});
