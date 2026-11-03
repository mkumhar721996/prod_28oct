import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TopBar } from "./TopBar";
import { SIGN_OUT_ERROR, handleSignOut } from "./TopBarControls";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

describe("TopBar signed in", () => {
  const html = renderToStaticMarkup(<TopBar signedIn pathname="/" />);

  const open = renderToStaticMarkup(<TopBar signedIn pathname="/" accountOpen />);

  it("shows header and brand, with Sign out only inside the open account menu", () => {
    expect(html).toContain("<header");
    expect(html).toContain(">Web App<");
    expect(html).not.toContain(">Sign out<");
    expect(open).toContain(">Sign out<");
  });

  it("closes the account menu by default and opens it when asked (AC10)", () => {
    expect(html).toMatch(/aria-controls="account-menu"[^>]*aria-expanded="false"|aria-expanded="false"[^>]*aria-controls="account-menu"/);
    expect(html).not.toContain('id="account-menu"');
    expect(open).toContain('id="account-menu"');
    expect(open).toMatch(/aria-expanded="true"[^>]*aria-controls="account-menu"|aria-controls="account-menu"[^>]*aria-expanded="true"/);
    expect(html).toMatch(/<button[^>]*aria-haspopup="menu"[^>]*aria-label="Account"/);
  });

  it("shows Profile and Settings disabled as Coming soon (AC9)", () => {
    expect(open).toMatch(/<button[^>]*disabled=""[^>]*>Profile[\s\S]*?Coming soon/);
    expect(open).toMatch(/<button[^>]*disabled=""[^>]*>Settings[\s\S]*?Coming soon/);
  });

  it("shows search and the bell disabled as Coming soon, the bell with a count of 3 (AC8, AC14)", () => {
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Search, coming soon"/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Notifications, coming soon"/);
    expect(html).toMatch(/aria-label="Notifications, coming soon"[\s\S]*?<span[^>]*class="bell-badge"[^>]*>3</);
  });

  it("calls the nav item Dashboard, current on home (AC2)", () => {
    expect(html).toMatch(/<a[^>]*data-nav-key="home"[^>]*aria-current="page"[^>]*>Dashboard</);
  });

  it("shows Holdings and SIPs as disabled, non-link entries (AC13)", () => {
    for (const [key, label] of [["holdings", "Holdings"], ["sips", "SIPs"]]) {
      expect(html).toMatch(
        new RegExp(`<span[^>]*aria-disabled="true"[^>]*data-nav-key="${key}"[^>]*>${label}[\\s\\S]*?Coming soon`),
      );
      expect(html).not.toMatch(new RegExp(`<a[^>]*data-nav-key="${key}"`));
    }
  });

  it("links the brand home", () => {
    expect(html).toMatch(/<a[^>]*class="shell-brand"[^>]*href="\/"/);
  });

  it("has a Menu button controlling the nav", () => {
    expect(html).toMatch(/<button[^>]*aria-controls="main-nav"[^>]*>Menu</);
    expect(html).toContain('id="main-nav"');
    expect(html).toContain('aria-expanded="false"');
  });

  it("reflects the open menu", () => {
    expect(renderToStaticMarkup(<TopBar signedIn pathname="/" menuOpen />)).toContain(
      'aria-expanded="true"',
    );
  });

  it("exposes the current page entry", () => {
    expect(html).toMatch(/<a[^>]*data-nav-key="home"[^>]*aria-current="page"/);
  });

  it("does not mark other pages as current", () => {
    const other = renderToStaticMarkup(<TopBar signedIn pathname="/elsewhere" />);
    expect(other).toContain('data-nav-key="home"');
    expect(other).not.toContain("aria-current");
  });

  it("places the account menu after the nav", () => {
    expect(open.indexOf(">Sign out<")).toBeGreaterThan(open.indexOf("</nav>"));
  });

  it("shows no alert without an error", () => {
    expect(html).not.toContain('role="alert"');
  });

  it("shows the error and keeps Sign out enabled", () => {
    const failed = renderToStaticMarkup(
      <TopBar signedIn pathname="/" accountOpen error={SIGN_OUT_ERROR} />,
    );
    expect(failed).toContain('role="alert"');
    expect(failed).toContain("Sign out failed");
    expect(failed).toMatch(/<button[^>]*>Sign out<\/button>/);
    expect(failed).not.toMatch(/<button[^>]*disabled[^>]*>Sign out/);
  });

  it("disables Sign out while signing out", () => {
    expect(
      renderToStaticMarkup(<TopBar signedIn pathname="/" accountOpen signingOut />),
    ).toMatch(/<button[^>]*disabled=""[^>]*>Sign out/);
  });
});

describe("TopBar signed out", () => {
  const html = renderToStaticMarkup(<TopBar signedIn={false} pathname="/sign-in" />);

  it("shows the brand and the public Menu entry, without account controls", () => {
    expect(html).toContain(">Web App<");
    expect(html).not.toContain("Sign out");
    expect(html).not.toContain('aria-label="Account"');
    expect(html).not.toContain("Coming soon");
    expect(html).toMatch(
      /<a[^>]*data-nav-key="menu"[^>]*href="\/menu"|<a[^>]*href="\/menu"[^>]*data-nav-key="menu"/,
    );
    expect(html).not.toContain('data-nav-key="wallet"');
  });

  it("marks Menu current on /menu", () => {
    expect(renderToStaticMarkup(<TopBar signedIn={false} pathname="/menu" />)).toMatch(
      /data-nav-key="menu"[^>]*aria-current="page"/,
    );
  });

  it("links the brand to sign-in", () => {
    expect(html).toMatch(/<a[^>]*class="shell-brand"[^>]*href="\/sign-in"/);
  });
});

describe("TopBar brand value", () => {
  it("flows a changed brand into the header", async () => {
    vi.resetModules();
    vi.doMock("@/lib/shell", async (orig) => ({
      ...(await orig<typeof import("@/lib/shell")>()),
      BRAND_NAME: "Acme Portal",
    }));
    const { TopBar: Mocked } = await import("./TopBar");
    const html = renderToStaticMarkup(<Mocked signedIn pathname="/" />);
    expect(html).toContain(">Acme Portal<");
    expect(html).not.toContain(">Web App<");
  });
});

describe("handleSignOut", () => {
  it("replaces to sign-in and refreshes on success", async () => {
    const replace = vi.fn();
    const refresh = vi.fn();
    const setError = vi.fn();
    await handleSignOut({ signOut: async () => {}, replace, refresh }, setError);
    expect(replace).toHaveBeenCalledWith("/sign-in");
    expect(refresh).toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith(null);
  });

  it("sets the error and does not navigate on failure", async () => {
    const replace = vi.fn();
    const refresh = vi.fn();
    const setError = vi.fn();
    await handleSignOut(
      {
        signOut: async () => {
          throw new Error("x");
        },
        replace,
        refresh,
      },
      setError,
    );
    expect(setError).toHaveBeenLastCalledWith(expect.stringContaining("Sign out failed"));
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
