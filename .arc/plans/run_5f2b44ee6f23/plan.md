summary: |
  Add the `quiz_survey` paragraph component to the Web App's paragraph registry so a page with that paragraph shows its Drupal-set questions and answer options, and a user can step through and complete it. The step logic and persisted state live in a pure, framework-free module (reducer plus a storage adapter) so they can be tested in the existing node-environment vitest setup without new dependencies. The thin client component wires that module to the DOM. Production's exact step order, completion behaviour and leave/reload behaviour are not recorded anywhere in the repo, so they are listed as open questions for a human to confirm before code is written.
scope:
  - description: |
      Pure quiz state module. Types for the Drupal-mapped quiz paragraph plus a reducer and a persistence adapter.
      ```ts
      export interface QuizOption { id: string; label: string }
      export interface QuizQuestion { id: string; prompt: string; options: QuizOption[] }
      export interface QuizState { step: number; answers: Record<string, string>; completed: boolean }
      export type QuizAction =
        | { type: "answer"; questionId: string; optionId: string }
        | { type: "next" } | { type: "back" } | { type: "finish" };
      export function initialState(): QuizState
      export function quizReducer(questions: QuizQuestion[], state: QuizState, action: QuizAction): QuizState
      export function parseQuizBlock(block: ParagraphBlock): { id: string; questions: QuizQuestion[] }
      export function loadState(store: Pick<Storage, "getItem">, key: string, questions: QuizQuestion[]): QuizState
      export function saveState(store: Pick<Storage, "setItem">, key: string, state: QuizState): void
      ```
      `loadState` discards stored state that is malformed or refers to unknown question or option ids, and returns `initialState()` instead.
    files:
      - apps/web/src/components/paragraphs/types/quizSurveyState.ts
      - apps/web/src/components/paragraphs/types/quizSurveyState.test.ts
    rationale: |
      Keeps steps, order, completion and reload behaviour (AC1, AC3, AC4) testable in the node vitest environment (apps/web/vitest.config.ts, environment "node", no jsdom) without adding a DOM test library. It is a `.ts` file in `types/`, and barrel.test.ts only requires exports for `.tsx` files. It must NOT be added to the barrel, because registry.default.ts treats every barrel export as a paragraph component.
  - description: |
      `QuizSurvey` client component (`"use client"`) following the registry convention. Renders the Drupal class names via `classNamesForType(block.type)` on the root. Renders one question per step with its options as a radio group, with Back, Next and Finish buttons that reuse the existing `.btn`, `.btn-secondary` and `.alert` classes from globals.css. Reads state with `loadState` on mount (in an effect, so server and first client render match) and calls `saveState` on each change. Server render shows step 0 with the Drupal questions and options (AC2).
      Export it from the barrel with one line.
      ```ts
      export { default as QuizSurvey } from "./QuizSurvey";
      ```
      The registry maps `QuizSurvey` to `quiz_survey` through `typeForModuleKey`. Check the actual Drupal paragraph machine name (open question), because the registry key must equal it.
    files:
      - apps/web/src/components/paragraphs/types/QuizSurvey.tsx
      - apps/web/src/components/paragraphs/types/QuizSurvey.test.tsx
      - apps/web/src/components/paragraphs/types/index.ts
    rationale: |
      Extends the existing ParagraphBlocks registry (registry.default.ts picks up every barrel export, so no registry change is needed). This is a new component, but the catalogue (TopBar, TopBarControls, ParagraphBlocks) has nothing that covers an interactive quiz. Buttons and alerts reuse the existing global classes.
  - description: |
      Quiz styles appended to globals.css, using only tokens from design-system/tokens.css, which globals.css already imports at line 2. Tokens used: `--space-2`, `--space-3`, `--space-4` (gaps and padding), `--color-border`, `--border-width`, `--radius-lg` (card), `--color-bg`, `--color-fg`, `--color-fg-muted` (text), `--color-primary`, `--color-primary-bg` (selected option), `--color-focus`, `--border-width-strong`, `--size-focus-offset` (focus ring), `--size-check` (radio size), `--font-size-lg`, `--font-weight-semibold` (prompt). No colour or pixel literals.
    files:
      - apps/web/src/app/globals.css
    rationale: |
      Tokens are already loaded (globals.css:2, imported by apps/web/src/app/layout.tsx), so no new loading step is required. Visual parity with production is limited to layout and step order (AC3). Any production value that no token covers goes in the open questions.
  - description: |
      Playwright e2e covering a real browser step-through, complete, reload and leave-and-return. It uses a fixture page that renders `ParagraphBlocks` with a sample `quiz_survey` block. Reuse the existing apps/web/playwright.config.ts.
    files:
      - apps/web/e2e/quiz-survey.spec.ts
      - apps/web/src/app/quiz-fixture/page.tsx
    rationale: |
      Covers AC1 and AC4 in a browser, which the node-environment unit tests cannot (localStorage, reload). The fixture route must be gated to non-production, or removed once real Drupal-backed pages exist. Check how pages currently get paragraph data before finalising it.
