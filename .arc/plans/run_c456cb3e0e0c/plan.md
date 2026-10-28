summary: |
  Add the `rich_text` paragraph component to the existing paragraph registry. It renders the editor-authored, Drupal-processed HTML of the block unchanged (so markup, including `<a href>` links, is byte-identical to production), inside the standard Drupal paragraph wrapper classes, with prose styling in `globals.css` built only from design tokens. Because the registry maps `RichText` to `rich_text` by naming convention, no registry change is needed. Scope is the rich text paragraph type only; other embedded elements (images, embeds, tables) are not claimed.
scope:
  - description: |
      Create the `RichText` component. Signature:

      ```tsx
      export default function RichText({ block }: { block: ParagraphBlock }): ReactNode
      ```

      Reads the processed HTML from the block (assumed Drupal text field shape `{ value, format, processed }`, field key `text`; see open questions) and renders
      `<div className={classNamesForType(block.type)}><div className="rich-text" dangerouslySetInnerHTML={{ __html: processed }} /></div>`.
      Renders the wrapper with no inner HTML when the field is missing or empty (no throw). Links are not rewritten: `href`, `target`, `rel` and anchor attributes pass through untouched, so activating a link lands on the same destination as production.
    files:
      - apps/web/src/components/paragraphs/types/RichText.tsx
    rationale: |
      Reuses `classNamesForType` from registry.ts for the Drupal wrapper classes (same convention as FixtureType). Passing Drupal's already-filtered `processed` output through is the only way to guarantee markup parity.
  - description: |
      Register the component by adding one barrel line, `export { default as RichText } from "./RichText";`, to types/index.ts (replacing `export {};`). `registry.default.ts` derives the `rich_text` type from the export name via `typeForModuleKey`, and barrel.test.ts enforces the line.
    files:
      - apps/web/src/components/paragraphs/types/index.ts
    rationale: Required by the existing barrel convention; no change to registry.ts or registry.default.ts.
  - description: |
      Add prose styling scoped to `.paragraph--type--rich-text .rich-text` in the app's global stylesheet (tokens are already loaded at globals.css line 2 via `@import "../../../../design-system/tokens.css"`). Tokens used: `--font-family-base`, `--font-size-md`, `--line-height-base`, `--color-fg`, `--space-2` (paragraph and list spacing, same token the shell uses), `--color-primary` and `--color-primary-hover` (links), `--color-focus`, `--border-width-strong`, `--size-focus-offset` (link focus ring). Rules cover `p`, `ul/ol`, `strong/em`, `a`, `a:hover`, `a:focus-visible`. No colour literals or raw pixel values.
    files:
      - apps/web/src/app/globals.css
    rationale: Existing app puts shared component CSS (buttons, shell) in globals.css using tokens; this follows that pattern.
  - description: |
      Update the existing production-registry test: `ParagraphBlocks.test.tsx` line 38-40 asserts the default registry renders `hero_banner` as empty, which stays true; add the rich text tests in a new file rather than editing it.
    files:
      - apps/web/src/components/paragraphs/types/RichText.test.tsx
    rationale: Test file for all four ACs (written first).
