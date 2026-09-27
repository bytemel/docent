import { describe, expect, it } from "vitest";
import { appPath } from "@/lib/native";

describe("links that open in the app", () => {
  it("keeps site links to routes, directions, here and live pages", () => {
    expect(appPath("https://docent-drab.vercel.app/r?d=abc")).toBe("/r?d=abc");
    expect(appPath("https://docent-drab.vercel.app/go?to=36.8,-1.26,Sarit")).toBe("/go?to=36.8,-1.26,Sarit");
    expect(appPath("https://docent-drab.vercel.app/here?name=Wanjiru")).toBe("/here?name=Wanjiru");
    expect(appPath("https://docent-drab.vercel.app/live/gf1gtXjHKPMqNnWVX1mCKwvY?d=x&n=A")).toBe(
      "/live/gf1gtXjHKPMqNnWVX1mCKwvY?d=x&n=A",
    );
    expect(appPath("https://docent-drab.vercel.app/")).toBe("/");
  });

  it("reads the docent scheme", () => {
    expect(appPath("docent://go?to=36.8,-1.26")).toBe("/go?to=36.8,-1.26");
    expect(appPath("docent://r?d=abc")).toBe("/r?d=abc");
    expect(appPath("docent://live/abcdefghijklmnopqrstuv?d=1")).toBe("/live/abcdefghijklmnopqrstuv?d=1");
    expect(appPath("docent:///go")).toBe("/go");
  });

  it("refuses other hosts, schemes and paths", () => {
    expect(appPath("https://evil.example/go")).toBeNull();
    expect(appPath("http://docent-drab.vercel.app/go")).toBeNull();
    expect(appPath("javascript:alert(1)")).toBeNull();
    expect(appPath("https://docent-drab.vercel.app/api/route?x=1")).toBeNull();
    expect(appPath("docent://api/route")).toBeNull();
    expect(appPath("docent://live/../api")).toBe("/live/api");
    expect(appPath("not a url")).toBeNull();
  });
});
