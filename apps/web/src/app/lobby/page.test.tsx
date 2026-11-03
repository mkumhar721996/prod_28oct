import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LobbyPage from "./page";

describe("Lobby page", () => {
  it("renders without a session", () => {
    expect(renderToStaticMarkup(<LobbyPage />)).toContain("Game lobby");
  });
});
