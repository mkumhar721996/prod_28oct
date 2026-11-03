summary: |
  Show the signed-in player's credit balance as a badge in the existing top bar (`TopBar` / `TopBarControls`), next to Sign out. The root layout (a server component that already calls `getSession()`) also reads the balance with the existing `getWalletBalance()` for signed-in players only. A failed read is caught and passed down as `null`, which renders `--`. Signed-out visitors get no badge. To update without a reload, a small client-side shared balance store (a `BalanceProvider` context mounted in the layout) holds the current balance. Anything that changes the balance publishes the new value through a `useBalance().setBalance(n)` hook. `ClaimCreditsPanel` (top-up) is wired to it now. Bet and win belong to Game play, which will call the same hook, so betting is out of scope here.
scope:
  - description: |
      Shared balance store. New client component `BalanceProvider` plus the hook `useBalance()`.
      ```ts
      export type BalanceState = number | null; // null = could not be loaded
      export function BalanceProvider(props: { initial: BalanceState; children: React.ReactNode }): JSX.Element;
      export function useBalance(): { balance: BalanceState; setBalance: (credits: number) => void };
      ```
      `setBalance` replaces the value, and a later successful publish also clears the `null` state. Re-sync from `initial` when the prop changes (a `router.refresh()` re-renders the layout with a fresh server value), so server refreshes and client publishes agree.
    files:
      - apps/web/src/components/BalanceProvider.tsx
      - apps/web/src/components/BalanceProvider.test.tsx
    rationale: |
      The question left for planning was how the top bar learns about changes. Chosen: shared client state fed by the action that changed the balance. It needs no polling or push, the update is immediate, and the API already returns the new balance on every claim. `CartProvider` in the layout is the precedent for a client provider there.
  - description: |
      Top bar balance badge. `TopBar` gets a new prop `balance?: number | null`, and the badge renders only when `signedIn` is true.
      - A number renders `<span class="badge badge-info" data-wf-id="balance" role="status" aria-live="polite">` with `formatCredits(n)` ("1,000 credits"). The prototype shows the badge in this form (`badge-info`) and the page copy says "announced politely as Balance 900 credits".
      - `null` renders `<span class="badge badge-danger"><span aria-hidden="true">--</span><span class="sr-only">Balance unavailable</span></span>`, as in the prototype's "balance not loaded" screen.
      - Place it after `.shell-group` and before the Sign out button, inside `.shell-bar`.
      Reuse `formatCredits` from `BalanceTile.tsx`. `TopBarControls` reads `useBalance()` and passes `balance` to `TopBar`. `TopBar` stays presentational, like today.
    files:
      - apps/web/src/components/TopBar.tsx
      - apps/web/src/components/TopBarControls.tsx
      - apps/web/src/components/TopBar.test.tsx
      - apps/web/src/app/globals.css
    rationale: |
      Adds the display to the existing top bar rather than a new component, as the catalogue requires. CSS uses tokens only. `.balance-badge` is a small rule (`min-height: var(--size-control-sm)`, `font-size: var(--font-size-md)`, `font-variant-numeric: tabular-nums`), mirroring the prototype's `.mirror .badge`, and `margin-left: auto` or the existing `justify-content: space-between` keeps it beside Sign out. `.sr-only` is available from Tailwind. The badge and Sign out must not wrap awkwardly below 768px.
  - description: |
      Root layout loads the initial balance server side and mounts the provider.
      ```ts
      const session = await getSession();
      const balance = session ? await getWalletBalance().catch(() => null) : null;
      // <BalanceProvider initial={balance}> wraps the shell, inside CartProvider
      ```
      Signed-out visitors never trigger a wallet request. A wallet failure must not break the page (AC4).
    files:
      - apps/web/src/app/layout.tsx
    rationale: |
      The layout wraps every page, so "any page with the top bar" is covered once. `getWalletBalance` already exists in `lib/session.ts` and throws on a non-2xx response.
  - description: |
      Publish top-up results. In `ClaimCreditsPanel`, after a successful claim call `setBalance(result.balanceCredits)`. `runClaim` gets an optional `publish: (credits: number) => void` dependency, called before the outcome is returned. The existing `router.refresh()` stays, so the server-rendered wallet page also updates.
    files:
      - apps/web/src/components/ClaimCreditsPanel.tsx
      - apps/web/src/components/ClaimCreditsPanel.test.tsx
    rationale: |
      Top-up is the only balance-changing action that exists today (AC2). Bet and win call `useBalance().setBalance` from Game play when it ships.
  - description: |
      End-to-end check. Extend the existing Playwright spec and its mock API (`mock-session-server.mjs`) with a wallet read, a failing wallet read for a flagged cookie, and a top-up that returns a new balance.
    files:
      - apps/web/tests/e2e/player-accounts.spec.ts
      - apps/web/tests/e2e/mock-session-server.mjs
    rationale: |
      Proves AC1 to AC4 in a browser with the real layout and no reload.
