import { expect, test, type Page } from "@playwright/test";

// The session endpoints are assumed (the sign-in story defines them). The server-side session
// read hits tests/e2e/mock-session-server.mjs, which is signed in when the `e2e-session` cookie is
// forwarded; the browser-side sign-out call is stubbed with page.route().
async function stubSession(page: Page, signedIn: boolean, signOutStatus = 200) {
  if (signedIn) {
    await page
      .context()
      .addCookies([{ name: "e2e-session", value: "1", url: "http://localhost:3100" }]);
  }
  await page.route("**/session/sign-out", (route) =>
    route.fulfill({ status: signOutStatus, body: "" }),
  );
}

test("signed in: header, brand, sign out and highlighted Home", async ({ page }) => {
  await stubSession(page, true);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("link", { name: "Web App" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  const bar = await page.locator(".shell-bar").boundingBox();
  const out = await page.getByRole("button", { name: "Sign out" }).boundingBox();
  expect(out!.x + out!.width).toBeGreaterThan(bar!.x + bar!.width - 40);
});

test("signed out: brand only, brand goes to sign-in", async ({ page }) => {
  await stubSession(page, false);
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Web App" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await page.getByRole("link", { name: "Web App" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("signed in: brand goes home", async ({ page }) => {
  await stubSession(page, true);
  await page.goto("/elsewhere");
  await page.getByRole("link", { name: "Web App" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("narrow: nav collapses behind Menu, keyboard opens it", async ({ page }) => {
  await stubSession(page, true);
  await page.setViewportSize({ width: 767, height: 800 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Menu" });
  await expect(menu).toBeVisible();
  await expect(page.getByRole("link", { name: "Home" })).toBeHidden();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await menu.focus();
  await page.keyboard.press("Enter");
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
});

test("768px: nav inline, no Menu", async ({ page }) => {
  await stubSession(page, true);
  await page.setViewportSize({ width: 768, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();
  await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
});

test("sign out success shows sign-in", async ({ page }) => {
  await stubSession(page, true);
  await page.goto("/");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("sign out failure shows an error and stays signed in", async ({ page }) => {
  await stubSession(page, true, 500);
  await page.goto("/");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("alert")).toContainText("Sign out failed");
  await expect(page).not.toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("button", { name: "Sign out" })).toBeEnabled();
});
