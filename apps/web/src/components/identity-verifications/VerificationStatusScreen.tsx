"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { Details, MyVerification } from "@/lib/identityVerifications";
import { WALLET_HREF } from "@/lib/shell";
import { Toast } from "../appointments/Toast";
import { Icon } from "../orders/Icon";
import { ResubmitForm } from "./ResubmitForm";
import { SubmissionFacts } from "./SubmissionCard";

export const RESUBMITTED = "Details resubmitted. They are waiting for review.";
const BLANK: Details = { fullName: "", dateOfBirth: "", idNumber: "" };

/** The customer's own details from the status, or null when they never submitted. */
const detailsOf = (v: MyVerification): Details | null =>
  v.fullName && v.dateOfBirth && v.idNumber
    ? { fullName: v.fullName, dateOfBirth: v.dateOfBirth, idNumber: v.idNumber }
    : null;

export function VerificationStatusScreen({ initial }: { initial: MyVerification }) {
  const [verification, setVerification] = useState(initial);
  const [resubmitting, setResubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const hideToast = useCallback(() => setToast(null), []);
  const details = detailsOf(verification);

  function onSubmitted(next: MyVerification) {
    setVerification(next);
    setResubmitting(false);
    setToast(RESUBMITTED);
  }

  return (
    <div className="page stack stack-4">
      <h1>Identity verification</h1>
      {verification.status === "none" ? (
        <ResubmitForm heading="Submit your details" initial={BLANK} lastReason={null} onSubmitted={onSubmitted} />
      ) : verification.status === "pending" ? (
        <div className="card stack stack-2">
          <p>
            <span className="badge badge-info">
              <Icon name="loader" /> Pending
            </span>
          </p>
          <p>Your details are waiting for review. This usually takes one working day.</p>
          {details && <SubmissionFacts details={details} />}
        </div>
      ) : verification.status === "rejected" ? (
        resubmitting ? (
          <ResubmitForm
            heading="Resubmit your details"
            initial={details ?? BLANK}
            lastReason={verification.rejectionReason}
            onSubmitted={onSubmitted}
            onCancel={() => setResubmitting(false)}
          />
        ) : (
          <div className="stack stack-2">
            <div className="alert alert-danger" role="status">
              Your identity verification was rejected. Check the reason below and resubmit.
            </div>
            <div className="card stack stack-2">
              <p>
                <span className="badge badge-danger">
                  <Icon name="x" /> Rejected
                </span>
              </p>
              <p>
                <strong>Reason:</strong> {verification.rejectionReason}
              </p>
              <div className="form-actions form-actions-end">
                <button className="btn btn-primary" type="button" onClick={() => setResubmitting(true)}>
                  Resubmit details
                </button>
              </div>
            </div>
          </div>
        )
      ) : (
        <div className="stack stack-2">
          <div className="alert alert-success" role="status">
            Your identity verification was approved.
          </div>
          <div className="card stack stack-2">
            <p>
              <span className="badge badge-success">
                <Icon name="check" /> Approved
              </span>
            </p>
            <p>You can now reach your accounts.</p>
            <div className="form-actions form-actions-end">
              <Link className="btn btn-primary" href={WALLET_HREF}>
                Go to my accounts
              </Link>
            </div>
          </div>
        </div>
      )}
      {toast && <Toast message={toast} onHide={hideToast} />}
    </div>
  );
}
