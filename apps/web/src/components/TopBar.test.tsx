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

describe("TopBar role-based nav", () => {
  it("shows New hires then Holidays to hr", () => {
    const hr = renderToStaticMarkup(<TopBar signedIn role="hr" pathname="/" />);
    expect(hr).toMatch(/data-nav-key="new-hires"[^>]*>New hires</);
    expect(hr).toMatch(/data-nav-key="holidays"[^>]*>Holidays</);
    expect(hr.indexOf(">New hires<")).toBeLessThan(hr.indexOf(">Holidays<"));
  });

  it("shows a new hire neither entry", () => {
    const nh = renderToStaticMarkup(<TopBar signedIn role="new_hire" pathname="/" />);
    expect(nh).not.toContain("New hires");
    expect(nh).not.toContain("Holidays");
    expect(nh).toContain('data-nav-key="home"');
  });
});

describe("TopBar signed out", () => {
  const html = renderToStaticMarkup(<TopBar signedIn={false} pathname="/sign-in" />);

  it("shows the brand only", () => {
    expect(html).toContain(">Web App<");
    expect(html).not.toContain("Sign out");
    expect(html).not.toContain("data-nav-key");
    expect(html).not.toContain("Menu");
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
