import { expect, test } from "@playwright/test";

// The server-side reads hit tests/e2e/mock-session-server.mjs (signed in when the `e2e-session`
// cookie is forwarded); the browser-side calls are stubbed with page.route(). Real account
// behaviour is covered by the API e2e (services/api/test/session.e2e-spec.ts).
async function signIn(page: import("@playwright/test").Page) {
  await page
    .context()
    .addCookies([{ name: "e2e-session", value: "1", url: "http://localhost:3100" }]);
}

test("AC10: a signed-out visitor opening the wallet lands on sign-in", async ({ page }) => {
  await page.goto("/wallet");
  await expect(page).toHaveURL(/\/sign-in\?next=wallet$/);
  await expect(page.getByText("Sign in to see your wallet.")).toBeVisible();
});

test("AC4: a signed-in player sees their balance", async ({ page }) => {
  await signIn(page);
  await page.goto("/wallet");
  await expect(page.getByRole("heading", { name: "Wallet" })).toBeVisible();
  await expect(page.locator("main").getByText("1,000 credits")).toBeVisible();
  await expect(page.getByText("Signed in as ana@example.com")).toBeVisible();
});

test("AC3: Sign out in the top bar returns to sign-in", async ({ page }) => {
  await signIn(page);
  await page.route("**/session/sign-out", (route) => route.fulfill({ status: 204, body: "" }));
  await page.goto("/wallet");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("AC8: a wrong password shows the message and keeps the email", async ({ page }) => {
  await page.route("**/session/sign-in", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Email or password incorrect" }),
    }),
  );
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("ana@example.com");
  await page.getByLabel("Password").fill("nope-nope");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toHaveText("Email or password incorrect");
  await expect(page.getByLabel("Email")).toHaveValue("ana@example.com");
  await expect(page.getByLabel("Password")).toHaveValue("");
});

test("History: the nav opens the history page with each entry", async ({ page }) => {
  await signIn(page);
  await page.goto("/wallet");
  await page.getByRole("link", { name: "History" }).first().click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
  await expect(page.getByText("Welcome bonus")).toBeVisible();
  await expect(page.getByText("Bet", { exact: true })).toBeVisible();
});

test("Free credits: a player with 1 credit claims and sees the success message", async ({
  page,
}) => {
  await signIn(page);
  await page
    .context()
    .addCookies([{ name: "e2e-balance", value: "1", url: "http://localhost:3100" }]);
  await page.route("**/api/wallet/top-up", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ balanceCredits: 501, grantedCredits: 500 }),
    }),
  );
  await page.goto("/wallet");
  await expect(page.getByText("Available")).toBeVisible();
  await page.getByRole("button", { name: "Claim free credits" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Free credits claimed" })).toContainText(
    "Free credits claimed: 500 credits. Balance 501 credits.",
  );
});

test("Top bar balance: signed-in player sees it and a top-up updates it without reload", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/wallet");
  const badge = page.locator('[data-wf-id="balance"]');
  await expect(badge).toHaveText("1,000 credits");

  await page
    .context()
    .addCookies([{ name: "e2e-balance", value: "1", url: "http://localhost:3100" }]);
  await page.route("**/api/wallet/top-up", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ balanceCredits: 501, grantedCredits: 500 }),
    }),
  );
  await page.goto("/wallet");
  await expect(badge).toHaveText("1 credit");
  const url = page.url();
  let loaded = false;
  page.on("load", () => (loaded = true));
  await page.getByRole("button", { name: "Claim free credits" }).click();
  await expect(badge).toHaveText("501 credits");
  expect(page.url()).toBe(url);
  expect(loaded).toBe(false);
});

test("Top bar balance: signed-out visitors see no balance", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.locator(".balance-badge")).toHaveCount(0);
});

test("Top bar balance: shows -- when the balance cannot be loaded", async ({ page }) => {
  await signIn(page);
  await page
    .context()
    .addCookies([{ name: "e2e-wallet", value: "fail", url: "http://localhost:3100" }]);
  await page.goto("/history");
  const bar = page.locator(".shell-bar");
  await expect(bar.locator(".badge-danger")).toContainText("--");
  await expect(bar.getByText("Balance unavailable")).toBeAttached();
});

test("AC7: a duplicate email shows the alert", async ({ page }) => {
  await page.route("**/session/register", (route) =>
    route.fulfill({ status: 409, contentType: "application/json", body: "{}" }),
  );
  await page.goto("/register");
  await page.getByLabel("Email").fill("ana@example.com");
  await page.getByLabel("Password").fill("play-2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator("#rg-email-err")).toContainText("An account with this email already exists");
  await expect(page.getByRole("alert")).toHaveCount(0);
});
