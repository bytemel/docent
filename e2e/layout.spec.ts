import { expect, test } from "@playwright/test";
import { exampleLink, noOverflow, shot, watchErrors } from "./helpers";

const SIZES = [
  { name: "390", width: 390, height: 844 },
  { name: "1280", width: 1280, height: 800 },
];

const PAGES: { name: string; path: (d: string) => string; notFound?: boolean }[] = [
  { name: "home", path: () => "/" },
  { name: "go", path: () => "/go" },
  { name: "new", path: () => "/new" },
  { name: "route", path: (d) => `/r?d=${d}` },
  { name: "go-shared", path: (d) => `/go?d=${d}` },
  { name: "here", path: () => "/here?n=Tim" },
  { name: "live", path: (d) => `/live/AbCdEfGhIjKlMnOpQrStUv?d=${d}` },
  { name: "broken-link", path: () => "/r?d=garbage" },
  { name: "not-found", path: () => "/no-such-page", notFound: true },
];

for (const size of SIZES) {
  test.describe(`layout at ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    for (const p of PAGES) {
      test(`${p.name} fits and has no console errors`, async ({ page }) => {
        const errors = watchErrors(page, p.notFound ? [/404/] : []);
        const link = await exampleLink(page);
        await page.goto(p.path(link.split("?d=")[1]));
        await page.waitForLoadState("networkidle").catch(() => undefined);
        await page.waitForTimeout(1500);
        expect(await noOverflow(page)).toBeLessThanOrEqual(0);
        if (size.name === "390" && ["home", "go", "new", "route", "here", "not-found"].includes(p.name)) {
          await shot(page, "layout", `${p.name} at 390 px`);
        }
        expect(errors).toEqual([]);
      });
    }
  });
}
