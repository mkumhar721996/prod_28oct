import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirect, getSession, getWalletHistory } = vi.hoisted(() => ({
  redirect: vi.fn((href: string): never => {
    throw new Error(`redirect:${href}`);
  }),
  getSession: vi.fn(),
  getWalletHistory: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/session", () => ({ getSession, getWalletHistory }));

import HistoryPage from "./page";

beforeEach(() => vi.clearAllMocks());

describe("HistoryPage", () => {
  it("redirects a signed-out visitor to sign-in", async () => {
    getSession.mockResolvedValue(null);
    await expect(HistoryPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "redirect:/sign-in?next=history",
    );
    expect(getWalletHistory).not.toHaveBeenCalled();
  });

  it("renders the heading and asks for the page and range from the URL", async () => {
    getSession.mockResolvedValue({ role: "player" });
    getWalletHistory.mockResolvedValue({ entries: [], page: 2, pageCount: 1, total: 0, range: "all" });
    const html = renderToStaticMarkup(
      await HistoryPage({ searchParams: Promise.resolve({ page: "2", range: "all" }) }),
    );
    expect(html).toContain("History");
    expect(getWalletHistory).toHaveBeenCalledWith(2, "all");
  });

  it("treats a bad page and range as page 1, recent", async () => {
    getSession.mockResolvedValue({ role: "player" });
    getWalletHistory.mockResolvedValue({ entries: [], page: 1, pageCount: 1, total: 0, range: "recent" });
    await HistoryPage({ searchParams: Promise.resolve({ page: "abc", range: "x" }) });
    expect(getWalletHistory).toHaveBeenCalledWith(1, "recent");
  });
});
