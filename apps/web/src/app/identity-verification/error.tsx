"use client";

export default function IdentityVerificationError({ reset }: { reset: () => void }) {
  return (
    <div className="page stack stack-4">
      <h1>Identity verification</h1>
      <div className="alert alert-danger" role="alert">
        Your verification status could not be loaded. Check your connection and try again.
      </div>
      <div>
        <button className="btn btn-secondary" type="button" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
