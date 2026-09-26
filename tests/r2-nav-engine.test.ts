import { describe, expect, it } from "vitest";
import { lineLength } from "@/lib/geo";
import {
  ACTIVITIES,
  arrowFor,
  buildNavRoute,
  cleanStep,
  createAnnouncer,
  dueAnnouncements,
  formatPace,
  navProgress,
  needsApproach,
  parseTo,
  rerouteDue,
  spokenDistance,
  startAnnouncement,
  type Activity,
} from "@/lib/nav";
import { buildSteps } from "@/lib/steps";
import type { Landmark, LngLat, Mode, Segment } from "@/lib/types";

const LAT0 = -1.28;
const LNG0 = 36.8;
const DEG = (6371008.8 * Math.PI) / 180;
const m = (x: number, y: number): LngLat => [LNG0 + x / (DEG * Math.cos((LAT0 * Math.PI) / 180)), LAT0 + y / DEG];

function line(points: [number, number][], step = 20): LngLat[] {
  const out: LngLat[] = [];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / step));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) out.push(m(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n));
  }
  return out;
}

function seg(id: string, mode: Mode, pts: [number, number][], from?: string, to?: string): Segment {
  const geometry = line(pts);
  const a = geometry[0];
  const b = geometry[geometry.length - 1];
  return {
    id,
    mode,
    from: { lng: a[0], lat: a[1], label: from },
    to: { lng: b[0], lat: b[1], label: to },
    vias: [],
    drawn: false,
    geometry,
    distanceM: lineLength(geometry),
    durationS: 0,
  };
}

const totalAt = (x: number): Landmark => ({ id: "t", lng: m(x + 12, -12)[0], lat: m(x + 12, -12)[1], label: "Total", kind: "fuel", source: "map" });

function lRoute(eastM = 400, northM = 300, mode: Mode = "walk") {
  const segments = [seg("a", mode, [[0, 0], [eastM, 0], [eastM, northM]], undefined, "Green gate")];
  return buildNavRoute([{ segments, steps: buildSteps(segments, [totalAt(eastM)]) }], { arrivalNote: "Ring the bell." });
}

function walkAlong(activity: Activity, route: ReturnType<typeof lRoute>, stepM = 4) {
  const a = createAnnouncer(route, activity);
  const said: string[] = [];
  for (let at = 0; at <= route.totalM + 1; at += stepM) {
    const s = a.update(Math.min(at, route.totalM));
    if (s) said.push(s);
  }
  return said;
}

describe("arrows", () => {
  it("maps turn angles to plate arrows", () => {
    expect(arrowFor(5)).toBe("straight");
    expect(arrowFor(-35)).toBe("slight-left");
    expect(arrowFor(40)).toBe("slight-right");
    expect(arrowFor(-90)).toBe("left");
    expect(arrowFor(95)).toBe("right");
    expect(arrowFor(-135)).toBe("sharp-left");
    expect(arrowFor(140)).toBe("sharp-right");
    expect(arrowFor(175)).toBe("u-turn");
  });

  it("cleans step text for the plate", () => {
    expect(cleanStep("After 200 m, turn left at Total petrol station.")).toBe("Turn left at Total petrol station");
    expect(cleanStep("Start here. Walk east.")).toBe("Walk east");
  });
});

describe("an L shaped walk", () => {
  const route = lRoute();

  it("has a left turn at Total and an arrival", () => {
    const kinds = route.maneuvers.map((x) => x.kind);
    expect(kinds).toEqual(["depart", "turn", "arrive"]);
    const turn = route.maneuvers[1];
    expect(turn.arrow).toBe("left");
    expect(turn.text).toBe("Turn left at Total petrol station");
    expect(turn.now).toBe("Turn left now");
    expect(turn.atM).toBeCloseTo(400, -1);
    expect(route.maneuvers[2].now).toBe("You have arrived. Ring the bell.");
  });

  it("tracks progress, ETA and the next maneuver", () => {
    const p = navProgress(route, { atM: 100, offRouteM: 3 }, "walk", 0);
    expect(p.current.kind).toBe("turn");
    expect(p.next?.kind).toBe("arrive");
    expect(p.toNextM).toBeCloseTo(300, -1);
    expect(p.leftM).toBeCloseTo(600, -1);
    expect(p.etaS).toBeCloseTo(600 / (4.8 / 3.6), -1);
    expect(navProgress(route, { atM: 100, offRouteM: 3 }, "run", 0).etaS).toBeCloseTo(216, -1);
    const after = navProgress(route, { atM: 450, offRouteM: 3 }, "walk", 0);
    expect(after.current.kind).toBe("arrive");
    expect(after.next).toBeNull();
  });

  it("speaks each walk threshold once, in order", () => {
    expect(walkAlong("walk", route)).toEqual([
      "In 150 metres, turn left at Total petrol station",
      "In 30 metres, turn left at Total petrol station",
      "Turn left now",
      "In 150 metres, arrive at Green gate",
      "In 30 metres, arrive at Green gate",
      "You have arrived. Ring the bell.",
    ]);
  });

  it("does not repeat when the position jitters back and forth", () => {
    const a = createAnnouncer(route, "walk");
    const said: string[] = [];
    for (const at of [0, 240, 252, 245, 255, 249, 260, 372, 365, 380, 392, 386, 395]) {
      const s = a.update(at);
      if (s) said.push(s);
    }
    expect(said).toEqual([
      "In 150 metres, turn left at Total petrol station",
      "In 30 metres, turn left at Total petrol station",
      "Turn left now",
    ]);
  });

  it("opens with the first instruction", () => {
    expect(startAnnouncement(route, "walk")).toMatch(/^Walk (east|toward [^.]+)\. Continue for 400 metres, then turn left at Total petrol station\.$/);
    expect(createAnnouncer(route, "walk").current(390)).toBe("Turn left now");
  });
});

