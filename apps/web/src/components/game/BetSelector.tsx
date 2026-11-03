import { BETS } from "@/lib/game";

/** The five bets as native radios: arrow keys, focus ring and checked state come for free. */
export function BetSelector({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (bet: number) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="bet" disabled={disabled}>
      <legend>Bet</legend>
      <div className="bet-options">
        {BETS.map((bet) => (
          <label key={bet} className="bet-option">
            <input
              type="radio"
              name="bet"
              value={bet}
              checked={value === bet}
              onChange={() => onChange(bet)}
            />
            <span>{bet}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
