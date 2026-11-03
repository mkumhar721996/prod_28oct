import { describe, expect, it } from "vitest";
import {
  SAMPLE_GAMES,
  fetchGames,
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
