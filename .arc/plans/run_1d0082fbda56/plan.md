summary: |
  Add four paragraph components (Testimonial, Quote, Stats, Benefits) under apps/web/src/components/paragraphs/types/, each exported from the barrel so the existing registry (registry.default.ts) picks them up with no other change. Each renders the Drupal field values of its block with the Drupal root classes (classNamesForType), preserving text, attribution, figure/label pairs and list order, and is styled only with design-system tokens. Tests are written first, one file per type, rendering with renderToStaticMarkup like ParagraphBlocks.test.tsx.
scope:
  - description: |
      Testimonial component. Signature: `export default function Testimonial({ block }: { block: ParagraphBlock })`.
      Renders the testimonial text in a `blockquote` and the attribution (name, optional role/company) in a `footer`/`cite`. Root element uses `className={classNamesForType(block.type)}` plus token-based utilities. Missing optional attribution renders no empty element.
    files:
      - apps/web/src/components/paragraphs/types/Testimonial.tsx
      - apps/web/src/components/paragraphs/types/Testimonial.test.tsx
    rationale: AC1 and AC5.
  - description: |
      Quote component (`Quote.tsx`), same signature. Renders the quote text in a `blockquote` with the Drupal root classes; optional source line only if the field is present.
    files:
      - apps/web/src/components/paragraphs/types/Quote.tsx
      - apps/web/src/components/paragraphs/types/Quote.test.tsx
    rationale: AC2 and AC5.
  - description: |
      Stats component (`Stats.tsx`), same signature. Renders a list (`dl` or `ul`) with one item per stat in source order, figure and label in separate elements, so each figure stays paired with its label.
    files:
      - apps/web/src/components/paragraphs/types/Stats.tsx
      - apps/web/src/components/paragraphs/types/Stats.test.tsx
    rationale: AC3 and AC5.
  - description: |
      Benefits component (`Benefits.tsx`), same signature. Renders an ordered-as-given `ul` of benefits (title plus optional description per item), never sorting or deduplicating.
    files:
      - apps/web/src/components/paragraphs/types/Benefits.tsx
      - apps/web/src/components/paragraphs/types/Benefits.test.tsx
    rationale: AC4 and AC5.
  - description: |
      Add four lines to the barrel, e.g. `export { default as Testimonial } from "./Testimonial";`. barrel.test.ts already fails if a .tsx here is missing. Update the "empty for now" production-registry test in ParagraphBlocks.test.tsx only if it breaks (it uses hero_banner, so it should not).
    files:
      - apps/web/src/components/paragraphs/types/index.ts
    rationale: Registers the components via typeForModuleKey (Testimonial to testimonial and so on) with no registry change.
  - description: |
      Shared field-reading helper is NOT planned; each component reads its own fields with a small local `asString` / `asArray` guard, since block fields are typed `unknown`. If duplication across the four exceeds a few lines, extract one helper into types-adjacent file apps/web/src/components/paragraphs/fields.ts (not in types/, so the barrel test ignores it).
    files: []
    rationale: Avoids speculative abstraction.
tests:
  - |
    Testimonial.test.tsx (AC1), written first and failing because the component does not exist:
    ```ts
    const html = renderToStaticMarkup(<ParagraphBlocks blocks={[{ type: "testimonial", id: "1", text: "Great work", author: "Ada", role: "CTO" }]} />);
    expect(html).toContain("Great work");
    expect(html).toContain("Ada");
    expect(html).toContain('class="paragraph paragraph--type--testimonial');
    ```
    The field names above are placeholders until the Drupal mapping is confirmed (see open questions).
  - |
    Quote.test.tsx (AC2):
    ```ts
    expect(render({ type: "quote", text: "Make it simple" })).toContain("Make it simple");
    expect(render({ type: "quote", text: "Make it simple" })).toContain("paragraph--type--quote");
    ```
  - |
    Stats.test.tsx (AC3), pairing and order:
    ```ts
    const html = render({ type: "stats", items: [{ figure: "98%", label: "Satisfied" }, { figure: "10k", label: "Users" }] });
    expect(html).toMatch(/98%[\s\S]*Satisfied[\s\S]*10k[\s\S]*Users/);
    ```
  - |
    Benefits.test.tsx (AC4), order preserved:
    ```ts
    const html = render({ type: "benefits", items: [{ title: "Zeta" }, { title: "Alpha" }] });
    expect(html.indexOf("Zeta")).toBeLessThan(html.indexOf("Alpha"));
    ```
  - |
    AC5, one shared test per component file (colours and layout): rendered markup contains no hex/rgb literals and uses token variables, and the barrel guard passes:
    ```ts
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
    expect(html).toContain("var(--color-");
    ```
    Plus barrel.test.ts passes unchanged, and `renderToStaticMarkup(<ParagraphBlocks blocks={[{ type: "testimonial" }]} />)` renders without throwing on missing fields. Visual parity with production is verified manually against the production page, because the repo has no production reference to diff against.
    Narrow run: `(cd apps/web && pnpm exec vitest run src/components/paragraphs)`. Run the full configured command at the end.
