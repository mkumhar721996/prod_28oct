import { expect, test, type Page } from "@playwright/test";

const items = (page: Page) => page.getByTestId("menu-item");
const badge = (page: Page) => page.getByRole("button", { name: /cart/i }).first().locator(".badge");

test("shows every dish and a chip per category", async ({ page }) => {
  await page.goto("/menu");
  await expect(items(page)).toHaveCount(3);
  for (const name of ["Mains", "Sides", "Drinks"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }
});

test("searches in any case, filters by chip, and combines both", async ({ page }) => {
  await page.goto("/menu");
  await page.getByLabel("Search the menu").fill("COLA");
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).first()).toContainText("Cola");

  await page.getByLabel("Search the menu").fill("");
  await page.getByRole("button", { name: "Mains", exact: true }).click();
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).first()).toContainText("Margherita Pizza");

  await page.getByLabel("Search the menu").fill("cola");
  await expect(page.getByText("No items match")).toBeVisible();
});

test("Clear filters restores the grid", async ({ page }) => {
  await page.goto("/menu");
  await page.getByLabel("Search the menu").fill("zzzz-no-dish");
  await expect(items(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(items(page)).toHaveCount(3);
});

test("the cart count goes 0, 1, 2 as dishes are added", async ({ page }) => {
  await page.goto("/menu");
  await expect(badge(page)).toHaveText("0");
  await page.getByRole("button", { name: "Add to cart" }).first().click();
  await expect(badge(page)).toHaveText("1");
  await page.getByRole("button", { name: "Add to cart" }).first().click();
  await expect(badge(page)).toHaveText("2");
});
