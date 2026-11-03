import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LobbyPage from "./page";

describe("Lobby page", () => {
  it("is public: no session lookup or redirect", () => {
    const src = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    expect(src).not.toContain("redirect(");
    expect(src).not.toContain("getSession");
    expect(renderToStaticMarkup(<LobbyPage />)).toContain("Game lobby");
  });
});
