import { formatCredits } from "./BalanceTile";
import { BRAND_NAME, brandHref, isCurrent, visibleNav } from "@/lib/shell";

type TopBarProps = {
  signedIn: boolean;
  pathname: string;
  menuOpen?: boolean;
  /** Sign-out error text; shown as an alert when set. */
  error?: string | null;
  onToggleMenu?: () => void;
  onSignOut?: () => void;
  signingOut?: boolean;
  /** Credits to show; null = could not be loaded; omitted = no badge. */
  balance?: number | null;
};

export function TopBar({
  signedIn,
  pathname,
  menuOpen = false,
  error = null,
  onToggleMenu,
  onSignOut,
  signingOut = false,
  balance,
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
            {balance === null && (
              <span className="badge badge-danger balance-badge">
                <span aria-hidden="true">--</span>
                <span className="sr-only">Balance unavailable</span>
              </span>
            )}
            {typeof balance === "number" && (
              <span
                className="badge badge-info balance-badge"
                data-wf-id="balance"
                role="status"
                aria-live="polite"
              >
                {formatCredits(balance)}
              </span>
            )}
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
