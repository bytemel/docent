import { describe, expect, it } from "vitest";
import { lineLength } from "@/lib/geo";
import { buildNavRoute, createAnnouncer } from "@/lib/nav";
import { buildSteps } from "@/lib/steps";
import type { LngLat, Segment } from "@/lib/types";

const LAT0 = -1.26;
const LNG0 = 36.8;
const DEG = (6371008.8 * Math.PI) / 180;
const m = (x: number, y: number): LngLat => [LNG0 + x / (DEG * Math.cos((LAT0 * Math.PI) / 180)), LAT0 + y / DEG];

function route(points: [number, number][]) {
  const geometry: LngLat[] = [];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 10));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) geometry.push(m(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n));
  }
  const seg: Segment = {
    id: "w",
    mode: "walk",
    from: { lng: geometry[0][0], lat: geometry[0][1] },
    to: { lng: geometry[geometry.length - 1][0], lat: geometry[geometry.length - 1][1], label: "Sarit Centre" },
    vias: [],
    drawn: false,
    geometry,
    distanceM: lineLength(geometry),
    durationS: 0,
  };
  return buildNavRoute([{ segments: [seg], steps: buildSteps([seg], []) }]);
}

describe("the now line when a fix jumps past the turn", () => {
  const r = route([[0, 0], [400, 0], [400, -60], [460, -60], [460, 300]]);
  const turns = r.maneuvers.filter((x) => x.kind === "turn");

  it("has three turns close together, like the Westlands walk", () => {
    expect(turns.map((t) => Math.round(t.atM / 10) * 10)).toEqual([400, 460, 520]);
  });

  it("says each turn now once, late when a fix skips the trigger window", () => {
    const a = createAnnouncer(r, "walk");
    const said: string[] = [];
    for (const at of [0, 120, 250, 372, 388, 404, 431, 452, 476, 498, 509, 540, 560]) {
      const s = a.update(at);
      if (s) said.push(s);
    }
    const nows = said.filter((s) => /now/.test(s));
    expect(nows).toHaveLength(3);
    expect(said.join(" | ")).toMatch(/Turn right now.*Turn left now.*Turn left now/);
  });

  it("skips a turn that is already more than 40 m behind", () => {
    const a = createAnnouncer(r, "walk", 440);
    expect(a.update(505)).not.toMatch(/^Turn right now/);
  });

  it("never repeats a now line on jitter", () => {
    const a = createAnnouncer(r, "walk", 380);
    const said = [395, 388, 396, 385, 399].map((at) => a.update(at)).filter(Boolean);
    expect(said).toEqual(["Turn right now"]);
  });
});
