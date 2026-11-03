import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Orders come from the mock in tests/e2e/mock-session-server.mjs. Cookie `e2e-order=fail-once | slow`
// steers it; the keys it received are read back from its /e2e endpoints. The Order confirmed page
// belongs to another story, so these tests assert the URL only.
const ORIGIN = "http://localhost:3100";
const MOCK = `http://localhost:${process.env.MOCK_SESSION_PORT ?? 3101}`;
const CART = [{ id: "p1", name: "Pizza", unitPrice: 900, quantity: 2, image: "/menu/margherita.svg" }];
const ADDRESS = "12 MG Road, Bengaluru, 560103";

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK}/e2e/reset-orders`);
});

async function open(page: Page, order?: "fail-once" | "slow") {
  const cookies = [{ name: "e2e-session", value: "1", url: ORIGIN }];
  if (order) cookies.push({ name: "e2e-order", value: order, url: ORIGIN });
  await page.context().addCookies(cookies);
  await page.addInitScript((cart) => {
    if (!window.localStorage.getItem("cart")) window.localStorage.setItem("cart", JSON.stringify(cart));
  }, CART);
  await page.goto("/checkout");
  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
}

const keys = async (request: APIRequestContext) => (await request.get(`${MOCK}/e2e/order-keys`)).json();

async function fillDelivery(page: Page) {
  await page.getByLabel("Name").fill("Ana");
  await page.getByLabel("Phone number").fill("0123456789");
  await page.getByLabel("Address").fill(ADDRESS);
}

test("shows the address field for Delivery only and the order summary", async ({ page }) => {
  await open(page);
  await expect(page.getByLabel("Address")).toBeVisible();
  await page.getByRole("radio", { name: "Collection" }).check();
  await expect(page.getByLabel("Address")).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Order summary" })).toContainText("Pizza");
});

test("shows required-field errors only after Place order is pressed", async ({ page }) => {
  await open(page);
  await expect(page.getByText("Enter your address")).toHaveCount(0);
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByText("Enter your name")).toBeVisible();
  await expect(page.getByText(/Enter a phone number/)).toBeVisible();
  await expect(page.getByText("Enter your address")).toBeVisible();
  await expect(page).toHaveURL(/\/checkout$/);
});

test("a guest's POST /api/orders creates nothing", async ({ request }) => {
  const res = await request.post("/api/orders", { data: { lines: [] } });
  expect(res.status()).toBe(401);
});

test("keeps details and cart after a failure, then the same retry is placed", async ({ page, request }) => {
  await open(page, "fail-once");
  await fillDelivery(page);
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByRole("alert")).toContainText("Your order was not placed");
  await expect(page.getByLabel("Name")).toHaveValue("Ana");
  await expect(page.getByLabel("Phone number")).toHaveValue("0123456789");
  await expect(page.getByLabel("Address")).toHaveValue(ADDRESS);
  await expect(page.getByRole("radio", { name: "Delivery" })).toBeChecked();
  await expect(page.getByRole("list", { name: "Order summary" }).getByRole("listitem")).toHaveCount(1);
  expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem("cart") ?? "[]"))).toEqual(CART);

  await page.getByRole("button", { name: "Place order" }).click();
  await page.waitForURL(/\/order-confirmed\?number=1001$/);
  const sent = await keys(request);
  expect(sent).toHaveLength(2);
  expect(sent[1]).toBe(sent[0]);
});

test("an edit after a failure sends a different idempotency key", async ({ page, request }) => {
  await open(page, "fail-once");
  await fillDelivery(page);
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByLabel("Name").fill("Ana B");
  await page.getByRole("button", { name: "Place order" }).click();
  await page.waitForURL(/\/order-confirmed\?number=1001$/);
  const sent = await keys(request);
  expect(sent).toHaveLength(2);
  expect(sent[1]).not.toBe(sent[0]);
});

test("disables Place order while the order is being submitted", async ({ page }) => {
  await open(page, "slow");
  await fillDelivery(page);
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByRole("button", { name: /Placing order/ })).toBeDisabled();
  await page.waitForURL(/\/order-confirmed\?number=1001$/);
});
