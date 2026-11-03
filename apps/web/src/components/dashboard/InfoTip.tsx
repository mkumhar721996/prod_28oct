import { Icon } from "../orders/Icon";

/** A "?" help button; the tooltip shows on hover and keyboard focus (CSS). */
export function InfoTip({ id, label, text }: { id: string; label: string; text: string }) {
  return (
    <span className="tooltip-anchor">
      <button className="help" type="button" aria-label={label} aria-describedby={id}>
        <Icon name="info" />
      </button>
      <span className="tooltip" role="tooltip" id={id}>
        {text}
      </span>
    </span>
  );
}
