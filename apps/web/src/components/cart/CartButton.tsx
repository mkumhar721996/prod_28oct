import { forwardRef } from "react";
import { Icon } from "../orders/Icon";

export const CartButton = forwardRef<HTMLButtonElement, { count: number; onClick: () => void }>(
  function CartButton({ count, onClick }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className="btn btn-secondary cart-open-btn"
        aria-label="Open cart"
        onClick={onClick}
      >
        <Icon name="bag" /> Cart <span className="badge badge-neutral">{count}</span>
      </button>
    );
  },
);
