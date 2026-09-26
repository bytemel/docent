import { describe, expect, it, beforeEach } from "vitest";
import { parsePoints, rateLimit } from "@/lib/server";
import { parseLatLng, parseProfile, parseQuery } from "@/lib/server/parse";
import { resetRateLimits } from "@/lib/server/rateLimit";
import { parseOsrm, parsePhotonReverse, parsePhotonSearch } from "@/lib/server/providers";

describe("parsePoints", () => {
  it("parses good input", () => {
    expect(parsePoints("36.81,-1.26;36.75,-1.264")).toEqual([
      [36.81, -1.26],
      [36.75, -1.264],
    ]);
  });

  it("accepts integers and negative values", () => {
    expect(parsePoints("-180,-90;180,90")).toEqual([
      [-180, -90],
      [180, 90],
    ]);
  });

  it("rejects too few points", () => {
    expect(parsePoints("36.81,-1.26")).toBeNull();
    expect(parsePoints("")).toBeNull();
  });

  it("accepts 25 points and rejects 26", () => {
    const pts = (n: number) => Array.from({ length: n }, (_, i) => `36.${i},-1.2`).join(";");
    expect(parsePoints(pts(25))).toHaveLength(25);
    expect(parsePoints(pts(26))).toBeNull();
  });

  it("rejects out of range values", () => {
    expect(parsePoints("181,0;0,0")).toBeNull();
    expect(parsePoints("0,91;0,0")).toBeNull();
    expect(parsePoints("0,0;0,-90.5")).toBeNull();
  });

  it("rejects garbage", () => {
    expect(parsePoints("abc")).toBeNull();
    expect(parsePoints("1,2;3")).toBeNull();
    expect(parsePoints("1,2,3;4,5")).toBeNull();
    expect(parsePoints("1e2,3;4,5")).toBeNull();
    expect(parsePoints("NaN,1;2,3")).toBeNull();
    expect(parsePoints("Infinity,1;2,3")).toBeNull();
    expect(parsePoints("1,2;;3,4")).toBeNull();
    expect(parsePoints(" ,2;3,4")).toBeNull();
  });
});

describe("rateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to the limit then blocks", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) expect(rateLimit("t:a", 3, 60_000, now + i)).toBe(true);
    expect(rateLimit("t:a", 3, 60_000, now + 10)).toBe(false);
    expect(rateLimit("t:b", 3, 60_000, now + 10)).toBe(true);
  });

  it("resets after the window", () => {
    const now = 2_000_000;
    expect(rateLimit("t:c", 1, 60_000, now)).toBe(true);
    expect(rateLimit("t:c", 1, 60_000, now + 59_999)).toBe(false);
    expect(rateLimit("t:c", 1, 60_000, now + 60_000)).toBe(true);
  });
});

describe("other inputs", () => {
  it("parses lat and lng", () => {
    expect(parseLatLng("-1.29", "36.82")).toEqual({ lat: -1.29, lng: 36.82 });
    expect(parseLatLng("100", "36")).toBeNull();
    expect(parseLatLng(null, "36")).toBeNull();
  });

  it("accepts only known profiles", () => {
    expect(parseProfile("foot")).toBe("foot");
    expect(parseProfile("walk")).toBeNull();
  });

  it("cleans queries", () => {
    expect(parseQuery("  West\u0000lands ")).toBe("West lands");
    expect(parseQuery("a")).toBeNull();
    expect(parseQuery("x".repeat(121))).toBeNull();
  });
});

describe("providers", () => {
  it("reads an OSRM route", () => {
    const r = parseOsrm({
      code: "Ok",
      routes: [{ distance: 1234.4, geometry: { coordinates: [[36.8, -1.2], [36.81, -1.21]] } }],
    });
    expect(r).toEqual({ geometry: [[36.8, -1.2], [36.81, -1.21]], distanceM: 1234 });
    expect(parseOsrm({ code: "NoRoute" })).toBeNull();
  });

  it("builds search results with a sub line", () => {
    const res = parsePhotonSearch({
      features: [
        {
          properties: { name: "Sarit Centre", street: "Karuna Road", district: "Westlands", city: "Nairobi" },
          geometry: { coordinates: [36.8, -1.26] },
        },
        { properties: {}, geometry: { coordinates: [36.8, -1.26] } },
      ],
    });
    expect(res).toEqual([{ label: "Sarit Centre", sub: "Karuna Road, Westlands, Nairobi", lng: 36.8, lat: -1.26 }]);
  });

  it("names a reverse result", () => {
    expect(parsePhotonReverse({ features: [{ properties: { street: "Mogotio Road" } }] })).toEqual({
      label: "Mogotio Road",
    });
    expect(parsePhotonReverse({})).toEqual({ label: "" });
  });
});

describe("search merge", async () => {
  const { mergeResults, parseNominatim, parseOrsGeocode } = await import("@/lib/server/providers");
  it("dedupes the same place within 150 m and puts Kenya first", () => {
    const merged = mergeResults([
      [
        { label: "Sarit Centre", sub: "Westlands", lng: 36.8021, lat: -1.2612, cc: "ke" },
        { label: "Sarit", sub: "", lng: 10, lat: 50, cc: "de" },
      ],
      [
        { label: "Sarit Centre", sub: "Nairobi", lng: 36.8025, lat: -1.2615, cc: "ke" },
        { label: "Kangemi Stage", sub: "Kangemi", lng: 36.75, lat: -1.267, cc: "ke" },
      ],
    ]);
    expect(merged.map((r) => r.label)).toEqual(["Sarit Centre", "Kangemi Stage", "Sarit"]);
    expect(merged[0]).toEqual({ label: "Sarit Centre", sub: "Westlands", lng: 36.8021, lat: -1.2612 });
  });
  it("reads ORS and Nominatim rows", () => {
    expect(
      parseOrsGeocode({
        features: [{ properties: { name: "Kangemi", locality: "Nairobi", country_a: "KEN" }, geometry: { coordinates: [36.75, -1.26] } }],
      }),
    ).toEqual([{ label: "Kangemi", sub: "Nairobi", lng: 36.75, lat: -1.26, cc: "ke" }]);
    expect(
      parseNominatim([{ lat: "-1.26", lon: "36.80", name: "Sarit Centre", address: { road: "Karuna Road", city: "Nairobi", country_code: "ke" } }]),
    ).toEqual([{ label: "Sarit Centre", sub: "Karuna Road, Nairobi", lng: 36.8, lat: -1.26, cc: "ke" }]);
    expect(parseNominatim({})).toEqual([]);
  });
});
