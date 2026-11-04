export const formatCredits = (credits: number) =>
  `${credits.toLocaleString("en-US")} ${credits === 1 ? "credit" : "credits"}`;

type BalanceTileProps = {
  credits?: number;
  email?: string;
  /** An account tile (Transfer): the account name, with a plain-number `amount` and no currency. */
  label?: string;
  amount?: number;
  frozen?: boolean;
};

export function BalanceTile({ credits = 0, email, label, amount, frozen }: BalanceTileProps) {
  if (amount !== undefined) {
    return (
      <div className="card stack stack-2">
        <span className="bal-label">
          {label}
          {frozen && (
            <>
              {" "}
              <span className="badge badge-warning">Frozen</span>
            </>
          )}
        </span>
        <span className="bal-value" aria-live="polite">
          {amount}
        </span>
      </div>
    );
  }
  return (
    <div className="card balance-tile" role="status">
      <span className="text-muted">Credit balance</span>
      <span className="balance-figure">{formatCredits(credits)}</span>
      {email && <span className="text-sm text-muted">Signed in as {email}</span>}
    </div>
  );
}
