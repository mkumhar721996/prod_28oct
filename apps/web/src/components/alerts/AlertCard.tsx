import { formatAmount, type Alert } from "@/lib/alerts";
import { LocalTime } from "../history/LocalTime";
import { Icon } from "../orders/Icon";

export const MARK_READ_FAILED = "We couldn't mark that alert as read. Try again.";

type Props = {
  alert: Alert;
  /** A mark-as-read request for this alert is in flight. */
  pending?: boolean;
  /** The last mark-as-read request for this alert failed. */
  failed?: boolean;
  onMarkRead?: (id: string) => void;
};

export function AlertCard({ alert, pending = false, failed = false, onMarkRead }: Props) {
  return (
    <div className={`card alert-card stack stack-2${alert.read ? "" : " is-unread"}`}>
      <div className="title-row">
        <h3>Money received</h3>
        {alert.read ? (
          <span className="badge badge-neutral">Read</span>
        ) : (
          <span className="badge badge-info">Unread</span>
        )}
      </div>
      <p className="alert-amount">Amount received: {formatAmount(alert.amountMinor, alert.currency)}</p>
      <p>From: {alert.senderName}</p>
      <p className="text-muted text-sm">
        <LocalTime iso={alert.createdAt} />
      </p>
      {failed && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" />
          <span>{MARK_READ_FAILED}</span>
        </div>
      )}
      {!alert.read && (
        <div>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={pending}
            onClick={() => onMarkRead?.(alert.id)}
          >
            {pending ? "Marking as read…" : "Mark as read"}
          </button>
        </div>
      )}
    </div>
  );
}
