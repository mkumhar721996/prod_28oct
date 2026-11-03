import { expect, test } from "@playwright/test";

// The server-side session read hits tests/e2e/mock-session-server.mjs, signed in when the
// `e2e-session` cookie is forwarded.
test("signed in: home is the Stocks dashboard", async ({ page }) => {
  await page
    .context()
    .addCookies([{ name: "e2e-session", value: "1", url: "http://localhost:3100" }]);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
});

test("signed out: home shows the sign-in screen", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in/);
});
