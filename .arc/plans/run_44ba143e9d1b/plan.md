summary: |
  Add a public Game lobby page at /lobby (Web App only). A client screen loads the sample set (a static front-end constant, no Games API) through an injectable async loader, sorts it A-Z by name (case-insensitive English), and renders a grid of cards (name + category). It shows a loading state (spinner + skeleton cards) while loading, a danger alert with a Retry button on failure (Retry reloads and swaps the grid back in), and greys out unavailable games with a "Coming soon" warning badge. Guests need no session: the page never calls getSession or redirect. Search, category chips and Play are not rendered at all (reviewer decision); they belong to stories 082/083.
scope:
  - description: |
      Games data module. Define the type and the sample set (placeholder, same pattern as MENU_ITEMS: no games API exists yet), a pure sort, and the async loader the screen calls.

      ```ts
      export type Game = { id: string; name: string; category: string; available: boolean };
      export const SAMPLE_GAMES: readonly Game[]; // the 8 games from the prototype, deliberately unsorted
      export function sortGamesByName(games: readonly Game[]): Game[]; // a.name.localeCompare(b.name, "en", { sensitivity: "base" }); returns a new array
      export async function fetchGames(): Promise<Game[]>; // resolves the sample set; rejects on failure

      export type LobbyState = { status: "loading" | "error" | "loaded"; games: Game[] };
      export type LobbyAction =
        | { type: "requested" }
        | { type: "failed" }
        | { type: "loaded"; games: Game[] }; // sorts on load
      export function lobbyReducer(state: LobbyState, action: LobbyAction): LobbyState;
      ```
      The reducer exists because the web vitest environment is "node" with no DOM library (apps/web/vitest.config.ts line 9), so Retry behaviour is tested through it.
    files:
      - apps/web/src/lib/games.ts
      - apps/web/src/lib/games.test.ts
    rationale: |
      Keeps data, ordering and loading separate from rendering so AC1, AC3, AC7 and AC8 are unit-testable, and a real API can replace fetchGames later without touching the UI. The sample set is the prototype's GAMES array (Neon Roulette, Golden Reels, Blackjack Classic, Pyramid Dice (coming soon), Lucky Sevens, Dice Duel, Midnight Blackjack (coming soon), European Roulette).
  - description: |
      GameCard and GameGrid components, new (nothing in the catalogue covers them; MenuGrid is the nearest match but is bound to cart and prices, so it is reused only as a pattern). GameCard renders a `li.card.game-card` with the thumbnail placeholder (image icon, aria-hidden), `.game-name`, `.game-meta` holding the category in `text-sm text-muted`, and a `badge badge-warning` reading "Coming soon" for an unavailable game. An unavailable card also has `is-unavailable` (muted bg, dashed border). No Play button is rendered (reviewer decision; Play is a later story), so the card is thumbnail, name, category row only. GameGrid renders `ul.game-grid` (2 columns, 4 columns from 768px).
      Reuse the existing Icon (add an `image` path to its PATHS map, copied from the prototype sprite symbol i-image).
    files:
      - apps/web/src/components/lobby/GameCard.tsx
      - apps/web/src/components/lobby/GameCard.test.tsx
      - apps/web/src/components/lobby/GameGrid.tsx
      - apps/web/src/components/orders/Icon.tsx
    rationale: |
      Matches prototype elements data-wf-id game-card, game-thumbnail, game-name (play-now deliberately omitted). Colour and text pair with a word and icon, so "Coming soon" never relies on colour alone.
  - description: |
      LobbyScreen (client component). State is `useReducer(lobbyReducer, ...)` from lib/games.ts. Loads on mount via the injected loader; the reducer sorts with sortGamesByName. Retry dispatches `requested`, reloads, and on success shows the grid in place of the alert (AC6). The grid is `ul.game-grid` with aria-label "Games". Signature:

      ```ts
      export type LobbyScreenProps = {
        fetchGames?: () => Promise<Game[]>;
        /** Starting state, to render a given state without effects (tests). */
        initial?: { status: "loading" | "error" | "loaded"; games?: Game[] };
      };
      export function LobbyScreen({ fetchGames = defaultFetchGames, initial }: LobbyScreenProps): JSX.Element;
      ```

      Layout follows the prototype: h1 "Game lobby", intro paragraph "Browse every game and its category. You don't need to sign in to look around." (text-muted, max 60ch), then the loading, error or loaded block. Loading: `div aria-busy="true"` with `p.loading-note[role=status]` (spinner + "Loading games…") above four `.card` skeleton cards in the grid with aria-hidden. Error: `div.alert.alert-danger[role=alert]` with the alert Icon, bold "We couldn't load the games.", "Check your connection and try again.", and a `btn btn-secondary btn-sm` "Retry" (disabled and "Retrying…" while the retry is in flight; focus moves to Retry when the error appears, as in the prototype). Loaded: GameGrid. Reuse the existing RetryAlert pattern from OrdersScreen; it is a private function there, so either copy it into the lobby folder or extract it into a shared component in the same change (prefer extract only if the OrdersScreen tests stay green untouched).
      The prototype's search input, category chips and Play buttons are NOT built (reviewer decision, stories 082/083): no disabled placeholders.
    files:
      - apps/web/src/components/lobby/LobbyScreen.tsx
      - apps/web/src/components/lobby/LobbyScreen.test.tsx
    rationale: |
      Mirrors OrdersScreen (client screen, injectable fetcher, `initial` prop for effect-free renders with renderToStaticMarkup) so the same test style and error/retry UX apply.
  - description: |
      Route and navigation. New server page `app/lobby/page.tsx` that renders `<LobbyScreen />` and never reads the session or redirects (public, like /menu). Add `LOBBY_HREF = "/lobby"` to shell.ts and append `{ key: "lobby", label: "Lobby", href: LOBBY_HREF, public: true }` to the END of MAIN_NAV so existing positions stay stable and guests see it. Update the existing shell tests that assert the guest nav list and the key order.
    files:
      - apps/web/src/app/lobby/page.tsx
      - apps/web/src/app/lobby/page.test.tsx
      - apps/web/src/lib/shell.ts
      - apps/web/src/lib/shell.test.ts
    rationale: |
      AC2 needs guests to reach the grid; a nav link is the only way in today. shell.test.ts currently asserts `visibleNav(false)` equals only Menu, `visibleNav(true).at(-1)` is menu, and the exact key list, so those three assertions must change deliberately.
  - description: |
      Styles, in the app's own stylesheet, token-only. apps/web/src/app/globals.css already imports design-system/tokens.css (line 2) and mirrors prototype-utils classes by hand, so add a "Game lobby" section: `.lobby-title p`, `.game-grid`, `.game-card`, `.game-thumb`, `.game-name`, `.game-meta`, `.game-card .btn`, `.game-card.is-unavailable`, `.skeleton-thumb`, `.loading-note`, copied from the prototype's own CSS. Tokens used: --space-1/2/3, --radius-md, --color-bg-subtle, --color-fg-muted, --color-border, --font-weight-semibold, --size-control-sm, --size-spinner, --border-width-strong where needed. The 768px media query is a literal because custom properties cannot be used in media queries (same as the existing shell rule). Existing classes already present (.card, .badge-warning, .alert-danger, .skeleton, .spinner, .btn-primary, .btn-secondary, .btn-sm, .text-muted, .text-sm, .stack) are reused as-is; `.badge` base exists but `.badge-warning` is already defined at globals.css line 60.
    files:
      - apps/web/src/app/globals.css
    rationale: |
      No new colour or pixel literals: every value is a token from design-system/tokens.css.
