import { describe, expect, it } from "vitest";
import {
  ArrowBendUpLeftIcon,
  ArrowBendUpRightIcon,
  ArrowUpRightIcon,
  ArrowUUpLeftIcon,
  FlagCheckeredIcon,
  MapPinIcon,
  NavigationArrowIcon,
  VanIcon,
} from "@phosphor-icons/react";
import { stepGlyph } from "@/components/editor/StepPlates";
import { initialState } from "@/components/editor/init";
import { newSegment, withRoute } from "@/components/editor/ops";
import { STAGES } from "@/components/editor/types";
import type { Step } from "@/lib/types";

const A = { lng: 36.8, lat: -1.26, label: "Westlands" };
const B = { lng: 36.76, lat: -1.26, label: "Kangemi" };
const segs = [withRoute(newSegment(A, B, "matatu", "s1"), [[36.8, -1.26], [36.76, -1.26]])];
const step = (kind: Step["kind"], text: string): Step => ({ id: `${kind}-0`, kind, text, atM: 0 });

describe("direction plate glyphs", () => {
  it("picks an arrow for each kind of step", () => {
    expect(stepGlyph(step("start", "Start at Westlands."), segs)).toBe(NavigationArrowIcon);
    expect(stepGlyph(step("arrive", "Arrive at Kangemi."), segs)).toBe(FlagCheckeredIcon);
    expect(stepGlyph(step("landmark", "Pass Total."), segs)).toBe(MapPinIcon);
    expect(stepGlyph(step("turn", "Turn left at Total."), segs)).toBe(ArrowBendUpLeftIcon);
    expect(stepGlyph(step("turn", "After 200 m, turn right."), segs)).toBe(ArrowBendUpRightIcon);
    expect(stepGlyph(step("turn", "Turn slightly right."), segs)).toBe(ArrowUpRightIcon);
    expect(stepGlyph(step("turn", "Make a U-turn."), segs)).toBe(ArrowUUpLeftIcon);
    expect(stepGlyph(step("mode", "Take a matatu at Westlands."), segs)).toBe(VanIcon);
  });
});

describe("flow entry points", () => {
  it("opens the ask sheet from /new?ask=1", () => {
    expect(initialState("?ask=1", () => null, () => null)).toMatchObject({ ask: true, phase: "setup" });
    expect(initialState("", () => null, () => null).ask).toBe(false);
  });
  it("keeps the four parts in order", () => {
    expect(STAGES).toEqual(["where", "route", "directions", "send"]);
  });
});
