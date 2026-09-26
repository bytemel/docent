import { describe, expect, it } from "vitest";
import { createPose, poseFor } from "@/components/player/transfer";
import { createSample, type TimelineSample } from "@/lib/timeline";
import type { Mode } from "@/lib/types";

function s(phase: "move" | "transfer", fromMode: Mode, mode: Mode, progress: number): TimelineSample {
  return { ...createSample(), phase, fromMode, mode, progress };
}

describe("poseFor", () => {
  it("shows only the walker on a walking leg, moving while playing", () => {
    const p = poseFor(s("move", "walk", "walk", 0.5), true, createPose());
    expect(p.vehicle).toBeNull();
    expect(p.walker).toBe(true);
    expect(p.walkerMoving).toBe(true);
    expect(poseFor(s("move", "walk", "walk", 0.5), false, createPose()).walkerMoving).toBe(false);
  });

  it("shows only the vehicle on a vehicle leg", () => {
    const p = poseFor(s("move", "matatu", "matatu", 0.5), true, createPose());
    expect(p.vehicle).toBe("matatu");
    expect(p.walker).toBe(false);
    expect(p.vehicleOffset).toBe(0);
  });

  it("walks the walker into the vehicle", () => {
    const start = poseFor(s("transfer", "walk", "boda", 0), true, createPose());
    expect(start.walker).toBe(true);
    expect(start.walkerOffset).toBe(0);
    expect(start.vehicle).toBe("boda");
    const end = poseFor(s("transfer", "walk", "boda", 1), true, createPose());
    expect(end.walker).toBe(false);
    expect(end.vehicleOffset).toBeCloseTo(0, 6);
    expect(end.vehicleAlpha).toBe(1);
  });

  it("lets the walker out of the vehicle", () => {
    const start = poseFor(s("transfer", "matatu", "walk", 0), true, createPose());
    expect(start.walker).toBe(false);
    expect(start.vehicle).toBe("matatu");
    const end = poseFor(s("transfer", "matatu", "walk", 1), true, createPose());
    expect(end.walker).toBe(true);
    expect(end.walkerOffset).toBeCloseTo(0, 6);
    expect(end.vehicleAlpha).toBeCloseTo(0, 6);
  });

  it("swaps vehicles halfway between two vehicle legs", () => {
    expect(poseFor(s("transfer", "matatu", "boda", 0.2), true, createPose()).vehicle).toBe("matatu");
    expect(poseFor(s("transfer", "matatu", "boda", 0.8), true, createPose()).vehicle).toBe("boda");
  });
});
