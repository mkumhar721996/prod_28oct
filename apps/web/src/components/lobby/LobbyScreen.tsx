"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  fetchGames as defaultFetchGames,
  loadGames,
  lobbyReducer,
  playGame,
  sortGamesByName,
  type Game,
} from "@/lib/games";
import { SIGN_IN_HREF, gameHref } from "@/lib/shell";
import { Icon } from "../orders/Icon";
import { GameGrid } from "./GameGrid";

export type LobbyScreenProps = {
  /** Whether a player is signed in; guests are sent to sign in when they press Play. */
  signedIn: boolean;
  fetchGames?: () => Promise<Game[]>;
  /** Starting state, to render a given state without effects (tests). */
  initial?: { status: "loading" | "error" | "loaded"; games?: Game[] };
  /** Name of a game that failed to open, to render the play error without effects (tests). */
  initialPlayError?: string;
};

export function LobbyScreen({
  signedIn,
  fetchGames = defaultFetchGames,
  initial,
  initialPlayError,
}: LobbyScreenProps) {
  const router = useRouter();
  const [playError, setPlayError] = useState<string | undefined>(initialPlayError);
  const [state, dispatch] = useReducer(lobbyReducer, {
    status: initial?.status ?? "loading",
    games: sortGamesByName(initial?.games ?? []),
  });
  const started = useRef(initial !== undefined);

  const load = useCallback(() => {
    void loadGames(fetchGames, dispatch);
  }, [fetchGames]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    load();
  }, [load]);

  const onPlay = useCallback(
    async (game: Game) => {
      setPlayError(undefined);
      const outcome = await playGame(game, {
        signedIn,
        // router.push never rejects today, so only an unavailable game shows the error in
        // practice; the async seam is for Game play to report a real open failure.
        open: (g) => router.push(gameHref(g.id)),
        goToSignIn: () => router.push(SIGN_IN_HREF),
      });
      if (outcome === "failed") setPlayError(game.name);
    },
    [signedIn, router],
  );

  return (
    <div className="stack stack-4">
      <div className="lobby-title stack stack-1">
        <h1 className="text-3xl font-semibold">Game lobby</h1>
        <p className="text-muted">
          Browse every game and its category. You don&apos;t need to sign in to look around.
        </p>
      </div>
      {playError !== undefined && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" />
          <div>
            <strong>We couldn&apos;t open {playError}.</strong>
            <p>Try again, or pick another game.</p>
          </div>
        </div>
      )}
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
        <GameGrid games={state.games} onPlay={onPlay} />
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
