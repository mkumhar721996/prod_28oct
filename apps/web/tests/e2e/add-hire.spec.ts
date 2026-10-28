import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const DUPLICATE = "A hire with this email already exists. Use a different email.";

async function fillValid(page: Page, email = "ada@example.com") {
  await page.getByLabel("Full name").fill("Ada Lovelace");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Role").selectOption("Engineer");
  await page.getByLabel("Start date").fill("2026-11-02");
}

// The /hr page lists hires on the server, so the list comes from tests/e2e/records-api-stub.mjs.
const STUB_URL = "http://localhost:4100/__state";
const seed = (request: APIRequestContext, state: object) => request.put(STUB_URL, { data: state });

test.beforeEach(({ request }) => seed(request, { hires: [] }));

// Only the browser's POST is stubbed here; the list is not (see above).
async function stubHires(page: Page, onPost: () => void = () => {}, status = 201) {
  await page.route("**/api/hires", async (route) => {
    onPost();
    if (status === 201) return route.fulfill({ status, json: { id: "1", status: "invited" } });
    if (status === 409) return route.fulfill({ status, json: { errors: { email: DUPLICATE } } });
    return route.fulfill({ status, json: {} });
  });
}

test.describe("entry points", () => {
  test("header button opens the form when hires exist", async ({ page, request }) => {
    await seed(request, {
      hires: [{ id: "1", name: "Priya Raman", email: "priya@example.com", role: "Engineer", startDate: "2026-11-02", status: "invited" }],
    });
    await page.goto("/hr");
    await expect(page.locator(".empty-state")).toHaveCount(0);
    await page.locator(".page-head").getByRole("link", { name: "Add new hire" }).click();
    await expect(page).toHaveURL(/\/hr\/hires\/new/);
    await expect(page.getByRole("heading", { level: 1, name: "Add new hire" })).toBeVisible();
  });

  test("a failed load shows an error with retry and keeps Add new hire reachable", async ({ page, request }) => {
    await seed(request, { down: true });
    await page.goto("/hr");
    await expect(page.locator(".empty-state")).toHaveCount(0);
    await expect(page.getByRole("alert")).toContainText("We couldn't load the new hires.");
    await expect(page.getByRole("link", { name: "Try again" })).toBeVisible();
    await expect(page.locator(".page-head").getByRole("link", { name: "Add new hire" })).toBeVisible();
  });

  test("empty state action opens the form", async ({ page }) => {
    await page.goto("/hr");
    await page.locator(".empty-state").getByRole("link", { name: "Add new hire" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Add new hire" })).toBeVisible();
  });

  test("form has the four fields and focuses name", async ({ page }) => {
    await page.goto("/hr/hires/new");
    for (const l of ["Full name", "Work email", "Role", "Start date"]) {
      await expect(page.getByLabel(l)).toBeVisible();
    }
    await expect(page.getByLabel("Full name")).toBeFocused();
    await expect(page.getByRole("button", { name: "Send invite" })).toBeEnabled();
  });
});

test.describe("send invite", () => {
  test("posts once, returns to the dashboard and shows the toast", async ({ page }) => {
    let posts = 0;
    await stubHires(page, () => posts++);
    await page.goto("/hr/hires/new");
    await fillValid(page);
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(page).toHaveURL(/\/hr$/);
    await expect(page.getByRole("status")).toHaveText("Invite queued for ada@example.com");
    expect(posts).toBe(1);
    await page.reload();
    await expect(page.getByRole("status")).toHaveCount(0);
  });

  test("invalid submit shows an error per field, keeps values and sends nothing", async ({ page }) => {
    let posts = 0;
    await stubHires(page, () => posts++);
    await page.goto("/hr/hires/new");
    await page.getByLabel("Full name").fill("Ada");
    await page.getByLabel("Work email").fill("nope");
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(page).toHaveURL(/\/hr\/hires\/new$/);
    await expect(page.getByLabel("Full name")).toHaveValue("Ada");
    await expect(page.locator("#e-email")).toHaveText("Enter an email like name@example.com.");
    await expect(page.getByLabel("Work email")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("alert").filter({ hasText: "Fix" })).toContainText(
      "Fix 3 fields before sending the invite.",
    );
    await expect(page.getByRole("alert").filter({ hasText: "Fix" })).toBeFocused();
    expect(posts).toBe(0);
  });

  test("empty form shows four errors", async ({ page }) => {
    await page.goto("/hr/hires/new");
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(page.locator(".field-error:visible")).toHaveCount(4);
    await page.getByLabel("Full name").fill("Ada");
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(page.locator("#e-name")).toBeHidden();
    await expect(page.locator("#e-email")).toBeVisible();
  });

  test("duplicate email shows the 409 message", async ({ page }) => {
    await stubHires(page, () => {}, 409);
    await page.goto("/hr/hires/new");
    await fillValid(page);
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(page.locator("#e-email")).toHaveText(DUPLICATE);
    await expect(page).toHaveURL(/\/hr\/hires\/new$/);
  });

  test("a 500 keeps the values, shows the alert and allows a retry", async ({ page }) => {
    let status = 500;
    await page.route("**/api/hires", (route) =>
      route.fulfill({ status, json: status === 201 ? { id: "1" } : {} }),
    );
    await page.goto("/hr/hires/new");
    await fillValid(page);
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Try again" })).toContainText(
      "We couldn't send the invite. Try again.",
    );
    await expect(page.getByLabel("Full name")).toHaveValue("Ada Lovelace");
    status = 201;
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(page).toHaveURL(/\/hr$/);
  });

  test("double click sends exactly one request", async ({ page }) => {
    let posts = 0;
    await page.route("**/api/hires", async (route) => {
      posts++;
      await new Promise((r) => setTimeout(r, 300));
      await route.fulfill({ status: 201, json: { id: "1" } });
    });
    await page.goto("/hr/hires/new");
    await fillValid(page);
    await page.getByRole("button", { name: "Send invite" }).dblclick();
    await expect(page).toHaveURL(/\/hr$/);
    await expect.poll(() => posts).toBe(1);
  });

  test("hostile text is rendered as text in the toast", async ({ page }) => {
    await page.goto("/hr?invited=%3Cscript%3E");
    await expect(page.getByRole("status")).toHaveText("Invite queued for <script>");
  });
});

test.describe("cancel", () => {
  test("from the dashboard sends nothing and returns", async ({ page }) => {
    let posts = 0;
    await stubHires(page, () => posts++);
    await page.goto("/hr/hires/new");
    await fillValid(page);
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page).toHaveURL(/\/hr$/);
    await expect(page.getByText("Ada Lovelace")).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveCount(0);
    expect(posts).toBe(0);
  });

  test("from the empty state shows the empty dashboard and a blank form on reopen", async ({ page }) => {
    await stubHires(page);
    await page.goto("/hr");
    await page.locator(".empty-state").getByRole("link", { name: "Add new hire" }).click();
    await fillValid(page);
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.locator(".empty-state")).toBeVisible();
    await page.locator(".empty-state").getByRole("link", { name: "Add new hire" }).click();
    await expect(page.getByLabel("Full name")).toHaveValue("");
  });

  for (const from of ["https://evil.example", "//evil.example", "/other", "javascript:alert(1)"]) {
    test(`ignores from=${from}`, async ({ page }) => {
      await page.goto(`/hr/hires/new?from=${encodeURIComponent(from)}`);
      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(page).toHaveURL(/\/hr$/);
    });
  }
});

test.describe("narrow viewport", () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test("menu toggles the nav and long values do not scroll the page", async ({ page }) => {
    await page.goto("/hr/hires/new");
    await expect(page.getByRole("link", { name: "Home" })).toBeHidden();
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
    await page.getByLabel("Full name").fill("x".repeat(200));
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(fits).toBe(true);
  });
});
