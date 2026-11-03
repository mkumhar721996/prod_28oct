import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SEEDED_MENU } from "@/lib/menu";

const { getSession, redirect } = vi.hoisted(() => ({ getSession: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession }));
vi.mock("next/navigation", () => ({ redirect }));

import MenuPage from "./page";

describe("Menu page", () => {
  it("renders the seeded dishes for a guest without redirecting", () => {
    getSession.mockResolvedValue(null);
    const html = renderToStaticMarkup(<MenuPage />);
    for (const d of SEEDED_MENU) expect(html).toContain(d.name);
    expect(html.match(/data-testid="menu-item"/g)).toHaveLength(SEEDED_MENU.length);
    expect(redirect).not.toHaveBeenCalled();
  });
});
