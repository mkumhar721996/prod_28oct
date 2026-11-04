import { formatAmount, type Alert } from "@/lib/alerts";
import { LocalTime } from "../history/LocalTime";

type Props = {
  alert: Alert;
  onMarkRead: (id: string) => void;
  /** True while the mark-read request is in flight. */
  pending?: boolean;
  /** Shown beside the card when the last mark-read attempt failed. */
  error?: string | null;
};

function title(alert: Alert): string {
  switch (alert.kind) {
    case "money_received":
      return "Money received";
    case "transfer_sent":
      return "Money sent";
    case "account_frozen":
      return "Account frozen";
    case "account_unfrozen":
      return "Account unfrozen";
    case "identity_verification_result":
      return alert.verificationResult === "approved" ? "Identity verified" : "Identity verification unsuccessful";
  }
}

/** One alert: what happened, when, and whether it is still unread. */
export function AlertCard({ alert, onMarkRead, pending = false, error = null }: Props) {
  const hasAmount = alert.amountMinor !== undefined && alert.currency !== undefined;
  return (
    <article className={alert.read ? "card alert-card stack stack-2" : "card alert-card stack stack-2 is-unread"}>
      <div className="title-row">
        <h3>{title(alert)}</h3>
        {alert.read ? (
          <span className="badge badge-neutral">Read</span>
        ) : (
          <span className="badge badge-info">Unread</span>
        )}
      </div>
      {hasAmount && (
        <p className="amount">
          {alert.kind === "transfer_sent" ? "Amount sent" : "Amount received"}:{" "}
          {formatAmount(alert.amountMinor!, alert.currency!)}
        </p>
      )}
      {alert.senderName && <p>From: {alert.senderName}</p>}
      {alert.recipientName && <p>To: {alert.recipientName}</p>}
      <p className="text-muted text-sm">
        <LocalTime iso={alert.createdAt} />
      </p>
      {error && (
        <div className="alert alert-danger" role="alert">
          <span aria-hidden="true">!</span>
          <span>{error}</span>
        </div>
      )}
      {!alert.read && (
        <div>
          <button
            className="btn btn-secondary"
            type="button"
            disabled={pending}
            onClick={() => onMarkRead(alert.id)}
          >
            {pending ? "Marking as read…" : "Mark as read"}
          </button>
        </div>
      )}
    </article>
  );
}
