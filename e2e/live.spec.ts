import { expect, test } from "@playwright/test";
import { exampleLink, shot } from "./helpers";

test("live link shows the off state or the watch screen", async ({ page }) => {
  const link = await exampleLink(page);
  const d = link.split("?d=")[1];
  await page.goto(`/live/AbCdEfGhIjKlMnOpQrStUv?d=${d}&n=Wanjiru`);
  const off = page.getByRole("heading", { name: "Live sharing is off" });
  const watching = page.getByText(/Waiting for .* to start sharing|is sharing|Last seen/);
  await expect(off.or(watching).first()).toBeVisible({ timeout: 30_000 });
  if (await off.isVisible()) {
    await expect(page.getByRole("link", { name: "Watch the route" })).toHaveAttribute("href", /^\/r\?d=/);
  }
  await shot(page, "live", (await off.isVisible()) ? "Live sharing is not configured" : "Watching a live trip");
});

test("a broken live id shows a friendly page", async ({ page }) => {
  await page.goto("/live/short");
  await expect(page.getByRole("heading", { name: "This live link does not work" })).toBeVisible();
});
