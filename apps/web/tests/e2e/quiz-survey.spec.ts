import { expect, test } from "@playwright/test";

test("steps through, survives reload and leave-and-return, then completes", async ({ page }) => {
  await page.goto("/quiz-fixture");
  const next = page.getByRole("button", { name: "Next" });
  await expect(next).toBeDisabled();

  await page.getByRole("radio", { name: "Developer" }).check();
  await page.reload();
  await expect(page.getByRole("radio", { name: "Developer" })).toBeChecked();

  await next.click();
  await expect(page.getByText("How do you work?")).toBeVisible();
  await page.goto("/");
  await page.goto("/quiz-fixture");
  await expect(page.getByText("How do you work?")).toBeVisible();

  await page.getByRole("radio", { name: "Solo" }).check();
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.getByRole("status")).toContainText("completed");
  await page.reload();
  await expect(page.getByRole("status")).toContainText("completed");
});
