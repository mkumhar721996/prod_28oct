export type Game = { id: string; name: string; category: string; available: boolean };

/** Placeholder sample set, deliberately unsorted: no games API exists yet (same pattern as MENU_ITEMS). */
export const SAMPLE_GAMES: readonly Game[] = [
  { id: "g1", name: "Neon Roulette", category: "Roulette", available: true },
  { id: "g2", name: "Golden Reels", category: "Slots", available: true },
  { id: "g3", name: "Blackjack Classic", category: "Blackjack", available: true },
  { id: "g4", name: "Pyramid Dice", category: "Dice", available: false },
  { id: "g5", name: "Lucky Sevens", category: "Slots", available: true },
  { id: "g6", name: "Dice Duel", category: "Dice", available: true },
  { id: "g7", name: "Midnight Blackjack", category: "Blackjack", available: false },
  { id: "g8", name: "European Roulette", category: "Roulette", available: true },
];

/** A-Z by name, case-insensitive English; returns a new array. */
export function sortGamesByName(games: readonly Game[]): Game[] {
  return [...games].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

/** Resolves the sample set; a real API can replace this without touching the UI. */
export async function fetchGames(): Promise<Game[]> {
  return SAMPLE_GAMES.slice();
}

export type LobbyState = { status: "loading" | "error" | "loaded"; games: Game[] };

export type LobbyAction =
  | { type: "requested" }
  | { type: "failed" }
  | { type: "loaded"; games: Game[] };

/** One load attempt: used for the first load and for Retry. */
export async function loadGames(
  fetchGames: () => Promise<Game[]>,
  dispatch: (action: LobbyAction) => void,
): Promise<void> {
  dispatch({ type: "requested" });
  try {
    dispatch({ type: "loaded", games: await fetchGames() });
  } catch {
    dispatch({ type: "failed" });
  }
}

export type PlayOutcome = "opened" | "sign-in" | "unavailable" | "failed";

/**
 * What pressing Play does: guests sign in first; a "Coming soon" game opens nothing (the card's
 * button is disabled, this is the guard behind it); an open that throws is "failed".
 */
export async function playGame(
  game: Game,
  deps: {
    signedIn: boolean;
    open: (game: Game) => Promise<void> | void;
    goToSignIn: () => void;
  },
): Promise<PlayOutcome> {
  if (!deps.signedIn) {
    try {
      deps.goToSignIn();
    } catch (error) {
      console.error(`Could not go to sign-in from game ${game.id}`, error);
    }
    return "sign-in";
  }
  if (!game.available) return "unavailable";
  try {
    await deps.open(game);
    return "opened";
  } catch (error) {
    console.error(`Could not open game ${game.id}`, error);
    return "failed";
  }
}

export function lobbyReducer(state: LobbyState, action: LobbyAction): LobbyState {
  switch (action.type) {
    case "requested":
      return { ...state, status: "loading" };
    case "failed":
      return { ...state, status: "error" };
    case "loaded":
      return { status: "loaded", games: sortGamesByName(action.games) };
  }
}
