import { describe, expect, it } from "vitest";
import {
  NO_FILTERS,
  SAMPLE_GAMES,
  categoriesOf,
  fetchGames,
  filterGames,
  filterReducer,
  type Game,
  loadGames,
  lobbyReducer,
  sortGamesByName,
  type LobbyAction,
  type LobbyState,
} from "./games";

const SORTED = [
  "Blackjack Classic",
  "Dice Duel",
  "European Roulette",
  "Golden Reels",
  "Lucky Sevens",
  "Midnight Blackjack",
  "Neon Roulette",
  "Pyramid Dice",
];

describe("games", () => {
  it("sorts A-Z by name without mutating the sample set", () => {
    expect(sortGamesByName(SAMPLE_GAMES).map((g) => g.name)).toEqual(SORTED);
    expect(SAMPLE_GAMES.map((g) => g.name)).not.toEqual(SORTED);
  });

  it("sorts case-insensitively", () => {
    const names = ["cricket", "Bravo", "apple", "Delta", "Alpha"].map((name, i) => ({
      id: String(i),
      name,
      category: "x",
      available: true,
    }));
    expect(sortGamesByName(names).map((g) => g.name)).toEqual([
      "Alpha",
      "apple",
      "Bravo",
      "cricket",
      "Delta",
    ]);
  });

  it("has an unavailable and an available game", () => {
    expect(SAMPLE_GAMES.some((g) => !g.available)).toBe(true);
    expect(SAMPLE_GAMES.some((g) => g.available)).toBe(true);
  });

  it("fetchGames resolves the sample set", async () => {
    expect(await fetchGames()).toHaveLength(SAMPLE_GAMES.length);
  });

  it("reducer sorts on load", () => {
    const s = lobbyReducer({ status: "loading", games: [] }, { type: "loaded", games: SAMPLE_GAMES.slice() });
    expect(s.games.map((g) => g.name)).toEqual(SORTED);
  });

  it("loadGames: a rejected load fails, and a retry with a working loader shows the sorted grid", async () => {
    let state: LobbyState = { status: "loading", games: [] };
    const dispatch = (a: LobbyAction) => {
      state = lobbyReducer(state, a);
    };
    await loadGames(() => Promise.reject(new Error("down")), dispatch);
    expect(state.status).toBe("error");
    await loadGames(async () => SAMPLE_GAMES.slice(), dispatch);
    expect(state.status).toBe("loaded");
    expect(state.games.map((g) => g.name)).toEqual(SORTED);
  });

  it("failed then retry then loaded", () => {
    const failed = lobbyReducer({ status: "loading", games: [] }, { type: "failed" });
    expect(failed.status).toBe("error");
    const retrying = lobbyReducer(failed, { type: "requested" });
    expect(retrying.status).toBe("loading");
    const loaded = lobbyReducer(retrying, { type: "loaded", games: SAMPLE_GAMES.slice() });
    expect(loaded.status).toBe("loaded");
    expect(loaded.games).toHaveLength(SAMPLE_GAMES.length);
  });
});

describe("game filters", () => {
  const names = (g: Game[]) => g.map((x) => x.name);

  it("matches part of the name, case-insensitively (AC1, AC12)", () => {
    expect(names(filterGames(SAMPLE_GAMES, { search: "dice", category: null })).sort()).toEqual([
      "Dice Duel",
      "Pyramid Dice",
    ]);
    expect(names(filterGames(SAMPLE_GAMES, { search: "LUCKY", category: null }))).toContain("Lucky Sevens");
  });

  it("never matches on category (AC3)", () => {
    expect(filterGames(SAMPLE_GAMES, { search: "slots", category: null })).toEqual([]);
  });

  it("filters by category alone (AC4) and combines with search (AC5)", () => {
    expect(filterGames(SAMPLE_GAMES, { search: "", category: "Dice" }).map((g) => g.category)).toEqual([
      "Dice",
      "Dice",
    ]);
    expect(names(filterGames(SAMPLE_GAMES, { search: "lucky", category: "Slots" }))).toEqual(["Lucky Sevens"]);
    expect(filterGames(SAMPLE_GAMES, { search: "lucky", category: "Dice" })).toEqual([]);
  });

  it("returns every game with no filters and keeps input order", () => {
    expect(filterGames(SAMPLE_GAMES, NO_FILTERS)).toEqual(SAMPLE_GAMES);
  });

  it("updates search text on each change (AC2)", () => {
    expect(filterReducer(NO_FILTERS, { type: "search", text: "lu" }).search).toBe("lu");
  });

  it("switches and deselects category chips (AC13, AC14)", () => {
    const s1 = filterReducer(NO_FILTERS, { type: "toggleCategory", category: "Slots" });
    const s2 = filterReducer(s1, { type: "toggleCategory", category: "Dice" });
    expect(s2.category).toBe("Dice");
    expect(filterGames(SAMPLE_GAMES, s2).every((g) => g.category === "Dice")).toBe(true);
    expect(filterReducer(s1, { type: "toggleCategory", category: "Slots" }).category).toBeNull();
  });

  it("clear resets search and category (AC9-11)", () => {
    const cleared = filterReducer({ search: "zzz", category: "Slots" }, { type: "clear" });
    expect(cleared.search).toBe("");
    expect(cleared.category).toBeNull();
    expect(filterGames(SAMPLE_GAMES, cleared)).toHaveLength(SAMPLE_GAMES.length);
  });

  it("lists each category once", () => {
    expect(categoriesOf(SAMPLE_GAMES)).toEqual(["Blackjack", "Dice", "Roulette", "Slots"]);
  });
});
