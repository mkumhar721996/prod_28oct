import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, redirect } = vi.hoisted(() => ({
  getSession: vi.fn(),
  redirect: vi.fn((href: string): never => {
    throw new Error(`redirect:${href}`);
  }),
}));
vi.mock("@/lib/session", () => ({ getSession }));
vi.mock("next/navigation", () => ({ redirect }));

import { AlertsScreen } from "@/components/alerts/AlertsScreen";
import AlertsPage from "./page";

beforeEach(() => vi.clearAllMocks());

describe("AlertsPage", () => {
  it("sends a signed-out visitor to sign-in", async () => {
    getSession.mockResolvedValue(null);
    await expect(AlertsPage()).rejects.toThrow("redirect:/sign-in?next=alerts");
  });

  it("renders the alerts screen for a signed-in customer", async () => {
    getSession.mockResolvedValue({ role: "player" });
    expect((await AlertsPage()).type).toBe(AlertsScreen);
  });
});
