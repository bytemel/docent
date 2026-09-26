import { describe, expect, it } from "vitest";
import { glyphFor, plateText, stepLegMeters, turnGlyph } from "@/components/player/glyph";
import { EXAMPLE_DOC } from "@/lib/example";
import { buildTimeline } from "@/lib/timeline";

describe("turnGlyph", () => {
  it("reads the turn words", () => {
    expect(turnGlyph("After 450 m, turn right.")).toBe("right");
    expect(turnGlyph("Turn left at Total.")).toBe("left");
    expect(turnGlyph("Turn slightly left.")).toBe("slightLeft");
    expect(turnGlyph("Turn slightly right at the church.")).toBe("slightRight");
    expect(turnGlyph("Make a U-turn.")).toBe("uturn");
    expect(turnGlyph("Continue on Waiyaki Way.")).toBe("straight");
  });
});

describe("glyphFor", () => {
  const tl = buildTimeline(EXAMPLE_DOC);
  const glyphs = EXAMPLE_DOC.steps.map((s) => glyphFor(s, tl));

  it("marks the start and the arrival", () => {
    expect(glyphs[0]).toBe("start");
    expect(glyphs[glyphs.length - 1]).toBe("arrive");
  });

  it("shows the vehicle for a mode change", () => {
    const i = EXAMPLE_DOC.steps.findIndex((s) => s.kind === "mode");
    expect(glyphs[i]).toBe("matatu");
  });

  it("shows a signpost for landmarks", () => {
    const i = EXAMPLE_DOC.steps.findIndex((s) => s.kind === "landmark");
    expect(glyphs[i]).toBe("landmark");
  });
});

describe("plateText", () => {
  it("drops the leading distance so the plate can show it large", () => {
    expect(plateText("After 450 m, turn right.")).toBe("Turn right.");
    expect(plateText("Turn left at Total.")).toBe("Turn left at Total.");
  });
});

describe("stepLegMeters", () => {
  it("gives the distance to the next step and none for the arrival", () => {
    const tl = buildTimeline(EXAMPLE_DOC);
    const steps = EXAMPLE_DOC.steps;
    expect(stepLegMeters(steps, 0, tl.totalM)).toBeCloseTo(steps[1].atM, 6);
    expect(stepLegMeters(steps, steps.length - 1, tl.totalM)).toBeNull();
  });
});
