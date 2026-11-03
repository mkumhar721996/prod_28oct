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
  it("renders for a guest and passes signedIn false", async () => {
    getSession.mockResolvedValue(null);
    expect((await LobbyPage()).props.signedIn).toBe(false);
    expect(await render()).toContain("Game lobby");
  });

  it("renders for a signed-in player and passes signedIn true", async () => {
    getSession.mockResolvedValue({ role: "player" });
    expect((await LobbyPage()).props.signedIn).toBe(true);
    expect(await render()).toContain("Game lobby");
  });

  it("treats a failing session lookup as a guest", async () => {
    getSession.mockRejectedValue(new Error("down"));
    expect((await LobbyPage()).props.signedIn).toBe(false);
    expect(await render()).toContain("Game lobby");
  });
});
