"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { fetchGames as defaultFetchGames, lobbyReducer, sortGamesByName, type Game } from "@/lib/games";
import { Icon } from "../orders/Icon";
import { GameGrid } from "./GameGrid";

export type LobbyScreenProps = {
  fetchGames?: () => Promise<Game[]>;
  /** Starting state, to render a given state without effects (tests). */
  initial?: { status: "loading" | "error" | "loaded"; games?: Game[] };
};

export function LobbyScreen({ fetchGames = defaultFetchGames, initial }: LobbyScreenProps) {
  const [state, dispatch] = useReducer(lobbyReducer, {
    status: initial?.status ?? "loading",
    games: sortGamesByName(initial?.games ?? []),
  });
  const started = useRef(initial !== undefined);

  const load = useCallback(() => {
    dispatch({ type: "requested" });
    fetchGames().then(
      (games) => dispatch({ type: "loaded", games }),
      () => dispatch({ type: "failed" }),
    );
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
          Browse every game and its category. You don&apos;t need to sign in to look around.
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
        <GameGrid games={state.games} />
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
