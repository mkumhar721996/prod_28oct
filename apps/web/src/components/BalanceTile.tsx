export const formatCredits = (credits: number) =>
  `${credits.toLocaleString("en-US")} ${credits === 1 ? "credit" : "credits"}`;

/** "card" is the Wallet page's large tile; "inline" is the compact readout in a page header. */
export function BalanceTile({
  credits,
  email,
  variant = "card",
}: {
  credits: number;
  email?: string;
  variant?: "card" | "inline";
}) {
  if (variant === "inline") {
    return (
      <div className="balance-box">
        <span className="text-sm text-muted">Balance</span>
        <strong aria-live="polite">{credits.toLocaleString("en-US")}</strong>
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
