import { describe, expect, it } from "vitest";
import { cumulative, haversine } from "@/lib/geo";
import type { LiveFix } from "@/lib/live";
import { createLiveFilter, isPlausibleFix, progressAlong, smoothFix, snapToRoute } from "@/lib/liveFilter";
import type { LngLat } from "@/lib/types";

const LAT0 = -1.28;
const LNG0 = 36.8;
const DEG = (6371008.8 * Math.PI) / 180;
const m = (x: number, y: number): LngLat => [LNG0 + x / (DEG * Math.cos((LAT0 * Math.PI) / 180)), LAT0 + y / DEG];
const fix = (x: number, y: number, t: number, acc = 10, speed: number | null = null): LiveFix => {
  const [lng, lat] = m(x, y);
  return { lng, lat, acc, heading: null, speed, t };
};

function noise(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s / 2147483647) * 2 - 1;
  };
}

describe("smoothing", () => {
  it("converges on a still point and beats the raw jitter", () => {
    const rnd = noise(7);
    const f = createLiveFilter();
    let rawErr = 0;
    let outErr = 0;
    for (let i = 0; i < 40; i++) {
      const raw = fix(rnd() * 15, rnd() * 15, 1000 + i * 3000, 15);
      const out = f.push(raw)!;
      expect(out).not.toBeNull();
      if (i >= 20) {
        rawErr += haversine(m(0, 0), [raw.lng, raw.lat]);
        outErr += haversine(m(0, 0), [out.lng, out.lat]);
      }
    }
    expect(outErr).toBeLessThan(rawErr * 0.6);
    expect(outErr / 20).toBeLessThan(6);
  });

  it("trusts an accurate fix more than a vague one", () => {
    const start = smoothFix(null, fix(0, 0, 0, 20));
    const sharp = smoothFix(start, fix(40, 0, 1000, 5));
    const vague = smoothFix(start, fix(40, 0, 1000, 80));
    expect(haversine(m(40, 0), [sharp.lng, sharp.lat])).toBeLessThan(5);
    expect(haversine(m(40, 0), [vague.lng, vague.lat])).toBeGreaterThan(30);
  });

  it("follows a moving guest without lagging far behind", () => {
    const f = createLiveFilter();
    let out: LiveFix | null = null;
    for (let i = 0; i <= 20; i++) out = f.push(fix(i * 24, 0, i * 3000, 8, 8));
    expect(haversine(m(480, 0), [out!.lng, out!.lat])).toBeLessThan(15);
  });
});

describe("outliers", () => {
  it("rejects fixes worse than 100 m", () => {
    const f = createLiveFilter();
    expect(f.push(fix(0, 0, 0, 101))).toBeNull();
    expect(f.push(fix(0, 0, 1000, 100))).not.toBeNull();
    expect(isPlausibleFix(fix(0, 0, 0, 150), null)).toBe(false);
  });

  it("rejects stale and broken fixes", () => {
    const f = createLiveFilter();
    expect(f.push(fix(0, 0, 5000))).not.toBeNull();
    expect(f.push(fix(1, 0, 5000))).toBeNull();
    expect(f.push(fix(1, 0, 4000))).toBeNull();
    expect(f.push({ ...fix(0, 0, 9000), lat: Number.NaN })).toBeNull();
  });

  it("rejects an impossible jump over 60 m/s and keeps the last good position", () => {
    const f = createLiveFilter();
    f.push(fix(0, 0, 0));
    expect(isPlausibleFix(fix(700, 0, 10000), fix(0, 0, 0))).toBe(false);
    expect(isPlausibleFix(fix(500, 0, 10000), fix(0, 0, 0))).toBe(true);
    expect(f.push(fix(5000, 0, 3000))).toBeNull();
    const next = f.push(fix(10, 0, 6000))!;
    expect(haversine(m(0, 0), [next.lng, next.lat])).toBeLessThan(10);
  });

  it("starts over after repeated jumps so one bad first fix cannot lock it", () => {
    const f = createLiveFilter();
    f.push(fix(9000, 0, 0));
    expect(f.push(fix(0, 0, 3000))).toBeNull();
    expect(f.push(fix(0, 0, 6000))).toBeNull();
    const out = f.push(fix(0, 0, 9000))!;
    expect(haversine(m(0, 0), [out.lng, out.lat])).toBeLessThan(1);
  });
});

describe("snapToRoute", () => {
  const coords = [m(0, 0), m(500, 0), m(500, 500)];
  const cum = cumulative(coords);

  it("snaps a fix near the route onto the line", () => {
    const s = snapToRoute({ ...fixLL(200, 12), acc: 10 }, coords, cum);
    expect(s.snapped).toBe(true);
    expect(s.offRouteM).toBeCloseTo(12, 0);
    expect(s.atM).toBeCloseTo(200, -1);
    expect(haversine(s.pos, m(200, 0))).toBeLessThan(1);
  });

  it("uses the accuracy when it is bigger than 25 m", () => {
    expect(snapToRoute({ ...fixLL(300, 40), acc: 10 }, coords, cum).snapped).toBe(false);
    expect(snapToRoute({ ...fixLL(300, 40), acc: 50 }, coords, cum).snapped).toBe(true);
  });

  it("leaves an off route fix where it is", () => {
    const s = snapToRoute({ ...fixLL(250, -120), acc: 15 }, coords, cum);
    expect(s.snapped).toBe(false);
    expect(s.offRouteM).toBeCloseTo(120, 0);
    expect(haversine(s.pos, m(250, -120))).toBeLessThan(0.01);
    expect(s.atM).toBeCloseTo(250, -1);
  });

  it("measures along the second leg of the line", () => {
    const s = snapToRoute({ ...fixLL(505, 300), acc: 5 }, coords, cum);
    expect(s.snapped).toBe(true);
    expect(s.atM).toBeCloseTo(800, -1);
  });
});

describe("progressAlong", () => {
  it("adds each remaining leg at its own speed", () => {
    const legs = [
      { mode: "walk" as const, startM: 0, endM: 400 },
      { mode: "matatu" as const, startM: 400, endM: 5400 },
    ];
    const p = progressAlong(200, legs);
    expect(p.leg).toBe(0);
    expect(p.leftM).toBe(5200);
    expect(p.etaS).toBe(Math.round(200 / (4.8 / 3.6) + 5000 / (18 / 3.6)));
    expect(progressAlong(9999, legs)).toEqual({ leftM: 0, etaS: 0, leg: 1 });
  });
});

function fixLL(x: number, y: number) {
  const [lng, lat] = m(x, y);
  return { lng, lat };
}
