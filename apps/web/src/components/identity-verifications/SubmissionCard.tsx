import type { ReactNode } from "react";
import { formatDateOfBirth, type Details } from "@/lib/identityVerifications";

/** The three details staff check against the ID: full name, date of birth, ID number; `children` adds more rows. */
export function SubmissionFacts({ details, children }: { details: Details; children?: ReactNode }) {
  return (
    <dl className="facts">
      <div>
        <dt>Full name</dt>
        <dd>{details.fullName}</dd>
      </div>
      <div>
        <dt>Date of birth</dt>
        <dd>{formatDateOfBirth(details.dateOfBirth)}</dd>
      </div>
      <div>
        <dt>ID number</dt>
        <dd className="mono">{details.idNumber}</dd>
      </div>
      {children}
    </dl>
  );
}

/** One pending submission in the list, with its Review button. */
export function SubmissionCard({
  submission,
  onReview,
}: {
  submission: Details & { id: string };
  onReview: (id: string) => void;
}) {
  return (
    <li className="card record">
      <SubmissionFacts details={submission} />
      <button
        className="btn btn-primary"
        type="button"
        aria-label={`Review ${submission.fullName}`}
        onClick={() => onReview(submission.id)}
      >
        Review
      </button>
    </li>
  );
}
