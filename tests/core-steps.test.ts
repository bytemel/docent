import { describe, expect, it } from "vitest";
import { lineLength } from "@/lib/geo";
import { estimateSeconds } from "@/lib/modes";
import { buildSteps, compassWord, detectTurns, turnWords } from "@/lib/steps";
import type { Landmark, LngLat, Mode, Segment } from "@/lib/types";

const LAT0 = -1.28;
const LNG0 = 36.8;
const DEG = (6371008.8 * Math.PI) / 180;
const m = (x: number, y: number): LngLat => [LNG0 + x / (DEG * Math.cos((LAT0 * Math.PI) / 180)), LAT0 + y / DEG];

function path(points: [number, number][], step = 20): LngLat[] {
  const out: LngLat[] = [m(points[0][0], points[0][1])];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 1; k <= n; k++) out.push(m(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n));
  }
  return out;
}

let n = 0;
function seg(mode: Mode, geometry: LngLat[], from?: string, to?: string): Segment {
  const d = lineLength(geometry);
  n++;
  return {
    id: `t${n}`,
    mode,
    from: { lng: geometry[0][0], lat: geometry[0][1], label: from },
    to: { lng: geometry[geometry.length - 1][0], lat: geometry[geometry.length - 1][1], label: to },
    vias: [],
    drawn: false,
    geometry,
    distanceM: d,
    durationS: estimateSeconds(mode, d),
  };
}

function lm(id: string, x: number, y: number, label: string, kind: Landmark["kind"] = "fuel", extra: Partial<Landmark> = {}): Landmark {
  const [lng, lat] = m(x, y);
  return { id, lng, lat, label, kind, source: "map", ...extra };
}

const L_RIGHT = path([[0, 0], [0, 300], [200, 300]]);
const L_LEFT = path([[0, 0], [0, 300], [-200, 300]]);
const STRAIGHT = path([[0, 0], [0, 600]]);

describe("detectTurns", () => {
  it("finds one right turn on an L-shaped route", () => {
    const turns = detectTurns([seg("walk", L_RIGHT)]);
    expect(turns).toHaveLength(1);
    expect(turns[0].angle).toBeGreaterThan(80);
    expect(turns[0].atM).toBeCloseTo(300, -1);
    expect(turns[0].segmentIndex).toBe(0);
  });
  it("finds one left turn with a negative angle", () => {
    const turns = detectTurns([seg("car", L_LEFT)]);
    expect(turns).toHaveLength(1);
    expect(turns[0].angle).toBeLessThan(-80);
  });
  it("finds nothing on a straight route or a gentle bend", () => {
    expect(detectTurns([seg("walk", STRAIGHT)])).toHaveLength(0);
    expect(detectTurns([seg("walk", path([[0, 0], [0, 300], [60, 600]]))])).toHaveLength(0);
  });
  it("skips matatu and boda legs", () => {
    expect(detectTurns([seg("matatu", L_RIGHT)])).toHaveLength(0);
    expect(detectTurns([seg("boda", L_RIGHT)])).toHaveLength(0);
  });
  it("reports atM along the whole route", () => {
    const first = seg("matatu", path([[0, -500], [0, 0]]));
    const turns = detectTurns([first, seg("walk", L_RIGHT)]);
    expect(turns).toHaveLength(1);
    expect(turns[0].atM).toBeCloseTo(800, -1);
    expect(turns[0].segmentIndex).toBe(1);
  });
});

describe("turn words", () => {
  it("maps angles to plain words", () => {
    expect(turnWords(45)).toBe("Turn slightly right");
    expect(turnWords(-45)).toBe("Turn slightly left");
    expect(turnWords(90)).toBe("Turn right");
    expect(turnWords(-120)).toBe("Turn left");
    expect(turnWords(170)).toBe("Make a U-turn");
  });
  it("names compass directions", () => {
    expect(compassWord(0)).toBe("north");
    expect(compassWord(94)).toBe("east");
    expect(compassWord(225)).toBe("southwest");
    expect(compassWord(359)).toBe("north");
  });
});

