import { expect, test, type Page } from "@playwright/test";

// Game data comes from tests/e2e/mock-session-server.mjs: balance 1000 (100 for an id starting with
// `low`), spins alternate win (bet paid back 1x) and loss. Each test uses its own `e2e-game` id.
const ORIGIN = "http://localhost:3100";

async function signIn(page: Page, gameId: string) {
  await page.context().addCookies([
    { name: "e2e-session", value: "1", url: ORIGIN },
    { name: "e2e-game", value: gameId, url: ORIGIN },
  ]);
}

test("picking 250 selects the 250 bet", async ({ page }) => {
  await signIn(page, "pick");
  await page.goto("/play");
  await expect(page.getByRole("radio", { name: "100" })).toBeChecked();
  await page.getByText("250", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "250" })).toBeChecked();
});

test("a spin shows reels, a result message and the new balance", async ({ page }) => {
  await signIn(page, "spin");
  await page.goto("/play");
  await page.getByRole("button", { name: "Spin" }).click();
  await expect(page.getByRole("img", { name: /Reel \d spinning/ })).toHaveCount(3);
  await expect(page.getByText(/You win 100/)).toBeVisible();
  await expect(page.locator(".balance-box strong")).toHaveText("1,000");
  await page.getByRole("button", { name: "Spin" }).click();
  await expect(page.getByText(/No win this time/)).toBeVisible();
  await expect(page.locator(".balance-box strong")).toHaveText("900");
  await expect(page.locator(".jackpot-total")).toHaveText("10.00");
});

test("a balance below the bet does not spin and says so", async ({ page }) => {
  await signIn(page, "low-balance");
  await page.goto("/play");
  await page.getByText("250", { exact: true }).click();
  await page.getByRole("button", { name: "Spin" }).click();
  await expect(page.getByText("Your balance of 100 does not cover a bet of 250. Choose a lower bet.")).toBeVisible();
  await expect(page.getByRole("img", { name: /spinning/ })).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "250" })).toBeChecked();
});

test("after a reload the settled balance is shown", async ({ page }) => {
  await signIn(page, "reload");
  await page.goto("/play");
  await page.getByRole("button", { name: "Spin" }).click();
  await expect(page.getByText(/You win 100/)).toBeVisible();
  await page.getByText("50", { exact: true }).click();
  await page.getByRole("button", { name: "Spin" }).click();
  await expect(page.getByText(/No win this time/)).toBeVisible();
  await page.reload();
  await expect(page.locator(".balance-box strong")).toHaveText("950");
});
