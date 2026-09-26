import { describe, expect, it } from "vitest";
import { OG_MAX_POINTS, ogQuery, parseOg } from "@/app/r/og-params";
import { EXAMPLE_DOC } from "@/lib/example";

describe("share image params", () => {
  it("builds a short query with at most 60 points and parses it back per leg", () => {
    const q = new URLSearchParams(ogQuery(EXAMPLE_DOC));
    expect(q.get("t")).toBe(EXAMPLE_DOC.title);
    expect(q.get("m")).toMatch(/^w\d+m\d+w\d+$/);
    const data = parseOg(q);
    expect(data.runs.map((r) => r.mode)).toEqual(["walk", "matatu", "walk"]);
    const points = [...q.get("m")!.matchAll(/\d+/g)].reduce((n, x) => n + Number(x[0]), 0);
    expect(points).toBeLessThanOrEqual(OG_MAX_POINTS);
    expect(data.meters).toBeGreaterThan(7000);
  });
  it("drops the route on bad params and clamps the title", () => {
    const bad = parseOg(new URLSearchParams({ t: "x".repeat(500) + "\u0001", g: "zz", m: "q1" }));
    expect(bad.runs).toEqual([]);
    expect(bad.title).toHaveLength(120);
    expect(parseOg(new URLSearchParams({ g: "_p~iF~ps|U_ulLnnqC", m: "w5" })).runs).toEqual([]);
    expect(parseOg(new URLSearchParams({ l: "-4" })).meters).toBeNull();
    expect(parseOg(new URLSearchParams()).title).toBe("");
  });
});
