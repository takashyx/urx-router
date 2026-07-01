import { test, expect, type Page } from "@playwright/test";

// The console runs against the factory plan (sends present), so we do NOT seed
// "empty" here — the CH → MIX sends the FIXED / Pan-Link locks act on exist.
const strip = (page: Page, name: string) =>
  page.locator(".con-strip", { has: page.getByText(name, { exact: true }) });
const param = (page: Page, label: string) => page.locator("#inspector .param", { hasText: label });
const openMix1 = (page: Page) =>
  page.locator(".con-modepick").getByRole("button", { name: "MIX 1", exact: true }).click();

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("urx-lang", "en");
    localStorage.setItem("urx-theme", "dark");
    localStorage.setItem("urx-model", "URX44V");
  });
  await page.goto("/");
  await expect(page.locator("#model-picker")).toHaveValue("URX44V");
});

test("FIXED BUS Type locks the console send fader read-only", async ({ page }) => {
  // Set MIX 1 to FIXED in the graph inspector, then view its send tab.
  await page.locator('g.node[data-id="bus.mix1"]').click();
  await param(page, "BUS Type").locator("select").selectOption("1"); // FIXED
  await page.click("#btn-view-console");
  await openMix1(page);

  const fader = strip(page, "CH 1").locator(".con-fader");
  await expect(fader).toHaveClass(/readonly/);
  await expect(fader).toHaveAttribute("aria-disabled", "true");
});

test("VARI (default) leaves the console send fader editable", async ({ page }) => {
  await page.click("#btn-view-console");
  await openMix1(page);
  await expect(strip(page, "CH 1").locator(".con-fader")).not.toHaveClass(/readonly/);
});

test("Pan Link locks the console send pan knob read-only", async ({ page }) => {
  await page.locator('g.node[data-id="bus.mix1"]').click();
  await param(page, "Pan Link").locator("button", { hasText: "ON" }).click();
  await page.click("#btn-view-console");
  await openMix1(page);

  const knob = strip(page, "CH 1").locator(".con-knob[aria-label='PAN']");
  await expect(knob).toHaveClass(/readonly/);
  await expect(knob).toHaveAttribute("aria-disabled", "true");
});

test("a FIXED MIX bus leaves the MAIN tab (STEREO main path) fader editable", async ({ page }) => {
  await page.locator('g.node[data-id="bus.mix1"]').click();
  await param(page, "BUS Type").locator("select").selectOption("1"); // FIXED
  await page.click("#btn-view-console"); // stays on MAIN
  // FIXED gates the MIX send level, not the channel's → STEREO main fader.
  await expect(strip(page, "CH 1").locator(".con-fader")).not.toHaveClass(/readonly/);
});
