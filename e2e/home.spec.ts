import { expect, test } from "@playwright/test";
import { saveSpoken, shot, stubSpeech, watchErrors } from "./helpers";

const FLOW = "home";

test.describe("home page", () => {
  test("shows the promise, the three ways in, and speaks an example", async ({ page }) => {
    await stubSpeech(page);
    const errors = watchErrors(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Directions that talk you to the gate." })).toBeVisible();
    const main = page.getByRole("main");
    await expect(main.getByRole("link", { name: /^Get directions/ }).first()).toHaveAttribute("href", "/go");
    await expect(main.getByRole("link", { name: /^Share a route/ }).first()).toHaveAttribute("href", "/new");
    await expect(main.getByRole("link", { name: /^Ask where they are/ })).toHaveAttribute("href", "/new?ask=1");
    await shot(page, FLOW, "The home page with the two plates and Ask where they are");

    const hear = page.getByRole("button", { name: "Hear an example" });
    await hear.scrollIntoViewIfNeeded();
    await hear.click();
    await expect.poll(async () => (await saveSpokenPeek(page)).length).toBeGreaterThanOrEqual(2);
    const lines = await saveSpoken(page, FLOW, "Hear an example");
    expect(lines[0]).toMatch(/^In \d+ (m|metres|km|kilometres), /);
    await shot(page, FLOW, "Hear an example speaks the direction plate");

    await page.getByRole("link", { name: "Watch an example" }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("link", { name: "Watch an example" })).toHaveAttribute("href", /^\/r\?d=/);
    expect(errors).toEqual([]);
  });

  test("the three plates open the right pages", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("main").getByRole("link", { name: /^Get directions/ }).first().click();
    await expect(page).toHaveURL(/\/go$/);
    await expect(page.getByRole("heading", { name: "Where to?" })).toBeVisible();
    await page.goto("/");
    await page.getByRole("main").getByRole("link", { name: /^Share a route/ }).first().click();
    await expect(page).toHaveURL(/\/new$/);
    await page.goto("/");
    await page.getByRole("main").getByRole("link", { name: /^Ask where they are/ }).click();
    await expect(page).toHaveURL(/\/new/);
  });
});

async function saveSpokenPeek(page: import("@playwright/test").Page) {
  return page.evaluate(() => (window as unknown as { __spoken?: string[] }).__spoken ?? []);
}
