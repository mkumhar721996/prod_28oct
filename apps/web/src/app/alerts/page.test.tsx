import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, getAlerts, redirect } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getAlerts: vi.fn(async () => [{ id: "1" }]),
  redirect: vi.fn((href: string): never => {
    throw new Error(`redirect:${href}`);
  }),
}));
vi.mock("@/lib/session", () => ({ getSession }));
vi.mock("@/lib/alerts", () => ({ getAlerts }));
vi.mock("next/navigation", () => ({ redirect }));

import { AlertsScreen } from "@/components/alerts/AlertsScreen";
import AlertsPage from "./page";
import Loading from "./loading";

beforeEach(() => vi.clearAllMocks());

describe("AlertsPage", () => {
  it("sends a signed-out visitor to sign-in without loading alerts", async () => {
    getSession.mockResolvedValue(null);
    await expect(AlertsPage()).rejects.toThrow("redirect:/sign-in?next=alerts");
    expect(getAlerts).not.toHaveBeenCalled();
  });

  it("renders the screen with the signed-in customer's alerts", async () => {
    getSession.mockResolvedValue({ role: "player" });
    const el = await AlertsPage();
    expect(el.type).toBe(AlertsScreen);
    expect(el.props.initialAlerts).toEqual([{ id: "1" }]);
  });
});

describe("alerts loading", () => {
  it("shows two skeleton rows", () => {
    const el = Loading();
    expect(JSON.stringify(el)).toContain("skeleton");
  });
});
