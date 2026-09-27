import { expect, test } from "@playwright/test";
import { saveSpoken, shot, stubSpeech, watchErrors } from "./helpers";

const FLOW = "new";

test.describe("share a route", () => {
  test("Westlands to Kangemi: options, matatu, directions with voice, send and open", async ({ page, context }) => {
    test.setTimeout(180_000);
    await stubSpeech(page);
    const errors = watchErrors(page);
    await page.goto("/new");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.getByRole("heading", { name: "Where does the trip go?" })).toBeVisible();

    const results = page.locator("ul[id$='-list'] button");
    await page.getByRole("searchbox", { name: "Where does the trip start?" }).fill("Westlands");
    await expect(results.first()).toBeVisible();
    await results.filter({ hasText: /^Westlands/ }).first().click();
    await expect(page.locator("#setup-start")).toHaveValue(/Westlands/);
    await page.getByRole("searchbox", { name: "Where are they going?" }).fill("Kangemi");
    await expect(results.first()).toBeVisible();
    await shot(page, FLOW, "Start set, searching for the destination");
    await results.filter({ hasText: /^Kangemi/ }).first().click();

    await expect(page.getByRole("heading", { name: "Shape the route" })).toBeVisible();
    const optionRows = page.getByRole("button", { name: /^Use this route/ });
    await expect(optionRows.first()).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole("complementary").getByText("Shortest", { exact: true }).first()).toBeVisible();
    await shot(page, FLOW, "Route options on the map and in the leg card");

    const leg = page.locator("article").first();
    await leg.getByRole("button", { name: "Matatu" }).click();
    await expect(leg.getByRole("button", { name: "Matatu" })).toHaveAttribute("aria-pressed", "true");
    await expect(leg.locator(".animate-pulse")).toHaveCount(0, { timeout: 45_000 });
    await shot(page, FLOW, "The leg changed to matatu");

    await page.getByRole("button", { name: "Next: check the directions" }).click();
    const plates = page.locator("ol li.sign");
    await expect(plates.first()).toBeVisible();
    expect(await plates.count()).toBeGreaterThan(1);
    await expect(plates.nth(1)).toContainText(/matatu/i);
    await plates.first().getByRole("button", { name: /^Hear it/ }).click();
    await expect.poll(async () => (await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.length))).toBeGreaterThan(0);
    await shot(page, FLOW, "Directions as plates, the first one spoken");
    const lines = await saveSpoken(page, FLOW, "Hear it on the first step");
    expect(lines.at(-1)).toMatch(/^Start at /);

    await page.getByRole("button", { name: "Send the route" }).click();
    await expect(page.getByRole("heading", { name: "Ready to send" })).toBeVisible();
    const link = await page.locator("#share-link").inputValue();
    expect(link).toMatch(/\/r\?d=[A-Za-z0-9_-]+$/);
    await expect(page.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);
    await page.waitForTimeout(3000);
    await shot(page, FLOW, "Send screen with the map snapshot and the link");

    const viewer = await context.newPage();
    await viewer.goto(link);
    await expect(viewer.getByRole("heading", { level: 1, name: /Directions to Kangemi/ })).toBeVisible();
    await expect(viewer.getByText("Matatu").first()).toBeVisible();
    await viewer.waitForTimeout(1500);
    await shot(viewer, FLOW, "The link opens for the guest");
    expect(errors).toEqual([]);
  });

  test("the Ask where they are link opens the ask sheet", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("main").getByRole("link", { name: /^Ask where they are/ }).click();
    await expect(page).toHaveURL(/\/new/);
    await expect(page.getByRole("dialog", { name: "Ask where they are" })).toBeVisible();
  });

  test("the Ask where they are link still opens the ask sheet after visiting Share a route", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("main").getByRole("link", { name: /^Share a route/ }).first().click();
    await expect(page.getByRole("heading", { name: "Where does the trip go?" })).toBeVisible();
    await page.goBack();
    await page.getByRole("main").getByRole("link", { name: /^Ask where they are/ }).click();
    await expect(page).toHaveURL(/\/new/);
    await expect(page.getByRole("dialog", { name: "Ask where they are" })).toBeVisible();
  });

  test("asking while the editor is already open shows the ask sheet", async ({ page }) => {
    await page.goto("/new");
    await expect(page.getByRole("heading", { name: "Where does the trip go?" })).toBeVisible();
    const pushed = await page.evaluate(() => {
      const next = (window as unknown as { next?: { router?: { push(href: string): void } } }).next;
      if (!next?.router) return false;
      next.router.push("/new?ask=1");
      return true;
    });
    test.skip(!pushed, "The Next router is not exposed on this build");
    await expect(page.getByRole("dialog", { name: "Ask where they are" })).toBeVisible();
  });

  test("a shared link stays loaded after the address is tidied", async ({ page }) => {
    await page.goto("/");
    const link = /\/r\?d=[A-Za-z0-9_-]+/.exec(await (await page.request.get("/")).text())![0];
    await page.goto(`/new?d=${link.split("?d=")[1]}`);
    await expect(page.getByRole("heading", { name: "Shape the route" })).toBeVisible();
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/new$/);
    await expect(page.getByRole("heading", { name: "Shape the route" })).toBeVisible();
    await expect(page.locator("article").first()).toBeVisible();
  });

  test("opening /new?ask=1 directly shows the ask sheet with a /here link", async ({ page }) => {
    await page.goto("/new?ask=1");
    const dialog = page.getByRole("dialog", { name: "Ask where they are" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Your name (optional)").fill("Tim");
    await expect(dialog.getByRole("link", { name: "Send on WhatsApp" })).toHaveAttribute("href", /here%3Fn%3DTim/);
    await shot(page, FLOW, "Ask where they are sheet");
  });
});
