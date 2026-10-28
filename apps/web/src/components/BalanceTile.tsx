export const formatCredits = (credits: number) =>
  `${credits.toLocaleString("en-US")} ${credits === 1 ? "credit" : "credits"}`;

export function BalanceTile({ credits, email }: { credits: number; email?: string }) {
  return (
    <div className="card balance-tile" role="status">
      <span className="text-muted">Credit balance</span>
      <span className="balance-figure">{formatCredits(credits)}</span>
      {email && <span className="text-sm text-muted">Signed in as {email}</span>}
    </div>
  );
}
