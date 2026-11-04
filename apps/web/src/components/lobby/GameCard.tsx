import type { Game } from "@/lib/games";
import { Icon } from "../orders/Icon";

export function GameCard({ game, onPlay }: { game: Game; onPlay: (game: Game) => void }) {
  return (
    <li className={`card game-card${game.available ? "" : " is-unavailable"}`}>
      <div className="game-thumb" aria-hidden="true">
        <Icon name="image" />
      </div>
      <div className="game-name">{game.name}</div>
      <div className="game-meta">
        <span className="text-sm text-muted">{game.category}</span>
        {!game.available && <span className="badge badge-warning">Coming soon</span>}
      </div>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        aria-label={`Play ${game.name}`}
        disabled={!game.available}
        onClick={() => onPlay(game)}
      >
        Play
      </button>
    </li>
  );
}
