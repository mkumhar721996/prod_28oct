import type { Cart, CartLine } from "@/lib/cart";
import { QuantityStepper } from "./QuantityStepper";

type AddToCartControlProps = {
  item: Omit<CartLine, "quantity">;
  cart: Cart;
  onAdd: (item: Omit<CartLine, "quantity">) => void;
  onIncrease: (id: string) => void;
  onDecrease: (id: string) => void;
};

/** "Add to cart" until the item is in the cart, then a stepper (bin at 1) so it can be removed from the Menu too. */
export function AddToCartControl({ item, cart, onAdd, onIncrease, onDecrease }: AddToCartControlProps) {
  const line = cart.find((l) => l.id === item.id);
  if (!line) {
    return (
      <button type="button" className="btn btn-secondary" onClick={() => onAdd(item)}>
        Add to cart
      </button>
    );
  }
  return (
    <QuantityStepper
      name={item.name}
      quantity={line.quantity}
      onIncrease={() => onIncrease(item.id)}
      onDecrease={() => onDecrease(item.id)}
    />
  );
}
