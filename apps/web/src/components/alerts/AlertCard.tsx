import { formatAmount, type Alert } from "@/lib/alerts";
import { IDENTITY_VERIFICATION_HREF } from "@/lib/shell";
import { LocalTime } from "../history/LocalTime";

type Props = {
  alert: Alert;
  onMarkRead: (id: string) => void;
  /** True while the mark-read request is in flight. */
  pending?: boolean;
  /** Shown beside the card when the last mark-read attempt failed. */
  error?: string | null;
};

const IDENTITY_TEXT = {
  identity_approved: { heading: "Verification approved", line: "Your identity verification was approved." },
  identity_rejected: {
    heading: "Verification rejected",
    line: "Your identity verification was rejected. Check the reason on your verification page and resubmit.",
  },
} as const;

/** One alert: a money-received (who sent how much) or an identity decision, when, and whether it is still unread. */
export function AlertCard({ alert, onMarkRead, pending = false, error = null }: Props) {
  return (
    <article className={alert.read ? "card alert-card stack stack-2" : "card alert-card stack stack-2 is-unread"}>
      <div className="title-row">
        <h3>{alert.kind === "money_received" ? "Money received" : IDENTITY_TEXT[alert.kind].heading}</h3>
        {alert.read ? (
          <span className="badge badge-neutral">Read</span>
        ) : (
          <span className="badge badge-info">Unread</span>
        )}
      </div>
      {alert.kind === "money_received" ? (
        <>
          <p className="amount">Amount received: {formatAmount(alert.amountMinor, alert.currency)}</p>
          <p>From: {alert.senderName}</p>
        </>
      ) : (
        <>
          <p>{IDENTITY_TEXT[alert.kind].line}</p>
          {alert.kind === "identity_rejected" && (
            <p>
              <a href={IDENTITY_VERIFICATION_HREF}>Open your verification page</a>
            </p>
          )}
        </>
      )}
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
