import { describe, expect, it } from "vitest";
import { plainStep, stepIcon } from "@/components/landing/stepIcon";
import { EXAMPLE_DOC } from "@/lib/example";
import { brand, landing, notFound, saved } from "@/strings/common";

function strings(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (typeof v === "function") return [];
  if (Array.isArray(v)) return v.flatMap(strings);
  if (v && typeof v === "object") return Object.values(v).flatMap(strings);
  return [];
}

describe("home copy", () => {
  it("routes the three doors to the right places", () => {
    expect(landing.go.href).toBe("/go");
    expect(landing.share.href).toBe("/new");
    expect(landing.ask.href).toBe("/new?ask=1");
  });
  it("keeps the subtext under 20 words", () => {
    expect(landing.subtext.split(/\s+/).length).toBeLessThan(20);
  });
  it("has no em or en dashes and no emoji", () => {
    for (const s of strings({ brand, landing, notFound, saved })) {
      expect(s).not.toMatch(/[\u2013\u2014]/);
      expect(s).not.toMatch(/\p{Emoji_Presentation}/u);
    }
  });
});

describe("direction plate helpers", () => {
  it("strips the lead-in so the distance can sit on the plate", () => {
    expect(plainStep("After 150 m, turn right.")).toBe("Turn right.");
    expect(plainStep("After 1.2 km, turn left at Total.")).toBe("Turn left at Total.");
    expect(plainStep("Turn left.")).toBe("Turn left.");
  });
  it("picks arrows from the step text", () => {
    const step = (text: string, kind: "turn" | "arrive" = "turn") => ({ id: "x", kind, text, atM: 7000 });
    expect(stepIcon(step("Turn right."), EXAMPLE_DOC).displayName).toMatch(/ArrowBendUpRight/);
    expect(stepIcon(step("Turn slightly left."), EXAMPLE_DOC).displayName).toMatch(/ArrowBendUpLeft/);
    expect(stepIcon(step("Make a U-turn."), EXAMPLE_DOC).displayName).toMatch(/ArrowUUpLeft/);
    expect(stepIcon(step("Arrive.", "arrive"), EXAMPLE_DOC).displayName).toMatch(/FlagCheckered/);
  });
});
