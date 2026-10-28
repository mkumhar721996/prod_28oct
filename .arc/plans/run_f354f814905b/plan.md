summary: |
  Add one shared top bar (the app shell header) to the Next.js Web App root layout: brand text from a single constant ("Web App"), a main navigation container that collapses behind a Menu button below 768px, and a Sign out button on the right when signed in. Signed-out users see the brand only (no nav, no Sign out). The brand links to the home page when signed in and to the sign-in page when signed out. Sign out failure shows an error alert, keeps the user signed in and keeps the button. The current page's nav entry is highlighted and carries aria-current="page". It follows the approved prototype and design-system tokens. The repo has no auth or session code yet, so the shell consumes a small session seam that the Invitations/sign-in/roles story will fill in.
scope:
  - description: |
      Load the design tokens once, in the app's own entry stylesheet. `apps/web/src/app/globals.css` currently holds only `@import "tailwindcss";` and nothing references `design-system/`. Add, after the tailwind import:
      `@import "../../../../design-system/tokens.css";`
      (path from apps/web/src/app to the repo root; `layout.tsx` line 2 already imports globals.css). Then add the shell rules copied from the prototype's `data-arc-shell-style` block (.shell, .shell-header, .shell-bar, .shell-brand, .shell-menu-btn, .shell-nav, .shell-nav a, [aria-current="page"], .shell-main, plus the 768px media query) and the `.btn`, `.btn-secondary`, `.btn-ghost`, `.btn-sm` and `.alert`/`.alert-danger` rules from `design-system/prototype-utils.css` that the shell uses. Tokens only, no colour or pixel literals other than the `768px` media-query breakpoint (custom properties cannot be used in media queries; the prototype does the same).
    files:
      - apps/web/src/app/globals.css
    rationale: |
      The app does not load the tokens today, so the UI guidelines require a one-time load in the entry stylesheet. Tokens used: --color-bg, --color-fg, --color-fg-muted, --color-bg-subtle, --color-border, --color-border-strong, --color-primary, --color-focus, --color-danger, --color-danger-bg, --color-danger-border, --space-1, --space-2, --space-3, --space-4, --radius-md, --radius-sm, --font-size-lg, --font-size-sm, --font-weight-medium, --font-weight-semibold, --border-width, --border-width-strong, --size-control, --size-control-sm, --size-focus-offset, --size-shell-max.
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
      Only the Home entry is defined here (UI guidelines: the only destination today is Home, `data-nav-key="home"`; new sections are appended to the end). New hires and Holidays entries are added by the stories that ship those screens, and role-specific filtering belongs to the sign-in/roles story, so `MAIN_NAV` is the one append point.
    files:
      - apps/web/src/lib/shell.ts
      - apps/web/src/lib/shell.test.ts
    rationale: |
      Keeps brand text and nav as data so AC9 ("Acme Portal") is a one-line change and the logic is unit-testable in the existing node-environment vitest setup without adding jsdom.
  - description: |
      Session seam. `apps/web/src/lib/session.ts` exports `type Session = { role: string } | null`, `getSession(): Promise<Session>` (server side, used by the layout) and `signOut(): Promise<void>` (rejects on failure). Until the Invitations/sign-in/roles story lands there is no real session, so the default implementation reads the session from the Records API and treats no session as signed out; that story replaces the body without changing the signatures. Open question below on the endpoint.
    files:
      - apps/web/src/lib/session.ts
    rationale: |
      The epic says signed-in role comes from the Invitations, sign-in and roles item. The shell must not own auth, only consume it.
  - description: |
      Shell components, matching the prototype markup. `TopBar` (server-renderable, props `{ signedIn: boolean; pathname: string }`) renders `<header class="shell-header">` > `.shell-bar` containing: `<a class="shell-brand" href={brandHref(signedIn)}>{BRAND_NAME}</a>`; when signed in, `<button class="btn btn-secondary btn-sm shell-menu-btn" type="button" aria-controls="main-nav" aria-expanded>Menu</button>` followed by `<nav id="main-nav" class="shell-nav" aria-label="Main">` with one `<a data-nav-key href>` per `visibleNav(signedIn)` entry, `aria-current="page"` on the current one; and the Sign out button. A client component `TopBarControls` (`"use client"`, `usePathname()` from next/navigation) owns Menu open/close state (`useState`) and the sign-out handler. Menu button is a real `<button>` with `aria-controls` and `aria-expanded` toggled, so it is keyboard operable (Enter/Space) and announced by screen readers. Sign out is a `.btn .btn-ghost` (or `.btn-secondary`) button pushed to the right: the prototype's `.shell-bar` uses `justify-content: space-between`, so the Sign out button is the last flex child, wrapped with the brand/menu/nav in a left group. On sign out success call `router.replace(SIGN_IN_HREF)` then `router.refresh()`. On failure render `<div class="alert alert-danger" role="alert">` with the prototype copy "Sign out failed. You are still signed in. Try again." (text plus icon, never colour alone), keep session state untouched and keep the button rendered and enabled. Signed out renders brand only: no Menu, nav or Sign out.
    files:
      - apps/web/src/components/TopBar.tsx
      - apps/web/src/components/TopBarControls.tsx
      - apps/web/src/components/TopBar.test.tsx
    rationale: |
      Mirrors prototype elements top-bar, main-nav, `.shell-brand`, `.shell-menu-btn`, `.shell-nav`, sign-out error alert (prototype screen "Sign out failed (signed in)" uses a `.toast role="alert"`; see assumption about toast vs alert).
  - description: |
      Wire the shell into the root layout so every screen gets it. `layout.tsx` becomes async: `const session = await getSession();` then renders `<div class="shell"><TopBar .../><main class="shell-main">{children}</main></div>` inside `<body>`. Replace the Tailwind utility `className` on body only as needed (keep `min-h-screen`). `page.tsx` drops its own `<main>` and `min-h-screen` centring (the layout now provides `<main class="shell-main">`) but keeps `<h1>{appTitle()}</h1>` so the existing title and e2e test still hold.
    files:
      - apps/web/src/app/layout.tsx
      - apps/web/src/app/page.tsx
    rationale: |
      A single layout is how the header appears on every screen (AC1-AC6). Avoids nested `<main>` landmarks.
  - description: |
      Playwright e2e for behaviour that needs a real browser (viewport width, focus, navigation). Extend `apps/web/tests/e2e/` with `top-bar.spec.ts` and keep `home.spec.ts` passing. Signed-in/out states and a failing sign out are driven by `page.route()` stubbing the session and sign-out endpoints.
    files:
      - apps/web/tests/e2e/top-bar.spec.ts
    rationale: |
      vitest here runs in the node environment with no DOM library and the plan adds no new dependency; interaction and responsive criteria are verified where a real browser exists.
