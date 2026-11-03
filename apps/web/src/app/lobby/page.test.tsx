import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/session", () => ({ getSession: () => getSession() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import LobbyPage from "./page";

async function render() {
  return renderToStaticMarkup(await LobbyPage());
}

describe("Lobby page", () => {
  it("renders without a session", async () => {
    getSession.mockResolvedValue(null);
    expect(await render()).toContain("Game lobby");
  });

  it("renders for a signed-in player", async () => {
    getSession.mockResolvedValue({ role: "player" });
    expect(await render()).toContain("Game lobby");
  });

  it("still renders when the session lookup throws", async () => {
    getSession.mockRejectedValue(new Error("down"));
    expect(await render()).toContain("Game lobby");
  });
});
