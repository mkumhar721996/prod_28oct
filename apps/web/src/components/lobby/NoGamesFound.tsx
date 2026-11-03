import type { GameFilters } from "@/lib/games";
import { Icon } from "../orders/Icon";

export function NoGamesFound({ filters, onClear }: { filters: GameFilters; onClear: () => void }) {
  const search = filters.search.trim();
  const parts: string[] = [];
  if (search) parts.push(`the name “${search}”`);
  if (filters.category) parts.push(`the ${filters.category} category`);
  return (
    <div className="empty-state no-games">
      <Icon name="search" />
      <h2>No games found</h2>
      <p className="text-muted">
        {parts.length > 0 ? `No game matches ${parts.join(" in ")}. ` : ""}Change your search or clear the
        filters.
      </p>
      <button type="button" className="btn btn-primary" onClick={onClear}>
        Clear filters
      </button>
    </div>
  );
}
