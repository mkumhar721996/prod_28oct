export default function AlertsLoading() {
  return (
    <div className="page stack stack-4">
      <h1>Alerts</h1>
      <div className="stack" aria-busy="true">
        <span className="skeleton" style={{ height: "var(--space-6)" }} />
        <span className="skeleton" style={{ height: "var(--space-6)" }} />
      </div>
    </div>
  );
}
