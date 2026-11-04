import { ALERTS_HREF, BRAND_NAME, brandHref, isCurrent, visibleNav } from "@/lib/shell";
import { Icon } from "./orders/Icon";

type TopBarProps = {
  signedIn: boolean;
  pathname: string;
  menuOpen?: boolean;
  /** Sign-out error text; shown as an alert when set. */
  error?: string | null;
  onToggleMenu?: () => void;
  onSignOut?: () => void;
  signingOut?: boolean;
  /** Unread alerts; null or undefined while unknown. The badge is hidden at 0. */
  unreadCount?: number | null;
};

export function TopBar({
  signedIn,
  pathname,
  menuOpen = false,
  error = null,
  onToggleMenu,
  onSignOut,
  signingOut = false,
  unreadCount = null,
}: TopBarProps) {
  const unread = unreadCount ?? 0;
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
              className="btn btn-ghost btn-sm count-link"
              href={ALERTS_HREF}
              data-nav-key="alerts"
              aria-label={unread > 0 ? `Alerts, ${unread} unread` : "Alerts"}
              aria-current={pathname === ALERTS_HREF ? "page" : undefined}
            >
              <Icon name="bell" />
              <span>Alerts</span>
              <span className={unread > 0 ? "badge badge-danger" : undefined} role="status" aria-live="polite">
                {unread > 0 ? `${unread} unread` : null}
              </span>
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
