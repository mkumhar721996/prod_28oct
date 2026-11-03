"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  NO_FILTERS,
  categoriesOf,
  fetchGames as defaultFetchGames,
  filterGames,
  filterReducer,
  loadGames,
  lobbyReducer,
  sortGamesByName,
  type Game,
  type GameFilters,
} from "@/lib/games";
import { Icon } from "../orders/Icon";
import { GameGrid } from "./GameGrid";
import { NoGamesFound } from "./NoGamesFound";

export type LobbyScreenProps = {
  fetchGames?: () => Promise<Game[]>;
  /** Starting state, to render a given state without effects (tests). */
  initial?: { status: "loading" | "error" | "loaded"; games?: Game[]; filters?: GameFilters };
};

export function LobbyScreen({ fetchGames = defaultFetchGames, initial }: LobbyScreenProps) {
  const [state, dispatch] = useReducer(lobbyReducer, {
    status: initial?.status ?? "loading",
    games: sortGamesByName(initial?.games ?? []),
  });
  const [filters, dispatchFilters] = useReducer(filterReducer, initial?.filters ?? NO_FILTERS);
  const searchInput = useRef<HTMLInputElement>(null);
  const started = useRef(initial !== undefined);
  const matches = filterGames(state.games, filters);

  const clearFilters = () => {
    dispatchFilters({ type: "clear" });
    searchInput.current?.focus();
  };

  const load = useCallback(() => {
    void loadGames(fetchGames, dispatch);
  }, [fetchGames]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    load();
  }, [load]);

  return (
    <div className="stack stack-4">
      <div className="lobby-title stack stack-1">
        <h1 className="text-3xl font-semibold">Game lobby</h1>
        <p className="text-muted">
          Search by game name and pick a category to find a game quickly.
        </p>
      </div>
      {state.status === "loading" ? (
        <div aria-busy="true" className="stack stack-3">
          <p className="loading-note text-muted" role="status">
            <span className="spinner" aria-hidden="true" /> Loading games…
          </p>
          <ul className="game-grid" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="card stack stack-2">
                <span className="skeleton skeleton-thumb" />
                <span className="skeleton" />
                <span className="skeleton" />
              </li>
            ))}
          </ul>
        </div>
      ) : state.status === "error" ? (
        <LobbyError onRetry={load} />
      ) : (
        <>
          <div className="lobby-search-row">
            <div className="field">
              <label htmlFor="game-search-input">Search games</label>
              <input
                ref={searchInput}
                className="input"
                id="game-search-input"
                type="search"
                placeholder="Search games"
                autoComplete="off"
                value={filters.search}
                onChange={(e) => dispatchFilters({ type: "search", text: e.target.value })}
              />
            </div>
          </div>
          <div className="cluster" role="group" aria-label="Categories">
            {categoriesOf(state.games).map((category) => (
              <button
                key={category}
                type="button"
                className="chip"
                aria-pressed={filters.category === category}
                onClick={() => dispatchFilters({ type: "toggleCategory", category })}
              >
                {category}
              </button>
            ))}
          </div>
          <p className="result-status text-sm text-muted" role="status" aria-live="polite">
            {matches.length === 0 ? "No games found" : `${matches.length} of ${state.games.length} games`}
          </p>
          {matches.length > 0 ? <GameGrid games={matches} /> : <NoGamesFound filters={filters} onClear={clearFilters} />}
        </>
      )}
    </div>
  );
}

function LobbyError({ onRetry }: { onRetry: () => void }) {
  const retry = useRef<HTMLButtonElement>(null);
  useEffect(() => retry.current?.focus(), []);
  return (
    <div className="alert alert-danger" role="alert">
      <Icon name="alert" />
      <div className="stack stack-2">
        <div>
          <strong>We couldn&apos;t load the games.</strong>
          <p>Check your connection and try again.</p>
        </div>
        <div>
          <button ref={retry} type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}
