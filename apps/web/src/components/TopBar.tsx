import { ALERTS_HREF, BRAND_NAME, brandHref, isCurrent, visibleNav } from "@/lib/shell";
import { Icon } from "./orders/Icon";

const ALERTS_ENTRY = { key: "alerts", label: "Alerts", href: ALERTS_HREF };

type TopBarProps = {
  signedIn: boolean;
  pathname: string;
  /** Unread alerts; the badge shows only above 0. Null while unknown. */
  unreadCount?: number | null;
  menuOpen?: boolean;
  /** Sign-out error text; shown as an alert when set. */
  error?: string | null;
  onToggleMenu?: () => void;
  onSignOut?: () => void;
  signingOut?: boolean;
};

export function TopBar({
  signedIn,
  pathname,
  unreadCount = null,
  menuOpen = false,
  error = null,
  onToggleMenu,
  onSignOut,
  signingOut = false,
}: TopBarProps) {
  const hasUnread = unreadCount !== null && unreadCount > 0;
  const brand = (
    <a className="shell-brand" href={brandHref(signedIn)}>
      {BRAND_NAME}
    </a>
  );

  return (
    <header className="shell-header">
      <div className="shell-bar">
        <div className="shell-group">
          {brand}
          <button
            className="btn btn-secondary btn-sm shell-menu-btn"
            type="button"
            aria-controls="main-nav"
            aria-expanded={menuOpen}
            onClick={onToggleMenu}
          >
            Menu
          </button>
          <nav id="main-nav" className="shell-nav" aria-label="Main">
            {visibleNav(signedIn).map((entry) => (
              <a
                key={entry.key}
                href={entry.href}
                data-nav-key={entry.key}
                aria-current={isCurrent(entry, pathname) ? "page" : undefined}
              >
                {entry.label}
              </a>
            ))}
          </nav>
        </div>
        {signedIn && (
          <>
            <a
              className="shell-alerts"
              href={ALERTS_HREF}
              data-nav-key={ALERTS_ENTRY.key}
              aria-label={hasUnread ? `Alerts, ${unreadCount} unread` : "Alerts"}
              aria-current={isCurrent(ALERTS_ENTRY, pathname) ? "page" : undefined}
            >
              <Icon name="bell" />
              <span>Alerts</span>
              {hasUnread && <span className="badge badge-danger">{unreadCount} unread</span>}
            </a>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={onSignOut}
              disabled={signingOut}
            >
              Sign out
            </button>
            {error && (
              <div className="alert alert-danger shell-error" role="alert">
                <span aria-hidden="true">!</span>
                <span>{error}</span>
              </div>
            )}
          </>
        )}
      </div>
    </header>
  );
}
