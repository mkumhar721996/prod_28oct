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
  await expect(page.getByText("1,000 credits")).toBeVisible();
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
  await expect(page.getByText("Email or password is incorrect")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue("ana@example.com");
  await expect(page.getByLabel("Password")).toHaveValue("");
});

test("Sign in: empty submit shows both inline required messages and a link to register", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("link", { name: "Create an account" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Enter your email")).toBeVisible();
  await page.getByLabel("Email").fill("ana@example.com");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Enter your password")).toBeVisible();
});

test("Sign in: the failed message goes away once the correct details are submitted", async ({
  page,
}) => {
  let attempts = 0;
  let releaseSecond!: () => void;
  const secondHeld = new Promise<void>((resolve) => {
    releaseSecond = resolve;
  });
  await page.route("**/session/sign-in", async (route) => {
    attempts += 1;
    if (attempts === 1) {
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Email or password incorrect" }),
      });
    }
    // Hold the second response so the page state while it is pending can be checked.
    await secondHeld;
    await signIn(page);
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("ana@example.com");
  await page.getByLabel("Password").fill("nope-nope");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Email or password is incorrect")).toBeVisible();
  await page.getByLabel("Password").fill("play-2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  // Still on Sign in with the request pending: the failed message is already gone.
  await expect(page.getByRole("button", { name: "Signing in…" })).toBeVisible();
  await expect(page.getByText("Email or password is incorrect")).toHaveCount(0);
  releaseSecond();
  await expect(page).toHaveURL(/\/wallet/);
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