assumptions_or_open_questions:
  - |
    The Drupal paragraph machine names and field names for testimonial, quote, stats and benefits are not in this repository (I searched the worktree outside node_modules for testimonial/stats/benefit/quote and for field_ names and found only design-system docs and the earlier plan). I assumed types `testimonial`, `quote`, `stats`, `benefits`, with fields like text, author, role, items[{figure,label}] and items[{title,description}]. Please supply the real type names (they may be several per family, e.g. testimonial_card) and the Records API field shape. This is the main blocker for exact parity.
  - |
    Production visual parity (layout, text, colours) cannot be checked from the code. I assumed the reviewer compares against production manually, and that production colours map onto existing tokens (--color-fg, --color-fg-muted, --color-bg-subtle, --color-primary, --color-border). Any production colour or size no token covers (for example a large stat-figure font size above --font-size-xl) is listed here rather than hard-coded. Please confirm those values.
  - |
    Whether "all testimonial/quote, stats and benefits types" means more than one Drupal type per family is unknown. The plan has one component per family and adds files per extra type once names are known.
  - |
    Performance budgets (deferred question) are not answered. These components are static server-renderable markup with no client JS or images, so I set no budget. Observability (deferred question) is out of scope for this story.
  - FR-13 (flagging paragraph types with no component) is out of scope, as in the registry story. registry.types() already supports a later report.
estimated_points: 3
package_dependencies: []
notes: |
  ### Data & rollout

  None — presentational React components only, no stored data, migration, setting or env var.

  Token loading: `apps/web/src/app/globals.css` line 1 imports tailwindcss and line 2 imports `../../../../design-system/tokens.css`, so `var(--token)` is available app-wide. No new loading step is needed. Existing UI (TopBar) uses global classes such as `btn` and `alert`; there is no existing component for testimonial, quote, stats or benefits, so four new ones are justified. ParagraphBlocks is reused unchanged as the entry point.

  Tokens each component uses, by name: text `--color-fg`, secondary text and attribution `--color-fg-muted`, surface `--color-bg-subtle`, accent rule `--color-primary` with `--border-width-strong`, borders `--color-border`, spacing `--space-2` to `--space-5`, radius `--radius-lg`, type `--font-size-md`, `--font-size-lg`, `--font-size-xl`, `--font-weight-semibold`, `--line-height-base`. Applied through Tailwind arbitrary values such as `text-[var(--color-fg)]`, never literals.

  ```mermaid
  flowchart TD
    PB[ParagraphBlocks.tsx] --> RD[registry.default.ts]
    RD --> IDX[types/index.ts barrel]
    IDX --> T[Testimonial.tsx]
    IDX --> Q[Quote.tsx]
    IDX --> S[Stats.tsx]
    IDX --> B[Benefits.tsx]
    T --> R[registry.ts classNamesForType]
    Q --> R
    S --> R
    B --> R
    classDef touched fill:#f96,color:#000
    class IDX,T,Q,S,B touched
  ```
review_focus: |
  IN: four components plus barrel lines and their tests. OUT: FR-13 flagging, page routes and data fetching, and any registry change. Riskiest area is field-name and type-name guessing, since the Drupal mapping is not in the repo, so reviewers should check it against the confirmed mapping. Token-only styling and omitting empty optional elements are deliberate.