tests:
  - |
    AC1 (write first, fails because the module does not exist). Stepping through and finishing completes the quiz.
    ```ts
    const qs = [
      { id: "q1", prompt: "A?", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] },
      { id: "q2", prompt: "B?", options: [{ id: "c", label: "C" }] },
    ];
    let s = initialState();
    s = quizReducer(qs, s, { type: "answer", questionId: "q1", optionId: "a" });
    s = quizReducer(qs, s, { type: "next" });
    expect(s.step).toBe(1);
    s = quizReducer(qs, s, { type: "answer", questionId: "q2", optionId: "c" });
    s = quizReducer(qs, s, { type: "finish" });
    expect(s.completed).toBe(true);
    expect(s.answers).toEqual({ q1: "a", q2: "c" });
    ```
    Also assert that `next` without an answer on the current step does not advance, and that `back` at step 0 stays at 0. Both are the assumed production rules, pending the open questions.
  - |
    AC2 (QuizSurvey.test.tsx, using the pattern in ParagraphBlocks.test.tsx). Questions and options set in Drupal are rendered.
    ```ts
    const html = renderToStaticMarkup(<ParagraphBlocks blocks={[block]} />);
    expect(html).toContain("What is your role?");
    expect(html).toContain("Developer");
    expect(html).toContain('class="paragraph paragraph--type--quiz-survey');
    ```
    Also assert that `parseQuizBlock` preserves the Drupal option order, and that a block with no questions renders without throwing.
  - |
    AC3 (layout and order). Only step 0 renders on the server, questions appear in Drupal order, and each step shows exactly one question.
    ```ts
    expect(html.indexOf("Question one")).toBeGreaterThan(-1);
    expect(html).not.toContain("Question two");
    expect(html.indexOf("Option A")).toBeLessThan(html.indexOf("Option B"));
    ```
    A markup snapshot of production's step layout is pending the open question. Do not freeze a snapshot until a production reference is supplied.
  - |
    AC4 (quizSurveyState.test.ts). State is restored on return and invalid state is discarded.
    ```ts
    const store = new Map<string, string>();
    const mem = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    saveState(mem, "quiz:p1", { step: 1, answers: { q1: "a" }, completed: false });
    expect(loadState(mem, "quiz:p1", qs)).toEqual({ step: 1, answers: { q1: "a" }, completed: false });
    mem.setItem("quiz:p1", "not json");
    expect(loadState(mem, "quiz:p1", qs)).toEqual(initialState());
    mem.setItem("quiz:p1", JSON.stringify({ step: 0, answers: { q1: "zzz" }, completed: false }));
    expect(loadState(mem, "quiz:p1", qs)).toEqual(initialState());
    ```
  - |
    Barrel and registry. `barrel.test.ts` stays green with the new `QuizSurvey.tsx`. Add to registry.test.ts or ParagraphBlocks.test.tsx:
    ```ts
    expect(defaultRegistry.types()).toContain("quiz_survey");
    ```
    The existing test "renders with the production registry, empty for now" uses `hero_banner`, so it is unaffected.
  - |
    E2E (Playwright, AC1 and AC4). Answer question 1, reload, and expect the same step and selected option. Complete the quiz and expect the completion state to be shown.
    ```ts
    await page.getByRole("radio", { name: "Developer" }).check();
    await page.reload();
    await expect(page.getByRole("radio", { name: "Developer" })).toBeChecked();
    ```