describe("thresholds per activity", () => {
  it("cycle warns at 250 and 50 metres", () => {
    const said = walkAlong("cycle", lRoute(1200, 300, "bike"));
    expect(said.slice(0, 3)).toEqual([
      "In 250 metres, turn left at Total petrol station",
      "In 50 metres, turn left at Total petrol station",
      "Turn left now",
    ]);
  });

  it("drive warns at 500 and 100 metres and says how far to continue", () => {
    const said = walkAlong("drive", lRoute(2000, 1400, "car"), 8);
    expect(said.slice(0, 3)).toEqual([
      "In 500 metres, turn left at Total petrol station",
      "In 100 metres, turn left at Total petrol station",
      "Turn left now",
    ]);
    expect(said[3]).toBe("Continue for 1.4 kilometres");
  });

  it("a long walk leg says Continue for", () => {
    const said = walkAlong("walk", lRoute(400, 1200));
    expect(said).toContain("Continue for 1.2 kilometres");
  });
});

describe("multimodal shared route", () => {
  const segments = [
    seg("w1", "walk", [[0, 0], [300, 0]], "Mpaka Road", "Westlands stage"),
    seg("mt", "matatu", [[300, 0], [2300, 0]], "Westlands stage", "Kangemi stage"),
    seg("w2", "walk", [[2300, 0], [2300, 200]], "Kangemi stage", "Blue gate"),
  ];
  const route = buildNavRoute([{ segments, steps: buildSteps(segments, []) }]);

  it("boards and gets off at the named stages", () => {
    const board = route.maneuvers.find((x) => x.kind === "board")!;
    const alight = route.maneuvers.find((x) => x.kind === "alight")!;
    expect(board.text).toBe("Take a matatu at Westlands stage");
    expect(board.atM).toBeCloseTo(300, -1);
    expect(alight.text).toBe("Get off at Kangemi stage");
    expect(alight.atM).toBeCloseTo(2300, -1);
  });

  it("uses the matatu speed for the ride and the activity speed on foot", () => {
    const p = navProgress(route, { atM: 1300, offRouteM: 5 }, "walk", 0);
    expect(p.current.kind).toBe("alight");
    expect(p.etaS).toBeCloseTo(1000 / (18 / 3.6) + 200 / (4.8 / 3.6), -1);
  });

  it("joins a shared route after walking to its start", () => {
    const approach = [seg("ap", "walk", [[-200, -150], [0, 0]])];
    const joined = buildNavRoute([
      { segments: approach, steps: buildSteps(approach, []) },
      { segments, steps: buildSteps(segments, []) },
    ]);
    const join = joined.maneuvers.find((x) => x.kind === "join")!;
    expect(join.text).toBe("Join the route at Mpaka Road");
    expect(join.atM).toBeCloseTo(250, -1);
    expect(joined.maneuvers.filter((x) => x.kind === "arrive")).toHaveLength(1);
    expect(joined.maneuvers.filter((x) => x.kind === "depart")).toHaveLength(1);
  });
});

