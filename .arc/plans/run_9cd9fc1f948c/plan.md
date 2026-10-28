summary: |
  Add one shared top bar (the app shell header) to the Next.js Web App root layout. Brand text comes from a single constant ("Web App"). A main navigation container collapses behind a Menu button below 768px. A Sign out button sits on the right when signed in. Signed-out users see the brand only (no nav, no Sign out). The brand links home when signed in and to the sign-in page when signed out. A failed sign out shows an error alert, keeps the user signed in and keeps the button. The current page's nav entry is highlighted and carries aria-current="page". The work follows the approved prototype and the design-system tokens. The repo has no auth or session code yet, so the shell consumes a small session seam that the Invitations, sign-in and roles story will fill in.
scope:
  - description: |
      Load the design tokens once, in the app's own entry stylesheet. `apps/web/src/app/globals.css` holds only `@import "tailwindcss";` (line 1), and nothing in `apps/web` references `design-system/`. Add after the tailwind import:

      ```css
      @import "../../../../design-system/tokens.css";
      ```

      The path runs from apps/web/src/app to the repo root. `layout.tsx` line 2 already imports globals.css. Then add the shell rules copied from the prototype's `data-arc-shell-style` block (.shell, .shell-header, .shell-bar, .shell-brand, .shell-menu-btn, .shell-nav, .shell-nav a, [aria-current="page"], .shell-main, plus the 768px media query). Also add the `.btn`, `.btn-secondary`, `.btn-ghost`, `.btn-sm` and `.alert`/`.alert-danger` rules from `design-system/prototype-utils.css` that the shell uses. Tokens only. The only literal allowed is the `768px` media-query breakpoint, because custom properties cannot be used in media queries (the prototype does the same).

      Tokens used: --color-bg, --color-fg, --color-fg-muted, --color-bg-subtle, --color-border, --color-border-strong, --color-primary, --color-focus, --color-danger, --color-danger-bg, --color-danger-border, --space-1, --space-2, --space-3, --space-4, --radius-md, --radius-sm, --font-size-lg, --font-size-sm, --font-weight-medium, --font-weight-semibold, --border-width, --border-width-strong, --size-control, --size-control-sm, --size-focus-offset, --size-shell-max. Confirm each name against design-system/tokens.css while implementing.
    files:
      - apps/web/src/app/globals.css
    rationale: |
      The app does not load the tokens today, so the UI guidelines require a one-time load in the entry stylesheet.
  - description: |
      Single changeable brand value, nav definition and pure helpers (test first). Signatures:

      ```ts
      export const BRAND_NAME = "Web App";
      export const HOME_HREF = "/";
      export const SIGN_IN_HREF = "/sign-in";
      export type NavEntry = { key: string; label: string; href: string };
      export const MAIN_NAV: readonly NavEntry[]; // [{ key: "home", label: "Home", href: "/" }]
      export function brandHref(signedIn: boolean): string;
      export function visibleNav(signedIn: boolean): readonly NavEntry[];
      export function isCurrent(entry: NavEntry, pathname: string): boolean;
      ```

      Only the Home entry is defined (UI guidelines: the only destination today is Home, `data-nav-key="home"`; new sections are appended to the end). New hires and Holidays entries are added by the stories that ship those screens. Role-specific filtering belongs to the sign-in/roles story, so `MAIN_NAV` is the one append point.
    files:
      - apps/web/src/lib/shell.ts
      - apps/web/src/lib/shell.test.ts
    rationale: |
      Keeps brand text and nav as data so AC9 ("Acme Portal") is a one-line change. The logic is unit-testable in the existing node-environment vitest setup (vitest.config.ts includes src/**/*.test.ts and .test.tsx) without adding jsdom.
  - description: |
      Session seam. `apps/web/src/lib/session.ts` exports:

      ```ts
      export type Session = { role: string } | null;
      export async function getSession(): Promise<Session>; // server side, used by the layout
      export async function signOut(): Promise<void>;       // rejects on failure
      ```

      Until the Invitations/sign-in/roles story lands there is no real session. The default implementation reads the session from the Records API and treats no session (or an unreachable API) as signed out. That story replaces the bodies without changing the signatures. See the open question about the endpoints.
    files:
      - apps/web/src/lib/session.ts
    rationale: |
      The epic says the signed-in role comes from the Invitations, sign-in and roles item. The shell must consume auth, not own it.
  - description: |
      Shell components, matching the prototype markup. Split so the markup is testable with `renderToStaticMarkup`:

      ```tsx
      // TopBar.tsx: presentational, no hooks
      export function TopBar(props: {
        signedIn: boolean;
        pathname: string;
        menuOpen?: boolean;          // default false
        error?: string | null;       // sign-out error text
        onToggleMenu?: () => void;
        onSignOut?: () => void;
        signingOut?: boolean;
      }): JSX.Element;
      ```

      `TopBar` renders `<header class="shell-header">` > `.shell-bar`. The left group holds `<a class="shell-brand" href={brandHref(signedIn)}>{BRAND_NAME}</a>`. When signed in the left group also holds `<button class="btn btn-secondary btn-sm shell-menu-btn" type="button" aria-controls="main-nav" aria-expanded={menuOpen}>Menu</button>` and `<nav id="main-nav" class="shell-nav" aria-label="Main">`. The nav has one `<a data-nav-key href>` per `visibleNav(signedIn)` entry, with `aria-current="page"` on the current one. It carries an open-state hook (`data-open`) that the CSS uses below 768px. The Sign out `<button class="btn btn-ghost" type="button">` is the last flex child of `.shell-bar`, so `justify-content: space-between` puts it on the right. When `error` is set, render `<div class="alert alert-danger" role="alert">` with the prototype copy "Sign out failed. You are still signed in. Try again." (text plus icon, never colour alone). Signed out renders the brand only: no Menu, nav or Sign out.

      `TopBarControls.tsx` is a client component (`"use client"`, props `{ signedIn: boolean }`). It reads `usePathname()` from next/navigation and `useRouter()`. It owns the `menuOpen` and `error` state and renders `TopBar`. Sign out handler:

      ```ts
      async function handleSignOut(
        deps: { signOut: () => Promise<void>; replace: (href: string) => void; refresh: () => void },
        setError: (m: string | null) => void,
      ) {
        try { await deps.signOut(); } catch { setError(SIGN_OUT_ERROR); return; }
        deps.replace(SIGN_IN_HREF); deps.refresh();
      }
      ```

      Export the handler (with injected deps) so it is unit-testable. On failure the session state is untouched, the router is not called and the button stays rendered and enabled. The Menu is a native `<button>` with `aria-controls` and a toggled `aria-expanded`, so it is keyboard operable (Enter/Space) and announced by screen readers. This answers the deferred accessibility question.
    files:
      - apps/web/src/components/TopBar.tsx
      - apps/web/src/components/TopBarControls.tsx
      - apps/web/src/components/TopBar.test.tsx
    rationale: |
      Mirrors prototype elements top-bar, main-nav, .shell-brand, .shell-menu-btn, .shell-nav and the "Sign out failed (signed in)" screen. The prototype shows that failure as a `.toast role="alert"`; see the toast vs alert assumption. The usePathname hook lives in the client wrapper because the server layout has no pathname.
  - description: |
      Wire the shell into the root layout so every screen gets it. `layout.tsx` becomes async. It calls `const session = await getSession();`, then renders `<div className="shell"><TopBarControls signedIn={session !== null} /><main className="shell-main">{children}</main></div>` inside `<body>`. Keep `min-h-screen` on body and drop the Tailwind colour utilities in favour of the token-based `--color-bg` and `--color-fg` set in globals.css. `metadata.title` reads `BRAND_NAME`. `page.tsx` drops its own `<main>` and centring wrapper, because the layout provides `<main class="shell-main">`. It keeps `<h1>{appTitle()}</h1>` so `home.spec.ts` still holds.
    files:
      - apps/web/src/app/layout.tsx
      - apps/web/src/app/page.tsx
    rationale: |
      A single layout is how the header appears on every screen (AC1-AC6). It avoids nested `<main>` landmarks. Reading the session makes the layout dynamic, which is expected for per-user chrome.
  - description: |
      Playwright e2e for behaviour that needs a real browser (viewport width, focus, navigation). Add `top-bar.spec.ts` and keep `home.spec.ts` passing. The signed-in, signed-out and failing sign-out states are driven by stubbing the session and sign-out requests. Server-side `getSession()` runs in the Next server, so `page.route()` cannot intercept it. The spec therefore needs a test seam, for example `getSession` reading a test-only cookie or header that the stubbed Records API honours. The implementer chooses the least invasive seam and documents it in session.ts. See the open question.
    files:
      - apps/web/tests/e2e/top-bar.spec.ts
    rationale: |
      Vitest here runs in the node environment with no DOM library, and the plan adds no new dependency. Interaction and responsive criteria are verified where a real browser exists.