tests:
  - |
    AC1 markup parity (write first; fails because `rich_text` is unmapped and renders ""). In `RichText.test.tsx`, using `renderToStaticMarkup(<ParagraphBlocks blocks={[block]} />)` with the default registry:
    ```tsx
    const html = '<p>Hello <strong>world</strong></p><ul><li>One</li></ul>';
    const out = render({ type: "rich_text", id: "1", text: { value: html, format: "full_html", processed: html } });
    expect(out).toContain('class="paragraph paragraph--type--rich-text');
    expect(out).toContain(html); // inner HTML is byte-identical to the processed field
    ```
    Also `expect(render({ type: "rich_text" })).toContain("paragraph--type--rich-text")` and does not throw for a missing field.
  - |
    AC2 styling parity. Vitest runs without a browser, so assert the contract: the wrapper carries `rich-text`, and the stylesheet defines the rules using tokens only:
    ```ts
    const css = readFileSync(resolve(__dirname, "../../../app/globals.css"), "utf8");
    const block = css.match(/\.paragraph--type--rich-text[^{]*\{[^}]*\}/g)!.join("");
    expect(block).toContain("var(--color-fg)");
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/);
    ```
    Visual comparison against production is manual or Playwright-based, see open questions.
  - |
    AC3 link markup and styling. Render a block whose processed HTML is `<p><a href="/about" target="_blank" rel="noopener">About</a></p>` and assert `expect(out).toContain('<a href="/about" target="_blank" rel="noopener">About</a>')`; and that the CSS contains `.paragraph--type--rich-text .rich-text a` with `var(--color-primary)` and an `a:focus-visible` rule.
  - |
    AC4 same destination. Parse the rendered markup with `new DOMParser()` (jsdom, if the vitest environment provides it; otherwise a regex on the string) and assert
    `expect(anchor.getAttribute("href")).toBe("/about")` and an external `https://example.com/x?y=1#z` is unchanged, i.e. no href rewriting or stripping.
  - |
    Registry conventions. The existing `types/barrel.test.ts` must pass with the new `RichText.tsx`, and `registry.test.ts` / `ParagraphBlocks.test.tsx` stay green. Narrow command: `(cd apps/web && pnpm test -- src/components/paragraphs)`.
assumptions_or_open_questions:
  - |
    Production reference is not in the repo. I searched for Drupal, field_, paragraph--type, rich_text and processed across the worktree (excluding node_modules, plans, design-system) and found only the registry code and tests. The exact Drupal field key for rich text (assumed `text` with `{ value, format, processed }`) and the production markup and CSS for it must be confirmed from the Records API payload or a production sample.
  - |
    Styling parity with production is stated as a goal, but the production CSS values are unknown, so the prose rules are token-based approximations. If production uses values no token covers (heading sizes beyond `--font-size-xl`, blockquote or table styling), those need new tokens or a decision; none are planned here.
  - |
    Security: `dangerouslySetInnerHTML` renders Drupal's server-filtered `processed` HTML as trusted. If the Records API may pass unfiltered `value`, a sanitizer (new package) would be needed. I assume processed output is already filtered by Drupal's text format and add no dependency.
  - Embedded elements other than links (images, media, tables, embeds) pass through as raw HTML but are not claimed or tested here, per the item's scope.
  - Performance budgets (epic question) and observability (chore question) are not answered by the code; this change adds no JS beyond one server-rendered component and a small CSS block, so no budget or logging work is planned.
estimated_points: 2
package_dependencies: []
notes: |
  ### Data & rollout

  None — front-end component and CSS only; no stored data, schema, settings or provisioning. Rollback is reverting the commit.

  Token loading: `apps/web/src/app/globals.css:2` already imports `design-system/tokens.css`, so no loader work is needed. Existing UI components reviewed: ParagraphBlocks (reused unchanged as the renderer), FixtureType (pattern for using `classNamesForType`); TopBar is unrelated.

  ```mermaid
  flowchart TD
    PB[ParagraphBlocks.tsx] --> RD[registry.default.ts]
    RD --> IDX[types/index.ts]
    IDX --> RT[types/RichText.tsx]
    RT --> REG[registry.ts classNamesForType]
    RT -.styled by.-> CSS[app/globals.css]
    CSS --> TOK[design-system/tokens.css]
    classDef touched fill:#f96,color:#000
    class IDX,RT,CSS touched
  ```
  index.ts gains the barrel line (registers the type), RichText.tsx is the new component, globals.css gets the token-based prose rules.
review_focus: |
  IN scope: the `rich_text` paragraph component, its barrel line, and token-only CSS. OUT: other paragraph types, non-link embedded elements, sanitizer, perf/observability. Riskiest area is the unverified assumption about the Drupal field key and production markup/CSS (no reference in the repo), and the deliberate unsanitised pass-through of `processed` HTML so markup stays identical to production.
