import { describe, expect, it } from "vitest";
import {
  cleanText,
  decodeFrom,
  decodePoint,
  encodeFrom,
  encodePoint,
  hereUrl,
  readFromParams,
  readHereParams,
  replyUrl,
} from "@/app/here/params";

describe("here link params", () => {
  it("round trips a destination with a label that has commas", () => {
    const enc = encodePoint({ lng: 36.80212345, lat: -1.26123456, label: "Sarit Centre, Westlands" });
    expect(enc).toBe("36.80212,-1.26123,Sarit Centre, Westlands");
    expect(decodePoint(enc)).toEqual({ lng: 36.80212, lat: -1.26123, label: "Sarit Centre, Westlands" });
  });

  it("rejects bad destinations", () => {
    expect(decodePoint("200,1")).toBeNull();
    expect(decodePoint("1,95")).toBeNull();
    expect(decodePoint("1e3,1")).toBeNull();
    expect(decodePoint("abc")).toBeNull();
    expect(decodePoint("1".repeat(300))).toBeNull();
    expect(decodePoint(undefined)).toBeNull();
  });

  it("round trips the reply point with accuracy", () => {
    expect(decodeFrom(encodeFrom({ lng: 36.8, lat: -1.26, acc: 12.4 }))).toEqual({ lng: 36.8, lat: -1.26, acc: 12 });
    expect(decodeFrom("36.8,-1.26")).toEqual({ lng: 36.8, lat: -1.26 });
    expect(decodeFrom("36.8,-1.26,-5")).toBeNull();
    expect(decodeFrom("36.8,-1.26,9999999")).toBeNull();
    expect(decodeFrom("36.8")).toBeNull();
  });

  it("cleans names and notes", () => {
    expect(cleanText("  Tim <script>\n", 40)).toBe("Tim script");
    expect(cleanText("x".repeat(50), 40)).toHaveLength(40);
    expect(readHereParams({ n: ["Wanjiku", "x"], to: "36.8,-1.2,Home" })).toEqual({
      name: "Wanjiku",
      to: { lng: 36.8, lat: -1.2, label: "Home" },
    });
  });

  it("builds the ask link and the reply link", () => {
    const ask = hereUrl("https://docent.app", { name: "Tim", to: { lng: 36.8, lat: -1.26, label: "Sarit" } });
    expect(ask).toBe("https://docent.app/here?n=Tim&to=36.80000%2C-1.26000%2CSarit");
    const reply = replyUrl("https://docent.app", {
      from: { lng: 36.75, lat: -1.267, acc: 12 },
      note: "At the Shell petrol station",
      to: { lng: 36.8, lat: -1.26, label: "Sarit" },
    });
    const parsed = readFromParams(new URL(reply).search, "Their location");
    expect(parsed).toEqual({
      from: { lng: 36.75, lat: -1.267, label: "At the Shell petrol station" },
      to: { lng: 36.8, lat: -1.26, label: "Sarit" },
    });
  });

  it("uses the fallback label and ignores a bad to", () => {
    expect(readFromParams("?from=36.75,-1.267&to=bad", "Their location")).toEqual({
      from: { lng: 36.75, lat: -1.267, label: "Their location" },
      to: null,
    });
    expect(readFromParams("?from=999,1", "x")).toBeNull();
  });
});