tests:
  - |
    AC4/AC9 brand text is a single value. Write first in `apps/web/src/lib/shell.test.ts` and `TopBar.test.tsx`, rendering with `renderToStaticMarkup` from react-dom/server:

    ```ts
    expect(BRAND_NAME).toBe("Web App");
    expect(renderToStaticMarkup(<TopBar signedIn={true} pathname="/" />)).toContain(">Web App<");
    ```

    For AC9, `vi.mock("@/lib/shell", async (orig) => ({ ...(await orig()), BRAND_NAME: "Acme Portal" }))`, then assert the markup contains `>Acme Portal<` and does not contain `>Web App<`.
  - |
    AC1/AC2/AC3 signed-in header on any screen. Unit: the markup contains `<header`, a button named "Sign out" and the brand. e2e on `/` and a second route with the session stubbed signed in:

    ```ts
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Web App" })).toBeVisible();
    ```
  - |
    AC5/AC6 signed-out header. Unit:

    ```ts
    const html = renderToStaticMarkup(<TopBar signedIn={false} pathname="/sign-in" />);
    expect(html).toContain(">Web App<");
    expect(html).not.toContain("Sign out");
    expect(html).not.toContain("data-nav-key");
    expect(html).not.toContain("Menu");
    expect(visibleNav(false)).toEqual([]);
    ```
  - |
    AC7/AC8 brand target. Unit:

    ```ts
    expect(brandHref(true)).toBe("/");
    expect(brandHref(false)).toBe("/sign-in");
    ```

    e2e: signed in, click the brand and `await expect(page).toHaveURL("/")`. Signed out, click the brand and `await expect(page).toHaveURL(/\/sign-in$/)`.
  - |
    AC10/AC19 collapse at 767px and inline at 768px. e2e, signed in:

    ```ts
    await page.setViewportSize({ width: 767, height: 800 });
    await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Home" })).toBeHidden();
    await page.setViewportSize({ width: 768, height: 800 });
    await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();
    await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
    ```
  - |
    AC11 Menu opens the nav and is keyboard accessible. e2e at 767px:

    ```ts
    const menu = page.getByRole("button", { name: "Menu" });
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await menu.focus();
    await page.keyboard.press("Enter");
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
    ```

    Unit: `expect(html).toContain('aria-controls="main-nav"'); expect(html).toContain('id="main-nav"');`
  - |
    AC12 Sign out at the right of the header. e2e at 1280px:

    ```ts
    const bar = (await page.locator(".shell-bar").boundingBox())!;
    const out = (await page.getByRole("button", { name: "Sign out" }).boundingBox())!;
    const nav = (await page.locator("#main-nav").boundingBox())!;
    expect(out.x).toBeGreaterThan(nav.x + nav.width);
    expect(out.x + out.width).toBeGreaterThan(bar.x + bar.width - 40);
    ```

    The 40px slack covers padding and the `--size-shell-max` centring, so the implementer may tighten it.
  - |
    AC13 Sign out success. Unit for `handleSignOut` with an injected `signOut` that resolves:

    ```ts
    const replace = vi.fn(); const refresh = vi.fn();
    await handleSignOut({ signOut: async () => {}, replace, refresh }, vi.fn());
    expect(replace).toHaveBeenCalledWith("/sign-in");
    ```

    e2e: stub sign-out to 200, click Sign out, then `await expect(page).toHaveURL(/\/sign-in$/)`.
  - |
    AC14/AC15/AC16 Sign out failure. Unit with a rejecting `signOut`:

    ```ts
    const setError = vi.fn(); const replace = vi.fn();
    await handleSignOut({ signOut: async () => { throw new Error("x"); }, replace, refresh: vi.fn() }, setError);
    expect(setError).toHaveBeenCalledWith(expect.stringContaining("Sign out failed"));
    expect(replace).not.toHaveBeenCalled();
    const html = renderToStaticMarkup(<TopBar signedIn={true} pathname="/" error="Sign out failed. You are still signed in. Try again." />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Sign out</button>");
    ```

    e2e: stub sign-out to 500, click Sign out, then:

    ```ts
    await expect(page.getByRole("alert")).toContainText("Sign out failed");
    await expect(page).not.toHaveURL(/\/sign-in$/);
    await expect(page.getByRole("button", { name: "Sign out" })).toBeEnabled();
    ```
  - |
    AC17/AC18 current page highlight and exposure. Unit:

    ```ts
    expect(isCurrent(MAIN_NAV[0], "/")).toBe(true);
    const html = renderToStaticMarkup(<TopBar signedIn={true} pathname="/" />);
    expect(html).toMatch(/<a[^>]*data-nav-key="home"[^>]*aria-current="page"/);
    ```

    A non-current entry has no `aria-current`. The visible highlight comes from the `.shell-nav a[aria-current="page"]` rule (`--color-primary` on `--color-bg-subtle`), tied to the same attribute. e2e at 1280px: `await expect(page.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page")`.
  - |
    Regression: the existing `apps/web/tests/e2e/home.spec.ts` heading assertion and `apps/web/src/lib/title.test.ts` pass unchanged. Narrow run, for example `cd apps/web && pnpm test -- src/lib/shell.test.ts src/components/TopBar.test.tsx`.
