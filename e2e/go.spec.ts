import { expect, test, type Page, type Response } from "@playwright/test";
import { exampleLink, lngLatPath, NAIROBI, saveSpoken, shot, spoken, stubSpeech, watchErrors } from "./helpers";

const FLOW = "go";

type Opt = { id: string; geometry: [number, number][]; distanceM: number; labels: string[] };

function km(m: number) {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace(/\.0$/, "")} km`;
}

async function plateDistance(page: Page): Promise<number | null> {
  const txt = await page.locator(".sign .num").first().textContent({ timeout: 2000 }).catch(() => null);
  if (!txt) return null;
  const m = /([\d.]+)\s*(km|m)/.exec(txt.replace(/\s+/g, " "));
  if (!m) return null;
  return Number(m[1]) * (m[2] === "km" ? 1000 : 1);
}

async function plateText(page: Page): Promise<string> {
  const label = await page.locator("button.sign").first().getAttribute("aria-label", { timeout: 2000 }).catch(() => null);
  return (label ?? "").replace(/\. Repeat$/, "");
}

test.describe("get directions", () => {
  test.use({ permissions: ["geolocation"], geolocation: NAIROBI.westlands });

  test("search, choose a route option, start and follow it to the end with voice", async ({ page, context }) => {
    test.setTimeout(240_000);
    await stubSpeech(page);
    const errors = watchErrors(page);
    const options: Opt[][] = [];
    page.on("response", async (r: Response) => {
      if (r.url().includes("/api/route?") && r.url().includes("alt=1") && r.ok()) {
        const body = (await r.json().catch(() => null)) as { routes?: Opt[] } | null;
        if (body?.routes) options.push(body.routes);
      }
    });

    await page.goto("/go");
    await expect(page.getByRole("heading", { name: "Where to?" })).toBeVisible();
    await page.getByRole("searchbox").fill("Sarit Centre");
    const results = page.locator("ul[id$='-list'] button");
    await expect(results.first()).toBeVisible();
    await shot(page, FLOW, "Search for Sarit Centre");
    await results.filter({ hasText: "Sarit" }).first().click();

    const radios = page.getByRole("radio");
    await expect(radios.first()).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole("radiogroup").getByText("Shortest")).toBeVisible();
    await shot(page, FLOW, "Route options with the Shortest label");

    const count = await radios.count();
    if (count > 1) {
      await radios.nth(1).click();
      await expect(radios.nth(1)).toHaveAttribute("aria-checked", "true");
      await shot(page, FLOW, "A second route option picked");
    }
    const pickedText = (await page.getByRole("radio", { checked: true }).textContent()) ?? "";

    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.locator(".sign").first()).toBeVisible({ timeout: 45_000 });
    await page.waitForTimeout(1500);
    await shot(page, FLOW, "Navigation started with the first direction plate");

    const list = options.at(-1) ?? [];
    expect(list.length).toBeGreaterThan(0);
    const route = list.find((o) => pickedText.includes(km(o.distanceM))) ?? list[Math.min(count > 1 ? 1 : 0, list.length - 1)];

    const fixes = lngLatPath(route.geometry, 25);
    const distances: number[] = [];
    const texts = new Set<string>();
    let shotAt = 0;
    for (let i = 0; i < fixes.length; i++) {
      await context.setGeolocation({ ...fixes[i], accuracy: 5 });
      await page.waitForTimeout(450);
      const d = await plateDistance(page);
      if (d !== null) distances.push(d);
      const t = await plateText(page);
      if (t) texts.add(t);
      if (i - shotAt > fixes.length / 3) {
        shotAt = i;
        await shot(page, FLOW, `On the way, plate says ${t || "..."}`);
      }
      if (await page.getByRole("heading", { name: "You have arrived" }).isVisible()) break;
    }
    const end = fixes[fixes.length - 1];
    for (let k = 0; k < 4; k++) {
      await context.setGeolocation({ ...end, accuracy: 5 });
      await page.waitForTimeout(700);
    }
    await expect(page.getByRole("heading", { name: "You have arrived" })).toBeVisible({ timeout: 20_000 });
    await shot(page, FLOW, "You have arrived");

    const lines = await saveSpoken(page, FLOW, "Walking to Sarit Centre");
    let drops = 0;
    for (let i = 1; i < distances.length; i++) if (distances[i] < distances[i - 1]) drops++;
    expect(drops, `plate distances ${distances.join(", ")}`).toBeGreaterThan(3);
    expect(texts.size, [...texts].join(" | ")).toBeGreaterThan(1);
    expect(lines.some((l) => /^In \d+ (metres|kilometres|kilometre)/.test(l)), lines.join(" | ")).toBe(true);
    expect(lines.some((l) => l.startsWith("You have arrived")), lines.join(" | ")).toBe(true);
    expect(errors).toEqual([]);
  });

  test("joins a shared route and speaks its steps", async ({ page }) => {
    await stubSpeech(page);
    const errors = watchErrors(page);
    const link = await exampleLink(page);
    const d = link.split("?d=")[1];
    await page.goto(`/go?d=${d}`);
    await expect(page.getByRole("heading", { level: 1, name: /Wanjiru/ })).toBeVisible();
    await expect(page.getByText("We will guide you to the start first if you are not there.")).toBeVisible();
    await shot(page, FLOW, "A shared route opened in Get directions");
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.locator(".sign").first()).toBeVisible({ timeout: 45_000 });
    await expect.poll(async () => (await spoken(page)).length, { timeout: 20_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(1500);
    await shot(page, FLOW, "Guided to the shared route");
    const lines = await saveSpoken(page, FLOW, "Joining the shared route");
    expect(lines.join(" ")).toMatch(/Join|route|In \d+|Continue|Head|Walk/i);
    expect(errors).toEqual([]);
  });
});
