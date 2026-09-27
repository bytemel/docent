import { expect, test } from "@playwright/test";
import { NAIROBI, shot, watchErrors } from "./helpers";

const FLOW = "here";
const ASK_URL = "/here?n=Tim&to=36.80210,-1.26120,Sarit%20Centre";

test.describe("share where I am", () => {
  test.describe("with location allowed", () => {
    test.use({ permissions: ["geolocation"], geolocation: { ...NAIROBI.kangemi, accuracy: 12 } });

    test("shows accuracy and a reply link back to the editor", async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(ASK_URL);
      await expect(page.getByRole("heading", { level: 1, name: "Tim wants to show you the way" })).toBeVisible();
      await expect(page.getByText("Going to Sarit Centre")).toBeVisible();
      await shot(page, FLOW, "The guest opens the ask link");
      await page.getByRole("button", { name: "Share where I am" }).click();
      await expect(page.getByText(/Accurate to about \d+ m/)).toBeVisible({ timeout: 20_000 });
      await page.getByLabel("Anything to help them find you? (optional)").fill("At the Shell petrol station");
      const send = page.getByRole("link", { name: "Send to Tim" });
      await expect(send).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);
      const text = decodeURIComponent((await send.getAttribute("href"))!.split("text=")[1]);
      expect(text).toMatch(/\/new\?from=36\.75\d*%2C-1\.26\d*%2C12&fl=At\+the\+Shell\+petrol\+station&to=/);
      await page.waitForTimeout(1500);
      await shot(page, FLOW, "Location found with accuracy and the reply link");

      const reply = text.replace(/^I am here: /, "");
      await page.goto(new URL(reply).pathname + new URL(reply).search);
      await expect(page.getByRole("heading", { name: "Shape the route" })).toBeVisible({ timeout: 30_000 });
      await expect(page.locator("article h3").first()).toContainText("At the Shell petrol station");
      await page.waitForTimeout(2000);
      await shot(page, FLOW, "The reply opens the editor with their spot as the start");
      expect(errors).toEqual([]);
    });
  });

  test.describe("with location blocked", () => {
    test.use({ permissions: [] });

    test("explains how to turn location on and offers search", async ({ page }) => {
      await page.goto(ASK_URL);
      await page.getByRole("button", { name: "Share where I am" }).click();
      await expect(page.getByRole("heading", { name: "We could not get your location" })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/Android Chrome/)).toBeVisible();
      await expect(page.getByText(/iPhone Safari/)).toBeVisible();
      await expect(page.getByRole("searchbox", { name: "Search for where you are" })).toBeVisible();
      await shot(page, FLOW, "Location blocked: help and search");
    });
  });
});