assumptions_or_open_questions:
  - |
    No auth or session code exists in the repo. I searched and listed `apps/web/src` (only app/layout.tsx, app/page.tsx, app/globals.css, lib/title.ts, lib/title.test.ts) and the plan therefore adds a `session.ts` seam. Open question for a human: what are the real session-read and sign-out endpoints (Records API route, cookie vs token)? `getSession()` runs server-side in the layout, so e2e cannot stub it with `page.route()`. A test seam is needed, and the sign-in story should own the final shape.
  - |
    AC8 and AC13 expect the sign-in page to be shown, but no `/sign-in` route exists and the item says it owns no feature screens. The plan targets `/sign-in` (SIGN_IN_HREF) and does not build the page. The route path needs confirming with the sign-in story, and the e2e tests assert only the URL.
  - |
    Prototype vs AC: the prototype's "Sign out failed" screen uses a `.toast role="alert"`, while the UI guidelines reserve toast for transient confirmations and `.alert` for messages that stay on the page. AC14 says only that an error message is shown. The plan renders a persistent `.alert.alert-danger role="alert"` with the prototype wording. Say so if the toast is wanted instead.
  - |
    The prototype's static shell markup omits the Sign out button itself, so the exact variant is unspecified. The plan uses `.btn-ghost` as the last flex child of `.shell-bar` (right via `justify-content: space-between`). Confirm the variant.
  - |
    Only the Home nav entry is created. The epic mentions New hires and Holidays, but those screens and their role-based visibility belong to other items. The UI guidelines say to add sections to the end of the nav as they ship, so `MAIN_NAV` is the append point. AC6 and AC17-AC19 are satisfied with Home alone.
  - |
    Menu accessibility (the deferred question) is answered with a native button, aria-controls, aria-expanded, Enter/Space operation and visible focus via `outline` using `--border-width-strong` and `--color-focus`. Escape-to-close and focus trapping are not planned: the nav is an inline disclosure, not a modal.
  - |
    Vitest uses the node environment with no DOM library, so component tests use `renderToStaticMarkup` and interaction is covered in Playwright. Adding jsdom plus Testing Library would need new dev dependencies, and that is not assumed.
  - |
    The project-wide question about data retention for new-hire personal details and uploaded documents is not answerable from this item and is not relevant to the header. It is not addressed here.
