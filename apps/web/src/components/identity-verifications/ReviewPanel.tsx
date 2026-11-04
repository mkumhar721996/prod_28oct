"use client";

import { useState } from "react";
import type { Submission } from "@/lib/identityVerifications";
import { Icon } from "../orders/Icon";
import { SubmissionFacts } from "./SubmissionCard";

export const REASON_REQUIRED = "Enter a reason to reject this verification. It stays pending.";

/** The error text when a rejection has no reason, else null. Blank and whitespace-only both count as no reason. */
export const validateReason = (reason: string): string | null => (reason.trim() === "" ? REASON_REQUIRED : null);

type Props = {
  /** The pending list, shown beside the detail. */
  queue: Submission[];
  selected: Submission;
  busy: boolean;
  onBack: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
  /** Lets a test render the blank-reason state without a click. */
  initialError?: string | null;
};

/** The review workspace: the queue on one side, the selected submission with approve and reject on the other. */
export function ReviewPanel({ queue, selected, busy, onBack, onApprove, onReject, initialError = null }: Props) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(initialError);

  function reject() {
    const invalid = validateReason(reason);
    setError(invalid);
    if (!invalid) onReject(reason);
  }

  return (
    <div className="workspace">
      <div className="queue-col stack stack-2">
        {queue.map((s) =>
          s.id === selected.id ? (
            <div key={s.id} className="card queue-item" aria-current="true">
              <strong>{s.fullName}</strong>
            </div>
          ) : (
            <div key={s.id} className="card queue-item is-quiet">
              {s.fullName}
            </div>
          ),
        )}
      </div>
      <div className="detail-col card stack stack-2">
        <h2>{selected.fullName}</h2>
        <SubmissionFacts details={selected} />
        <div className="field">
          <label htmlFor="reason">Reason for rejection</label>
          <textarea
            className={error ? "textarea is-invalid" : "textarea"}
            id="reason"
            rows={3}
            placeholder="Required if you reject. Say what the customer must correct."
            value={reason}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "reason-error" : undefined}
            onChange={(e) => setReason(e.target.value)}
          />
          {error ? (
            <p className="field-error row-inline" id="reason-error" role="alert">
              <Icon name="alert" />
              <span>{error}</span>
            </p>
          ) : (
            <p className="field-hint">The customer sees this reason on their status page.</p>
          )}
        </div>
        <div className="form-actions form-actions-end">
          <button className="btn btn-ghost" type="button" onClick={onBack}>
            Back to list
          </button>
          <button className="btn btn-danger" type="button" disabled={busy} onClick={reject}>
            Reject
          </button>
          <button className="btn btn-primary" type="button" disabled={busy} onClick={onApprove}>
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
