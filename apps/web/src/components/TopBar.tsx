import { BRAND_NAME, brandHref, isCurrent, visibleNav } from "@/lib/shell";
import { TopBarControls } from "./TopBarControls";

export function TopBar({ signedIn, pathname }: { signedIn: boolean; pathname: string }) {
  const brand = (
    <a className="shell-brand" href={brandHref(signedIn)}>
      {BRAND_NAME}
    </a>
  );

  return (
    <header className="shell-header">
      <div className="shell-bar">
        {signedIn ? (
          <TopBarControls brand={brand}>
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
          </TopBarControls>
        ) : (
          brand
        )}
      </div>
    </header>
  );
}
