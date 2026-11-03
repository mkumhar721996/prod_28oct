import { Icon } from "../orders/Icon";

type QuantityStepperProps = {
  name: string;
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
};

/** Minus, quantity, plus; at 1 the minus becomes a bin, so "below 1 removes" is visible before the click. */
export function QuantityStepper({ name, quantity, onIncrease, onDecrease }: QuantityStepperProps) {
  return (
    <div className="stepper" role="group" aria-label={`Quantity of ${name}`}>
      <button
        type="button"
        className="btn btn-ghost btn-icon"
        aria-label={quantity === 1 ? `Remove ${name}` : `Decrease quantity of ${name}`}
        onClick={onDecrease}
      >
        <Icon name={quantity === 1 ? "trash" : "minus"} />
      </button>
      <span className="stepper-qty" aria-label={`Quantity ${quantity}`}>
        {quantity}
      </span>
      <button
        type="button"
        className="btn btn-ghost btn-icon"
        aria-label={`Increase quantity of ${name}`}
        onClick={onIncrease}
      >
        <Icon name="plus" />
      </button>
    </div>
  );
}
