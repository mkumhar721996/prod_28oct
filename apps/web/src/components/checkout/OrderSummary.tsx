import { cartTotal, formatMoney, type Cart } from "@/lib/cart";

/** Read-only view of the cart lines for Checkout; the editable lines live in the cart drawer. */
export function OrderSummary({ cart }: { cart: Cart }) {
  return (
    <section className="stack stack-2" aria-labelledby="order-summary-title">
      <h2 id="order-summary-title">Your order</h2>
      <ul className="cart-lines" aria-label="Order summary">
        {cart.map((line) => (
          <li className="cart-line order-line" key={line.id}>
            <div>
              <div className="cart-line-name">{line.name}</div>
              <div className="cart-line-meta">
                {line.quantity} × {formatMoney(line.unitPrice)}
              </div>
            </div>
            <span>{formatMoney(line.unitPrice * line.quantity)}</span>
          </li>
        ))}
      </ul>
      <div className="cart-total-row">
        <span>Total</span>
        <span>{formatMoney(cartTotal(cart))}</span>
      </div>
    </section>
  );
}
