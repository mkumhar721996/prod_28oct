summary: |
  Add a paragraph type registry to the Web App (apps/web, Next.js + vitest). A Drupal paragraph type machine name (for example `hero_banner`) resolves, through one convention (snake_case type name to PascalCase component module `HeroBanner`), to exactly one React component. A `ParagraphBlocks` renderer takes a page's paragraph blocks and renders the mapped component for each block, renders nothing for a type with no component, and keeps the Drupal class names on the component's root element. This is the scaffold the ~50 component stories plug into. It contains no individual component visuals and no Drupal fetching.
scope:
  - description: |
      Type-name helpers and registry factory. Pure functions, no React.

      ```ts
      export type ParagraphComponent = (props: { block: ParagraphBlock }) => React.ReactNode;
      export interface ParagraphBlock { type: string; id?: string; [field: string]: unknown }
      export function componentNameForType(type: string): string;          // "hero_banner" -> "HeroBanner"
      export function classNamesForType(type: string): string;             // "hero_banner" -> "paragraph paragraph--type--hero-banner"
      export function createRegistry(modules: Record<string, { default: ParagraphComponent }>): {
        lookup(type: string): ParagraphComponent | undefined;
        types(): string[];
      };
      ```

      `createRegistry` keys components by the name derived from each module key, and throws if two modules resolve to the same Drupal type, so a type can never have more than one component (AC1).
    files:
      - apps/web/src/components/paragraphs/registry.ts
      - apps/web/src/components/paragraphs/registry.test.ts
    rationale: |
      One predictable lookup, testable without Next. Duplicate detection enforces the exactly-one rule.
  - description: |
      Production wiring. `apps/web/src/components/paragraphs/types/index.ts` is a barrel that does `export { default as HeroBanner } from "./HeroBanner"` for each component folder file, and `registry.default.ts` builds `createRegistry(...)` from it. It ships empty of real components in this story. Later component stories add a file under `types/` and one barrel line. A test reads the `types/` directory and fails if any `*.tsx` there is missing from the barrel, which is the guard for AC3.
    files:
      - apps/web/src/components/paragraphs/types/index.ts
      - apps/web/src/components/paragraphs/registry.default.ts
      - apps/web/src/components/paragraphs/types/barrel.test.ts
    rationale: |
      Next.js bundlers cannot rely on vite-only `import.meta.glob`; an explicit barrel plus a directory-completeness test gives convention-based discovery without bundler-specific features.
  - description: |
      Renderer, a server-compatible React component.

      ```tsx
      export function ParagraphBlocks(props: {
        blocks: ParagraphBlock[];
        registry?: ReturnType<typeof createRegistry>;   // defaults to the production registry
      }): React.JSX.Element
      ```

      For each block, `registry.lookup(block.type)`. If found, render `<Component block={block} key={block.id ?? index} />`. If not, return null for that block (AC5). No raw block markup or JSON is ever emitted (AC4). Class carry-over (AC2): the component wraps itself in an element with `classNamesForType(block.type)` and any legacy class names it needs, kept as a constant next to the component.
    files:
      - apps/web/src/components/paragraphs/ParagraphBlocks.tsx
      - apps/web/src/components/paragraphs/ParagraphBlocks.test.tsx
    rationale: |
      A single renderer that every page route uses to turn blocks into components.
  - description: |
      Test-only fixture components (`Fixture.tsx` as `fixture_type`, `FixtureTwo.tsx`) used with the injected registry, so no real component visuals are needed. They live under `__fixtures__` and are not exported from the production barrel.
    files:
      - apps/web/src/components/paragraphs/__fixtures__/FixtureType.tsx
    rationale: |
      Keeps this story free of component visuals, which are out of scope.
