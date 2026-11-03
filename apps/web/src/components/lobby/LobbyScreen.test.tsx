import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NO_FILTERS, SAMPLE_GAMES, type GameFilters } from "@/lib/games";
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

describe("LobbyScreen search and filter", () => {
  const games = SAMPLE_GAMES.slice();
  const withFilters = (filters: GameFilters) => render({ status: "loaded", games, filters });
  const cards = (html: string) => html.match(/class="card game-card/g) ?? [];

  it("renders a search field with no submit control, and category chips (AC2)", () => {
    const html = withFilters(NO_FILTERS);
    expect(html).toContain('type="search"');
    expect(html).toContain('for="game-search-input"');
    expect(html).not.toContain('type="submit"');
    expect(html).toContain('aria-label="Categories"');
    expect(html).toContain("8 of 8 games");
  });

  it("filters the grid by name (AC1, AC3, AC12)", () => {
    const html = withFilters({ search: "lu", category: null });
    expect(cards(html)).toHaveLength(1);
    expect(html).toContain("Lucky Sevens");
    expect(html).toContain("1 of 8 games");
    expect(cards(withFilters({ search: "slots", category: null }))).toHaveLength(0);
  });

  it("filters by the selected chip and marks only it pressed (AC4, AC13)", () => {
    const html = withFilters({ search: "", category: "Dice" });
    expect(cards(html)).toHaveLength(2);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Dice</);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Slots</);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  });

  it("combines chip and search (AC5)", () => {
    expect(cards(withFilters({ search: "lucky", category: "Slots" }))).toHaveLength(1);
    expect(cards(withFilters({ search: "lucky", category: "Dice" }))).toHaveLength(0);
  });

  it("shows No games found with Clear filters instead of the grid (AC6, AC8)", () => {
    const html = withFilters({ search: "zzz", category: null });
    expect(html).toContain("No games found");
    expect(html).toContain(">Clear filters<");
    expect(html).not.toContain('aria-label="Games"');
  });

  it("hides No games found when something matches (AC7)", () => {
    const html = withFilters({ search: "lucky", category: null });
    expect(html).not.toContain("No games found");
    expect(html).toContain('aria-label="Games"');
  });

  it("does not render search or chips while loading or on error", () => {
    for (const status of ["loading", "error"] as const) {
      const html = render({ status });
      expect(html).not.toContain('type="search"');
      expect(html).not.toContain("aria-pressed");
    }
  });
});
