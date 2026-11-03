import { expect, test, type Page } from "@playwright/test";

// Game data comes from tests/e2e/mock-session-server.mjs: balance 1000 (100 with cookie
// `e2e-game-balance=100`), spins alternate win then loss, state is reset before each test.
const ORIGIN = "http://localhost:3100";
const MOCK_API = "http://localhost:3101";

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK_API}/__reset`);
});

async function signIn(page: Page, lowBalance = false) {
  const cookies = [{ name: "e2e-session", value: "1", url: ORIGIN }];
  if (lowBalance) cookies.push({ name: "e2e-game-balance", value: "100", url: ORIGIN });
  await page.context().addCookies(cookies);
}

test("AC1: picking 250 selects it, with 100 selected to begin with", async ({ page }) => {
  await signIn(page);
  await page.goto("/play");
  await expect(page.getByRole("radio", { name: "100" })).toBeChecked();
  await page.getByText("250", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "250" })).toBeChecked();
});

test("AC2/3/5/6: a spin shows reels, a win message, the new balance and a bigger pool", async ({ page }) => {
  await signIn(page);
  await page.goto("/play");
  await expect(page.locator(".jackpot-total")).toHaveText("0.00");
  await page.getByRole("button", { name: "Spin" }).click();
  await expect(page.getByRole("img", { name: /Reel 1 spinning/ })).toBeVisible();
  await expect(page.getByText("You win 100. Two cherries pay 1× your bet.")).toBeVisible();
  await expect(page.getByRole("img", { name: "Reel 3", exact: true })).toHaveText("BAR");
  await expect(page.locator(".balance-box strong")).toHaveText("1,000");
  await expect(page.locator(".jackpot-total")).toHaveText("5.00");
});

test("AC4/5: the second spin is a loss and the balance drops by the bet", async ({ page }) => {
  await signIn(page);
  await page.goto("/play");
  await page.getByRole("button", { name: "Spin" }).click();
  await expect(page.getByText(/You win 100/)).toBeVisible();
  await page.getByRole("button", { name: "Spin" }).click();
  await expect(page.getByText("No win this time. You bet 100. Try again.")).toBeVisible();
  await expect(page.locator(".balance-box strong")).toHaveText("900");
});

test("AC10: balance 100 and bet 250 does not spin and says the balance does not cover the bet", async ({ page }) => {
  await signIn(page, true);
  await page.goto("/play");
  await page.getByText("250", { exact: true }).click();
  await page.getByRole("button", { name: "Spin" }).click();
  await expect(page.getByText("Your balance of 100 does not cover a bet of 250. Choose a lower bet.")).toBeVisible();
  await expect(page.getByRole("img", { name: /spinning/ })).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "250" })).toBeChecked();
  await expect(page.locator(".balance-box strong")).toHaveText("100");
});

test("AC8: reloading after a spin shows the settled balance", async ({ page }) => {
  await signIn(page);
  await page.goto("/play");
  await page.getByRole("button", { name: "Spin" }).click();
  await expect(page.getByText(/You win 100/)).toBeVisible();
  await page.getByRole("button", { name: "Spin" }).click();
  await expect(page.getByText(/No win this time/)).toBeVisible();
  await page.reload();
  await expect(page.locator(".balance-box strong")).toHaveText("900");
  await expect(page.locator(".jackpot-total")).toHaveText("10.00");
});
