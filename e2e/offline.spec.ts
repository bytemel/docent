import { expect, test } from "@playwright/test";
import { exampleLink, shot } from "./helpers";

test("a route opened once still plays offline", async ({ page, context }) => {
  test.skip(process.env.E2E_DEV === "1", "The service worker only runs on a production build");
  test.setTimeout(120_000);
  const link = await exampleLink(page);
  await page.goto(link);
  await expect(page.getByRole("heading", { level: 1, name: "Directions to Wanjiru's place" })).toBeVisible();
  await expect(page.getByText("Saved on this phone. It plays without data too.")).toBeVisible({ timeout: 45_000 });
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null || false, null, { timeout: 30_000 }).catch(() => undefined);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Directions to Wanjiru's place" })).toBeVisible();
  await page.waitForTimeout(3000);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Directions to Wanjiru's place" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Watch the route" })).toBeVisible();
  await page.waitForTimeout(2000);
  await shot(page, "offline", "The same route with the network switched off");
  await page.getByRole("button", { name: "Watch the route" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await page.waitForTimeout(2000);
  await shot(page, "offline", "Playing offline");
  await context.setOffline(false);
});
