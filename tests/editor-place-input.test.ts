import { describe, expect, it } from "vitest";
import {
  decodeOlc,
  isFullOlc,
  isShortOlc,
  parseCoords,
  parseGoogleUrl,
  parsePlaceInput,
  recoverOlc,
} from "@/lib/placeInput";
import type { LngLat } from "@/lib/types";

const NAIROBI: LngLat = [36.8219, -1.2921];

describe("coordinates", () => {
  it("reads lat, lng as Google shows it", () => {
    expect(parseCoords("-1.2633, 36.8065", NAIROBI)).toEqual([36.8065, -1.2633]);
  });
  it("reads lng, lat and decides by range", () => {
    expect(parseCoords("36.8065,-1.2633", NAIROBI)).toEqual([36.8065, -1.2633]);
    expect(parseCoords("-1.2633 36.8065", NAIROBI)).toEqual([36.8065, -1.2633]);
  });
  it("uses the unambiguous order when one value is over 90", () => {
    expect(parseCoords("120.5, -1.2", NAIROBI)).toEqual([120.5, -1.2]);
  });
  it("rejects nonsense", () => {
    expect(parseCoords("200, 300", NAIROBI)).toBeNull();
    expect(parseCoords("Westlands", NAIROBI)).toBeNull();
  });
});

describe("plus codes", () => {
  it("decodes a full Nairobi code", () => {
    expect(isFullOlc("6GCRPR6C+24")).toBe(true);
    const p = decodeOlc("6GCRPR6C+24")!;
    expect(p.lat).toBeCloseTo(-1.2899375, 6);
    expect(p.lng).toBeCloseTo(36.8203125, 6);
  });
  it("matches the reference example from the spec", () => {
    const p = decodeOlc("7FG49Q00+")!;
    expect(p.lat).toBeCloseTo(20.375, 6);
    expect(p.lng).toBeCloseTo(2.775, 6);
  });
  it("recovers a short code against the map centre", () => {
    expect(isShortOlc("PR6C+24")).toBe(true);
    const p = recoverOlc("PR6C+24", NAIROBI[1], NAIROBI[0])!;
    expect(p.lat).toBeCloseTo(-1.2899375, 6);
    expect(p.lng).toBeCloseTo(36.8203125, 6);
  });
  it("recovers across a cell edge", () => {
    const p = recoverOlc("PR6C+24", -1.31, 36.84)!;
    expect(p.lat).toBeCloseTo(-1.2899375, 6);
  });
  it("rejects bad codes", () => {
    expect(isFullOlc("6GCRPR6C24")).toBe(false);
    expect(decodeOlc("6GCRPR6C+2")).toBeNull();
    expect(isFullOlc("ZZCRPR6C+24")).toBe(false);
  });
  it("parses codes typed with a locality", () => {
    expect(parsePlaceInput("PR6C+24 Nairobi", NAIROBI)).toEqual({
      kind: "pluscode-locality",
      code: "PR6C+24",
      locality: "Nairobi",
    });
    expect(parsePlaceInput("pr6c+24", NAIROBI)).toMatchObject({ kind: "point", source: "pluscode" });
    expect(parsePlaceInput("6GCRPR6C+24", NAIROBI)).toMatchObject({ kind: "point", lat: -1.2899375 });
  });
});

describe("Google Maps links", () => {
  const u = (s: string) => parseGoogleUrl(new URL(s));
  it("reads the @ viewport form with the place name", () => {
    expect(u("https://www.google.com/maps/place/Sarit+Centre/@-1.2612,36.8021,17z")).toEqual({
      lng: 36.8021,
      lat: -1.2612,
      label: "Sarit Centre",
    });
  });
  it("prefers the exact pin in data !3d !4d", () => {
    expect(
      u("https://www.google.com/maps/place/Sarit+Centre/@-1.2600,36.8000,17z/data=!4m6!3m5!1s0x0:0x0!8m2!3d-1.2612337!4d36.8021485"),
    ).toEqual({ lng: 36.8021485, lat: -1.2612337, label: "Sarit Centre" });
  });
  it("reads q, query and ll", () => {
    expect(u("https://maps.google.com/?q=-1.2633,36.8065")).toEqual({ lng: 36.8065, lat: -1.2633 });
    expect(u("https://www.google.com/maps/search/?api=1&query=-1.2633%2C36.8065")).toEqual({ lng: 36.8065, lat: -1.2633 });
    expect(u("https://maps.google.com/maps?ll=-1.2633,36.8065&z=15")).toEqual({ lng: 36.8065, lat: -1.2633 });
  });
  it("returns a search query when the link has only a name", () => {
    expect(u("https://www.google.com/maps/search/?api=1&query=Kangemi+stage")).toEqual({ query: "Kangemi stage" });
  });
  it("ignores other hosts", () => {
    expect(u("https://evil.example/maps/@-1.2,36.8,17z")).toBeNull();
    expect(u("https://www.google.com/search?q=-1.2,36.8")).toBeNull();
  });
  it("spots short links for the server to resolve", () => {
    expect(parsePlaceInput("https://maps.app.goo.gl/AbCdEf123", NAIROBI)).toEqual({
      kind: "shortlink",
      url: "https://maps.app.goo.gl/AbCdEf123",
    });
    expect(parsePlaceInput("goo.gl/maps/xyz", NAIROBI)).toMatchObject({ kind: "shortlink" });
    expect(parsePlaceInput("https://goo.gl/other", NAIROBI)).toBeNull();
  });
  it("leaves plain words for search", () => {
    expect(parsePlaceInput("Westlands", NAIROBI)).toBeNull();
  });
});