tests:
  - |
    AC1 (write first, fails): lib/games.test.ts and LobbyScreen.test.tsx. Every sample game appears with name and category.
    ```ts
    const html = render({ status: "loaded", games: SAMPLE_GAMES.slice() });
    for (const g of SAMPLE_GAMES) {
      expect(html).toContain(g.name);
      expect(html).toContain(g.category);
    }
    expect(html.match(/class="card game-card/g)).toHaveLength(SAMPLE_GAMES.length);
    ```
    Minimal code: games.ts, GameCard, GameGrid, LobbyScreen loaded branch.
  - |
    AC2: lobby/page.test.tsx and LobbyScreen.test.tsx. The lobby needs no session: the page never looks one up or redirects, and the screen takes no session prop, so the grid is the same for a guest (same approach as menu/page.test.tsx).
    ```ts
    const src = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    expect(src).not.toContain("redirect(");
    expect(src).not.toContain("getSession");
    expect(renderToStaticMarkup(<LobbyPage />)).toContain("Game lobby"); // page renders without a session
    ```
    Plus in LobbyScreen.test.tsx: `render({ status: "loaded", games: SAMPLE_GAMES.slice() })` contains `aria-label="Games"` (the grid) with no sign-in markup.
  - |
    AC3: games.test.ts for the pure sort, and a screen test for the rendered order.
    ```ts
    expect(sortGamesByName(SAMPLE_GAMES).map((g) => g.name)).toEqual([
      "Blackjack Classic", "Dice Duel", "European Roulette", "Golden Reels",
      "Lucky Sevens", "Midnight Blackjack", "Neon Roulette", "Pyramid Dice",
    ]);
    expect(SAMPLE_GAMES.map((g) => g.name)).not.toEqual(sortGamesByName(SAMPLE_GAMES).map((g) => g.name)); // input stays unsorted, sort does not mutate
    ```
    Case-insensitive English order (reviewer-approved):
    ```ts
    const names = ["cricket", "Bravo", "apple", "Delta", "Alpha"].map((name, i) => ({ id: String(i), name, category: "x", available: true }));
    expect(sortGamesByName(names).map((g) => g.name)).toEqual(["Alpha", "apple", "Bravo", "cricket", "Delta"]);
    ```
    Reducer: `lobbyReducer(loading, { type: "loaded", games: SAMPLE_GAMES.slice() })` yields games already sorted. Screen test: indexOf("Blackjack Classic") < indexOf("Dice Duel") < ... in the loaded markup.
  - |
    AC4: LobbyScreen.test.tsx. While loading, a status indicator shows and no grid is rendered.
    ```ts
    const html = render({ status: "loading" });
    expect(html).toContain("Loading games");
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('aria-label="Games"');
    ```
    (The loaded grid carries aria-label "Games" as its distinguishing marker; the skeleton list is aria-hidden and has no such label.)
  - |
    AC5: LobbyScreen.test.tsx. A failed load shows an error and a Retry control, with no grid.
    ```ts
    const html = render({ status: "error" });
    expect(html).toContain('role="alert"');
    expect(html).toContain("We couldn&#x27;t load the games.");
    expect(html).toContain(">Retry<");
    expect(html).not.toContain('aria-label="Games"');
    ```
    Plus in games.test.ts: `expect(lobbyReducer({ status: "loading", games: [] }, { type: "failed" }).status).toBe("error")`.
  - |
    AC6: games.test.ts (reducer). apps/web/vitest.config.ts uses `environment: "node"` and the web app has no DOM testing library (checked), so Retry is verified through lobbyReducer rather than a click; no new test dependency is added.
    ```ts
    const failed = lobbyReducer({ status: "loading", games: [] }, { type: "failed" });
    const retrying = lobbyReducer(failed, { type: "requested" });
    expect(retrying.status).toBe("loading");
    const loaded = lobbyReducer(retrying, { type: "loaded", games: SAMPLE_GAMES.slice() });
    expect(loaded.status).toBe("loaded");
    expect(loaded.games).toHaveLength(SAMPLE_GAMES.length);
    ```
    And in LobbyScreen.test.tsx, static markup of the `loaded` state after an error contains `aria-label="Games"` and no `role="alert"`. Minimal code: lobbyReducer plus the Retry button's onClick dispatching `requested` and re-running the loader.
  - |
    AC7: GameCard.test.tsx. An unavailable game is greyed out with a Coming soon marker.
    ```ts
    const html = renderToStaticMarkup(<GameCard game={{ id: "g8", name: "Pyramid Dice", category: "Dice", available: false }} />);
    expect(html).toContain("is-unavailable");
    expect(html).toContain("Coming soon");
    expect(html).toContain("badge-warning");
    ```
  - |
    AC8: GameCard.test.tsx. An available game has no marker and is not greyed out.
    ```ts
    const html = renderToStaticMarkup(<GameCard game={{ id: "g2", name: "Dice Duel", category: "Dice", available: true }} />);
    expect(html).not.toContain("Coming soon");
    expect(html).not.toContain("is-unavailable");
    ```
  - |
    Navigation regression: update shell.test.ts so guests see Menu then Lobby and the key order ends with menu, lobby.
    ```ts
    expect(visibleNav(false).map((e) => e.key)).toEqual(["menu", "lobby"]);
    expect(MAIN_NAV.at(-1)).toEqual({ key: "lobby", label: "Lobby", href: "/lobby", public: true });
    expect(isCurrent(MAIN_NAV.at(-1)!, "/lobby")).toBe(true);
    ```
    TopBar.test.tsx was read: its signed-out tests only check that the Menu entry exists and Wallet is absent, so they stay green unchanged. Optionally add `expect(html).toMatch(/data-nav-key="lobby"/)` there.
  - |
    Narrow run per task (derived from the project command): `cd apps/web && pnpm test -- src/lib/games.test.ts`, then the same with src/components/lobby/GameCard.test.tsx, src/components/lobby/LobbyScreen.test.tsx, src/app/lobby/page.test.tsx and src/lib/shell.test.ts.
