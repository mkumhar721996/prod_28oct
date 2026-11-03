summary: |
  Replace the current Home page (title plus "Next appointment" card) with the Stocks dashboard as the
  signed-in home screen, built from sample data exactly as the approved prototype shows it: quick actions,
  market overview (3 indices, in points), portfolio summary (rupees), a performance chart with 1M/6M/1Y tabs
  (1M default; only the chart changes), holdings (table from 768px, list below), watchlist, allocation donut,
  recent transactions, goals, SIPs, three insights and a footer. Every action, search, bell and insight link
  is a disabled "Coming soon" control. The shell gains the prototype's shell-owned pieces: search, a bell with
  a count badge of 3, an account-icon menu (Profile and Settings disabled, Sign out), a "Dashboard" current
  nav item and disabled Holdings and SIPs nav entries. Signed-out and expired sessions are sent to sign-in.
  Four cards (market overview, portfolio summary, performance, watchlist) can fail with an alert plus a
  "Try again" button; every card shows skeleton placeholders until its data is ready. Follows the Lobby
  screen's pattern (client screen, injectable fetchers, `initial` prop, pure reducer) because vitest here runs
  in a node environment with `renderToStaticMarkup` and no DOM testing library.

scope:
  - description: |
      Sample portfolio data, types and pure logic in a new `lib/stocks.ts`, in the same style as `lib/games.ts`
      (SAMPLE_GAMES, async fetchers, a reducer, one load function). Numbers are stored as numbers and formatted
      for display.
      ```ts
      export type Period = "1M" | "6M" | "1Y";
      export const PERIODS: readonly Period[] = ["1M", "6M", "1Y"];
      export const DEFAULT_PERIOD: Period = "1M";
      export function formatRupees(n: number, fractionDigits = 0): string;        // "₹12,48,600" via Intl en-IN
      export function formatRupeesCompact(n: number): string;                      // 2_000_000 -> "₹20L", 20_000_000 -> "₹2Cr"
      export function formatPoints(n: number): string;                              // 24310 -> "24,310 pts"
      export function formatSigned(n: number, fractionDigits?: number): string;     // "+₹8,420" / "−₹389" style helpers
      export type CardState<T> =
        | { status: "loading" }
        | { status: "ready"; data: T }
        | { status: "error"; attempts: number };
      export type CardAction<T> = { type: "requested" } | { type: "loaded"; data: T } | { type: "failed" };
      export function cardReducer<T>(s: CardState<T>, a: CardAction<T>): CardState<T>;  // failed increments attempts
      export async function loadCard<T>(fetcher: () => Promise<T>, dispatch: (a: CardAction<T>) => void): Promise<void>;
      export const SAMPLE_PORTFOLIO: Portfolio;  // values copied verbatim from the prototype (see notes)
      export async function fetchMarketOverview(): Promise<Index[]>;  // likewise fetchSummary, fetchPerformance, fetchWatchlist
      ```
      Non-failable cards (holdings, allocation, transactions, goals, SIPs, insights) show loading then ready only,
      as in the prototype (only market overview, summary, performance and watchlist carry `data-failable`).
    files:
      - apps/web/src/lib/stocks.ts
      - apps/web/src/lib/stocks.test.ts
    rationale: |
      Keeps formatting, state transitions and sample data pure and testable under the node-environment vitest
      setup, and lets a real API replace the sample fetchers later without touching the UI (the comment in
      lib/games.ts describes the same intent).

  - description: |
      Dashboard components under `components/dashboard/`, one per prototype section, composed by a client
      `StocksDashboard` that mirrors `LobbyScreen` (`fetch*` props default to the sample fetchers, `initial`
      prop renders a given state without effects, `useReducer` + `useEffect` start-once guard).
      - `DashboardCard`: wraps a section and renders loading (`.skeleton` lines, `role="status"`, `aria-busy`,
        `aria-label="Loading <label>"`), failed (`.alert .alert-danger role="alert"` with message
        "We couldn't load the <label>. Check your connection, then try again." and a `.btn .btn-secondary`
        "Try again"; from the second failure the message reads "Still couldn't load the <label>. Try again in
        a moment.") or ready children. Retry runs `loadCard` again; success replaces the failure message.
      - `ComingSoonButton` (`<button disabled aria-label="Buy, coming soon">Buy<span class="soon">Coming soon</span></button>`),
        used for Buy, Sell, Add funds, Add stock, Create goal, New SIP and per-holding Buy and Sell (compact,
        `btn-sm`, `title="Coming soon"`); `ComingSoonLink` for the three insight links (`.link-soon`).
      - `InfoTip` for the three "?" tooltips (P&L, total return, benchmark): a `.help` button with
        `aria-describedby` and a `role="tooltip"` span shown on hover and focus-within.
      - `MarketOverviewCard` (NIFTY 50 24,310 pts ▲ 0.6%, SENSEX 79,820 pts ▲ 0.5%, NIFTY Bank 52,140 pts ▼ 0.3%).
      - `PortfolioSummary` (four `.tile`s: Portfolio value, Today's P&L, Total return, Active SIPs).
      - `PerformanceCard` owns `period` state (`useState<Period>(DEFAULT_PERIOD)`), renders `PerformanceChart`
        (inline SVG, viewBox 0 0 544 220, portfolio solid line vs NIFTY 50 dashed, per-period axes, end labels),
        the legend badges, `PeriodTabs` (`role="tablist"`, `role="tab"`, `aria-selected`, roving `tabIndex`,
        ArrowLeft/ArrowRight) and the `role="status"` period note ("Showing the last month, 1 Oct to 29 Oct.").
        Period state is local to this card so no other card re-renders from props that change.
      - `HoldingsCard` (table at 768px and up, `.rows` list below, both with disabled Buy and Sell),
        `WatchlistCard`, `AllocationCard` (donut `circle`s using `stroke-dasharray` plus legend badges with the
        percentage in text), `TransactionsCard`, `GoalsCard` (`role="progressbar"` bars), `SipsCard`,
        `InsightsCard` (badge text On track, Watch or Action needed, each with an icon or word as well as colour).
      Up/down figures always carry ▲/▼ plus a sign, never colour alone (UI guidelines, status rule). The one
      `.btn-primary` rule is relaxed only where the prototype shows two (Buy and New SIP); see open questions.
      Reuses `Icon` (add `search`, `user` and `chevron-down` paths from the prototype sprite) and the existing
      `.card`, `.badge-*`, `.tabs/.tab`, `.alert-danger`, `.skeleton`, `.spinner`, `.btn-*`, `.stack*` classes.
      `OrderStatusBadge` is typed to `OrderStatus` so is not reused; badges use `.badge badge-*` directly.
    files:
      - apps/web/src/components/dashboard/StocksDashboard.tsx
      - apps/web/src/components/dashboard/DashboardCard.tsx
      - apps/web/src/components/dashboard/ComingSoon.tsx
      - apps/web/src/components/dashboard/InfoTip.tsx
      - apps/web/src/components/dashboard/MarketOverviewCard.tsx
      - apps/web/src/components/dashboard/PortfolioSummary.tsx
      - apps/web/src/components/dashboard/PerformanceCard.tsx
      - apps/web/src/components/dashboard/PerformanceChart.tsx
      - apps/web/src/components/dashboard/PeriodTabs.tsx
      - apps/web/src/components/dashboard/HoldingsCard.tsx
      - apps/web/src/components/dashboard/WatchlistCard.tsx
      - apps/web/src/components/dashboard/AllocationCard.tsx
      - apps/web/src/components/dashboard/TransactionsCard.tsx
      - apps/web/src/components/dashboard/GoalsCard.tsx
      - apps/web/src/components/dashboard/SipsCard.tsx
      - apps/web/src/components/dashboard/InsightsCard.tsx
      - apps/web/src/components/dashboard/StocksDashboard.test.tsx
      - apps/web/src/components/dashboard/DashboardCard.test.tsx
      - apps/web/src/components/dashboard/PerformanceCard.test.tsx
      - apps/web/src/components/orders/Icon.tsx
    rationale: |
      One component per prototype section keeps each card's loading, failed and ready states in one place and
      mirrors the prototype's `data-card` / `data-view` structure. `DashboardCard` is the single place the
      failure, retry and skeleton markup lives.

  - description: |
      Home becomes the dashboard. In `app/page.tsx`: signed-out (no session, or an expired one, which
      `getSession` already maps from 401/403 to `null`) calls `redirect(SIGN_IN_HREF)`; signed-in renders
      `<StocksDashboard />`. The "Next appointment" card and `appTitle()` heading leave Home (the
      appointments screen stays reachable from its nav entry).
      ```tsx
      export default async function Home() {
        if (!(await getSession())) redirect(SIGN_IN_HREF);
        return <StocksDashboard />;
      }
      ```
      `h1` reads "Dashboard" (prototype). `lib/title.ts` is left in place unless nothing else imports it (check
      with Grep before deleting; do not delete in this plan).
    files:
      - apps/web/src/app/page.tsx
      - apps/web/src/app/home.test.tsx
      - apps/web/tests/e2e/home.spec.ts
    rationale: |
      AC1 and AC12. Mirrors `app/wallet/page.tsx`, which already redirects a null session to sign-in.

  - description: |
      Shell changes (signed-in only), all from the prototype's "Shell gaps" note and AC2, 8-11, 13, 14.
      `lib/shell.ts`: add `disabled?: true` to `NavEntry`; rename Home's label to "Dashboard" keeping
      `key: "home"` and `href: "/"` (so `isCurrent` and `data-nav-key="home"` keep working); append
      `{ key: "holdings", label: "Holdings", href: "/holdings", disabled: true }` and
      `{ key: "sips", label: "SIPs", href: "/sips", disabled: true }` to the END of `MAIN_NAV` (guideline: new
      sections go last). Export `NOTIFICATION_COUNT = 3`.
      `TopBar.tsx`: nav renders a disabled entry as
      `<span class="nav-disabled" aria-disabled="true" data-nav-key="holdings">Holdings <span class="soon">Coming soon</span></span>`
      (no href, never current). The right-hand cluster becomes: search (disabled icon button), bell (disabled
      icon button with a badge showing `3`) and an account icon button
      `aria-haspopup="menu" aria-expanded={accountOpen} aria-controls="account-menu"` that toggles a `.menu`
      popup holding Profile and Settings (disabled, "Coming soon") and Sign out (`onSignOut`). The standalone
      "Sign out" ghost button is removed; the `error` alert and `signingOut` disabled state move to the menu item.
      New props: `accountOpen?: boolean; onToggleAccount?: () => void`.
      `TopBarControls.tsx`: owns `accountOpen`, closes it on Escape and on an outside click, and returns focus
      to the account button on close. `handleSignOut` is unchanged (success -> `router.replace("/sign-in")`).
    files:
      - apps/web/src/lib/shell.ts
      - apps/web/src/lib/shell.test.ts
      - apps/web/src/components/TopBar.tsx
      - apps/web/src/components/TopBarControls.tsx
      - apps/web/src/components/TopBar.test.tsx
      - apps/web/tests/e2e/top-bar.spec.ts
    rationale: |
      The shell is shared, so these controls appear on every signed-in page; that is what the prototype marks
      as shell-owned. Existing shell, TopBar and top-bar e2e tests that assert the old "Home" label, the
      standalone Sign out button and "lobby is last" are updated, not deleted.

  - description: |
      Footer and styling. `app/layout.tsx` adds `<footer className="shell-footer"><div>{BRAND_NAME}</div></footer>`
      inside `.shell` after `<main>`. `app/globals.css` gains a "Stocks dashboard (from the approved prototype)"
      section, written only with design-system tokens (the file already imports them at line 2:
      `@import "../../../../design-system/tokens.css";`, after `@import "tailwindcss"` at line 1, with
      `@tailwindcss/postcss` configured in `postcss.config.mjs`). Classes ported from the prototype:
      `.shell-footer`, `.shell-actions`, `.icon-btn`, `.bell-badge`, `.menu`/`.account-menu`, `.nav-disabled`,
      `.soon`, `.btn-soon`, `.link-soon`, `.section-head`, `.tiles`, `.tile`, `.tile-label`, `.tile-value`,
      `.up`, `.down`, `.two`, `.two-wide`, `.holdings-table`, `.holdings-list`, `.scroll`, `.rows`, `.num`,
      `.chart` and its line/axis/text classes, `.swatch`, `.dot`, `.donut`, `.alloc`, `.bar`, `.insights`,
      `.failed`, `.skel`, `.help`, `.tooltip-anchor`, `.tooltip`, `.preview`-free (the "Preview state" chips are
      a prototype review aid and are NOT built). Tokens used: `--space-1..6`, `--radius-sm/md/lg/full`,
      `--font-size-sm/md/lg`, `--font-weight-*`, `--color-fg`, `--color-fg-muted`, `--color-bg`,
      `--color-bg-subtle`, `--color-primary`, `--color-success`, `--color-danger`, `--color-accent`,
      `--color-secondary`, `--color-border`, `--color-border-strong`, `--color-neutral-50/200/500/600`,
      `--color-focus`, `--color-skeleton`, `--border-width`, `--border-width-strong`, `--size-control`,
      `--size-control-sm`, `--size-control-lg`, `--size-grid-min`, `--size-modal`, `--size-menu-min`,
      `--size-tooltip-max`, `--size-focus-offset`, `--opacity-disabled`, `--z-dropdown`, `--line-height-tight`.
      The 768px media query stays a literal (custom properties cannot be used in media queries), as the existing
      shell CSS already does. Do not re-declare classes globals.css already has (`.btn*`, `.card`, `.badge-*`,
      `.tabs/.tab`, `.alert-danger`, `.skeleton`, `.spinner`, `.stack*`, `.text-muted`, `.text-sm`).
    files:
      - apps/web/src/app/layout.tsx
      - apps/web/src/app/globals.css
    rationale: |
      AC3 requires a footer, and the shared layout has none. All styling goes in the app's own global stylesheet
      like every earlier screen ("from the approved prototype" sections).

  - description: |
      End-to-end coverage of the happy paths with Playwright, using the existing `e2e-session` cookie seam in
      `mock-session-server.mjs` (no change to it needed).
    files:
      - apps/web/tests/e2e/stocks-dashboard.spec.ts
    rationale: |
      Interaction ACs (tabs, account menu, sign-out, signed-out redirect, narrow and wide layout) are only
      truly verifiable in a browser, since the vitest setup is node-only.

tests:
  - |
    AC1 (home.test.tsx, fails first because Home still renders the appointments card):
    ```ts
    getSession.mockResolvedValue({ role: "player" });
    const html = renderToStaticMarkup(await Home());
    expect(html).toContain("<h1");
    expect(html).toContain(">Dashboard<");
    expect(html).not.toContain("Next appointment");
    ```
    e2e: `await page.goto("/"); await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");`
  - |
    AC2 (shell.test.ts and TopBar.test.tsx):
    ```ts
    expect(MAIN_NAV[0]).toEqual({ key: "home", label: "Dashboard", href: "/" });
    expect(isCurrent(MAIN_NAV[0], "/")).toBe(true);
    // TopBar
    expect(html).toMatch(/<a[^>]*data-nav-key="home"[^>]*aria-current="page"[^>]*>Dashboard</);
    ```
  - |
    AC3 (StocksDashboard.test.tsx, rendered with every card `initial` ready; TopBar.test.tsx for header/nav/account):
    ```ts
    const html = renderToStaticMarkup(<StocksDashboard initial={READY} />);
    for (const heading of ["Market overview", "Portfolio performance vs benchmark", "Holdings", "Watchlist",
      "Portfolio allocation", "Recent transactions", "Goals", "SIPs", "Insights &amp; alerts"]) {
      expect(html).toContain(`>${heading}<`);
    }
    expect(html).toContain("Portfolio value");
    // layout.tsx footer is covered by e2e: await expect(page.getByRole("contentinfo")).toContainText("Web App");
    ```
  - |
    AC4 (stocks.test.ts and StocksDashboard.test.tsx): every figure in the prototype appears.
    ```ts
    for (const text of ["NIFTY 50", "24,310 pts", "SENSEX", "79,820 pts", "NIFTY Bank", "52,140 pts",
      "Nifty 50 Index Fund", "Bluechip Equity Fund", "Infosys", "HDFC Bank", "TCS",
      "Equity 58%", "Debt 22%", "Gold 12%", "Cash 8%", "Buy a home", "Retirement",
      "Flexi Cap Fund", "Next debit 1 Nov", "Tech holdings are 48% of portfolio; consider rebalancing."]) {
      expect(html).toContain(text);
    }
    expect(SAMPLE_PORTFOLIO.holdings).toHaveLength(5);
    expect(SAMPLE_PORTFOLIO.transactions).toHaveLength(5);
    ```
  - |
    AC5 and AC16 (stocks.test.ts for the formatter, StocksDashboard.test.tsx for placement):
    ```ts
    expect(formatRupees(1248600)).toBe("₹12,48,600");
    expect(formatRupees(210.4, 2)).toBe("₹210.40");
    expect(formatRupeesCompact(2_000_000)).toBe("₹20L");
    expect(formatRupeesCompact(20_000_000)).toBe("₹2Cr");
    expect(html).toContain("₹12,48,600");
    expect(html).toContain("+₹8,420");
    // transactions
    for (const amount of ["₹15,120", "₹19,600", "₹16,840", "₹9,000", "₹5,000"]) expect(html).toContain(amount);
    ```
  - |
    AC6 (PerformanceCard.test.tsx): the chart shows the selected period, rendered through `initialPeriod`.
    ```ts
    const at = (p: Period) => renderToStaticMarkup(<PerformanceCard initial={{ status: "ready", data: PERF }} initialPeriod={p} />);
    expect(at("6M")).toContain("Portfolio +9.3%");
    expect(at("6M")).not.toContain("Portfolio +3.4%");
    expect(at("1Y")).toContain("NIFTY 50 +10.9%");
    expect(at("1M")).toContain("Showing the last month, 1 Oct to 29 Oct.");
    expect(at("6M")).toMatch(/<button[^>]*role="tab"[^>]*aria-selected="true"[^>]*>6M</);
    ```
    Also a pure `nextPeriod(current, "ArrowRight")` test for keyboard moves (1M -> 6M -> 1Y -> 1M).
    e2e: click the 6M tab and `await expect(page.getByText("Portfolio +9.3%")).toBeVisible()`.
  - |
    AC7 (e2e is the real proof; unit guard in StocksDashboard.test.tsx): the other cards do not depend on period.
    ```ts
    const strip = (h: string) => h.replace(/<section[^>]*aria-labelledby="h-perf"[\s\S]*?<\/section>/, "");
    expect(strip(render("1M"))).toBe(strip(render("6M")));
    ```
    e2e: capture `holdings-card` and `watchlist` `innerText` before and after clicking 1Y and expect equality.
  - |
    AC8 (StocksDashboard.test.tsx, TopBar.test.tsx):
    ```ts
    for (const label of ["Buy", "Sell", "Add funds", "Add stock", "Create goal", "New SIP"]) {
      expect(html).toMatch(new RegExp(`<button[^>]*disabled=""[^>]*aria-label="${label}, coming soon"`));
    }
    expect(html.match(/aria-label="Buy (Nifty 50 Index Fund|Bluechip Equity Fund|Infosys|HDFC Bank|TCS), coming soon"/g)).toHaveLength(10); // table + list
    expect(html.match(/class="link-soon"[^>]*disabled/g)).toHaveLength(3);
    // TopBar
    expect(bar).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Search, coming soon"/);
    expect(bar).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Notifications, coming soon"/);
    ```
    Each disabled control also carries visible or screen-reader text "Coming soon".
  - |
    AC9 (TopBar.test.tsx), account menu rendered open:
    ```ts
    const open = renderToStaticMarkup(<TopBar signedIn pathname="/" accountOpen />);
    expect(open).toMatch(/<button[^>]*disabled=""[^>]*>Profile[\s\S]*?Coming soon/);
    expect(open).toMatch(/<button[^>]*disabled=""[^>]*>Settings[\s\S]*?Coming soon/);
    ```
  - |
    AC10 (TopBar.test.tsx and e2e): closed by default, open when asked.
    ```ts
    expect(renderToStaticMarkup(<TopBar signedIn pathname="/" />)).toContain('aria-expanded="false"');
    expect(open).toContain('id="account-menu"');
    expect(open).toMatch(/aria-controls="account-menu"[^>]*aria-expanded="true"|aria-expanded="true"[^>]*aria-controls="account-menu"/);
    ```
    e2e: `await page.getByRole("button", { name: "Account" }).click(); await expect(page.getByRole("menu")).toBeVisible();`
    and `Escape` closes it.
  - |
    AC11 (TopBar.test.tsx keeps the existing `handleSignOut` tests; e2e updated):
    ```ts
    expect(open).toContain(">Sign out<");
    expect(replace).toHaveBeenCalledWith("/sign-in");
    ```
    e2e: open the account menu, click `Sign out`, `await expect(page).toHaveURL(/\/sign-in$/);`. The failure case
    (500) still shows `role="alert"` with "Sign out failed" and leaves the user on the dashboard.
  - |
    AC12 (home.test.tsx): a signed-out user and an expired session (the session service answers 401/403, so
    `getSession` resolves `null`) are redirected, never shown the dashboard.
    ```ts
    getSession.mockResolvedValue(null);
    await expect(Home()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirect).toHaveBeenCalledWith("/sign-in");
    ```
    (mock `next/navigation` `redirect` to throw, as the other page tests do.) e2e: no cookie, `goto("/")`,
    `toHaveURL(/\/sign-in/)`. The existing `session.test.ts` already covers 401/403 -> null; re-run it.
  - |
    AC13 (shell.test.ts, TopBar.test.tsx):
    ```ts
    expect(MAIN_NAV.slice(-2)).toEqual([
      { key: "holdings", label: "Holdings", href: "/holdings", disabled: true },
      { key: "sips", label: "SIPs", href: "/sips", disabled: true },
    ]);
    expect(html).toMatch(/<span[^>]*aria-disabled="true"[^>]*data-nav-key="holdings"[^>]*>Holdings[\s\S]*?Coming soon/);
    expect(html).not.toMatch(/<a[^>]*data-nav-key="holdings"/);
    expect(visibleNav(false).some((e) => e.disabled)).toBe(false);
    ```
  - |
    AC14 (TopBar.test.tsx):
    ```ts
    expect(html).toMatch(/aria-label="Notifications, coming soon"[\s\S]*?<span[^>]*class="bell-badge"[^>]*>3</);
    expect(NOTIFICATION_COUNT).toBe(3);
    ```
  - |
    AC15 (stocks.test.ts and StocksDashboard.test.tsx):
    ```ts
    expect(formatPoints(24310)).toBe("24,310 pts");
    expect(html).toContain("24,310 pts");
    expect(html).toContain("79,820 pts");
    expect(html).toContain("52,140 pts");
    ```
  - |
    AC17 (InsightsCard in StocksDashboard.test.tsx):
    ```ts
    const labels = [...html.matchAll(/data-wf-id="insight-\d-status"[^>]*>([^<]+)</g)].map((m) => m[1]);
    expect(labels).toHaveLength(3);
    for (const l of labels) expect(["On track", "Watch", "Action needed"]).toContain(l);
    ```
    (use a `data-testid` or class selector instead of `data-wf-id` if the implementer does not carry the
    prototype's wireframe ids into production markup; the assertion is the three labels.)
  - |
    AC18 (PerformanceCard.test.tsx and e2e):
    ```ts
    expect(DEFAULT_PERIOD).toBe("1M");
    const html = renderToStaticMarkup(<PerformanceCard initial={{ status: "ready", data: PERF }} />);
    expect(html).toMatch(/role="tab"[^>]*aria-selected="true"[^>]*>1M</);
    expect(html).toContain("Portfolio +3.4%");
    ```
    e2e: on first load `getByRole("tab", { name: "1M" })` has `aria-selected="true"`.
  - |
    AC19 and AC20 (DashboardCard.test.tsx and StocksDashboard.test.tsx, failure rendered via `initial`):
    ```ts
    const html = renderToStaticMarkup(<DashboardCard label="market overview" state={{ status: "error", attempts: 1 }} onRetry={() => {}}>x</DashboardCard>);
    expect(html).toContain('role="alert"');
    expect(html).toContain("We couldn&#x27;t load the market overview.");
    expect(html).toContain(">Try again<");
    expect(html).not.toContain(">x<");
    ```
    Repeat for portfolio summary, performance chart and watchlist (the four failable cards).
  - |
    AC21 (stocks.test.ts, pure reducer plus `loadCard`): retry that fails again keeps the failure.
    ```ts
    const dispatched: CardAction<number>[] = [];
    await loadCard(async () => { throw new Error("down"); }, (a) => dispatched.push(a));
    expect(dispatched.at(-1)).toEqual({ type: "failed" });
    let s: CardState<number> = { status: "error", attempts: 1 };
    s = cardReducer(cardReducer(s, { type: "requested" }), { type: "failed" });
    expect(s).toEqual({ status: "error", attempts: 2 });
    // DashboardCard at attempts 2 still renders role="alert" and ">Try again<"
    ```
  - |
    AC22 (stocks.test.ts): retry that succeeds replaces the failure with the figures.
    ```ts
    let s: CardState<number[]> = { status: "error", attempts: 1 };
    s = cardReducer(s, { type: "requested" });
    s = cardReducer(s, { type: "loaded", data: [1, 2] });
    expect(s).toEqual({ status: "ready", data: [1, 2] });
    // DashboardCard ready: expect(html).not.toContain('role="alert"') and children are present
    ```
  - |
    AC23 (DashboardCard.test.tsx and StocksDashboard.test.tsx, all ten cards `initial: loading`):
    ```ts
    const html = renderToStaticMarkup(<StocksDashboard initial={ALL_LOADING} />);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Loading market overview"');
    expect(html.match(/class="skeleton/g)!.length).toBeGreaterThanOrEqual(10);
    expect(html).not.toContain("24,310 pts");
    ```
  - |
    AC24 (stocks.test.ts reducer transition, DashboardCard.test.tsx, e2e):
    ```ts
    expect(cardReducer({ status: "loading" }, { type: "loaded", data: SAMPLE_PORTFOLIO.indices }))
      .toEqual({ status: "ready", data: SAMPLE_PORTFOLIO.indices });
    ```
    e2e: after `goto("/")` `await expect(page.getByText("24,310 pts")).toBeVisible()` and
    `await expect(page.getByLabel("Loading market overview")).toHaveCount(0)`.
  - |
    Regression and responsiveness: `apps/web/tests/e2e/top-bar.spec.ts` keeps its 767px (Menu collapses) and
    768px (nav inline) cases, updated to the new "Dashboard" name; add a 1280px case that the holdings table
    is visible and the holdings list is hidden, and a 375px case that the reverse holds.
    Run the narrow forms of the project command, for example
    `cd apps/web && pnpm exec vitest run src/lib/stocks.test.ts src/components/dashboard src/components/TopBar.test.tsx src/lib/shell.test.ts src/app/home.test.tsx`
    and `cd apps/web && pnpm exec playwright test tests/e2e/stocks-dashboard.spec.ts tests/e2e/top-bar.spec.ts`,
    then `pnpm typecheck`.

assumptions_or_open_questions:
  - |
    Which browsers, devices and screen sizes must the dashboard support? (Deferred from PROD-28OCT-CHORE-072; nothing
    in the item, the design or the repo answers it.) The plan builds mobile-first with one layout change at 768px,
    as the UI guidelines and prototype do, and tests 375px, 767px, 768px and 1280px in Chromium only (the Playwright
    project in `apps/web/playwright.config.ts`). A human should confirm or widen this before code is written.
  - |
    Conflict between AC2 and the prototype: AC2 says the nav item is "Dashboard", but the prototype's nav link reads
    "Home" and the UI guidelines name the destination Home. The plan follows the AC (label "Dashboard", key `home`
    and `href` "/" unchanged, so URLs and `data-nav-key` stay stable). If "Home" should stay, change one string in
    `lib/shell.ts` and drop the label assertions.
  - |
    The prototype's own "Shell gaps" note says search, bell, account menu, Holdings and SIPs nav and the sign-in
    screen belong to the shell, which today has none of them. The plan builds them in `TopBar` for every signed-in
    page, not only the dashboard. This replaces the standalone "Sign out" button with the account menu, so existing
    TopBar and top-bar e2e tests change. Confirm that is wanted.
  - |
    The sign-in screen itself (AC11, AC12) already exists at `/sign-in` (`app/sign-in/page.tsx`) and is not changed.
    After a successful sign-in `signInTarget` still sends a user to the wallet by default, not the dashboard. Adding
    `home` to `NEXT_TARGETS` and redirecting to `/?next=...` is out of scope here; say if the dashboard should be
    the post-sign-in landing page too.
  - |
    Removing the "Next appointment" card and the "Welcome to the Web App" heading from Home is implied by "as their
    home screen" but no AC says it. The appointments screen stays reachable through its nav entry. `lib/title.ts`
    is not deleted.
  - |
    Holdings and SIPs nav entries are appended to the END of `MAIN_NAV` (after Lobby) per the UI guideline that new
    sections go last, rather than next to Dashboard as a user might expect. `href`s `/holdings` and `/sips` are
    placeholders that nothing links to while disabled.
  - |
    Guideline "one `.btn-primary` per view": the prototype shows two (Buy and New SIP). The plan follows the
    prototype and the ACs; both are disabled. Say if New SIP should become `.btn-secondary`.
  - |
    Sample figures are taken verbatim from the prototype and are not reconciled with each other (for example the
    five holdings total about ₹1.73 lakh while Portfolio value is ₹12,48,600; Insight 3 is "On track" although its
    text reports a fall). AC4 only requires matching the demo data, so no figures are altered.
  - |
    Failure states cannot be forced in the browser because data comes from in-process sample fetchers (the Lobby
    pattern), not a network call, so AC19 to AC24 failure and retry paths are proven by unit tests on the reducer
    and the `initial` prop, with only the loaded path checked in Playwright. If a Records API endpoint for these
    figures is planned, a route-level e2e would become possible.
  - |
    SVG chart geometry (circle radii, `stroke-width`, `viewBox` coordinates, polyline points) is copied from the
    prototype as drawing data. No design token covers it. Colours use token variables only.
  - |
    Disabled icon buttons (search, bell) cannot show a hover `title` because the existing `.btn:disabled` rule sets
    `pointer-events: none`, so the label "Coming soon" is carried by `aria-label` plus a screen-reader-only span.
    Visible "Coming soon" text is used on the larger buttons, as in the prototype.

estimated_points: 8

package_dependencies: []

notes: |
  ### Data & rollout

  None. UI and sample data only: no schema, stored data, seed, queue payload, env var or setting changes. The
  sample portfolio lives in `apps/web/src/lib/stocks.ts` as a constant (same pattern as `lib/games.ts`). Deploy is a
  normal web-app release; roll back by reverting it. The existing `e2e-session` cookie seam in
  `tests/e2e/mock-session-server.mjs` is reused unchanged.

  ### How the design tokens are loaded today

  `apps/web/src/app/globals.css` line 1 is `@import "tailwindcss";` and line 2 is
  `@import "../../../../design-system/tokens.css";`, processed by `@tailwindcss/postcss` (`apps/web/postcss.config.mjs`).
  `app/layout.tsx` imports `./globals.css`. No change is needed to load tokens; new CSS only adds a section to
  `globals.css`, referencing `var(--token)` names that exist in `design-system/tokens.css`.

  ### What I read in the prototype (PROD-28OCT-STORY-073-design.html)

  - Single column, `.stack-4`, sections separated by `--space-4`; 2-up rows from 768px (`.two`, `.two-wide` = 2fr 1fr).
  - Order: h1 "Dashboard", quick actions (Buy primary; Sell and Add funds secondary; all `btn-soon` stacked label),
    Market overview card (3 `.tile`s), Portfolio summary (4 tiles, no card wrapper), Performance card, Holdings
    (2/3) with Watchlist (1/3), Allocation with Recent transactions, Goals with SIPs, Insights card with three
    inner `.card.insight` blocks.
  - Chart: inline SVG, viewBox `0 0 544 220`, wrapped in `.scroll` with `min-width` so it scrolls on narrow screens;
    portfolio is a solid `--color-primary` line, benchmark a dashed `--color-neutral-600` line; end labels
    "Portfolio +3.4% / NIFTY 50 +1.8%" (1M), "+9.3% / +6.8%" (6M), "+14.6% / +10.9%" (1Y); y-axis ticks and x-axis
    month or date labels differ per period (1M: 1 Oct to 29 Oct; 6M: May to Oct; 1Y: Nov to Oct).
  - Tabs: `.tabs` with `.tab` buttons, `role=tablist/tab`, `aria-selected`, roving tabindex, arrow keys; a
    `role="status"` note under the chart.
  - Card states per `data-view`: ready, loading (three `.skeleton` lines, first `.tall`), error (`.alert-danger` plus
    "Try again" `.btn-secondary`, spinner "Trying again" while retrying; first retry fails in the demo, second succeeds).
  - Holdings: table (Stock, Quantity, Avg cost, Value, P&L, Change, Actions) from 768px; below that a `.rows` list with
    name, units and percent, a Gain or Loss badge and Buy and Sell. Rupee figures use Indian digit grouping.
  - Allocation: donut with four `circle` segments (primary 58, accent 22, secondary 12, neutral-500 8) and legend
    badges with a dot and "Equity 58%" text. Goals: progress bars with `role="progressbar"`. Insights: badge
    (Watch = info, Action needed = warning, On track = success) plus text plus a disabled link.
  - The "Preview state" chip row exists only so reviewers can switch states in the prototype; it is NOT built.

  ### Structure

  ```mermaid
  flowchart TD
    Layout["app/layout.tsx<br/>adds footer"]:::touched
    TBC["TopBarControls.tsx<br/>account menu state, Esc / outside click"]:::touched
    TB["TopBar.tsx<br/>search, bell 3, account menu, disabled nav"]:::touched
    Shell["lib/shell.ts<br/>Dashboard label, disabled Holdings/SIPs"]:::touched
    Page["app/page.tsx<br/>redirect signed-out, render dashboard"]:::touched
    Session["lib/session.ts getSession, signOut"]
    Dash["components/dashboard/StocksDashboard.tsx<br/>new: composes cards"]:::touched
    Card["DashboardCard.tsx<br/>new: loading, failed, retry"]:::touched
    Stocks["lib/stocks.ts<br/>new: sample data, formatters, reducer"]:::touched
    Icon["components/orders/Icon.tsx<br/>add search, user, chevron-down"]:::touched
    Css["app/globals.css<br/>dashboard and shell styles"]:::touched
    Tokens["design-system/tokens.css"]
    Lobby["LobbyScreen.tsx<br/>pattern mirrored"]

    Layout --> TBC --> TB --> Shell
    TBC --> Session
    Page --> Session
    Page --> Dash --> Card --> Stocks
    Dash --> Icon
    Lobby -.pattern.-> Dash
    Css --> Tokens
    classDef touched fill:#f96,color:#000
  ```

  ### Order of work (TDD)

  1. `lib/stocks.ts` formatters, reducer and sample data (tests first, AC4, 5, 15, 16, 21-24).
  2. `DashboardCard` (AC19-24), then each card component against its test (AC3, 4, 8, 17).
  3. `PerformanceCard` with period state (AC6, 7, 18).
  4. `lib/shell.ts` then `TopBar` and `TopBarControls` (AC2, 8-11, 13, 14); update the old shell and TopBar tests in
     the same step so the suite stays green.
  5. `app/page.tsx` redirect and render (AC1, 12); update `home.test.tsx` and `home.spec.ts`.
  6. CSS and footer, then the Playwright spec, then a full run of the project test command and `pnpm typecheck`.

  ### Security / untrusted content

  The work item, deferred question and empty plan and feedback sections contained no instructions outside the change
  itself (no credential, URL, push or out-of-repo requests), so nothing was refused or left out.

review_focus: |
  IN: the dashboard screen from sample data, the shell controls the prototype marks as shell-owned (search, bell
  badge 3, account menu, disabled Holdings and SIPs nav, footer), and the signed-out redirect. OUT: the Holdings,
  SIPs, search, notification, profile and settings screens, empty states, any real API or data change, and the
  prototype's "Preview state" chips. Riskiest areas are the TopBar rework (it replaces the standalone Sign out button
  and renames the Home label, so several existing unit and e2e tests change deliberately) and the retry and loading
  state machine in `DashboardCard` and `cardReducer`. Deliberate: failure paths are tested through the reducer and an
  `initial` prop (Lobby pattern, node-only vitest), prototype figures are copied verbatim even where they do not
  reconcile, and AC2's "Dashboard" label wins over the prototype's "Home".