describe("buildSteps", () => {
  it("starts, turns with a lead-in, and arrives", () => {
    const steps = buildSteps([seg("walk", L_RIGHT, "the church gate", "Amina's shop")], []);
    expect(steps.map((s) => s.kind)).toEqual(["start", "turn", "arrive"]);
    expect(steps[0].text).toBe("Start at the church gate. Walk north.");
    expect(steps[1].text).toBe("After 300 m, turn right.");
    expect(steps[2].text).toBe("Arrive at Amina's shop.");
  });
  it("gives a left turn on a left L", () => {
    const steps = buildSteps([seg("walk", L_LEFT)], []);
    expect(steps.find((s) => s.kind === "turn")?.text).toMatch(/turn left\.$/);
  });
  it("gives no turn steps on a straight route", () => {
    const steps = buildSteps([seg("walk", STRAIGHT)], []);
    expect(steps.filter((s) => s.kind === "turn")).toHaveLength(0);
    expect(steps[0].text).toBe("Start here. Walk north.");
    expect(steps[steps.length - 1].text).toBe("Arrive at your destination.");
  });
  it("uses a landmark near the turn in the turn text", () => {
    const steps = buildSteps([seg("walk", L_RIGHT)], [lm("fuel1", 15, 315, "Total")]);
    const turn = steps.find((s) => s.kind === "turn");
    expect(turn?.text).toBe("After 300 m, turn right at Total petrol station.");
    expect(turn?.landmarkId).toBe("fuel1");
    expect(steps.filter((s) => s.landmarkId === "fuel1")).toHaveLength(1);
  });
  it("walks toward a landmark before the first turn", () => {
    const steps = buildSteps([seg("walk", L_RIGHT, "the gate")], [lm("sch", -20, 200, "Kilimani Primary", "school")]);
    expect(steps[0].text).toBe("Start at the gate. Walk toward Kilimani Primary.");
    expect(steps.find((s) => s.kind === "landmark")?.text).toBe("After 200 m, pass Kilimani Primary on your left.");
  });
  it("says which side a landmark is on", () => {
    const steps = buildSteps([seg("walk", STRAIGHT)], [lm("a", 20, 100, "Mama Njeri kiosk", "shop"), lm("b", -20, 400, "PCEA Church", "worship")]);
    const pass = steps.filter((s) => s.kind === "landmark").map((s) => s.text);
    expect(pass).toEqual(["Pass Mama Njeri kiosk on your right.", "After 300 m, pass PCEA Church on your left."]);
  });
  it("ignores hidden landmarks and ones far from the route", () => {
    const steps = buildSteps(
      [seg("walk", L_RIGHT)],
      [lm("h", 15, 315, "Hidden", "fuel", { hidden: true }), lm("far", 400, 0, "Far away", "fuel")],
    );
    expect(steps.some((s) => s.landmarkId)).toBe(false);
  });
  it("lists no turns for a matatu leg, one ride step and big landmarks", () => {
    const walk1 = seg("walk", path([[0, -200], [0, 0]]), "Home", "Westlands stage");
    const ride = seg("matatu", path([[0, 0], [0, 2000], [2500, 2000]]), "Westlands stage", "Kangemi stage");
    const walk2 = seg("walk", path([[2500, 2000], [2500, 2100]]), "Kangemi stage", "Wanjiru's gate");
    const steps = buildSteps([walk1, ride, walk2], [lm("sh", 30, 1200, "Shell"), lm("cafe", -30, 1500, "Java House", "food")]);
    expect(steps.filter((s) => s.kind === "turn")).toHaveLength(0);
    const rideStep = steps.find((s) => s.kind === "mode");
    expect(rideStep?.text).toBe("Take a matatu at Westlands stage. Ride about 4.5 km (about 15 min) and get off at Kangemi stage.");
    expect(steps.find((s) => s.landmarkId === "sh")?.text).toBe("You will pass Shell petrol station.");
    expect(steps.some((s) => s.landmarkId === "cafe")).toBe(false);
    expect(steps.some((s) => s.text === "Get off and walk north.")).toBe(true);
    expect(steps[steps.length - 1].text).toBe("Arrive at Wanjiru's gate.");
  });
  it("sorts by atM and keeps start first and arrive last", () => {
    const steps = buildSteps([seg("walk", L_RIGHT), seg("boda", path([[200, 300], [200, 1400]]), "Junction", "Market")], []);
    for (let i = 1; i < steps.length; i++) expect(steps[i].atM).toBeGreaterThanOrEqual(steps[i - 1].atM);
    expect(steps[0].kind).toBe("start");
    expect(steps[steps.length - 1].kind).toBe("arrive");
    expect(steps.find((s) => s.kind === "mode")?.text).toMatch(/^Take a boda at Junction\. Ride about 1\.1 km/);
  });
  it("makes deterministic, unique ids from kind and position", () => {
    const segs = [seg("walk", L_RIGHT), seg("car", path([[200, 300], [200, 900], [0, 900]]))];
    const lms = [lm("x", 15, 315, "Total"), lm("y", 185, 600, "Naivas", "shop")];
    const a = buildSteps(segs, lms);
    const b = buildSteps(segs, lms);
    expect(a).toEqual(b);
    for (const s of a) expect(s.id).toMatch(new RegExp(`^${s.kind}-${Math.round(s.atM / 10)}(-\\d+)?$`));
    expect(new Set(a.map((s) => s.id)).size).toBe(a.length);
  });
  it("adds -2 on id collisions", () => {
    const tiny = seg("walk", [m(0, 0), m(0, 2)]);
    const steps = buildSteps([tiny], [lm("a", 1, 1, "A", "shop"), lm("b", -1, 1.2, "B", "shop")]);
    const ids = steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("returns nothing for an empty route", () => {
    expect(buildSteps([], [])).toEqual([]);
  });
});
