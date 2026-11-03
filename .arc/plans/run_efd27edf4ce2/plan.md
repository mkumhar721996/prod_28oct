summary: |
  Add a Play button to every GameCard in the lobby. A signed-in player pressing Play on an available game is sent to that game; a guest is sent to the sign-in screen; if the game is unavailable or fails to open, a danger alert is shown on the lobby and the player stays there. The lobby page is public and the session is only read server side, so the lobby page reads getSession and passes a signedIn flag to LobbyScreen. The decision logic is a pure, injectable function in lib/games.ts (same pattern as loadGames), unit-tested without a router.
scope:
  - description: |
      Pure decision function plus route helper. Add to apps/web/src/lib/games.ts:

      ```ts
      export type PlayOutcome = "opened" | "sign-in" | "failed";
      export async function playGame(
        game: Game,
        deps: { signedIn: boolean; open: (game: Game) => Promise<void> | void; goToSignIn: () => void },
      ): Promise<PlayOutcome>;
      ```
      Order: guest -> goToSignIn(), return "sign-in" (never opens). Signed in and !game.available -> "failed" without calling open. Otherwise await open(game); throw/rejection -> "failed", success -> "opened". Add to apps/web/src/lib/shell.ts `export function gameHref(id: string): string` (returns `/games/${encodeURIComponent(id)}`) next to the other HREF constants.
    files:
      - apps/web/src/lib/games.ts
      - apps/web/src/lib/games.test.ts
      - apps/web/src/lib/shell.ts
      - apps/web/src/lib/shell.test.ts
    rationale: |
      Keeps the AC1-4 rules in one testable place, mirroring loadGames/lobbyReducer; the router is injected so tests need no Next runtime.
  - description: |
      GameCard gets a Play button (sketch element play-now, kind button, variant primary): `GameCard({ game, onPlay }: { game: Game; onPlay: (game: Game) => void })`. Render `<button type="button" className="btn btn-primary btn-sm" aria-label={`Play ${game.name}`} onClick={() => onPlay(game)}>Play</button>` below the game-meta row. Rendered on unavailable ("Coming soon") cards too and NOT disabled, because AC3 needs a press on an unavailable game to produce an error. GameGrid passes onPlay through. Styling uses existing .btn/.btn-primary/.btn-sm and the .game-card gap (space tokens); no new CSS. Existing GameCard.test.tsx and LobbyScreen.test.tsx call sites are updated for the new prop.
    files:
      - apps/web/src/components/lobby/GameCard.tsx
      - apps/web/src/components/lobby/GameGrid.tsx
      - apps/web/src/components/lobby/GameCard.test.tsx
    rationale: |
      Reuses GameCard and GameGrid from the component catalogue; satisfies the sketch's repeated game-card children (game-thumbnail, game-name, play-now).
  - description: |
      LobbyScreen takes a new `signedIn: boolean` prop and calls `useRouter()` from next/navigation (as TopBarControls does). It builds the deps for playGame: open = (g) => router.push(gameHref(g.id)), goToSignIn = () => router.push(SIGN_IN_HREF). On "failed" it sets a `playError` state and renders a `.alert .alert-danger` (role="alert", Icon name="alert", same markup pattern as LobbyError) above the grid: "We couldn't open {name}." / "Try again, or pick another game." The error is cleared on the next Play press. Nothing navigates on failure, so the player stays on the lobby (AC4). The loading, load-error and loaded states of the sketch are unchanged. apps/web/src/app/lobby/page.tsx becomes an async server component: `const session = await getSession(); return <LobbyScreen signedIn={session !== null} />;` (still public; a guest sees the lobby). Add an optional `initialPlayError?: string` test seam (the name of the failed game) matching the existing `initial` seam, so the alert can be rendered with renderToStaticMarkup.
    files:
      - apps/web/src/components/lobby/LobbyScreen.tsx
      - apps/web/src/components/lobby/LobbyScreen.test.tsx
      - apps/web/src/app/lobby/page.tsx
    rationale: |
      Wires the sketch flows open-game (play-now -> game) and open-sign-in (lobby -> sign-in) and the AC3/AC4 error state; reuses the alert pattern and tokens (color-danger via .alert-danger, space tokens) already used by LobbyError.
