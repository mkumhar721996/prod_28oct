import { expect, test, type Page } from "@playwright/test";

// Orders data comes from tests/e2e/mock-session-server.mjs (5 per page; 8 active, 6 past orders).
// Cookies steer the mock: `e2e-orders=none | fail-page-2 | slow-page-2`.
const ORIGIN = "http://localhost:3100";

async function signIn(page: Page, orders?: string) {
  const cookies = [{ name: "e2e-session", value: "1", url: ORIGIN }];
  if (orders) cookies.push({ name: "e2e-orders", value: orders, url: ORIGIN });
  await page.context().addCookies(cookies);
}

test("shows Active and Past tabs with rows, newest first", async ({ page }) => {
  await signIn(page);
  await page.goto("/orders");
  await expect(page.getByRole("tab", { name: "Active" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Past" })).toBeVisible();
  const rows = page.locator(".order-row");
  await expect(rows.first()).toContainText("Order title 1060");
  await expect(rows.first()).toContainText("Order #1060");
  await expect(rows.first()).toContainText("Received");
  await expect(rows.nth(1)).toContainText("Order title 1059");
});

test("Fulfilled and Cancelled orders are only under Past", async ({ page }) => {
  await signIn(page);
  await page.goto("/orders");
  await page.getByRole("tab", { name: "Past" }).click();
  await expect(page.getByText("Order title 1052")).toBeVisible();
  await expect(page.getByText("Order title 1051")).toBeVisible();
  await page.getByRole("tab", { name: "Active" }).click();
  await expect(page.getByText("Order title 1052")).toHaveCount(0);
  await expect(page.getByText("Order title 1051")).toHaveCount(0);
});

test("clicking a row does nothing", async ({ page }) => {
  await signIn(page);
  await page.goto("/orders");
  const before = page.url();
  await page.locator(".order-row").first().click();
  await expect(page).toHaveURL(before);
  await expect(page.locator(".order-row").first()).toBeVisible();
});

test("shows a loading indicator while a later page loads", async ({ page }) => {
  await signIn(page, "slow-page-2");
  await page.goto("/orders");
  await page.locator(".order-list").getByRole("listitem").last().scrollIntoViewIfNeeded();
  await expect(page.getByText("Loading more orders")).toBeVisible();
  await expect(page.locator(".order-row")).toHaveCount(8);
});

test("a failed later page keeps loaded rows and can be retried", async ({ page }) => {
  await signIn(page, "fail-page-2");
  await page.goto("/orders");
  await page.locator(".order-list").getByRole("listitem").last().scrollIntoViewIfNeeded();
  await expect(page.getByRole("alert")).toContainText("couldn't load more orders");
  await expect(page.locator(".order-row")).toHaveCount(5);
  await page.context().clearCookies({ name: "e2e-orders" });
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.locator(".order-row")).toHaveCount(8);
});

test("no orders: empty state links to the Menu", async ({ page }) => {
  await signIn(page, "none");
  await page.goto("/orders");
  await expect(page.getByText("You have no orders yet")).toBeVisible();
  await page.getByRole("link", { name: "Browse the menu" }).click();
  await expect(page).toHaveURL(/\/menu$/);
});

test("signed out: redirected to sign-in, never shown Orders", async ({ page }) => {
  await page.goto("/orders");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Forders$/);
  await expect(page.getByRole("tab")).toHaveCount(0);
});
