"use client";

import { useCallback, useState } from "react";
import {
  approveSubmission,
  fetchSubmission,
  fetchSubmissions,
  rejectSubmission,
  type ActionResult,
  type Submission,
} from "@/lib/identityVerifications";
import { Toast } from "../appointments/Toast";
import { DecidedList, DecisionBadge, DecisionFacts } from "./DecidedList";
import { REASON_REQUIRED, ReviewPanel, validateReason } from "./ReviewPanel";
import { SubmissionCard, SubmissionFacts } from "./SubmissionCard";

export { REASON_REQUIRED, validateReason };
export const ALREADY_DECIDED =
  "This submission was already decided by another staff member. Your action was not applied.";
const PENDING_LOAD_FAILED = "The pending verifications could not be loaded. Check your connection and try again.";
const DECIDED_LOAD_FAILED = "The decided verifications could not be loaded. Check your connection and try again.";

export const removeSubmission = (list: Submission[], id: string): Submission[] => list.filter((s) => s.id !== id);

type Decision = { kind: "approve" } | { kind: "reject"; reason: string };
export type DecisionOutcome = ActionResult | { ok: false; reason: "blank"; message: string };

/** Sends one decision. A rejection with a blank reason is refused here, before anything is sent. */
export async function runDecision(args: {
  id: string;
  decision: Decision;
  approve: (id: string) => Promise<ActionResult>;
  reject: (id: string, reason: string) => Promise<ActionResult>;
}): Promise<DecisionOutcome> {
  const { id, decision, approve, reject } = args;
  if (decision.kind === "approve") return approve(id);
  if (validateReason(decision.reason)) return { ok: false, reason: "blank", message: REASON_REQUIRED };
  return reject(id, decision.reason.trim());
}

type Tab = "pending" | "decided";
type View =
  | { kind: "list" }
  | { kind: "review"; id: string }
  | { kind: "already"; submission: Submission | null };

type Props = { initialPending: Submission[]; initialDecided: Submission[] };

export function VerificationsScreen({ initialPending, initialDecided }: Props) {
  const [tab, setTab] = useState<Tab>("pending");
  const [pending, setPending] = useState(initialPending);
  const [decided, setDecided] = useState(initialDecided);
  const [view, setView] = useState<View>({ kind: "list" });
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const hideToast = useCallback(() => setToast(null), []);

  async function load(next: Tab) {
    setTab(next);
    setView({ kind: "list" });
    setActionError(null);
    setFailed(false);
    setLoading(true);
    const result = await fetchSubmissions(next);
    setLoading(false);
    if (!result.ok) return setFailed(true);
    (next === "pending" ? setPending : setDecided)(result.submissions);
  }

  async function decide(submission: Submission, decision: Decision) {
    setBusy(true);
    setActionError(null);
    const out = await runDecision({
      id: submission.id,
      decision,
      approve: approveSubmission,
      reject: rejectSubmission,
    });
    setBusy(false);
    if (out.ok) {
      setPending((list) => removeSubmission(list, submission.id));
      setView({ kind: "list" });
      const verb = decision.kind === "approve" ? "approved" : "rejected";
      return setToast(`${submission.fullName} ${verb}. They have been sent an alert.`);
    }
    if (out.reason === "already-decided") {
      // Show the first decision, unchanged, and take the row off the pending list.
      const first = await fetchSubmission(submission.id);
      setPending((list) => removeSubmission(list, submission.id));
      return setView({ kind: "already", submission: first.ok ? first.submission : null });
    }
    setActionError(out.message);
  }

  const selected = view.kind === "review" ? pending.find((s) => s.id === view.id) : undefined;

  return (
    <div className="stack stack-4">
      <div className="stack stack-2">
        <h1>Identity verifications</h1>
        <div className="tabs" role="tablist" aria-label="Verification status">
          <button className="tab" type="button" role="tab" aria-selected={tab === "pending"} onClick={() => load("pending")}>
            Pending
          </button>
          <button className="tab" type="button" role="tab" aria-selected={tab === "decided"} onClick={() => load("decided")}>
            Decided
          </button>
        </div>
      </div>

      {loading ? (
        <div className="stack stack-2" role="status" aria-busy="true" aria-label="Loading verifications">
          {[0, 1].map((n) => (
            <div key={n} className="card stack stack-2">
              <span className="skeleton" style={{ width: "40%" }} />
              <span className="skeleton" style={{ width: "55%" }} />
              <span className="skeleton" style={{ width: "35%" }} />
            </div>
          ))}
        </div>
      ) : failed ? (
        <div className="stack stack-2">
          <div className="alert alert-danger" role="alert">
            {tab === "pending" ? PENDING_LOAD_FAILED : DECIDED_LOAD_FAILED}
          </div>
          <div>
            <button className="btn btn-secondary" type="button" onClick={() => load(tab)}>
              Try again
            </button>
          </div>
        </div>
      ) : tab === "decided" ? (
        <div className="stack stack-2">
          <p className="text-muted">Decided submissions. Pending ones stay on the Pending tab.</p>
          {decided.length === 0 ? <p>No decided submissions yet.</p> : <DecidedList submissions={decided} />}
        </div>
      ) : view.kind === "already" ? (
        <div className="stack stack-2">
          <div className="alert alert-warning" role="alert">
            {ALREADY_DECIDED}
          </div>
          {view.submission && (
            <div className="card record">
              <SubmissionFacts details={view.submission}>
                <div>
                  <dt>Decision</dt>
                  <dd>
                    <DecisionBadge status={view.submission.status} />
                  </dd>
                </div>
                <DecisionFacts submission={view.submission} />
              </SubmissionFacts>
            </div>
          )}
          <div>
            <button className="btn btn-secondary" type="button" onClick={() => setView({ kind: "list" })}>
              Back to list
            </button>
          </div>
        </div>
      ) : selected ? (
        <div className="stack stack-2">
          {actionError && (
            <div className="alert alert-danger" role="alert">
              {actionError}
            </div>
          )}
          <ReviewPanel
            key={selected.id}
            queue={pending}
            selected={selected}
            busy={busy}
            onBack={() => setView({ kind: "list" })}
            onApprove={() => decide(selected, { kind: "approve" })}
            onReject={(reason) => decide(selected, { kind: "reject", reason })}
          />
        </div>
      ) : pending.length === 0 ? (
        <div className="empty-state">
          <p>No pending verifications. New customer submissions appear here for review.</p>
          <button className="btn btn-primary" type="button" onClick={() => load("decided")}>
            See decided submissions
          </button>
        </div>
      ) : (
        <div className="stack stack-2">
          <p className="text-muted">Check each customer&apos;s details against their ID, then approve or reject.</p>
          <ul className="plain-list stack stack-2" aria-label="Pending submissions">
            {pending.map((s) => (
              <SubmissionCard key={s.id} submission={s} onReview={(id) => setView({ kind: "review", id })} />
            ))}
          </ul>
        </div>
      )}
      {toast && <Toast message={toast} onHide={hideToast} />}
    </div>
  );
}
