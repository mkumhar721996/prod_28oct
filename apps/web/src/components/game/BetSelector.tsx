import { BETS } from "@/lib/game";

type Props = { value: number; onChange: (bet: number) => void; disabled?: boolean };

export function BetSelector({ value, onChange, disabled = false }: Props) {
  return (
    <fieldset className="bet" disabled={disabled}>
      <legend>Bet</legend>
      <div className="bet-options">
        {BETS.map((bet) => (
          <label className="bet-option" key={bet}>
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
