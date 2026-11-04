export default function IdentityVerificationsLoading() {
  return (
    <div className="stack stack-4">
      <h1>Identity verifications</h1>
      <div className="stack stack-2" role="status" aria-busy="true" aria-label="Loading pending verifications">
        {[0, 1].map((n) => (
          <div key={n} className="card stack stack-2">
            <span className="skeleton" style={{ width: "40%" }} />
            <span className="skeleton" style={{ width: "55%" }} />
            <span className="skeleton" style={{ width: "35%" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
