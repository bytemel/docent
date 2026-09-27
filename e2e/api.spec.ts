import { expect, test } from "@playwright/test";
import { exampleLink, shot } from "./helpers";

test.describe("API and platform", () => {
  test("route options come back ranked and labelled", async ({ request }) => {
    const res = await request.get("/api/route?profile=foot&points=36.80184%2C-1.26476%3B36.7523%2C-1.26801&alt=1");
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { routes: { id: string; distanceM: number; durationS: number; labels: string[]; geometry: unknown[] }[] };
    expect(body.routes.length).toBeGreaterThanOrEqual(1);
    expect(body.routes[0].labels).toContain("shortest");
    for (const r of body.routes) {
      expect(r.geometry.length).toBeGreaterThan(10);
      expect(r.distanceM).toBeGreaterThan(1000);
      expect(r.durationS).toBeGreaterThan(0);
    }
    const sorted = [...body.routes].map((r) => r.distanceM).sort((a, b) => a - b);
    expect(body.routes.map((r) => r.distanceM)).toEqual(sorted);
    expect(res.headers()["cache-control"]).toContain("public");
  });

  test("bad route input is refused", async ({ request }) => {
    const res = await request.get("/api/route?profile=walk&points=1");
    expect(res.status()).toBe(400);
  });

  test("search finds places in Nairobi", async ({ request }) => {
    const res = await request.get("/api/search?q=Sarit%20Centre&lat=-1.29&lng=36.82");
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { results: { label: string; lng: number; lat: number }[] };
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.results.some((r) => /Sarit/i.test(r.label))).toBe(true);
  });

  test("security headers are set", async ({ request, baseURL }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toContain("geolocation=(self)");
    if (baseURL?.startsWith("https")) expect(h["strict-transport-security"]).toContain("max-age=");
  });

  test("a broken route link shows a friendly page", async ({ page }) => {
    await page.goto("/r?d=garbage");
    await expect(page.getByRole("heading", { level: 1, name: "This link does not work" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Make a route" })).toHaveAttribute("href", "/new");
    await shot(page, "platform", "A broken route link");
  });

  test("unknown pages show the 404 page", async ({ page }) => {
    const res = await page.goto("/this-road-goes-nowhere");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await shot(page, "platform", "The 404 page");
  });

  test("service worker, manifest and share images are served", async ({ request, page }) => {
    const sw = await request.get("/sw.js");
    expect(sw.status()).toBe(200);
    expect(sw.headers()["content-type"]).toMatch(/javascript/);
    const manifest = await request.get("/manifest.webmanifest");
    expect(manifest.status()).toBe(200);
    const m = (await manifest.json()) as { name: string; start_url: string };
    expect(m.name).toMatch(/Docent/);
    const og = await request.get("/opengraph-image");
    expect(og.status()).toBe(200);
    expect(og.headers()["content-type"]).toMatch(/image\//);
    const link = await exampleLink(page);
    await page.goto(link);
    const image = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(image).toBeTruthy();
    const routeOg = await request.get(new URL(image!, page.url()).toString());
    expect(routeOg.status()).toBe(200);
    expect(routeOg.headers()["content-type"]).toMatch(/image\//);
  });
});