describe("off route, arrival and pace", () => {
  const route = lRoute();

  it("flags off route by activity and accuracy", () => {
    expect(navProgress(route, { atM: 200, offRouteM: 50 }, "walk", 0).offRoute).toBe(true);
    expect(navProgress(route, { atM: 200, offRouteM: 50 }, "drive", 0).offRoute).toBe(false);
    expect(navProgress(route, { atM: 200, offRouteM: 50, acc: 70 }, "walk", 0).offRoute).toBe(false);
  });

  it("arrives near the end and only when on the route", () => {
    expect(navProgress(route, { atM: route.totalM - 10, offRouteM: 4 }, "walk", 0).arrived).toBe(true);
    expect(navProgress(route, { atM: route.totalM - 10, offRouteM: 80 }, "walk", 0).arrived).toBe(false);
    expect(navProgress(route, { atM: route.totalM - 60, offRouteM: 4 }, "walk", 0).arrived).toBe(false);
  });

  it("works out pace from time and distance, counting distance before a reroute", () => {
    const p = navProgress(route, { atM: 500, offRouteM: 2 }, "run", 150);
    expect(p.paceSPerKm).toBeCloseTo(300, 5);
    expect(formatPace(p.paceSPerKm!)).toBe("5:00");
    const rerouted = { ...route, baseM: 500 };
    expect(navProgress(rerouted, { atM: 500, offRouteM: 2 }, "run", 300).paceSPerKm).toBeCloseTo(300, 5);
    expect(navProgress(route, { atM: 10, offRouteM: 2 }, "run", 5).paceSPerKm).toBeNull();
    expect(formatPace(345)).toBe("5:45");
  });

  it("uses the measured speed for the ETA once moving, within limits", () => {
    const slow = navProgress(route, { atM: 300, offRouteM: 2 }, "walk", 600);
    expect(slow.etaS).toBeCloseTo(400 / (4.8 / 3.6 / 2), -1);
    const brisk = navProgress(route, { atM: 300, offRouteM: 2 }, "walk", 180);
    expect(brisk.etaS).toBeCloseTo(400 / (300 / 180), -1);
    const normal = navProgress(route, { atM: 300, offRouteM: 2 }, "walk", 20);
    expect(normal.etaS).toBeCloseTo(400 / (4.8 / 3.6), -1);
  });
});

describe("helpers", () => {
  it("reroutes after 8 s off route, at most every 20 s", () => {
    expect(rerouteDue(null, 0, 100_000)).toBe(false);
    expect(rerouteDue(95_000, 0, 100_000)).toBe(false);
    expect(rerouteDue(92_000, 0, 100_000)).toBe(true);
    expect(rerouteDue(92_000, 85_000, 100_000)).toBe(false);
  });

  it("needs an approach only beyond 80 m", () => {
    expect(needsApproach(m(0, 0), m(60, 0))).toBe(false);
    expect(needsApproach(m(0, 0), m(120, 0))).toBe(true);
  });

  it("reads a preset destination", () => {
    expect(parseTo("36.8021,-1.2612,Sarit Centre")).toEqual({ lng: 36.8021, lat: -1.2612, label: "Sarit Centre" });
    expect(parseTo("36.8021,-1.2612")).toEqual({ lng: 36.8021, lat: -1.2612, label: "" });
    expect(parseTo("200,1")).toBeNull();
    expect(parseTo("Sarit")).toBeNull();
  });

  it("says distances the way people do", () => {
    expect(spokenDistance(147)).toBe("150 metres");
    expect(spokenDistance(32)).toBe("30 metres");
    expect(spokenDistance(990)).toBe("1 kilometre");
    expect(spokenDistance(2360)).toBe("2.4 kilometres");
  });

  it("has the four activities with the right speeds", () => {
    expect(ACTIVITIES.walk.speedKmh).toBe(4.8);
    expect(ACTIVITIES.run.speedKmh).toBe(10);
    expect(ACTIVITIES.cycle.profile).toBe("bike");
    expect(ACTIVITIES.drive.thresholds).toEqual([500, 100]);
  });
});

it("still says Turn left now when a fix lands right at the turn", () => {
  const route = lRoute();
  const a = createAnnouncer(route, "walk", 300);
  expect(a.update(399)).toBe("Turn left now");
  expect(createAnnouncer(route, "walk", 380).update(430)).toBeNull();
});

it("joins two maneuvers crossed in one update", () => {
  const route = lRoute(400, 300);
  const a = createAnnouncer(route, "walk", 380);
  const extra = { ...route, maneuvers: route.maneuvers.map((x) => (x.kind === "arrive" ? { ...x, atM: 437 } : x)) };
  const b = createAnnouncer(extra, "walk", 385);
  expect(a.update(392)).toBe("Turn left now");
  expect(b.update(408)).toBe("Turn left now. Then in 30 metres, arrive at Green gate");
});

it("returns every crossed trigger in order when a fix jumps ahead", () => {
  const route = lRoute();
  const due = dueAnnouncements(route, 0, 380, "walk");
  expect(due.map((d) => d.key)).toEqual(["1:150", "1:30"]);
});
