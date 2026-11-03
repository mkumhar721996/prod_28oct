import { BRAND_NAME, CART_HREF, brandHref, isCurrent, visibleNav } from "@/lib/shell";

type TopBarProps = {
  signedIn: boolean;
  pathname: string;
  menuOpen?: boolean;
  /** Sign-out error text; shown as an alert when set. */
  error?: string | null;
  onToggleMenu?: () => void;
  onSignOut?: () => void;
  signingOut?: boolean;
  /** Items in the cart, shown in the top bar's cart control. */
  cartCount?: number;
};

export function TopBar({
  signedIn,
  pathname,
  menuOpen = false,
  error = null,
  onToggleMenu,
  onSignOut,
  signingOut = false,
  cartCount = 0,
}: TopBarProps) {
  const brand = (
    <a className="shell-brand" href={brandHref(signedIn)}>
      {BRAND_NAME}
    </a>
  );

  const cartControl = (
    <div className="cart-control" data-testid="cart-control">
      <a className="btn btn-ghost btn-sm" href={CART_HREF} data-testid="open-cart">
        Cart
      </a>
      <span
        className="badge badge-neutral"
        data-testid="cart-count"
        aria-label={`Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}
      >
        {cartCount}
      </span>
    </div>
  );

  return (
    <header className="shell-header">
      <div className="shell-bar">
        {signedIn ? (
          <>
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
            {cartControl}
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
        ) : (
          <>
            {brand}
            {cartControl}
          </>
        )}
      </div>
    </header>
  );
}
