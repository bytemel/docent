import { describe, expect, it } from "vitest";
import { ogQuery } from "@/app/r/og-params";
import { decodeDoc, encodeDoc, LIMITS } from "@/lib/share";
import type { LngLat, RouteDoc } from "@/lib/types";

function docWith(geometry: LngLat[]): RouteDoc {
  const first = geometry[0];
  const last = geometry[geometry.length - 1];
  return {
    v: 1,
    title: "Stress",
    segments: [
      {
        id: "s1",
        mode: "car",
        from: { lng: first[0], lat: first[1] },
        to: { lng: last[0], lat: last[1] },
        vias: [],
        drawn: true,
        geometry,
        distanceM: 0,
        durationS: 0,
      },
    ],
    landmarks: [],
    steps: [],
    arrival: { note: "" },
    walker: "neutral",
    createdAt: "2026-09-26T00:00:00.000Z",
  };
}

describe("hostile and long routes stay cheap", () => {
  it("builds the share image query for a 20,000 point zigzag quickly", () => {
    const zigzag: LngLat[] = Array.from({ length: 19990 }, (_, i) => [36.8 + i * 0.00001, -1.26 + (i % 2) * 0.001]);
    const started = performance.now();
    ogQuery(docWith(zigzag));
    expect(performance.now() - started).toBeLessThan(1500);
  });

  it("shrinks a very long route until the link fits and still decodes", () => {
    const wiggly: LngLat[] = Array.from({ length: 12000 }, (_, i) => [
      36.6 + i * 0.00005,
      -1.3 + Math.sin(i / 7) * 0.002 + (i % 3) * 0.00003,
    ]);
    const encoded = encodeDoc(docWith(wiggly));
    expect(encoded.length).toBeLessThanOrEqual(LIMITS.encodedChars);
    expect(decodeDoc(encoded)).not.toBeNull();
  });
});