assumptions_or_open_questions:
  - |
    BLOCKER: production behaviour is not documented in the repo. I searched the worktree (grep for quiz, survey, field_) and found nothing. Needed from a human: the Drupal paragraph machine name (assumed `quiz_survey`) and its field names for questions, answer options and ordering, plus a description or screenshots of the production quiz layout and steps.
  - |
    What does completing the quiz do in production (a result screen, a score, a submission to an endpoint, a redirect)? The plan assumes a completion state is shown and nothing is submitted. No API route exists for submissions, and ADR-0013 says there are no other third-party integrations.
  - |
    How does production persist partial progress, and does a completed quiz stay completed on return? The plan assumes localStorage keyed by paragraph id, restored on mount. If production resets on reload, or uses a cookie, session storage or a server-side session, the persistence adapter changes.
  - |
    Is a question required before Next (the plan assumes yes), and can the user go Back (the plan assumes yes)? Confirm both against production.
  - |
    How do pages obtain paragraph data today? I found no data-loading layer for Drupal fields in apps/web beyond the registry, so the e2e fixture route is a stand-in. Confirm where real pages will supply `ParagraphBlock` data.
  - |
    Deferred project question on performance budgets. No budget is defined. The quiz adds one small client component and no new dependencies, so none is enforced here.
  - |
    Deferred project question on observability. Nothing beyond local development is planned. The component has no logging, and a malformed stored state is silently discarded.
estimated_points: 5
package_dependencies: []
notes: |
  ### Data & rollout
  None — front-end component only. The change adds no schema, migration, seed or env var. The one new piece of stored data is a client-side localStorage entry per quiz, and `loadState` ignores anything malformed or unknown, so it cannot lock out a returning user. Roll back by reverting the commit. Stored entries are then simply ignored.

  ### Design tokens
  design-system/tokens.css is loaded by `apps/web/src/app/globals.css:2` (`@import "../../../../design-system/tokens.css";`), which `apps/web/src/app/layout.tsx` imports. No loading step is needed. The existing `.btn`, `.btn-secondary` and `.alert` classes in globals.css cover the buttons and error messages.

  ### Structure
  ```mermaid
  flowchart TD
    PB[ParagraphBlocks.tsx] --> RD[registry.default.ts]
    RD --> IDX[types/index.ts]
    IDX --> QS[types/QuizSurvey.tsx]
    QS --> ST[types/quizSurveyState.ts]
    QS --> REG[registry.ts classNamesForType]
    QS --> CSS[app/globals.css]
    classDef touched fill:#f96,color:#000
    class IDX,QS,ST,CSS touched
  ```
  index.ts gets one export line. QuizSurvey.tsx and quizSurveyState.ts are new. globals.css gets the quiz styles. The registry itself is untouched, because it builds from the barrel.

  ### Testing note
  vitest runs with `environment: "node"` and there is no jsdom or testing-library, so interaction logic is tested through the pure module, and browser behaviour through Playwright.
review_focus: |
  IN scope: the `quiz_survey` component, its pure state module, token-only styles and the barrel export. OUT of scope: other paragraph types, Drupal data loading, and any submission endpoint. The riskiest part is production parity (step order, completion and reload behaviour), which the repo does not document, so check the open questions were answered before trusting the assumed rules. Splitting the state logic from the component is deliberate, because the vitest environment is node-only, and the state module must stay out of the barrel.
