type ButtonProps = {
  label: string;
  variant?: "primary" | "secondary" | "ghost";
  /** Small button for a table or list row; `subject` names the row for screen readers. */
  compact?: boolean;
  subject?: string;
};

/** A feature that does not exist yet: always disabled and says so. */
export function ComingSoonButton({ label, variant = "secondary", compact = false, subject }: ButtonProps) {
  const name = subject ? `${label} ${subject}` : label;
  if (compact) {
    return (
      <button
        type="button"
        className={`btn btn-${variant} btn-sm`}
        disabled
        title="Coming soon"
        aria-label={`${name}, coming soon`}
      >
        {label}
      </button>
    );
  }
  return (
    <button
      type="button"
      className={`btn btn-${variant} btn-soon`}
      disabled
      aria-label={`${name}, coming soon`}
    >
      {label}
      <span className="soon">Coming soon</span>
    </button>
  );
}

export function ComingSoonLink({ label }: { label: string }) {
  return (
    <button className="link-soon" type="button" disabled aria-label={`${label}, coming soon`}>
      {label} <span className="soon">Coming soon</span>
    </button>
  );
}
