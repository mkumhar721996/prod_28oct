summary: |
  Add live search-by-name and single-select category chips to the existing game lobby (LobbyScreen, story 081), combined with AND, plus a "No games found" empty state with a "Clear filters" button. Filtering is a pure function and the filter state a pure reducer in `apps/web/src/lib/games.ts`, so every acceptance criterion is testable with the project's existing vitest and `renderToStaticMarkup` approach (no DOM test library is installed). `LobbyScreen` renders the search field, chips, result-status line, and either `GameGrid` or a new `NoGamesFound` component, following the approved prototype.
scope:
  - description: |
      Pure filtering and filter-state logic in `lib/games.ts`. Signatures:

      ```ts
      export type GameFilters = { search: string; category: string | null };
      export const NO_FILTERS: GameFilters = { search: "", category: null };

      export type FilterAction =
        | { type: "search"; text: string }
        | { type: "toggleCategory"; category: string }
        | { type: "clear" };

      export function filterGames(games: readonly Game[], f: GameFilters): Game[];
      export function filterReducer(state: GameFilters, action: FilterAction): GameFilters;
      export function categoriesOf(games: readonly Game[]): string[];
      ```

      `filterGames` matches `game.name` only (case-insensitive `includes` on the trimmed search text, per the prototype's `render()`), never `category` (AC 3), and ANDs it with `category === f.category` when a category is set (AC 5). It preserves the input order, so the A-Z sort stays. `toggleCategory` selects a new chip or deselects the same one (AC 13, 14). `clear` returns `NO_FILTERS`.
    files:
      - apps/web/src/lib/games.ts
      - apps/web/src/lib/games.test.ts
    rationale: |
      Mirrors the existing `lobbyReducer`/`sortGamesByName` pattern in the same file. Logic is verifiable without a browser.
  - description: |
      New `NoGamesFound` component, shown in place of the grid when zero games match. Markup follows the prototype's `#state-none`: `.empty-state.no-games` with the `search` Icon (reuse `Icon` from `components/orders/Icon.tsx`), an `<h2>No games found</h2>`, a `.text-muted` detail line naming the current search and category (for example "No game matches the name “xyz” in the Slots category. Change your search or clear the filters."), and a single `.btn.btn-primary` "Clear filters" with `onClick={onClear}`. React escapes the search text, so do not copy the prototype's `replace(/[<>&]/g, '')`. Tokens used come through the existing classes: `--space-2`, `--space-3`, `--space-6`, `--border-width`, `--color-border-strong`, `--radius-lg`, `--color-fg-muted`, and the button tokens.

      ```ts
      export function NoGamesFound(props: { filters: GameFilters; onClear: () => void }): JSX.Element;
      ```
    files:
      - apps/web/src/components/lobby/NoGamesFound.tsx
      - apps/web/src/components/lobby/NoGamesFound.test.tsx
    rationale: |
      The prototype marks `NoGamesFound` as NEW. The catalogue has no equivalent: `NoOrders` and `NoAppointments` are feature-specific, so a lobby-specific one in `components/lobby` fits the existing layout. The `.empty-state` class already exists in globals.css:70.
  - description: |
      Wire filters into `LobbyScreen`. Add `const [filters, dispatchFilters] = useReducer(filterReducer, initial?.filters ?? NO_FILTERS)`, with `initial` extended to `{ status; games?; filters?: GameFilters }` so tests can render a filtered state without effects. In the loaded branch render, in this order and inside the existing `.stack.stack-4`, the prototype's elements:

      1. `.lobby-search-row` > `.field` with a visible `<label htmlFor="game-search-input">Search games</label>` and `<input className="input" id="game-search-input" type="search" placeholder="Search games" autoComplete="off" value={filters.search} onChange={e => dispatchFilters({type:"search", text:e.target.value})}/>`. It is controlled and updates on each keystroke with no submit (AC 2).
      2. A `.cluster` with `role="group"` and `aria-label="Categories"` holding one `<button type="button" className="chip" aria-pressed={...}>` per `categoriesOf(state.games)`.
      3. `<p className="result-status text-sm text-muted" role="status" aria-live="polite">` reading "N of M games", or "No games found" when N is 0.
      4. `matches.length > 0 ? <GameGrid games={matches}/> : <NoGamesFound .../>` (AC 6, 7). `matches` is `filterGames(state.games, filters)`.

      Search, chips, and status render only when `status === "loaded"`. The loading and error branches are unchanged. The Clear filters handler dispatches `{type:"clear"}` and then focuses the search input (a ref), as the prototype does. Update the intro copy to the prototype's "Search by game name and pick a category to find a game quickly." `GameGrid` and `GameCard` are unchanged.
    files:
      - apps/web/src/components/lobby/LobbyScreen.tsx
      - apps/web/src/components/lobby/LobbyScreen.test.tsx
    rationale: |
      `LobbyScreen` already owns the loaded game list and the `initial` test seam. Keeping filter state in this client component avoids a new provider.
  - description: |
      Add the few styles the prototype defines that globals.css lacks: `.lobby-search-row { display: flex; gap: var(--space-2); }`, `.lobby-search-row .field { flex: 1; max-width: var(--size-modal); }`, `.result-status { min-height: var(--size-control-sm); }`, `.no-games { overflow-wrap: anywhere; }`, and the `.cluster` helper (`display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2)`). Add them under the existing "Game lobby" block (globals.css:254). Tokens are already loaded by `@import "../../../../design-system/tokens.css"` at globals.css:2. `.chip`, `.chip[aria-pressed="true"]`, `.chip:focus-visible`, `.input`, `.field`, `.empty-state`, and `.btn-primary` already exist, so they are reused as is.
    files:
      - apps/web/src/app/globals.css
    rationale: |
      Only token-based rules are added, with no colour or pixel literals. `.cluster` is missing from globals.css (checked by Grep: only `.stack*` is defined).
tests:
  - |
    AC1 and AC12, in `games.test.ts`, written first and failing because `filterGames` does not exist:
    ```ts
    const names = (g: Game[]) => g.map((x) => x.name);
    expect(names(filterGames(SAMPLE_GAMES, { search: "dice", category: null })).sort())
      .toEqual(["Dice Duel", "Pyramid Dice"]);
    expect(names(filterGames(SAMPLE_GAMES, { search: "lucky", category: null }))).toContain("Lucky Sevens");
    expect(names(filterGames(SAMPLE_GAMES, { search: "LUCKY", category: null }))).toContain("Lucky Sevens");
    ```
  - |
    AC2, in `LobbyScreen.test.tsx`. Static markup cannot type, so check two things. First, a loaded lobby renders a controlled search input that needs no submit control, and a search-text change dispatches straight into the filter reducer:
    ```ts
    expect(html).toContain('type="search"');
    expect(html).not.toContain('type="submit"');
    expect(filterReducer(NO_FILTERS, { type: "search", text: "lu" }).search).toBe("lu");
    ```
    Second, `LobbyScreen` rendered with `initial.filters = { search: "lu", category: null }` shows only "Lucky Sevens" (count of `class="card game-card` is 1).
  - |
    AC3: "Slots" is the category of Lucky Sevens, but the name does not contain it:
    ```ts
    expect(filterGames(SAMPLE_GAMES, { search: "slots", category: null })).toEqual([]);
    ```
  - |
    AC4: filtering by category alone, and the LobbyScreen markup with `initial.filters = { search: "", category: "Dice" }`:
    ```ts
    expect(filterGames(SAMPLE_GAMES, { search: "", category: "Dice" }).map((g) => g.category))
      .toEqual(["Dice", "Dice"]);
    expect(html.match(/class="card game-card/g)).toHaveLength(2);
    expect(html).toContain('aria-pressed="true"');
    ```
  - |
    AC5: combined filter, in `games.test.ts` and LobbyScreen markup:
    ```ts
    expect(filterGames(SAMPLE_GAMES, { search: "lucky", category: "Slots" }).map((g) => g.name))
      .toEqual(["Lucky Sevens"]);
    expect(filterGames(SAMPLE_GAMES, { search: "lucky", category: "Dice" })).toEqual([]);
    ```
  - |
    AC6, in `LobbyScreen.test.tsx`, with `initial.filters = { search: "zzz", category: null }`:
    ```ts
    expect(html).toContain("No games found");
    expect(html).not.toContain('aria-label="Games"');
    ```
    Also `NoGamesFound.test.tsx` renders the detail text for each of the three cases: search only, category only, both.
  - |
    AC7, with filters that match at least one game:
    ```ts
    expect(html).not.toContain("No games found");
    expect(html).toContain('aria-label="Games"');
    ```
    The result-status line reads "1 of 8 games" for the "lucky" search.
  - |
    AC8, in `NoGamesFound.test.tsx` and in the LobbyScreen no-match markup:
    ```ts
    expect(html).toContain('class="btn btn-primary"');
    expect(html).toContain(">Clear filters<");
    ```
  - |
    AC9, AC10, AC11, in `games.test.ts`:
    ```ts
    const dirty = { search: "zzz", category: "Slots" };
    const cleared = filterReducer(dirty, { type: "clear" });
    expect(cleared.search).toBe("");
    expect(cleared.category).toBeNull();
    expect(filterGames(SAMPLE_GAMES, cleared)).toHaveLength(SAMPLE_GAMES.length);
    ```
    In `NoGamesFound.test.tsx`, call the `onClear` prop of the button's React element, found by walking the element returned from `NoGamesFound({...})` (no DOM library needed), and assert it was called once.
  - |
    AC13, in `games.test.ts`:
    ```ts
    const s1 = filterReducer(NO_FILTERS, { type: "toggleCategory", category: "Slots" });
    const s2 = filterReducer(s1, { type: "toggleCategory", category: "Dice" });
    expect(s2.category).toBe("Dice");
    expect(filterGames(SAMPLE_GAMES, s2).every((g) => g.category === "Dice")).toBe(true);
    ```
    LobbyScreen markup with `category: "Dice"` shows the Dice chip `aria-pressed="true"` and the Slots chip `aria-pressed="false"`.
  - |
    AC14, in `games.test.ts`:
    ```ts
    const on = filterReducer(NO_FILTERS, { type: "toggleCategory", category: "Slots" });
    expect(filterReducer(on, { type: "toggleCategory", category: "Slots" }).category).toBeNull();
    ```
  - |
    Regression: the existing LobbyScreen tests (all games shown, A-Z order, loading, error) stay green. Loading and error states must not render the search field or chips. Also `categoriesOf(SAMPLE_GAMES)` returns each category once, with no duplicates.
  - |
    Narrow verification command, derived from the project command: `(cd apps/web && pnpm vitest run src/lib/games.test.ts src/components/lobby)`. Before finishing, run `(cd apps/web && pnpm typecheck)`.
assumptions_or_open_questions:
  - |
    The web app has no DOM testing library (no testing-library, jsdom or happy-dom in apps/web/package.json), and the existing lobby tests use `renderToStaticMarkup`. The plan therefore pins the interactive behaviour (typing, chip toggle, Clear filters) in pure reducer and function tests plus static renders of preset filter states. Adding a DOM test library or a Playwright spec (no lobby e2e spec exists under apps/web/e2e or tests, checked by Glob) is out of scope unless the reviewer wants it.
  - |
    Chips: the prototype shows four chips in the order Slots, Roulette, Blackjack, Dice. The plan derives them from the loaded games (`categoriesOf`, alphabetical), so the order would be Blackjack, Dice, Roulette, Slots, and a new category appears automatically. If the prototype order matters, switch to a fixed constant list. Please confirm.
  - |
    Search text is trimmed before matching, as in the prototype (`input.value.trim()`). The ACs say "contains the typed text" and do not mention whitespace, so "lucky " with a trailing space still matches "Lucky Sevens". Matching is case-insensitive, per AC 12.
  - |
    AC 12 names the game "Lucky Seven"; the sample data and prototype use "Lucky Sevens". "lucky" matches both, so the tests use the sample data name.
  - |
    The prototype's "Prototype state" jump bar is design scaffolding, not product, and is not built. The prototype's `render()` also re-sorts the list, but the app already sorts A-Z on load (`lobbyReducer`), so filtering preserves that order.
  - |
    Deferred project-wide question (from PROD-28OCT-CHORE-080) about environments, observability and data retention for player accounts and transaction history: not relevant to this client-side filtering change, and no data is stored or logged. Left open for the owning item.
estimated_points: 3
package_dependencies: []
notes: |
  ### Data & rollout
  None — client-side UI filtering over the already-loaded game list. No schema, stored data, seed, setting or env var changes. The change is safe to roll back by reverting the commit.

  ### Design source
  Read in full: `PROD-28OCT-STORY-082-design.html`, the single "Game lobby" screen (states: all games, filtered, no games found). The elements are: `h1` plus intro, `.lobby-search-row` > `.field` > label "Search games" + `input.input[type=search]`, a `.cluster[role=group][aria-label=Categories]` of `button.chip[aria-pressed]`, `p.result-status[role=status][aria-live=polite]`, then `ul.game-grid` or `.empty-state.no-games` (search icon, h2 "No games found", muted detail, `.btn.btn-primary` "Clear filters"). Only the Clear filters button is primary in the empty state, and the card "Play" buttons are 081's. The prototype and the ACs do not conflict. Its "Lucky Sevens" fixture is covered by AC 12.

  Tokens are loaded at `apps/web/src/app/globals.css:2` (`@import "../../../../design-system/tokens.css"`), with Tailwind v4 through `@tailwindcss/postcss`. All new CSS uses `var(--token)` only.

  ### Structure
  ```mermaid
  flowchart TD
    Page["app/lobby/page.tsx"] --> LS["LobbyScreen.tsx"]
    LS -->|"owns filter state, renders search, chips, status"| LS
    LS --> GG["GameGrid.tsx (unchanged)"]
    GG --> GC["GameCard.tsx (unchanged)"]
    LS -->|"zero matches"| NGF["NoGamesFound.tsx (new)"]
    LS -->|"filterGames, filterReducer, categoriesOf"| G["lib/games.ts"]
    NGF --> Icon["orders/Icon.tsx (reused)"]
    LS -.->|"new lobby rules"| CSS["app/globals.css"]
    classDef touched fill:#f96,color:#000
    class LS,NGF,G,CSS touched
  ```

  TDD order: (1) `games.test.ts` failing tests, then `lib/games.ts`; (2) `NoGamesFound.test.tsx`, then the component; (3) `LobbyScreen.test.tsx`, then the wiring and CSS.
review_focus: |
  IN scope: name-only search, single-select category chips, their AND combination, the result-status line, and the no-results state with Clear filters. OUT: Play and sign-in behaviour, sorting, new games data or API, and the prototype's demo state bar. Riskiest area: the filter logic must never match on category (AC 3), and the toggle/clear semantics must hold. Interaction is tested through pure reducer functions and static markup because the app has no DOM test library, which is deliberate. Chip order (derived and alphabetical versus the prototype's order) and trimming of search text are noted open choices.