tests:
  - |
    AC4/AC9 brand text is a single value. In `apps/web/src/lib/shell.test.ts` and `TopBar.test.tsx` (render with `renderToStaticMarkup` from react-dom/server, available through the existing react-dom dependency):
    ```ts
    expect(BRAND_NAME).toBe("Web App");
    expect(renderToStaticMarkup(<TopBar signedIn pathname="/" />)).toContain(">Web App<");
    ```
    For AC9, `vi.mock("@/lib/shell", async (orig) => ({ ...(await orig()), BRAND_NAME: "Acme Portal" }))` then assert the markup contains `>Acme Portal<` and does not contain `>Web App<`.
  - |
    AC1/AC2/AC3 signed-in header on any screen. Unit: markup contains `<header`, a button named "Sign out" and the brand. e2e on `/` and on a second route with the session stubbed signed in:
    ```ts
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Web App" })).toBeVisible();
    ```
  - |
    AC5/AC6 signed-out header. Unit:
    ```ts
    const html = renderToStaticMarkup(<TopBar signedIn={false} pathname="/sign-in" />);
    expect(html).not.toContain("Sign out");
    expect(html).not.toContain("data-nav-key");
    expect(html).not.toContain("Menu");
    expect(visibleNav(false)).toEqual([]);
    ```
  - |
    AC7/AC8 brand target.
    ```ts
    expect(brandHref(true)).toBe("/");
    expect(brandHref(false)).toBe("/sign-in");
    ```
    e2e: signed in, click the brand and `await expect(page).toHaveURL("/")`; signed out, click the brand and `await expect(page).toHaveURL(/\/sign-in$/)`.
  - |
    AC10 narrow screen collapse. e2e with `page.setViewportSize({ width: 767, height: 800 })`, signed in:
    ```ts
    await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Home" })).toBeHidden();
    ```
    Also a wide check at 768px: `Menu` hidden and `Home` visible (the boundary the prototype's `min-width: 768px` media query defines).
  - |
    AC11 Menu opens the nav, keyboard accessible (answers the deferred accessibility question). e2e at 767px:
    ```ts
    const menu = page.getByRole("button", { name: "Menu" });
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await menu.focus();
    await page.keyboard.press("Enter");
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
    ```
    Unit: markup has `aria-controls="main-nav"` on the Menu button and `id="main-nav"` on the nav.
  - |
    AC12 Sign out at the right of the header. e2e at 1280px:
    ```ts
    const bar = await page.locator(".shell-bar").boundingBox();
    const out = await page.getByRole("button", { name: "Sign out" }).boundingBox();
    expect(out!.x + out!.width).toBeGreaterThan(bar!.x + bar!.width - 40);
    ```
    (40 allows for the `--space-3` padding at 16px each side plus rounding; the assertion is that Sign out is the right-most control, also checked as `out.x > navBox.x + navBox.width`.)
  - |
    AC13 Sign out success. Unit for the handler with an injected `signOut` that resolves: the router is called with `/sign-in`. e2e: stub the sign-out endpoint 200, click Sign out, then
    ```ts
    await expect(page).toHaveURL(/\/sign-in$/);
    ```
  - |
    AC14/AC15/AC16 Sign out failure. e2e: stub the sign-out endpoint to 500, click Sign out, then
    ```ts
    await expect(page.getByRole("alert")).toContainText("Sign out failed");
    await expect(page).not.toHaveURL(/\/sign-in$/);
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeEnabled();
    ```
    Unit for the handler with a rejecting `signOut`: error state is set, the router is not called, and the signed-in markup still contains Sign out.
  - |
    AC17/AC18 current page highlight and exposure. Unit:
    ```ts
    expect(isCurrent(MAIN_NAV[0], "/")).toBe(true);
    const html = renderToStaticMarkup(<TopBar signedIn pathname="/" />);
    expect(html).toMatch(/<a[^>]*data-nav-key="home"[^>]*aria-current="page"/);
    ```
    A non-current entry has no `aria-current`. The visible highlight comes from the `.shell-nav a[aria-current="page"]` rule (colour `--color-primary`, background `--color-bg-subtle`), so it is tied to the same attribute; e2e at 1280px asserts `await expect(page.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page")`.
  - |
    Regression: existing `home.spec.ts` heading assertion and `title.test.ts` still pass unchanged.
assumptions_or_open_questions:
  - |
    No auth or session code exists in the repo (searched `apps/*/src` and `services/*/src` for sign-in, sign-out, session, logout and found nothing). The plan therefore adds a `session.ts` seam with the signatures above. Open question for a human: what are the real session read and sign-out endpoints (Records API route, cookie vs token)? Until that story lands the e2e tests stub them with `page.route()`.
  - |
    AC8 and AC13 expect the sign-in page to be shown, but no `/sign-in` route exists and the item says it owns no feature screens. The plan targets `/sign-in` as the route (SIGN_IN_HREF) and does not build the page. Needs confirmation of the route path with the sign-in story; the e2e tests assert only the URL.
  - |
    Prototype vs AC: the prototype's "Sign out failed" screen uses a `.toast role="alert"`, while UI guidelines reserve toast for transient confirmations and `.alert` for messages that stay on the page. AC14 says only that an error message is shown. The plan renders `.alert.alert-danger role="alert"` (persistent, so a screen reader and a slow reader do not miss it) and keeps the prototype's wording. Say so if the toast is wanted instead.
  - |
    The prototype markup puts Sign out on the right in the narrow layout too ("brand, Menu and Sign out"), but its static shell markup omits the Sign out button itself (the platform places it). The plan places Sign out as the last flex child of `.shell-bar` (right with `justify-content: space-between`), on `.btn-ghost`/`.btn-secondary`. The exact variant is not specified by the prototype.
  - |
    Only the Home nav entry is created. The AC and epic mention New hires and Holidays, but those screens and their role-dependent visibility belong to other items and UI guidelines say add sections to the end of the nav as they ship. `MAIN_NAV` is the append point.
  - |
    Menu accessibility (deferred question) is answered with a native button, aria-controls, aria-expanded, Enter/Space operation and visible focus via `outline: var(--border-width-strong) solid var(--color-focus)`. Escape-to-close and focus trapping are not planned: the nav is an inline disclosure, not a modal, so they are not required.
  - |
    Vitest uses the node environment with no DOM library, so component tests use `renderToStaticMarkup` and interaction is covered in Playwright. If the team prefers jsdom plus Testing Library, that adds dev dependencies and a vitest environment change. Not assumed.
  - |
    The project-wide question about data retention for new-hire personal details and uploaded documents is not answerable from this item and not relevant to the header. It is not addressed here.
estimated_points: 5
package_dependencies: []
notes: |
  ### Data & rollout

  None — UI shell only; no database, stored data, migration, seed or new env var. The session endpoint settings, if any, belong to the sign-in story.

  Token loading (found by reading): `apps/web/src/app/layout.tsx:2` imports `./globals.css`; `apps/web/src/app/globals.css:1` is only `@import "tailwindcss";` (Tailwind v4 via `@tailwindcss/postcss` in `postcss.config.mjs`). No file under `apps/web` references `design-system/` or tokens. The plan adds the single token import to `globals.css`. Tokens are defined in `design-system/tokens.css`.

  Design read: the prototype (`PROD-28OCT-STORY-016-design.html`) shows a `.shell` with `.shell-header` > `.shell-bar` (flex, wrap, space-between, padding `--space-2` `--space-3`, max width `--size-shell-max`), brand link `.shell-brand` (`--font-size-lg`, semibold), a `.btn btn-secondary btn-sm shell-menu-btn` "Menu" button with `aria-controls="main-nav" aria-expanded`, `nav#main-nav.shell-nav aria-label="Main"` with `a[data-nav-key="home"][aria-current="page"]`, hidden below 768px and inline at `min-width: 768px`; active entry styled `--color-primary` on `--color-bg-subtle`. Screens: Home, New hires, Menu open (narrow), Sign out failed, Sign in (signed out). The prototype's page background (`--color-danger-bg` pink on body/.screen) is a review artefact for the prototype, not part of the shell, and is deliberately not carried over: the UI guidelines say light, white surfaces (`--color-bg`). The prototype footer ("Web App") is not in any acceptance criterion and is not planned.

  Brand text in the layout metadata (`title: "Web App"` in `layout.tsx`) should also read `BRAND_NAME` so "Acme Portal" flows everywhere.

  ```mermaid
  flowchart TD
    layout[src/app/layout.tsx]:::touched -->|renders on every screen| topbar[components/TopBar.tsx]:::touched
    layout -->|reads signed-in state| session[lib/session.ts]:::touched
    topbar --> controls[components/TopBarControls.tsx]:::touched
    controls -->|signOut| session
    topbar -->|brand, nav, helpers| shell[lib/shell.ts]:::touched
    layout -->|imports| css[src/app/globals.css]:::touched
    css -->|token import| tokens[design-system/tokens.css]
    layout --> page[src/app/page.tsx]:::touched
    page --> title[lib/title.ts]
    classDef touched fill:#f96,color:#000
  ```
review_focus: |
  IN: the shared header, brand constant, Home-only nav, Menu collapse at 768px, Sign out and its failure handling, token import, and layout/page wiring. OUT: the sign-in page and real auth/session, New hires and Holidays screens, role-based nav filtering. Riskiest area is the session seam and sign-out flow, since no auth exists yet and the endpoints are assumed and stubbed in e2e, plus the layout becoming async and dynamic. Deliberate choices: `.alert` instead of the prototype's toast, no jsdom (component tests use renderToStaticMarkup, interaction in Playwright), prototype pink page background not copied.
