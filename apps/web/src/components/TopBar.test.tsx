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

  it("shows header, brand and Sign out", () => {
    expect(html).toContain("<header");
    expect(html).toContain(">Web App<");
    expect(html).toContain(">Sign out<");
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

  it("places Sign out after the nav", () => {
    expect(html.indexOf(">Sign out<")).toBeGreaterThan(html.indexOf("</nav>"));
  });

  it("shows no alert without an error", () => {
    expect(html).not.toContain('role="alert"');
  });

  it("shows the error and keeps Sign out", () => {
    const failed = renderToStaticMarkup(<TopBar signedIn pathname="/" error={SIGN_OUT_ERROR} />);
    expect(failed).toContain('role="alert"');
    expect(failed).toContain("Sign out failed");
    expect(failed).toContain(">Sign out</button>");
    expect(failed).not.toMatch(/<button[^>]*disabled[^>]*>Sign out/);
  });
});

describe("TopBar signed out", () => {
  const html = renderToStaticMarkup(<TopBar signedIn={false} pathname="/sign-in" />);

  it("shows the brand and the public Menu entry, without Sign out", () => {
    expect(html).toContain(">Web App<");
    expect(html).not.toContain("Sign out");
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

describe("TopBar balance", () => {
  it("shows the balance badge for a signed-in player", () => {
    const html = renderToStaticMarkup(<TopBar signedIn pathname="/" balance={1000} />);
    expect(html).toMatch(/class="badge badge-info balance-badge"[^>]*>1,000 credits</);
    expect(html).toContain('role="status"');
  });

  it("shows -- with an accessible label when the balance could not load", () => {
    const html = renderToStaticMarkup(<TopBar signedIn pathname="/" balance={null} />);
    expect(html).toContain(">--<");
    expect(html).toContain("badge-danger");
    expect(html).toContain("Balance unavailable");
  });

  it("shows no balance to a signed-out visitor", () => {
    const html = renderToStaticMarkup(<TopBar signedIn={false} pathname="/" balance={1000} />);
    expect(html).not.toContain("credits");
    expect(html).not.toContain("badge");
  });

  it("shows no badge when balance is omitted", () => {
    expect(renderToStaticMarkup(<TopBar signedIn pathname="/" />)).not.toContain("badge");
  });
});