tests:
  - |
    AC1, in registry.test.ts. Write first, fails because registry.ts does not exist.
    ```ts
    const registry = createRegistry({ HeroBanner: { default: Hero }, CardGrid: { default: Grid } });
    expect(registry.lookup("hero_banner")).toBe(Hero);
    expect(registry.types().filter((t) => t === "hero_banner")).toHaveLength(1);
    expect(registry.lookup("unknown_type")).toBeUndefined();
    expect(() => createRegistry({ HeroBanner: { default: Hero }, "hero-banner": { default: Grid } })).toThrow(/duplicate/i);
    expect(componentNameForType("card_grid")).toBe("CardGrid");
    ```
  - |
    AC2, in ParagraphBlocks.test.tsx, using renderToStaticMarkup from react-dom/server. The fixture component renders its root with classNamesForType.
    ```tsx
    const html = renderToStaticMarkup(<ParagraphBlocks blocks={[{ type: "hero_banner" }]} registry={registry} />);
    expect(html).toContain('class="paragraph paragraph--type--hero-banner');
    ```
    A table-driven test asserts `classNamesForType` for each type in a fixture list of legacy class strings supplied by the reviewer (see open questions).
  - |
    AC3, in types/barrel.test.ts. Reads `types/*.tsx` with node:fs and asserts each file's basename is exported from the barrel.
    ```ts
    const files = readdirSync(typesDir).filter((f) => f.endsWith(".tsx")).map((f) => f.replace(".tsx", ""));
    const exported = Object.keys(await import("./index"));
    for (const name of files) expect(exported).toContain(name);
    ```
    Also in registry.test.ts, a module keyed by a new PascalCase name (`NewThing`) is found for `new_thing` and rendered by ParagraphBlocks with no other code change.
  - |
    AC4, in ParagraphBlocks.test.tsx.
    ```tsx
    const html = renderToStaticMarkup(<ParagraphBlocks blocks={[{ type: "fixture_type", id: "1" }]} registry={registry} />);
    expect(html).toContain("data-testid=\"fixture-type\"");
    expect(html).not.toContain("fixture_type\"}");
    ```
  - |
    AC5, in ParagraphBlocks.test.tsx.
    ```tsx
    expect(renderToStaticMarkup(<ParagraphBlocks blocks={[{ type: "no_such_type" }]} registry={registry} />)).toBe("");
    // mixed page: mapped block still renders, unmapped one adds nothing
    expect(renderToStaticMarkup(<ParagraphBlocks blocks={[{ type: "no_such_type" }, { type: "fixture_type" }]} registry={registry} />)).toBe(renderToStaticMarkup(<ParagraphBlocks blocks={[{ type: "fixture_type" }]} registry={registry} />));
    ```
  - |
    Narrow run for each file, from the configured command: `(cd apps/web && pnpm exec vitest run src/components/paragraphs)`. Run the full configured command at the end.
assumptions_or_open_questions:
  - |
    The legacy class names are not in this repository (searched the worktree for "paragraph" outside node_modules and found nothing). I assumed Drupal's default pattern `paragraph paragraph--type--{type}`, with underscores in the type turned into hyphens as Drupal does in Twig. Please confirm this or supply the real class list per type. Each component story then carries its own exact class strings, and this story only provides the helper and the root-class contract.
  - |
    Naming convention assumed: Drupal machine name in snake_case maps to a PascalCase file in `apps/web/src/components/paragraphs/types/`. Confirm that is acceptable; the alternative is an explicit type-to-component table.
  - |
    A new component still needs one line in the barrel (guarded by a test) because Next bundlers have no portable directory glob. If "no code change at all" is required for AC3, we would need a codegen step or dynamic imports; flag if wanted.
  - |
    No page route or Records API paragraph data shape exists yet in apps/web (only src/app/page.tsx), so ParagraphBlocks takes an already-fetched array of `{ type, id?, ...fields }`. Wiring it into a real page belongs with the page and data-fetching work.
  - |
    FR-13 (flagging paragraph types with no component) is a lower-priority Should and no AC covers it, so it is left out. Unmapped blocks render nothing silently, per AC5. `registry.types()` is exposed so a later story can build the report.
  - |
    Deferred questions, performance budgets (EPIC-016) and observability beyond local development (CHORE-028), are not answered by this story. The registry is a small synchronous map with no logging, and these stay open for the component and platform stories.
estimated_points: 3
package_dependencies: []
notes: |
  ### Data & rollout
  None — new front-end modules only; no schema, stored data, seed or setting changes, and it is safe to revert by deleting the new folder.

  Design tokens: no UI styling is added in this story (component visuals are out of scope). `design-system/tokens.css` exists, but `apps/web/src/app/globals.css` currently contains only `@import "tailwindcss";` and does not import the tokens. The first component story with visuals should add that import once in globals.css. I did not add it here because nothing uses it yet.

  Test setup: `apps/web/vitest.config.ts` already includes `src/**/*.test.tsx` with the node environment and the `@` alias, so `renderToStaticMarkup` from `react-dom/server` works without a new dependency (react-dom is already installed). The existing test pattern is `apps/web/src/lib/title.test.ts`.

  ```mermaid
  flowchart TD
    Page[apps/web/src/app/page.tsx - existing, not changed] -.future caller.-> PB[ParagraphBlocks.tsx - renders blocks]
    PB --> RD[registry.default.ts - production wiring]
    RD --> REG[registry.ts - lookup, naming helpers]
    RD --> BAR[types/index.ts - barrel of components]
    classDef touched fill:#f96,color:#000
    class PB,RD,REG,BAR touched
  ```
review_focus: |
  IN: registry, naming helper, renderer, barrel and their tests only. OUT: real component visuals, Drupal data fetching, page routes, FR-13 reporting, design-token wiring. Riskiest part is the class-name carry-over (AC2): the legacy class strings are not in the repo, so the helper rests on an assumed Drupal pattern that a reviewer should confirm. The barrel plus a directory-completeness test is a deliberate choice over bundler-specific globbing.
