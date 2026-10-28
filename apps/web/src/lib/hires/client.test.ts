import { afterEach, describe, expect, it, vi } from "vitest";
import { sendInvite } from "./client";

const DUPLICATE_EMAIL_MESSAGE = "A hire with this email already exists. Use a different email.";

const input = { name: "Ada", email: "ada@example.com", role: "Engineer", startDate: "2026-11-02" };
const FORM_ERROR = "We couldn't send the invite. Try again.";

function stubFetch(impl: () => Promise<unknown>) {
  const fn = vi.fn(impl);
  vi.stubGlobal("fetch", fn);
  return fn;
}
const reply = (status: number, body: unknown) =>
  Promise.resolve({ status, ok: status < 300, json: () => Promise.resolve(body) });

afterEach(() => vi.unstubAllGlobals());

describe("sendInvite", () => {
  it("posts JSON to /api/hires and resolves the created hire on 201", async () => {
    const hire = { id: "1", ...input, status: "invited" };
    const fn = stubFetch(() => reply(201, hire));
    await expect(sendInvite(input)).resolves.toEqual({ ok: true, hire });
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/hires");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(input);
  });

  it("maps 409 to the duplicate email error", async () => {
    stubFetch(() => reply(409, { errors: { email: DUPLICATE_EMAIL_MESSAGE } }));
    await expect(sendInvite(input)).resolves.toEqual({
      ok: false,
      status: 409,
      errors: { email: DUPLICATE_EMAIL_MESSAGE },
    });
  });

  it("maps 400 field errors", async () => {
    stubFetch(() => reply(400, { errors: { role: "Choose a role." } }));
    await expect(sendInvite(input)).resolves.toMatchObject({ ok: false, status: 400, errors: { role: "Choose a role." } });
  });

  it("resolves with a form error on a 5xx", async () => {
    stubFetch(() => reply(500, {}));
    await expect(sendInvite(input)).resolves.toEqual({ ok: false, status: 500, errors: {}, formError: FORM_ERROR });
  });

  it("resolves with a form error when fetch rejects", async () => {
    stubFetch(() => Promise.reject(new Error("offline")));
    await expect(sendInvite(input)).resolves.toMatchObject({ ok: false, errors: {}, formError: FORM_ERROR });
  });

  it("resolves with a form error on an unparseable body", async () => {
    stubFetch(() => Promise.resolve({ status: 400, ok: false, json: () => Promise.reject(new Error("bad")) }));
    await expect(sendInvite(input)).resolves.toMatchObject({ ok: false, status: 400, formError: FORM_ERROR });
  });
});
