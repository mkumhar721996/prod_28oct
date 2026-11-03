import { formatMoney, type CartLine as Line } from "@/lib/cart";
import { QuantityStepper } from "./QuantityStepper";

type CartLineProps = {
  line: Line;
  onIncrease: (id: string) => void;
  onDecrease: (id: string) => void;
  onRemove: (id: string) => void;
};

export function CartLine({ line, onIncrease, onDecrease, onRemove }: CartLineProps) {
  return (
    <li className="cart-line">
      {/* The name sits beside the image, so the image is decorative. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="cart-thumb" src={line.image} alt="" />
      <div>
        <div className="cart-line-name">{line.name}</div>
        <div className="cart-line-meta">{formatMoney(line.unitPrice)} each</div>
      </div>
      <div className="cart-line-side">
        <span>{formatMoney(line.unitPrice * line.quantity)}</span>
        <QuantityStepper
          name={line.name}
          quantity={line.quantity}
          onIncrease={() => onIncrease(line.id)}
          onDecrease={() => onDecrease(line.id)}
        />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRemove(line.id)}>
          Remove
        </button>
      </div>
    </li>
  );
}
