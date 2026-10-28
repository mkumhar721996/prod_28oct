export default function WalletLoading() {
  return (
    <div className="narrow stack stack-4">
      <h1>Wallet</h1>
      <div className="card stack stack-2" aria-busy="true">
        <span className="skeleton" style={{ width: "40%" }} />
        <span className="skeleton" style={{ height: "var(--space-5)", width: "60%" }} />
      </div>
    </div>
  );
}
