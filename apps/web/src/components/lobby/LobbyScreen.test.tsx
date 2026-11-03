import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SAMPLE_GAMES } from "@/lib/games";
import { LobbyScreen, type LobbyScreenProps } from "./LobbyScreen";

const render = (initial: LobbyScreenProps["initial"]) =>
  renderToStaticMarkup(<LobbyScreen initial={initial} />);

describe("LobbyScreen", () => {
  it("shows every game with name and category, no sign-in markup", () => {
    const html = render({ status: "loaded", games: SAMPLE_GAMES.slice() });
    for (const g of SAMPLE_GAMES) {
      expect(html).toContain(g.name);
      expect(html).toContain(`>${g.category}</span>`);
    }
    expect(html.match(/class="card game-card/g)).toHaveLength(SAMPLE_GAMES.length);
    expect(html).toContain('aria-label="Games"');
    expect(html).not.toContain("Sign in");
    expect(html).not.toContain('role="alert"');
  });

  it("lists games alphabetically by name", () => {
    const html = render({ status: "loaded", games: SAMPLE_GAMES.slice() });
    const at = (n: string) => html.indexOf(n);
    expect(at("Blackjack Classic")).toBeLessThan(at("Dice Duel"));
    expect(at("Dice Duel")).toBeLessThan(at("Neon Roulette"));
    expect(at("Neon Roulette")).toBeLessThan(at("Pyramid Dice"));
  });

  it("shows a loading indicator instead of the grid", () => {
    const html = render({ status: "loading" });
    expect(html).toContain("Loading games");
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('aria-label="Games"');
  });

  it("shows an error with Retry instead of the grid", () => {
    const html = render({ status: "error" });
    expect(html).toContain('role="alert"');
    expect(html).toContain("We couldn&#x27;t load the games.");
    expect(html).toContain(">Retry<");
    expect(html).not.toContain('aria-label="Games"');
  });
});