estimated_points: 5
package_dependencies: []
notes: |
  ### Data & rollout

  None — UI shell only; no database, stored data, migration, seed or new env var. Any session endpoint settings belong to the sign-in story.

  Token loading (found by reading): `apps/web/src/app/layout.tsx:2` imports `./globals.css`. `apps/web/src/app/globals.css:1` is only `@import "tailwindcss";` (Tailwind v4 via postcss). No file under `apps/web` references `design-system/`. The plan adds the single token import to `globals.css`. Tokens are defined in `design-system/tokens.css`.

  Design read: the prototype (`PROD-28OCT-STORY-016-design.html`) shows `.shell` > `.shell-header` > `.shell-bar` (flex, wrap, space-between, padding `--space-2` `--space-3`, max width `--size-shell-max`). It has a brand link `.shell-brand` (`--font-size-lg`, semibold) and a `.btn btn-secondary btn-sm shell-menu-btn` "Menu" button with `aria-controls="main-nav" aria-expanded`. The `nav#main-nav.shell-nav` has `aria-label="Main"` and `a[data-nav-key="home"][aria-current="page"]`, hidden below 768px and inline at `min-width: 768px`. The active entry uses `--color-primary` on `--color-bg-subtle`. Prototype screens: Home, New hires, Menu open (narrow), Sign out failed, Sign in (signed out). The prototype's pink page background (`--color-danger-bg` on body/.screen) is a review artefact, not part of the shell, and is deliberately not carried over, because the UI guidelines say light, white surfaces (`--color-bg`). The prototype footer is in no acceptance criterion and is not planned. The implementer should re-open the prototype's `data-arc-shell-style` block when copying the CSS.

  Existing test setup: `apps/web/vitest.config.ts` uses the node environment with the `@` alias to `src` and includes `src/**/*.test.ts` and `.test.tsx`, so `.tsx` unit tests run without config changes. `tsconfig.json` has `jsx: react-jsx` and the `@/*` path alias.

  ```mermaid
  flowchart TD
    layout[src/app/layout.tsx]:::touched -->|renders on every screen| controls[components/TopBarControls.tsx]:::touched
    layout -->|reads signed-in state| session[lib/session.ts]:::touched
    controls -->|presentational markup| topbar[components/TopBar.tsx]:::touched
    controls -->|signOut| session
    topbar -->|brand, nav, helpers| shell[lib/shell.ts]:::touched
    layout -->|imports| css[src/app/globals.css]:::touched
    css -->|token import| tokens[design-system/tokens.css]
    layout --> page[src/app/page.tsx]:::touched
    page --> title[lib/title.ts]
    classDef touched fill:#f96,color:#000
  ```
review_focus: |
  IN: the shared header, brand constant, Home-only nav, Menu collapse at 768px, Sign out and its failure handling, the one-time token import, and layout/page wiring. OUT: the sign-in page and real auth/session, the New hires and Holidays screens, and role-based nav filtering. The riskiest area is the session seam and sign-out flow: no auth exists yet, the endpoints are assumed, and the server-side session read in the async layout cannot be stubbed with page.route(). Deliberate choices: `.alert` instead of the prototype's toast, no jsdom (component tests use renderToStaticMarkup, interaction is tested in Playwright), and the prototype's pink page background is not copied.
