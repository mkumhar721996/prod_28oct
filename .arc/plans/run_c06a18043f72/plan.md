summary: |
  Make the shared top bar's main navigation role-aware. `NavEntry` gains an optional `roles` list, `MAIN_NAV` gets New hires and Holidays entries (in that order, after Home) restricted to the `hr` role, `visibleNav` filters by the session role, and the root layout passes `session.role` through `TopBarControls` to `TopBar`. New hires see Home only. Rendering only: which role gets which entry beyond HR, landing pages and direct-URL access control stay with the roles epic; Documents is out of scope.
scope:
  - description: |
      Role-aware nav model in `apps/web/src/lib/shell.ts`.
      Before -> after:
      ```ts
      export type NavEntry = { key: string; label: string; href: string };
      export function visibleNav(signedIn: boolean): readonly NavEntry[]
      ```
      ```ts
      export type NavEntry = { key: string; label: string; href: string; roles?: readonly string[] };
      export function visibleNav(signedIn: boolean, role?: string | null): readonly NavEntry[]
      ```
      `roles` omitted means every signed-in user (Home). Append after Home, in this order:
      `{ key: "new-hires", label: "New hires", href: "/new-hires", roles: ["hr"] }` then
      `{ key: "holidays", label: "Holidays", href: "/holidays", roles: ["hr"] }`.
      `visibleNav` returns [] when signed out, else entries with no `roles` or whose `roles` include `role`.
    files:
      - apps/web/src/lib/shell.ts
      - apps/web/src/lib/shell.test.ts
    rationale: |
      MAIN_NAV is the documented single append point; keeping the filter in the pure lib function makes it unit-testable without rendering.
  - description: |
      Thread the role to the bar. `TopBar` gets a `role?: string | null` prop and calls `visibleNav(signedIn, role)`.
      `TopBarControls` gets `{ signedIn, role }` and forwards it. `layout.tsx` passes `role={session?.role ?? null}` (the existing `getSession()` result, no new fetch).
    files:
      - apps/web/src/components/TopBar.tsx
      - apps/web/src/components/TopBarControls.tsx
      - apps/web/src/app/layout.tsx
      - apps/web/src/components/TopBar.test.tsx
    rationale: |
      Reuses the existing TopBar and TopBarControls rather than adding a component. The layout already wraps every screen, which satisfies "any screen".
  - description: |
      No styling change: entries render through the existing `<nav className="shell-nav">` anchors, so no design-system tokens are used or added.
    files: []
    rationale: Nothing new to style.
tests:
  - |
    AC1 and AC2 (HR sees New hires and Holidays). In `apps/web/src/components/TopBar.test.tsx`, write first:
    ```tsx
    const hr = renderToStaticMarkup(<TopBar signedIn role="hr" pathname="/" />);
    expect(hr).toMatch(/data-nav-key="new-hires"[^>]*>New hires</);
    expect(hr).toMatch(/data-nav-key="holidays"[^>]*>Holidays</);
    ```
    Plus in `shell.test.ts`: `expect(visibleNav(true, "hr").map((e) => e.label)).toEqual(expect.arrayContaining(["New hires", "Holidays"]))`.
  - |
    AC3 and AC4 (new hire sees neither). In `TopBar.test.tsx`:
    ```tsx
    const nh = renderToStaticMarkup(<TopBar signedIn role="new_hire" pathname="/" />);
    expect(nh).not.toContain("New hires");
    expect(nh).not.toContain("Holidays");
    expect(nh).toContain('data-nav-key="home"');
    ```
    Plus `expect(visibleNav(true, null).map((e) => e.key)).toEqual(["home"])` so an unknown or missing role shows no HR entries.
  - |
    AC5 (order). In `shell.test.ts`:
    ```ts
    const keys = visibleNav(true, "hr").map((e) => e.key);
    expect(keys.indexOf("new-hires")).toBeLessThan(keys.indexOf("holidays"));
    ```
    and in `TopBar.test.tsx` `expect(hr.indexOf(">New hires<")).toBeLessThan(hr.indexOf(">Holidays<"))`.
  - |
    Regression. Update the existing `shows nav only when signed in` test so signed out still gives `visibleNav(false, "hr")` equal to `[]`. The existing TopBar tests that omit `role` keep passing, since Home has no `roles`. Narrow command: `cd apps/web && pnpm test src/lib/shell.test.ts src/components/TopBar.test.tsx`.
assumptions_or_open_questions:
  - |
    Role identifiers are assumed to be the strings `hr` and `new_hire`. The only evidence is `role: "hr"` in `apps/web/tests/e2e/mock-session-server.mjs`. The roles epic should confirm the real values. The check is an allow-list on `hr`, so any other role (including `new_hire`) sees no HR entries.
  - |
    Hrefs `/new-hires` and `/holidays` are assumed. `/new-hires` matches the existing `isCurrent` test. The screens ship in other stories, so the links may 404 until then.
  - |
    Home stays visible to every signed-in role, since the ACs only restrict New hires and Holidays.
  - |
    The `Session` type in `apps/web/src/lib/session.ts` is `{ role: string } | null`. It is a seam the roles story will replace, and this plan relies only on `role` staying a string.
  - |
    The project-wide data retention question (from PROD-28OCT-CHORE-015) does not affect navigation rendering and is not addressed here.
  - |
    Optional e2e coverage in `apps/web/tests/e2e/top-bar.spec.ts` is not planned. The mock session server only returns the `hr` role, so a new-hire e2e would need a mock change. Unit tests cover all five ACs.
estimated_points: 2
package_dependencies: []
notes: |
  ### Data & rollout

  None — UI rendering only, no stored data, schema, settings or env vars.

  Research: `visibleNav`, `MAIN_NAV` and `isCurrent` live in `apps/web/src/lib/shell.ts`. `TopBar` is a pure presentational component. `TopBarControls` is the client wrapper. `layout.tsx` already calls `getSession()`, which returns `{ role }`. Direct URL access control is out of scope (roles epic).

  ```mermaid
  flowchart TD
    Layout[app/layout.tsx] -->|passes session role| Controls[TopBarControls]
    Controls -->|forwards role| TopBar[TopBar]
    TopBar -->|visibleNav signedIn, role| Shell[lib/shell.ts]
    Layout --> Session[lib/session.ts getSession]
    classDef touched fill:#f96,color:#000
    class Layout,Controls,TopBar,Shell touched
  ```
review_focus: |
  IN: the role filter in `shell.ts`, the two HR-only entries in order, and threading `role` through layout, TopBarControls and TopBar. OUT: access control for direct URLs, landing pages, Documents, and any styling. The riskiest part is the assumed role string `hr`: filtering is an allow-list, so an unknown role fails closed, which is deliberate. Home is intentionally unrestricted.
