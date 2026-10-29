export const formatCredits = (credits: number) =>
  `${credits.toLocaleString("en-US")} ${credits === 1 ? "credit" : "credits"}`;

type Props = { credits: number; email?: string; variant?: "card" | "inline" };

export function BalanceTile({ credits, email, variant = "card" }: Props) {
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
