import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { APP_ANDROID_URL, CONTACT_EMAIL, DISALLOWED_PATHS, INDEXED_PATHS, isNativeApp, NOINDEX_PATHS, siteUrl } from "@/lib/app";
import { appPage, guide, privacyPage, routesPage, site } from "@/strings/pages";

function strings(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (typeof v === "function") return [];
  if (Array.isArray(v)) return v.flatMap(strings);
  if (v && typeof v === "object") return Object.values(v).flatMap(strings);
  return [];
}

describe("site config", () => {
  it("builds the site URL from env names in order", () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "https://docent.example/" })).toBe("https://docent.example");
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "docent.vercel.app" })).toBe("https://docent.vercel.app");
    expect(siteUrl({})).toBe("http://localhost:3000");
  });
  it("starts with no Android build and a placeholder contact", () => {
    expect(APP_ANDROID_URL).toBeNull();
    expect(CONTACT_EMAIL).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]+$/);
  });
  it("is not the native app in tests", () => {
    expect(isNativeApp()).toBe(false);
  });
  it("lists only the public pages in the sitemap", () => {
    const urls = sitemap().map((e) => new URL(e.url).pathname);
    expect(urls).toEqual(["/", "/how-it-works", "/app", "/privacy"]);
    for (const p of NOINDEX_PATHS) expect(urls).not.toContain(p);
  });
  it("keeps route pages crawlable for link previews and blocks the API", () => {
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule.disallow).toEqual([...DISALLOWED_PATHS]);
    expect(rule.disallow).not.toContain("/r");
    expect(String(r.sitemap)).toMatch(/\/sitemap\.xml$/);
    expect(INDEXED_PATHS).toContain("/privacy");
  });
});

describe("page copy", () => {
  it("has no em or en dashes and no emoji", () => {
    for (const s of strings({ site, routesPage, guide, appPage, privacyPage })) {
      expect(s).not.toMatch(/[–—]/);
      expect(s).not.toMatch(/\p{Emoji_Presentation}/u);
    }
  });
  it("links the header to the three content pages", () => {
    expect(site.nav.map((l) => l.href)).toEqual(["/how-it-works", "/routes", "/app"]);
    expect(guide.chapters.map((c) => c.id)).toEqual(["directions", "share", "offline"]);
  });
  it("names every outside service in the privacy policy", () => {
    const names = privacyPage.third.map((x) => x.name).join(" ");
    for (const n of ["OpenFreeMap", "Photon", "Nominatim", "FOSSGIS", "OpenRouteService", "Vercel", "Supabase"]) expect(names).toContain(n);
    expect(strings(privacyPage).join(" ")).toContain("Kenya Data Protection Act 2019");
  });
});
