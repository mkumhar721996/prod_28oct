import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, redirect } = vi.hoisted(() => ({
  getSession: vi.fn(),
  redirect: vi.fn((href: string): never => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
}));
vi.mock("@/lib/session", () => ({ getSession }));
vi.mock("next/navigation", () => ({ redirect }));

import Home from "./page";

beforeEach(() => vi.clearAllMocks());

describe("Home", () => {
  it("shows the Stocks dashboard to a signed-in user (AC1)", async () => {
    getSession.mockResolvedValue({ role: "player" });
    const html = renderToStaticMarkup(await Home());
    expect(html).toContain(">Dashboard</h1>");
    expect(html).not.toContain("Next appointment");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor or an expired session to sign-in (AC12)", async () => {
    // getSession resolves null for no session and for a 401/403 (expired) answer.
    getSession.mockResolvedValue(null);
    await expect(Home()).rejects.toThrow(/NEXT_REDIRECT:\/sign-in/);
    expect(redirect).toHaveBeenCalledWith("/sign-in");
  });
});
