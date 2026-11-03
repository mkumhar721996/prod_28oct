import { Icon } from "@/components/orders/Icon";

export function NoItemsMatch({ onClear }: { onClear: () => void }) {
  return (
    <div className="empty-state">
      <Icon name="bag" />
      <h2>No items match</h2>
      <p>Try a different search or category.</p>
      <button type="button" className="btn btn-secondary" onClick={onClear}>
        Clear filters
      </button>
    </div>
  );
}
