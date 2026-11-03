export default function PlayLoading() {
  return (
    <div className="stack stack-4 game" aria-busy="true">
      <h1 className="game-heading">Jackpot slots</h1>
      <div className="card stack stack-2">
        <span className="skeleton" style={{ width: "40%" }} />
        <span className="skeleton" style={{ height: "var(--space-5)", width: "60%" }} />
      </div>
      <span className="skeleton" style={{ height: "var(--size-control-lg)" }} />
    </div>
  );
}
