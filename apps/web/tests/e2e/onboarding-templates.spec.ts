import { expect, test, type Page } from "@playwright/test";

// Templates live in memory in tests/e2e/mock-session-server.mjs; software engineer is seeded with
// two tasks and 14 plans. Cookies steer the mock: `e2e-session=1` signs in, `e2e-hr=1` makes it HR.
const ORIGIN = "http://localhost:3100";
const MOCK_API = "http://localhost:3101";

test.beforeEach(async ({ request }) => {
  const res = await request.post(`${MOCK_API}/__reset`);
  expect(res.ok()).toBe(true);
});

async function signIn(page: Page, { hr }: { hr: boolean }) {
  const cookies = [{ name: "e2e-session", value: "1", url: ORIGIN }];
  if (hr) cookies.push({ name: "e2e-hr", value: "1", url: ORIGIN });
  await page.context().addCookies(cookies);
}

test("HR creates a template for a role with one task and sees the saved toast", async ({ page }) => {
  await signIn(page, { hr: true });
  await page.goto("/onboarding-templates");
  await page.getByRole("link", { name: "New template" }).click();

  await page.getByLabel("Role").selectOption({ label: "Account manager" });
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Account manager template" })).toBeVisible();

  await page.getByRole("button", { name: "Add task" }).click();
  await page.getByLabel("Task", { exact: true }).fill("Send welcome email");
  await page.getByRole("radio", { name: "HR", exact: true }).check();
  await page.getByRole("radio", { name: "Before start" }).check();
  await page.getByLabel("Days").fill("30");
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("30 days before start")).toBeVisible();

  await page.getByRole("button", { name: "Save template" }).click();
  await expect(page.getByRole("status")).toContainText("Account manager template saved");
  await expect(page.getByRole("heading", { name: "Onboarding templates" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit Account manager template" })).toBeVisible();
});

test("the task drawer refuses a missing owner, a missing due date and day 91", async ({ page }) => {
  await signIn(page, { hr: true });
  await page.goto("/onboarding-templates/software-engineer");
  await expect(page.getByText(/keep their tasks, owners and due dates/)).toBeVisible();

  await page.getByRole("button", { name: "Add task" }).click();
  await page.getByLabel("Task", { exact: true }).fill("Order badge");
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Choose an owner for this task.")).toBeVisible();
  await expect(page.getByText("Set a due date: enter the number of days, like 30.")).toBeVisible();

  await page.getByRole("radio", { name: "IT", exact: true }).check();
  await page.getByLabel("Days").fill("91");
  await page.getByRole("button", { name: "Done" }).click();
  await expect(
    page.getByText("Day 90 is the latest allowed due date. Enter 90 or fewer."),
  ).toBeVisible();
});

test("saving a template with no tasks is refused", async ({ page }) => {
  await signIn(page, { hr: true });
  await page.goto("/onboarding-templates/new?role=customer-support-agent");
  await page.getByRole("button", { name: "Save template" }).click();
  await expect(page.getByRole("alert")).toContainText("Add at least one task before saving.");
});

test("a user who is not HR sees the checklist with no create or edit controls", async ({ page }) => {
  await signIn(page, { hr: false });
  await page.goto("/onboarding-templates");
  await expect(page.getByRole("heading", { name: "Onboarding templates" })).toBeVisible();
  await expect(page.getByRole("button", { name: /new template|edit/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /new template|^edit/i })).toHaveCount(0);

  await page.getByRole("link", { name: "View Software engineer template" }).click();
  await expect(page.getByText("Set up laptop")).toBeVisible();
  await expect(page.getByText("Only HR can change it.")).toBeVisible();
  await expect(page.getByRole("button", { name: /add task|save template|edit task/i })).toHaveCount(0);
});

test("a signed-out visitor is sent to sign-in", async ({ page }) => {
  await page.goto("/onboarding-templates");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fonboarding-templates/);
});