assumptions_or_open_questions:
  - |
    Resolved (reviewer): the sample set is a static front-end constant in apps/web/src/lib/games.ts, using the eight games in the approved prototype. No Games API is added; a future API can replace fetchGames without changing the lobby UI contract.
  - |
    Loading and error states cannot occur with a synchronous constant, so fetchGames is an async function resolving the sample set. Nothing in production rejects it today; the error state is exercised only through the injectable loader in tests.
  - |
    Resolved (reviewer): add a public "Lobby" nav entry as the primary entry point for game discovery. It is appended at the END of MAIN_NAV (after Menu) because the UI guidelines say new sections go last so existing positions stay stable; product or design can reorder later.
  - |
    Resolved (reviewer): the prototype's disabled search box, category chips and Play buttons are NOT rendered. This is a deliberate deviation from the prototype, which draws them inert.
  - |
    Prototype vs acceptance criteria: AC7 says an unavailable game is "greyed out"; the prototype also disables that card's Play button, which is dropped with Play itself. No other conflict found.
  - |
    Resolved (reviewer): A-Z is case-insensitive English ordering, implemented as a.name.localeCompare(b.name, "en", { sensitivity: "base" }).
  - |
    Deferred project question (from PROD-28OCT-CHORE-080) about environments, observability and data retention: agreed with the reviewer that it stays tracked separately. The lobby stores and logs nothing, so it does not affect this plan.
  - |
    Verified: apps/web/vitest.config.ts sets environment "node" and no DOM testing library is used, so the Retry interaction cannot be tested through the DOM. Per the reviewer's fallback, AC6 is covered by lobbyReducer tests plus static markup tests; no test dependency is added.
