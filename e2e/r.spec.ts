import { expect, test } from "@playwright/test";
import { exampleLink, saveSpoken, shot, spoken, stubSpeech, watchErrors } from "./helpers";

const FLOW = "r";

test.describe("route viewer", () => {
  test("intro, start directions, watch with voice, switch view and reach the end card", async ({ page }) => {
    test.setTimeout(150_000);
    await stubSpeech(page);
    const errors = watchErrors(page);
    const link = await exampleLink(page);
    await page.goto(link);
    const overview = page.getByRole("region", { name: "Route overview" });
    await expect(overview.getByRole("heading", { level: 1, name: "Directions to Wanjiru's place" })).toBeVisible();
    await expect(overview.getByText("Distance")).toBeVisible();
    await expect(overview.getByText(/\d+(\.\d)? km/).first()).toBeVisible();
    await expect(overview.getByRole("link", { name: "Start directions" })).toHaveAttribute("href", /^\/go\?d=/);
    await page.waitForTimeout(1500);
    await shot(page, FLOW, "The route opens on an overview with Start directions");

    await page.getByRole("button", { name: "Watch the route" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Animation speed" }).getByRole("button", { name: "1x" })).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(4000);
    await shot(page, FLOW, "Watching the route at 1x");
    await expect.poll(async () => (await spoken(page)).length, { timeout: 30_000 }).toBeGreaterThanOrEqual(3);
    await shot(page, FLOW, "The traveller moves on and the steps are read out");

    const views = page.getByRole("group", { name: "Map view" });
    await views.getByRole("button", { name: "Flat" }).click();
    await expect(views.getByRole("button", { name: "Flat" })).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(1500);
    await shot(page, FLOW, "Flat view");
    await views.getByRole("button", { name: "Simple" }).click();
    await expect(views.getByRole("button", { name: "Simple" })).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(1000);
    await shot(page, FLOW, "Simple view");

    const slider = page.getByRole("slider", { name: "Move through the route" });
    await slider.focus();
    await page.keyboard.press("End");
    await expect(page.getByRole("heading", { name: /You have arrived|You are there/ })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("link", { name: /Open in Google Maps|Google Maps/ })).toBeVisible();
    await page.waitForTimeout(800);
    await shot(page, FLOW, "The end card after moving to the end");
    const lines = await saveSpoken(page, FLOW, "Watching the example route");
    expect(lines.some((l) => /Start at|Turn|Take a matatu|Pass/.test(l)), lines.join(" | ")).toBe(true);
    expect(errors).toEqual([]);
  });
});
