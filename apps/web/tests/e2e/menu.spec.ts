import { expect, test } from "@playwright/test";

const items = (page: import("@playwright/test").Page) => page.getByTestId("menu-item");

test("a guest reaches the menu from Home and sees the grid", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "View Menu" }).click();
  await expect(page).toHaveURL(/\/menu$/);
  await expect(page.getByRole("heading", { name: "Menu", level: 1 })).toBeVisible();
  await expect(items(page)).toHaveCount(6);
});

test("searches by name in any case, filters by chip, and combines both", async ({ page }) => {
  await page.goto("/menu");
  await page.getByLabel("Search the menu").fill("CHAI");
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).first()).toContainText("Masala Chai");

  await page.getByLabel("Search the menu").fill("");
  await page.getByRole("button", { name: "Drinks" }).click();
  await expect(items(page)).toHaveCount(2);

  await page.getByLabel("Search the menu").fill("mango");
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).first()).toContainText("Mango Lassi");
});

test("shows No items match, and Clear filters restores the grid", async ({ page }) => {
  await page.goto("/menu");
  await page.getByLabel("Search the menu").fill("zzzz-no-dish");
  await expect(page.getByText("No items match")).toBeVisible();
  await expect(items(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(items(page)).toHaveCount(6);
});

test("Add to cart updates the cart count in the top bar", async ({ page }) => {
  await page.goto("/menu");
  await expect(page.getByTestId("cart-count")).toHaveText("0");
  await page.getByTestId("add-to-cart").first().click();
  await expect(page.getByTestId("cart-count")).toHaveText("1");
});