estimated_points: 3
package_dependencies: []
notes: |
  ### Data & rollout

  None — front-end only; the sample games are a constant in code, with no database, stored data, setting or env var, and nothing to provision. Safe to roll back by reverting.

  ### Design source

  Read the approved prototype PROD-28OCT-STORY-081-design.html: single column, h1 "Game lobby", intro text, then loading, error and loaded states of one screen. Tokens are loaded by `@import "../../../../design-system/tokens.css"` at apps/web/src/app/globals.css line 2 (Tailwind v4 import on line 1), so no loader work is needed. The prototype's top reviewer bar and "Prototype state" bar are not part of the product.

  ```mermaid
  flowchart TD
    Page["app/lobby/page.tsx (new, public)"] --> Screen["LobbyScreen (new): states, retry"]
    Screen --> Lib["lib/games.ts (new): Game, SAMPLE_GAMES, sortGamesByName, fetchGames"]
    Screen --> Grid["GameGrid (new)"]
    Grid --> Card["GameCard (new): Coming soon badge"]
    Screen --> Icon["orders/Icon.tsx: add image icon"]
    Shell["lib/shell.ts: LOBBY_HREF, MAIN_NAV entry"] --> TopBar["components/TopBar.tsx (reads visibleNav)"]
    Css["app/globals.css: lobby styles, tokens only"] -.-> Card
    classDef touched fill:#f96,color:#000
    class Page,Screen,Lib,Grid,Card,Icon,Shell,Css touched
  ```

  Orders is the model for the screen (OrdersScreen: injectable fetcher, `initial` prop, RetryAlert), and /menu is the model for a public page (no redirect, session failures tolerated). TopBar itself is not edited; it renders whatever visibleNav returns.
review_focus: |
  IN scope: /lobby page, sample-set loader, A-Z sort, card grid with Coming soon marker, loading and retryable error states, and the public nav entry. OUT: any Games API, and search, category chips and Play, which are deliberately not rendered even though the prototype draws them (reviewer decision, stories 082/083). Riskiest areas are the case-insensitive sort and the shell.test.ts assertions that pin the guest nav list. Deliberate: the sample set is a static constant behind an async loader, Retry is tested through lobbyReducer because the web vitest environment is node with no DOM library, and the error state is only reachable through the injected loader.
