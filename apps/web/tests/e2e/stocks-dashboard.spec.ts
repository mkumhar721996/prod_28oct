import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page
    .context()
    .addCookies([{ name: "e2e-session", value: "1", url: "http://localhost:3100" }]);
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
});

test("shows every card from the sample data, with the footer", async ({ page }) => {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
  await expect(page.getByText("24,310 pts")).toBeVisible();
  await expect(page.getByLabel(/^Loading /)).toHaveCount(0);
  await expect(page.getByText("₹12,48,600")).toBeVisible();
  for (const heading of ["Market overview", "Holdings", "Watchlist", "Portfolio allocation", "Recent transactions", "Goals", "SIPs"]) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
  await expect(page.getByTestId("insight-status")).toHaveText(["Watch", "Action needed", "On track"]);
  await expect(page.getByRole("contentinfo")).toContainText("Web App");
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
});

test("1M is selected first; choosing a tab changes only the chart", async ({ page }) => {
  await expect(page.getByRole("tab", { name: "1M" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Portfolio +3.4%")).toBeVisible();
  const others = async () => [
    await page.getByRole("region", { name: "Holdings" }).innerText(),
    await page.getByRole("region", { name: "Watchlist" }).innerText(),
  ];
  const before = await others();
  await page.getByRole("tab", { name: "6M" }).click();
  await expect(page.getByText("Portfolio +9.3%")).toBeVisible();
  await expect(page.getByText("Portfolio +3.4%")).toHaveCount(0);
  await page.getByRole("tab", { name: "1Y" }).click();
  await expect(page.getByText("NIFTY 50 +10.9%")).toBeVisible();
  expect(await others()).toEqual(before);
});

test("period tabs move with the arrow keys", async ({ page }) => {
  await page.getByRole("tab", { name: "1M" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "6M" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "6M" })).toBeFocused();
});

test("every action, search and bell is disabled", async ({ page }) => {
  for (const name of ["Buy, coming soon", "Sell, coming soon", "Add funds, coming soon", "Add stock, coming soon", "Create goal, coming soon", "New SIP, coming soon", "Search, coming soon", "Notifications, coming soon", "Review, coming soon"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeDisabled();
  }
  await expect(page.locator(".bell-badge")).toHaveText("3");
});

test("account menu opens, lists disabled Profile and Settings, closes on Escape", async ({ page }) => {
  await page.getByRole("button", { name: "Account" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /Profile/ })).toBeDisabled();
  await expect(page.getByRole("menuitem", { name: /Settings/ })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Account" })).toBeFocused();
});

test("Holdings and SIPs nav entries are disabled", async ({ page }) => {
  for (const key of ["holdings", "sips"]) {
    const entry = page.locator(`[data-nav-key="${key}"]`);
    await expect(entry).toHaveAttribute("aria-disabled", "true");
    await expect(entry).toContainText("Coming soon");
  }
});

test("wide shows the holdings table, narrow shows the list", async ({ page }) => {
  await expect(page.locator(".holdings-table")).toBeVisible();
  await expect(page.locator(".holdings-list")).toBeHidden();
  await page.setViewportSize({ width: 375, height: 800 });
  await expect(page.locator(".holdings-table")).toBeHidden();
  await expect(page.locator(".holdings-list")).toBeVisible();
});
