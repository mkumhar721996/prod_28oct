import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assigneeLabel,
  createPlan,
  formatDate,
  parseDate,
  saveStartDate,
  START_DATE_ERROR,
  startDateSavedMessage,
  toInputDate,
} from "./hires";

afterEach(() => vi.unstubAllGlobals());

describe("parseDate", () => {
  it("turns DD/MM/YYYY into an ISO date", () => {
    expect(parseDate("08/12/2026")).toBe("2026-12-08");
    expect(parseDate(" 1/12/2026 ")).toBe("2026-12-01");
  });

  it("rejects text and days that are not on the calendar", () => {
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("2026-12-08")).toBeNull();
    expect(parseDate("")).toBeNull();
  });
});

describe("date formatting", () => {
  it("prints an ISO date in full, without timezone drift (AC2)", () => {
    expect(formatDate("2026-11-01")).toBe("1 November 2026");
    expect(formatDate("2026-12-08")).toBe("8 December 2026");
  });

  it("fills the input as DD/MM/YYYY", () => {
    expect(toInputDate("2026-12-01")).toBe("01/12/2026");
  });

  it("words the saved message", () => {
    expect(startDateSavedMessage("2026-12-08")).toBe(
      "Start date saved as 8 December 2026. Every due date moved with it.",
    );
    expect(START_DATE_ERROR).toBe("Enter a start date like 08/12/2026.");
  });
});

describe("assigneeLabel", () => {
  it("shows the assignee, or a plain word when there is none", () => {
    expect(assigneeLabel("Dana Lee")).toBe("Dana Lee");
    expect(assigneeLabel("")).toBe("Unassigned");
  });
});

describe("client helpers", () => {
  it("createPlan reports a refusal with the API message and kind (AC7, AC8)", async () => {
    const body = { code: "no_manager", message: "Plan not created: this hire has no manager." };
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 422, json: async () => body })));
    expect(await createPlan("hire-1")).toEqual({ ok: false, kind: "no_manager", message: body.message });
  });

  it("createPlan succeeds with the plan id", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 201, json: async () => ({ planId: "p1" }) })));
    expect(await createPlan("hire-1")).toEqual({ ok: true });
  });

  it("never throws when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    expect(await createPlan("hire-1")).toMatchObject({ ok: false, kind: "error" });
    expect(await saveStartDate("hire-1", "2026-12-08")).toMatchObject({ ok: false });
  });

  it("saveStartDate sends the ISO date with the session cookie", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await saveStartDate("hire-1", "2026-12-08")).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/hires/hire-1");
    expect(init).toMatchObject({ method: "PATCH", credentials: "include" });
    expect(JSON.parse(init.body as string)).toEqual({ startDate: "2026-12-08" });
  });
});
