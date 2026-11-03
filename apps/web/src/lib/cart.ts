export type CartLine = {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  image: string;
};
export type Cart = readonly CartLine[];

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

export function formatMoney(amount: number): string {
  return money.format(amount);
}

/** Copies only the cart-line fields, so extra fields on a menu item (e.g. category) never reach the cart. */
export function addItem(cart: Cart, item: Omit<CartLine, "quantity">): Cart {
  const { id, name, unitPrice, image } = item;
  return cart.some((line) => line.id === id)
    ? increase(cart, id)
    : [...cart, { id, name, unitPrice, image, quantity: 1 }];
}

/** A quantity below 1 removes the line. */
export function setQuantity(cart: Cart, id: string, quantity: number): Cart {
  if (quantity < 1) return removeLine(cart, id);
  return cart.map((line) => (line.id === id ? { ...line, quantity } : line));
}

export function increase(cart: Cart, id: string): Cart {
  const line = cart.find((l) => l.id === id);
  return line ? setQuantity(cart, id, line.quantity + 1) : cart;
}

export function decrease(cart: Cart, id: string): Cart {
  const line = cart.find((l) => l.id === id);
  return line ? setQuantity(cart, id, line.quantity - 1) : cart;
}

export function removeLine(cart: Cart, id: string): Cart {
  return cart.filter((line) => line.id !== id);
}

/** Derived from the lines, never stored, so it cannot drift. */
export function cartTotal(cart: Cart): number {
  return cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
}

export function cartCount(cart: Cart): number {
  return cart.reduce((sum, line) => sum + line.quantity, 0);
}
