import type { StaffAccount } from "@/lib/staffAccounts";
import { Icon } from "../orders/Icon";

export type PanelView = "current" | "unfrozen";

type Props = {
  account: StaffAccount;
  /** `unfrozen` shows the confirmation above the Active panel; `current` follows the account's own state. */
  view: PanelView;
  reason: string;
  reasonError: string | null;
  busy: boolean;
  onReasonChange: (reason: string) => void;
  onFreeze: () => void;
  onUnfreeze: () => void;
  onBackToForm: () => void;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export const accountTitle = (account: StaffAccount) => `${account.customerEmail}, ${account.number}`;

/** The right-hand panel: the freeze form, the frozen details, or the unfreeze confirmation. */
export function AccountPanel({
  account,
  view,
  reason,
  reasonError,
  busy,
  onReasonChange,
  onFreeze,
  onUnfreeze,
  onBackToForm,
}: Props) {
  const head = (
    <div className="panel-head">
      <h2>{accountTitle(account)}</h2>
      {account.frozen ? (
        <span className="badge badge-danger">
          <Icon name="alert" /> Frozen
        </span>
      ) : (
        <span className="badge badge-success">Active</span>
      )}
    </div>
  );

  if (account.frozen) {
    return (
      <div className="card stack-2">
        {head}
        <p>
          Frozen on {account.frozenAt ? formatDate(account.frozenAt) : "an unknown date"} by{" "}
          {account.frozenBy ?? "a staff member"}.
        </p>
        <p>
          <strong>Reason:</strong> {account.freezeReason}
        </p>
        <p className="muted">
          While frozen, transfers from or to this account are refused. Sign-in and transfers between
          the customer&apos;s other accounts still work.
        </p>
        <div className="form-actions">
          <button className="btn btn-primary" type="button" disabled={busy} onClick={onUnfreeze}>
            Unfreeze account
          </button>
        </div>
      </div>
    );
  }

  if (view === "unfrozen") {
    return (
      <div className="stack-2">
        <div className="alert alert-success" role="status">
          Account {account.number} is unfrozen. Transfers are allowed again.
        </div>
        <div className="card stack-2">
          {head}
          <div className="form-actions">
            <button className="btn btn-secondary" type="button" onClick={onBackToForm}>
              Back to freeze form
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card stack-2">
      {head}
      <p className="muted">
        Freezing stops transfers to and from this account only. Other accounts and sign-in are not
        affected.
      </p>
      <div className="field">
        <label htmlFor="freeze-reason">Reason for freeze (required)</label>
        <textarea
          className={reasonError ? "textarea is-invalid" : "textarea"}
          id="freeze-reason"
          rows={3}
          value={reason}
          aria-invalid={reasonError ? true : undefined}
          aria-describedby={reasonError ? "reason-error-message" : undefined}
          onChange={(e) => onReasonChange(e.target.value)}
        />
        {reasonError && (
          <p className="field-error row-inline" id="reason-error-message" role="alert">
            <Icon name="alert" />
            <span>{reasonError}</span>
          </p>
        )}
      </div>
      <div className="form-actions">
        <button className="btn btn-primary" type="button" disabled={busy} onClick={onFreeze}>
          Freeze account
        </button>
      </div>
    </div>
  );
}