tests:
  - |
    AC1 (lib/games.test.ts), written first and failing: a signed-in player on an available game opens it.
    ```ts
    const open = vi.fn(); const goToSignIn = vi.fn();
    const out = await playGame(SAMPLE_GAMES[0], { signedIn: true, open, goToSignIn });
    expect(out).toBe("opened");
    expect(open).toHaveBeenCalledWith(SAMPLE_GAMES[0]);
    expect(goToSignIn).not.toHaveBeenCalled();
    ```
    Plus shell.test.ts: `expect(gameHref("g1")).toBe("/games/g1")`.
  - |
    AC2 (lib/games.test.ts): a guest is sent to sign-in and no game is opened.
    ```ts
    const out = await playGame(SAMPLE_GAMES[0], { signedIn: false, open, goToSignIn });
    expect(out).toBe("sign-in");
    expect(goToSignIn).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
    ```
    Component level (GameCard.test.tsx): `expect(html).toContain(">Play</button>")` for available and unavailable cards. LobbyScreen.test.tsx: `expect(html.match(/>Play<\/button>/g)).toHaveLength(8)`.
  - |
    AC3 (lib/games.test.ts): unavailable game and open failure both give "failed".
    ```ts
    expect(await playGame(SAMPLE_GAMES[3], { signedIn: true, open, goToSignIn })).toBe("failed");
    expect(open).not.toHaveBeenCalled();
    const boom = vi.fn().mockRejectedValue(new Error("x"));
    expect(await playGame(SAMPLE_GAMES[0], { signedIn: true, open: boom, goToSignIn })).toBe("failed");
    ```
    LobbyScreen.test.tsx (using the seam): the alert renders with `role="alert"` and "We couldn&#x27;t open Pyramid Dice." and the grid (`aria-label="Games"`) is still present.
  - |
    AC4 (lib/games.test.ts and LobbyScreen.test.tsx): on "failed" neither router action runs.
    ```ts
    await playGame(SAMPLE_GAMES[3], { signedIn: true, open, goToSignIn });
    expect(goToSignIn).not.toHaveBeenCalled();
    ```
    LobbyScreen test with a mocked next/navigation useRouter returning { push }: after a failed play `expect(push).not.toHaveBeenCalled()` and the heading "Game lobby" is still rendered. Existing lobby tests must keep passing (no "Sign in" text and no role="alert" in the default loaded state). Narrow command: `(cd apps/web && pnpm test -- src/lib/games.test.ts src/lib/shell.test.ts src/components/lobby)`; the full configured command is the final gate.
assumptions_or_open_questions:
  - |
    SETTLED (reviewer-approved). No game route exists today (checked: no apps/web/src/app/games). "Opened" means router.push to the new gameHref(id) = /games/{id}; a temporary 404 is acceptable until Game play ships. Do not couple to the placeholder PLACE_BET_HREF in shell.ts.
  - |
    SETTLED (reviewer-approved). A guest pressing Play goes to /sign-in with no `next` parameter. Returning to the chosen game belongs to Account access / Game play (signInTarget only allows listed targets and falls back to the wallet).
  - |
    SETTLED (reviewer-approved). A guest pressing Play on an unavailable ("Coming soon") card follows the same sign-in flow (the guest rule is checked first); a signed-in player gets the AC3 error.
  - |
    Unavailable games keep an enabled Play button so the AC3 error can appear. With the sample data, the "fails to open" case can only be exercised through the injected open dependency, since router.push does not reject.
  - |
    The sketch's note on play-now ("Can a guest play without signing in?") is answered by AC2: no. The sketch's header, balance and sign-in-button are provided by the shared TopBar and are out of scope.
  - |
    useRouter from next/navigation can throw outside a mounted app router, which would break the existing renderToStaticMarkup lobby tests. Mock next/navigation with vi.mock in LobbyScreen.test.tsx (as other screen tests do) rather than changing the component.
  - |
    The deferred project-wide question about environments, observability and data retention for player accounts and transaction history does not affect this UI-only change and is not addressed here.
estimated_points: 3
package_dependencies: []
notes: |
  ### Data & rollout
  None — UI behaviour only; no stored data, schema, settings or env vars change. The lobby page now calls getSession (already used by the root layout and other pages), which uses the existing session setting and nothing new.

  UI: sketch screen `lobby` (states loading, error, loaded from the existing LobbyScreen, plus the new play error alert), flows `open-game` (play-now -> game) and `open-sign-in` (guest -> sign-in). Design tokens are already loaded by apps/web/src/app/globals.css line 2 (`@import "../../../../design-system/tokens.css"`). The Play button and alert use only existing token-driven classes (.btn-primary, .btn-sm, .alert-danger). One .btn-primary per card; the guidelines prefer one per view, but the sketch fixes primary on each repeated play-now, so the sketch is followed.

  ```mermaid
  flowchart TD
    Page[app/lobby/page.tsx] -->|signedIn from getSession| Lobby[LobbyScreen]
    Session[lib/session.ts getSession] --> Page
    Lobby --> Grid[GameGrid]
    Grid --> Card[GameCard Play button]
    Lobby -->|playGame| Games[lib/games.ts]
    Lobby -->|gameHref, SIGN_IN_HREF| Shell[lib/shell.ts]
    classDef touched fill:#f96,color:#000
    class Page,Lobby,Grid,Card,Games,Shell touched
  ```
review_focus: |
  IN: the Play button on each game card, the guest/signed-in/failure decision, and the lobby error alert. OUT: sign-in itself, return to the chosen game, the game screen, and the "Coming soon" definition. Riskiest part is keeping the existing lobby tests green once LobbyScreen calls useRouter. Deliberate: Play opens /games/{id}, which may 404 until Game play ships; guests go to /sign-in with no next parameter; Play stays enabled on unavailable cards so AC3 can show an error.
