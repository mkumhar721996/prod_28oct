import type { Game } from "@/lib/games";
import { Icon } from "../orders/Icon";

export function GameCard({ game }: { game: Game }) {
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
    </li>
  );
}
