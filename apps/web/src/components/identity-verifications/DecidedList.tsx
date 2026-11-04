import type { Submission } from "@/lib/identityVerifications";
import { LocalTime } from "../history/LocalTime";
import { Icon } from "../orders/Icon";
import { SubmissionFacts } from "./SubmissionCard";

export function DecisionBadge({ status }: { status: Submission["status"] }) {
  return status === "approved" ? (
    <span className="badge badge-success">
      <Icon name="check" /> Approved
    </span>
  ) : (
    <span className="badge badge-danger">
      <Icon name="x" /> Rejected
    </span>
  );
}

/** Who decided and when, plus the rejection reason; shared by the Decided list and the already-decided view. */
export function DecisionFacts({ submission }: { submission: Submission }) {
  return (
    <>
      <div>
        <dt>Decided by</dt>
        <dd>{submission.decidedBy}</dd>
      </div>
      <div>
        <dt>Decided at</dt>
        <dd>{submission.decidedAt && <LocalTime iso={submission.decidedAt} />}</dd>
      </div>
      {submission.rejectionReason && (
        <div>
          <dt>Reason</dt>
          <dd>{submission.rejectionReason}</dd>
        </div>
      )}
    </>
  );
}

export function DecidedList({ submissions }: { submissions: Submission[] }) {
  return (
    <ul className="plain-list stack stack-2" aria-label="Decided submissions">
      {submissions.map((s) => (
        <li key={s.id} className="card record">
          <SubmissionFacts details={s}>
            <DecisionFacts submission={s} />
          </SubmissionFacts>
          <DecisionBadge status={s.status} />
        </li>
      ))}
    </ul>
  );
}
