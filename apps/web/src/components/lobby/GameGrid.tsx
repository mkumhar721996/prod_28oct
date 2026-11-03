import type { Game } from "@/lib/games";
import { GameCard } from "./GameCard";

export function GameGrid({ games }: { games: readonly Game[] }) {
  return (
    <ul className="game-grid" aria-label="Games">
      {games.map((g) => (
        <GameCard key={g.id} game={g} />
      ))}
    </ul>
  );
}
