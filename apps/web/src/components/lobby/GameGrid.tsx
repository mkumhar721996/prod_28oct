import type { Game } from "@/lib/games";
import { GameCard } from "./GameCard";

export function GameGrid({
  games,
  onPlay,
}: {
  games: readonly Game[];
  onPlay: (game: Game) => void;
}) {
  return (
    <ul className="game-grid" aria-label="Games">
      {games.map((g) => (
        <GameCard key={g.id} game={g} onPlay={onPlay} />
      ))}
    </ul>
  );
}
