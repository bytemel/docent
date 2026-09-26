import { describe, expect, it } from "vitest";
import {
  bearing,
  cumulative,
  formatDistance,
  haversine,
  lineLength,
  nearestOnLine,
  pointAt,
  simplify,
  turnAngle,
} from "@/lib/geo";
import type { LngLat } from "@/lib/types";

const LAT0 = -1.28;
const LNG0 = 36.8;
const DEG = (6371008.8 * Math.PI) / 180;
const m = (x: number, y: number): LngLat => [LNG0 + x / (DEG * Math.cos((LAT0 * Math.PI) / 180)), LAT0 + y / DEG];

describe("haversine", () => {
  it("measures one degree of latitude at the equator", () => {
    expect(haversine([0, 0], [0, 1])).toBeCloseTo(111195, -1);
  });
  it("measures a short Nairobi distance", () => {
    expect(haversine(m(0, 0), m(300, 400))).toBeGreaterThan(495);
    expect(haversine(m(0, 0), m(300, 400))).toBeLessThan(505);
  });
});

describe("bearing and turnAngle", () => {
  it("gives compass bearings", () => {
    expect(bearing([0, 0], [0, 1])).toBeCloseTo(0, 5);
    expect(bearing([0, 0], [1, 0])).toBeCloseTo(90, 5);
    expect(bearing([0, 0], [0, -1])).toBeCloseTo(180, 5);
    expect(bearing([0, 0], [-1, 0])).toBeCloseTo(270, 5);
  });
  it("wraps turn angles to -180..180", () => {
    expect(turnAngle(350, 10)).toBe(20);
    expect(turnAngle(10, 350)).toBe(-20);
    expect(turnAngle(0, 90)).toBe(90);
  });
});

describe("pointAt", () => {
  const line = [m(0, 0), m(0, 100), m(100, 100)];
  const cum = cumulative(line);
  it("interpolates along the line", () => {
    const p = pointAt(line, cum, 50);
    expect(haversine(p.pos, m(0, 50))).toBeLessThan(0.5);
    expect(p.index).toBe(0);
    const q = pointAt(line, cum, 150);
    expect(haversine(q.pos, m(50, 100))).toBeLessThan(0.5);
    expect(q.bearing).toBeCloseTo(90, 0);
  });
  it("clamps below zero and past the end", () => {
    expect(pointAt(line, cum, -20).pos).toEqual(line[0]);
    const end = pointAt(line, cum, 10_000).pos;
    expect(haversine(end, line[2])).toBeLessThan(0.01);
  });
  it("handles empty and single point lines", () => {
    expect(pointAt([], [], 5).pos).toEqual([0, 0]);
    expect(pointAt([m(0, 0)], [0], 5).pos).toEqual(m(0, 0));
  });
});

describe("nearestOnLine", () => {
  it("finds distance and position along the line", () => {
    const line = [m(0, 0), m(0, 200)];
    const r = nearestOnLine(m(15, 80), line);
    expect(r.d).toBeCloseTo(15, 0);
    expect(r.atM).toBeCloseTo(80, 0);
  });
  it("clamps to the end points", () => {
    const line = [m(0, 0), m(0, 200)];
    expect(nearestOnLine(m(0, -30), line).atM).toBe(0);
    expect(nearestOnLine(m(0, 260), line).d).toBeCloseTo(60, 0);
  });
});

describe("simplify", () => {
  it("drops straight points and keeps the corner", () => {
    const line: LngLat[] = [];
    for (let y = 0; y <= 200; y += 10) line.push(m(0, y));
    for (let x = 10; x <= 200; x += 10) line.push(m(x, 200));
    const s = simplify(line, 4);
    expect(s.length).toBe(3);
    expect(s[1]).toBe(line[20]);
    expect(lineLength(s)).toBeCloseTo(lineLength(line), 0);
  });
});

describe("formatDistance", () => {
  it("rounds metres and kilometres", () => {
    expect(formatDistance(153)).toBe("150 m");
    expect(formatDistance(4230)).toBe("4.2 km");
    expect(formatDistance(12400)).toBe("12 km");
  });
});

describe("formatDistance near 1 km", () => {
  it("says 1.0 km just under 1 km, not 1000 m", () => {
    expect(formatDistance(998)).toBe("1.0 km");
  });
});