tests:
  - |
    AC1, `TopBar.test.tsx` (write first, fails until the badge exists):
    ```ts
    const html = renderToStaticMarkup(<TopBar signedIn pathname="/" balance={1000} />);
    expect(html).toContain("1,000 credits");
    expect(html).toMatch(/class="badge badge-info"[^>]*>1,000 credits</);
    ```
    Plus a `TopBarControls` or layout-level test that `getWalletBalance` resolving 1000 gives `BalanceProvider initial={1000}`.
  - |
    AC2, `BalanceProvider.test.tsx` and `ClaimCreditsPanel.test.tsx`:
    ```ts
    // provider: setBalance publishes to all consumers without remount
    act(() => result.current.setBalance(900));
    expect(result.current.balance).toBe(900);
    // runClaim publishes the new balance
    const publish = vi.fn();
    await runClaim({ claimFreeCredits: async () => ({ ok: true, balanceCredits: 501, grantedCredits: 500 }), refresh: vi.fn(), publish });
    expect(publish).toHaveBeenCalledWith(501);
    // failed claim does not publish
    expect(publish).not.toHaveBeenCalled();
    ```
    The e2e case clicks "Claim free credits" and expects the top-bar badge text to change with no navigation (assert `page.url()` is unchanged and no `load` event fires).
  - |
    AC3, `TopBar.test.tsx`:
    ```ts
    const out = renderToStaticMarkup(<TopBar signedIn={false} pathname="/" balance={1000} />);
    expect(out).not.toContain("credits");
    expect(out).not.toContain("badge");
    ```
    A layout test asserts `getWalletBalance` is not called when `getSession()` returns null. The e2e case checks signed-out pages have no balance badge.
  - |
    AC4, `TopBar.test.tsx`:
    ```ts
    const bad = renderToStaticMarkup(<TopBar signedIn pathname="/" balance={null} />);
    expect(bad).toContain(">--<");
    expect(bad).toContain("badge-danger");
    expect(bad).toContain("Balance unavailable");
    ```
    A layout test shows a rejecting `getWalletBalance` gives `initial={null}` and the page still renders. A provider test shows `setBalance(700)` replaces a `null` state with 700.
  - |
    Regression: the existing `TopBar.test.tsx` cases, including "places Sign out after the nav", keep passing. A `balance` omitted from a signed-in `TopBar` renders no badge, so older call sites are unaffected.
    Narrow command per task, for example `(cd apps/web && pnpm test -- src/components/TopBar.test.tsx)` and the same with `BalanceProvider.test.tsx` or `ClaimCreditsPanel.test.tsx`. Run the e2e spec with the web app's Playwright command.
assumptions_or_open_questions:
  - |
    Decision on the deferred question: shared client state, no polling or push. The balance shown stays correct only for changes made through this browser session's UI. A change made in another tab or device appears on the next navigation or `router.refresh()`. Say so if cross-tab sync is wanted; it is not in the ACs.
  - |
    Bet and win do not exist in the code yet (Game play owns them). This plan delivers the `useBalance().setBalance` contract and wires top-up only. The prototype's "Place bet" and "Record win" buttons and its demo-box are prototype scaffolding and are NOT built here.
  - |
    The prototype's "Try again" retry button and skeleton on the unavailable screen sit in page content, not the top bar. AC4 only requires `--`, so they are left out. A reload or a successful top-up recovers the badge.
  - |
    Prototype and code differ in the shell: the prototype's top bar shows only brand and Home, and the balance badge is a proposal to the shell. The existing `TopBar` already has Sign out and no Play or History links, so the badge is added beside Sign out as the prototype's note describes.
  - |
    The singular form "1 credit" comes from the existing `formatCredits`. The prototype uses the same rule, so it is kept.
  - |
    Project decision "total balance should be greater than the applied bet" is a betting rule (Game play). It is not used here.
estimated_points: 3
package_dependencies: []
notes: |
  ### Data & rollout
  None — display and client state only. No schema, stored data, seed, setting or env var changes. It reads the existing `GET /wallet` through `getWalletBalance()`. Safe to roll back by reverting the commit.

  Design source read: `PROD-28OCT-STORY-054-design.html`, with screens "Any page, signed in", "signed out" and "balance not loaded". Tokens are already loaded by the app (the existing `.shell-*` rules in `apps/web/src/app/globals.css` use `var(--space-*)`, `var(--color-*)`), so no token-loading task is needed. Tokens used: `--space-1`, `--space-2`, `--size-control-sm`, `--font-size-md`. Badge colours come from the existing `.badge-info` and `.badge-danger` classes.

  Existing pieces reused: `TopBar`, `TopBarControls`, `formatCredits` (`BalanceTile.tsx`), `ClaimCreditsPanel`, `getWalletBalance` (`lib/session.ts`), `CartProvider` as the precedent for a layout-level provider.

  ```mermaid
  flowchart TD
    Layout["app/layout.tsx (reads balance server side)"] --> BP["BalanceProvider (new shared store)"]
    Layout --> GWB["lib/session.ts getWalletBalance (existing)"]
    BP --> TBC["TopBarControls (reads useBalance)"]
    TBC --> TB["TopBar (renders badge)"]
    TB --> FC["BalanceTile.formatCredits (existing)"]
    CCP["ClaimCreditsPanel (publishes new balance)"] --> BP
    classDef touched fill:#f96,color:#000
    class Layout,BP,TBC,TB,CCP touched
  ```
review_focus: |
  IN: the badge in the existing top bar (signed in, signed out, failed load), the initial server-side read in the layout, a shared client balance store, and top-up publishing. OUT: betting, winning and the prototype's demo buttons, retry UI, and cross-tab sync. Riskiest areas are the layout's wallet read (it must never throw, and must not run for signed-out visitors) and keeping the provider in step with `router.refresh()` so the badge never shows a stale value. Deliberate: `TopBar` stays presentational and receives `balance` as a prop, and `null` means "could not load", which renders `--`.
