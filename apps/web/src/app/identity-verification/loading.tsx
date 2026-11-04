export default function IdentityVerificationLoading() {
  return (
    <div className="page stack stack-4">
      <h1>Identity verification</h1>
      <div className="card stack stack-2" role="status" aria-busy="true" aria-label="Loading your verification status">
        <span className="skeleton" style={{ width: "25%" }} />
        <span className="skeleton" style={{ width: "70%" }} />
        <span className="skeleton" style={{ width: "45%" }} />
      </div>
    </div>
  );
}
