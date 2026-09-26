import { deflateSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { EXAMPLE_DOC } from "@/lib/example";
import { lineLength } from "@/lib/geo";
import { estimateSeconds } from "@/lib/modes";
import { decodePolyline, encodePolyline } from "@/lib/polyline";
import { decodeDoc, encodeDoc, LIMITS, shareUrl } from "@/lib/share";
import type { LngLat, RouteDoc, Segment } from "@/lib/types";

const r5 = (v: number) => Math.round(v * 1e5) / 1e5;

function normalise(doc: RouteDoc) {
  return {
    ...doc,
    segments: doc.segments.map((s) => {
      const { distanceM, durationS, ...rest } = s;
      void distanceM;
      void durationS;
      return {
        ...rest,
        from: { ...s.from, lng: r5(s.from.lng), lat: r5(s.from.lat) },
        to: { ...s.to, lng: r5(s.to.lng), lat: r5(s.to.lat) },
        geometry: s.geometry.map(([a, b]) => [r5(a), r5(b)]),
        vias: s.vias.map(([a, b]) => [r5(a), r5(b)]),
      };
    }),
    landmarks: doc.landmarks.map((l) => ({ ...l, lng: r5(l.lng), lat: r5(l.lat) })),
  };
}

function wire(obj: unknown): string {
  const bytes = deflateSync(strToU8(JSON.stringify(obj)), { level: 9 });
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function rng(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

function syntheticDoc(): RouteDoc {
  const rand = rng(7);
  const coords: LngLat[] = [[36.8065, -1.2633]];
  let heading = 250;
  while (lineLength(coords) < 5000) {
    heading += (rand() - 0.5) * 50;
    const stepM = 20 + rand() * 25;
    const [lng, lat] = coords[coords.length - 1];
    const rad = (heading * Math.PI) / 180;
    coords.push([r5(lng + (Math.sin(rad) * stepM) / 111195), r5(lat + (Math.cos(rad) * stepM) / 111195)]);
  }
  const cuts = [0, Math.floor(coords.length * 0.12), Math.floor(coords.length * 0.88), coords.length - 1];
  const modes = ["walk", "matatu", "walk"] as const;
  const labels = ["Mpaka Road, Westlands", "Westlands stage", "Kangemi stage", "Wanjiru's place, green gate"];
  const segments: Segment[] = modes.map((mode, i) => {
    const geometry = coords.slice(cuts[i], cuts[i + 1] + 1);
    const d = lineLength(geometry);
    const [a, b] = [geometry[0], geometry[geometry.length - 1]];
    return {
      id: `seg${i}abc`,
      mode,
      from: { lng: a[0], lat: a[1], label: labels[i] },
      to: { lng: b[0], lat: b[1], label: labels[i + 1] },
      vias: [],
      drawn: false,
      geometry,
      distanceM: d,
      durationS: estimateSeconds(mode, d),
    };
  });
  const landmarks = Array.from({ length: 10 }, (_, i) => {
    const c = coords[Math.floor(((i + 0.5) * coords.length) / 10)];
    return { id: `osm-${5300000000 + i * 7919}`, lng: c[0] + 0.0002, lat: c[1], label: `Landmark number ${i + 1}`, kind: "fuel" as const, source: "map" as const };
  });
  const steps = Array.from({ length: 20 }, (_, i) => ({
    id: `turn-${i * 25}`,
    kind: "turn" as const,
    text: `After 250 m, turn ${i % 2 ? "left" : "right"} at Landmark number ${(i % 10) + 1}.`,
    atM: i * 250,
    landmarkId: landmarks[i % 10].id,
  }));
  return { v: 1, title: "Directions to Wanjiru's place", segments, landmarks, steps, arrival: { note: "Green gate, ring the bell." }, walker: "neutral", createdAt: "2026-09-26T09:00:00.000Z" };
}

describe("polyline", () => {
  it("round trips at precision 5", () => {
    const pts: LngLat[] = [[36.80651, -1.26334], [-120.2, 38.5], [-120.95, 40.7], [179.99999, -89.99999]];
    expect(decodePolyline(encodePolyline(pts))).toEqual(pts);
    expect(encodePolyline([[-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252]])).toBe("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
  });
  it("rejects bad input and too many points", () => {
    expect(decodePolyline("_p~iF")).toBeNull();
    expect(decodePolyline("abc def")).toBeNull();
    expect(decodePolyline(encodePolyline([[1, 1], [2, 2], [3, 3]]), 2)).toBeNull();
  });
});

describe("encodeDoc and decodeDoc", () => {
  it("round trips the example apart from recomputed fields", () => {
    const decoded = decodeDoc(encodeDoc(EXAMPLE_DOC));
    expect(decoded).not.toBeNull();
    expect(normalise(decoded!)).toEqual(normalise(EXAMPLE_DOC));
    for (const s of decoded!.segments) {
      expect(s.distanceM).toBeCloseTo(lineLength(s.geometry), 6);
      expect(s.durationS).toBe(estimateSeconds(s.mode, s.distanceM));
    }
  });
  it("keeps optional fields: vias, drawn, notes, hidden, edited, custom ids", () => {
    const doc = structuredClone(EXAMPLE_DOC);
    doc.segments[0].vias = [[36.8055, -1.2641]];
    doc.segments[0].drawn = true;
    doc.landmarks[0] = { ...doc.landmarks[0], note: "Big red sign\nopposite the stage", hidden: true };
    doc.landmarks.push({ id: "host-1", lng: 36.75182, lat: -1.26801, label: "Blue kiosk", kind: "host", source: "host" });
    doc.steps[1] = { ...doc.steps[1], id: "my-own-id", edited: true, text: "Turn right at the big tree." };
    doc.walker = "man";
    const back = decodeDoc(encodeDoc(doc))!;
    expect(normalise(back)).toEqual(normalise(doc));
  });
  it("encodes a 5 km three-leg route with 10 landmarks and 20 steps in under 3,000 characters", () => {
    const doc = syntheticDoc();
    const enc = encodeDoc(doc);
    expect(enc.length).toBeLessThan(3000);
    expect(enc).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(normalise(decodeDoc(enc)!)).toEqual(normalise(doc));
  });
  it("builds the share URL", () => {
    const url = shareUrl(EXAMPLE_DOC, "https://docent.example/");
    expect(url.startsWith("https://docent.example/r?d=")).toBe(true);
    expect(decodeDoc(url.split("?d=")[1])).not.toBeNull();
  });

  it("returns null for garbage", () => {
    for (const bad of ["", "   ", "abc", "!!!!", "%7B%7D", "eyJ2IjoxfQ", "AAAA", "____", "null"]) {
      expect(decodeDoc(bad)).toBeNull();
    }
    expect(decodeDoc(undefined as unknown as string)).toBeNull();
    expect(decodeDoc(42 as unknown as string)).toBeNull();
    expect(decodeDoc(wire("hello"))).toBeNull();
    expect(decodeDoc(wire([1, 2, 3]))).toBeNull();
    expect(decodeDoc(wire({ v: 2, s: [] }))).toBeNull();
    expect(decodeDoc(wire({ v: 1, s: [] }))).toBeNull();
    const notDeflate = btoa("{\"v\":1}").replace(/=+$/, "");
    expect(decodeDoc(notDeflate)).toBeNull();
  });
  it("returns null for truncated links", () => {
    const enc = encodeDoc(EXAMPLE_DOC);
    for (const cut of [10, Math.floor(enc.length / 2), enc.length - 3]) expect(decodeDoc(enc.slice(0, cut))).toBeNull();
  });
  it("returns null for oversized input", () => {
    expect(decodeDoc("A".repeat(LIMITS.encodedChars + 1))).toBeNull();
    expect(decodeDoc(wire({ v: 1, t: " ".repeat(LIMITS.jsonBytes + 10) }))).toBeNull();
    const seg = [0, encodePolyline([[36.8, -1.2], [36.81, -1.21]]), "", "", "", "", 0, "a"];
    expect(decodeDoc(wire({ v: 1, s: Array(21).fill(seg) }))).toBeNull();
    expect(decodeDoc(wire({ v: 1, s: [seg], p: Array(201).fill([0, "x", 0, -1, 0, ""]) }))).toBeNull();
    expect(decodeDoc(wire({ v: 1, s: [seg], l: Array(61).fill(["a", "b", 0, 0, "", 0]), lp: "" }))).toBeNull();
  });
  it("returns null when there are too many coordinates", () => {
    const many: LngLat[] = Array.from({ length: LIMITS.coords + 5 }, (_, i) => [36.8 + (i % 2) * 0.00001, -1.2]);
    const seg = [0, encodePolyline(many), "", "", "", "", 0, "a"];
    const enc = wire({ v: 1, s: [seg] });
    expect(enc.length).toBeLessThanOrEqual(LIMITS.encodedChars);
    expect(decodeDoc(enc)).toBeNull();
  });
  it("returns null for out of range coordinates and bad types", () => {
    const good = encodePolyline([[36.8, -1.2], [36.81, -1.21]]);
    const badLat = encodePolyline([[36.8, 95], [36.81, -1.21]]);
    const badLng = encodePolyline([[200, -1.2], [36.81, -1.21]]);
    expect(decodeDoc(wire({ v: 1, s: [[0, good]] }))).not.toBeNull();
    expect(decodeDoc(wire({ v: 1, s: [[0, badLat]] }))).toBeNull();
    expect(decodeDoc(wire({ v: 1, s: [[0, badLng]] }))).toBeNull();
    expect(decodeDoc(wire({ v: 1, s: [[9, good]] }))).toBeNull();
    expect(decodeDoc(wire({ v: 1, s: [[0.5, good]] }))).toBeNull();
    expect(decodeDoc(wire({ v: 1, s: [["walk", good]] }))).toBeNull();
    expect(decodeDoc(wire({ v: 1, s: [[0, encodePolyline([[36.8, -1.2]])]] }))).toBeNull();
    expect(decodeDoc(wire({ v: 1, t: 5, s: [[0, good]] }))).toBeNull();
    expect(decodeDoc(wire({ v: 1, s: [[0, good]], l: [["a", "b", 0, 0, "", 0]], lp: badLat }))).toBeNull();
    expect(decodeDoc(wire({ v: 1, s: [[0, good]], l: [["a", "b", 0, 0, "", 0]], lp: good }))).toBeNull();
    expect(decodeDoc(wire({ v: 1, s: [[0, good]], p: [[0, "x", 0, 3, 0, ""]] }))).toBeNull();
    expect(decodeDoc(wire({ v: 1, s: [[0, good]], p: [[0, "x", -5, -1, 0, ""]] }))).toBeNull();
  });
  it("fills defaults for missing optional fields", () => {
    const good = encodePolyline([[36.8, -1.2], [36.81, -1.21]]);
    const doc = decodeDoc(wire({ v: 1, s: [[2, good]] }))!;
    expect(doc.title).toBe("");
    expect(doc.walker).toBe("neutral");
    expect(doc.arrival).toEqual({ note: "" });
    expect(doc.landmarks).toEqual([]);
    expect(doc.steps).toEqual([]);
    expect(doc.segments[0].mode).toBe("matatu");
    expect(doc.segments[0].from).toEqual({ lng: 36.8, lat: -1.2 });
    expect(doc.segments[0].id).toBe("s1");
    expect(doc.segments[0].durationS).toBe(estimateSeconds("matatu", doc.segments[0].distanceM));
  });
  it("clamps long strings and strips control characters", () => {
    const doc = structuredClone(EXAMPLE_DOC);
    doc.title = "T".repeat(500);
    doc.segments[0].from.label = "L".repeat(200);
    doc.landmarks[0].label = "M".repeat(200);
    doc.landmarks[0].note = "N".repeat(1000);
    doc.arrival.note = "A".repeat(1000);
    doc.steps[0].text = "S".repeat(500) + "\u0000";
    doc.steps[1].text = "Turn\u0007 left";
    const back = decodeDoc(encodeDoc(doc))!;
    expect(back.title).toHaveLength(LIMITS.title);
    expect(back.segments[0].from.label).toHaveLength(LIMITS.label);
    expect(back.landmarks[0].label).toHaveLength(LIMITS.label);
    expect(back.landmarks[0].note).toHaveLength(LIMITS.note);
    expect(back.arrival.note).toHaveLength(LIMITS.note);
    expect(back.steps[0].text).toHaveLength(LIMITS.stepText);
    expect(back.steps[1].text).toBe("Turn  left");
  });
  it("makes duplicate ids unique", () => {
    const good = encodePolyline([[36.8, -1.2], [36.81, -1.21]]);
    const doc = decodeDoc(wire({ v: 1, s: [[0, good, "", "", "", "", 0, "x"], [0, good, "", "", "", "", 0, "x"]], p: [[0, "a", 0, -1, 0, "k"], [0, "b", 0, -1, 0, "k"]] }))!;
    expect(doc.segments.map((s) => s.id)).toEqual(["x", "x-2"]);
    expect(doc.steps.map((s) => s.id)).toEqual(["k", "k-2"]);
  });
});
