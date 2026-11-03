import { BRAND_NAME, NOTIFICATION_COUNT, brandHref, isCurrent, visibleNav } from "@/lib/shell";
import { Icon } from "./orders/Icon";

type TopBarProps = {
  signedIn: boolean;
  pathname: string;
  menuOpen?: boolean;
  accountOpen?: boolean;
  /** Sign-out error text; shown as an alert when set. */
  error?: string | null;
  onToggleMenu?: () => void;
  onToggleAccount?: () => void;
  onSignOut?: () => void;
  signingOut?: boolean;
};

export function TopBar({
  signedIn,
  pathname,
  menuOpen = false,
  accountOpen = false,
  error = null,
  onToggleMenu,
  onToggleAccount,
  onSignOut,
  signingOut = false,
}: TopBarProps) {
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
            {visibleNav(signedIn).map((entry) =>
              entry.disabled ? (
                <span key={entry.key} className="nav-disabled" aria-disabled="true" data-nav-key={entry.key}>
                  {entry.label} <span className="soon">Coming soon</span>
                </span>
              ) : (
                <a
                  key={entry.key}
                  href={entry.href}
                  data-nav-key={entry.key}
                  aria-current={isCurrent(entry, pathname) ? "page" : undefined}
                >
                  {entry.label}
                </a>
              ),
            )}
          </nav>
        </div>
        {signedIn && (
          <div className="shell-actions">
            <button type="button" className="icon-btn" disabled aria-label="Search, coming soon">
              <Icon name="search" />
            </button>
            <button type="button" className="icon-btn" disabled aria-label="Notifications, coming soon">
              <Icon name="bell" />
              <span className="bell-badge">{NOTIFICATION_COUNT}</span>
            </button>
            <div className="account">
              <button
                type="button"
                className="icon-btn"
                id="account-button"
                aria-haspopup="menu"
                aria-label="Account"
                aria-controls="account-menu"
                aria-expanded={accountOpen}
                onClick={onToggleAccount}
              >
                <Icon name="user" />
                <Icon name="chevron-down" />
              </button>
              {accountOpen && (
                <div className="menu account-menu" id="account-menu" role="menu" aria-labelledby="account-button">
                  <button type="button" role="menuitem" disabled>
                    Profile <span className="soon">Coming soon</span>
                  </button>
                  <button type="button" role="menuitem" disabled>
                    Settings <span className="soon">Coming soon</span>
                  </button>
                  <button type="button" role="menuitem" onClick={onSignOut} disabled={signingOut}>
                    Sign out
                  </button>
                </div>
              )}
            </div>
            {error && (
              <div className="alert alert-danger shell-error" role="alert">
                <span aria-hidden="true">!</span>
                <span>{error}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
