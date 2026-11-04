import { expect, test, type Page } from "@playwright/test";

// The page reads /accounts server side and the browser posts /api/transfers; both reach the
// in-memory rules in tests/e2e/mock-session-server.mjs (checking 200, savings 100).
const MOCK_API = "http://localhost:3101";

test.beforeEach(async ({ request }) => {
  expect((await request.post(`${MOCK_API}/__reset`)).ok()).toBe(true);
});

async function open(page: Page, frozen?: "checking" | "savings") {
  const cookies = [{ name: "e2e-session", value: "1", url: "http://localhost:3100" }];
  if (frozen) cookies.push({ name: "e2e-frozen", value: frozen, url: "http://localhost:3100" });
  await page.context().addCookies(cookies);
  await page.goto("/transfer");
}

async function review(page: Page, amount: string) {
  await page.getByLabel("Amount").fill(amount);
  await page.getByRole("button", { name: "Continue" }).click();
}

test("AC1: choosing checking to savings and 50 shows the review summary", async ({ page }) => {
  await open(page);
  await review(page, "50");
  const summary = page.getByTestId("review-summary");
  await expect(summary).toContainText("Checking");
  await expect(summary).toContainText("Savings");
  await expect(summary).toContainText("50");
});

test("AC2: leaving the review without confirming changes nothing", async ({ page }) => {
  await open(page);
  await review(page, "50");
  await page.goto("/transfer");
  await expect(page.getByRole("option", { name: "Checking (balance 200)" }).first()).toBeAttached();
  await expect(page.getByRole("option", { name: "Savings (balance 100)" }).first()).toBeAttached();
});

test("AC3/AC4: confirming updates both balances without a reload, with no dialog", async ({ page }) => {
  const dialogs: string[] = [];
  page.on("dialog", (d) => dialogs.push(d.message()));
  await open(page);
  await review(page, "50");
  await page.getByRole("button", { name: "Confirm transfer" }).click();
  await expect(page.getByRole("status")).toContainText("Transfer complete. 50 moved from Checking to Savings.");
  const tiles = page.locator(".bal-value");
  await expect(tiles).toHaveText(["150", "150"]);
  expect(dialogs).toEqual([]);
});

test("AC5/AC6/AC9: a transfer above the balance is refused with one plain message", async ({ page }) => {
  await open(page);
  await review(page, "250");
  await page.getByRole("button", { name: "Confirm transfer" }).click();
  await expect(page.getByRole("alert")).toContainText("Transfer not made.");
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.locator(".bal-value")).toHaveText(["200", "100"]);
});

for (const [account, label] of [
  ["checking", "Checking"],
  ["savings", "Savings"],
] as const) {
  test(`AC7/AC8: a frozen ${account} account refuses the transfer`, async ({ page }) => {
    await open(page, account);
    await review(page, "50");
    await page.getByRole("button", { name: "Confirm transfer" }).click();
    await expect(page.getByRole("alert")).toContainText("Transfer not made.");
    await expect(page.locator(".bal-label", { hasText: label })).toContainText("Frozen");
    await expect(page.locator(".bal-value")).toHaveText(["200", "100"]);
  });
}
