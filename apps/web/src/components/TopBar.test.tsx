import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TopBar } from "./TopBar";

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
