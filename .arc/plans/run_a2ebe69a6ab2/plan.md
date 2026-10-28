summary: |
  Add the `card` and `card_grid` paragraph types to the existing paragraph registry (STORY-029) so a page's paragraph blocks render a single card, or a grid of cards in Drupal order, laid out in 3 columns from 768px and 1 column below, as the approved prototype shows. Each type is one `.tsx` file in `apps/web/src/components/paragraphs/types/`, exported from the barrel so `registry.default.ts` picks it up with no other wiring. CardGrid reuses the single Card component for its items. Styling is plain CSS in `globals.css` using design-system tokens only. Carousels are out of scope.
scope:
  - description: |
      Card paragraph component. Renders one card from a block: image slot (4:3), title (h2), text, and a "Read more" link, matching the prototype's single-card screen. The root keeps Drupal's classes through `classNamesForType`. Also export a presentational `CardItem` so CardGrid reuses it.

      ```ts
      export interface CardData {
        title?: string;
        text?: string;
        image?: { url: string; alt?: string };
        link?: { url: string; title?: string };
      }
      export function CardItem({ card }: { card: CardData }): ReactNode;
      export default function Card({ block }: { block: ParagraphBlock }): ReactNode; // reads block as CardData
      ```
    files:
      - apps/web/src/components/paragraphs/types/Card.tsx
    rationale: |
      The registry maps file name to type, so `Card.tsx` becomes `card`. The prototype uses `article.card.pcard` with `.pcard-image`, `h2`, `.pcard-text` and `.pcard-link`.
  - description: |
      CardGrid paragraph component. Renders `block.cards` (array of CardData) in the order given inside `div.card-grid`, using CardItem. Root keeps the Drupal classes (`paragraph paragraph--type--card-grid`). An empty or missing `cards` renders the root with no items. Never sort or de-duplicate.
    files:
      - apps/web/src/components/paragraphs/types/CardGrid.tsx
    rationale: |
      `CardGrid.tsx` maps to `card_grid` through `typeForModuleKey`. Order parity is AC2.
  - description: |
      Add the two barrel lines, following the comment in the file. `barrel.test.ts` fails if a `.tsx` here is missing from this list.

      ```ts
      export { default as Card } from "./Card";
      export { default as CardGrid } from "./CardGrid";
      ```
    files:
      - apps/web/src/components/paragraphs/types/index.ts
    rationale: |
      `registry.default.ts` builds the production registry from this barrel, so no registry change is needed. `CardItem` is a named export of `Card.tsx` and is not in the barrel, so it is not registered as a type.
  - description: |
      Add card and grid styles to the app stylesheet. Tokens only. The 768px breakpoint is a literal media query, as the existing `.shell-*` rules already do, because custom properties can't be used in media queries.

      Tokens, from `design-system/tokens.css` already imported at `apps/web/src/app/globals.css` line 2:
      - `.card`: `--card-default-padding`, `--card-default-background`, `--card-default-foreground`, `--border-width`, `--card-default-border`, `--card-default-radius`.
      - `.pcard`: `--space-2` gap, 100% height.
      - `.pcard-image`: 4/3 aspect ratio, `--color-bg-subtle`, `--color-neutral-600`, `--radius-md`, `--border-width`, `--color-border`.
      - `.pcard-text`: `--color-neutral-700`.
      - `.pcard-link`: `--color-primary`, `--font-weight-medium`, focus outline `--border-width-strong`, `--color-focus`, `--size-focus-offset`.
      - `.card-grid`: `--space-3` gap, 1 column by default, `repeat(3, 1fr)` from 768px.
    files:
      - apps/web/src/app/globals.css
    rationale: |
      `.card` is not defined in `globals.css` today; it exists only in `design-system/prototype-utils.css`. The prototype uses a fixed 1 / 3 column grid, not the `.grid` auto-fill helper, so the column count is deterministic (AC3, AC4).
  - description: |
      Tests for both types and the stylesheet, written first (see `tests`).
    files:
      - apps/web/src/components/paragraphs/Card.test.tsx
      - apps/web/src/components/paragraphs/CardGrid.test.tsx
      - apps/web/src/components/paragraphs/cardGridColumns.test.ts
    rationale: |
      `types/barrel.test.ts` requires every `*.tsx` file in `types/` (its filter is `f.endsWith(".tsx")`) to be exported from the barrel, so a `Card.test.tsx` placed there would fail it. The tests therefore live in `paragraphs/`, next to `ParagraphBlocks.test.tsx`.
tests:
  - |
    AC1, written first and failing: a single card shows the same content as production for that paragraph.
    ```tsx
    const html = renderToStaticMarkup(
      <ParagraphBlocks blocks={[{ type: "card", id: "1", title: "Plan your first project",
        text: "Set up a project in minutes.", image: { url: "/a.jpg", alt: "Plan" },
        link: { url: "/plan", title: "Read more" } }]} />);
    expect(html).toContain("paragraph paragraph--type--card");
    expect(html).toContain("<h2>Plan your first project</h2>");
    expect(html).toContain("Set up a project in minutes.");
    expect(html).toContain('src="/a.jpg"');
    expect(html).toContain('href="/plan"');
    ```
    Also assert that a card with no image renders no `<img>` and does not throw.
  - |
    AC2: the grid shows the same cards in the same order as production.
    ```tsx
    const cards = ["Alpha","Beta","Gamma","Delta"].map((title) => ({ title }));
    const html = renderToStaticMarkup(<ParagraphBlocks blocks={[{ type: "card_grid", cards }]} />);
    const titles = [...html.matchAll(/<h2>(.*?)<\/h2>/g)].map((m) => m[1]);
    expect(titles).toEqual(["Alpha","Beta","Gamma","Delta"]);
    expect(html).toContain("paragraph paragraph--type--card-grid");
    ```
    Also assert that `cards: []` and a missing `cards` render no `<article`.
  - |
    AC3, desktop columns: jsdom cannot evaluate media queries, so assert on the stylesheet source that the grid is 3 columns from 768px.
    ```ts
    const css = readFileSync(globalsCssPath, "utf8");
    expect(css).toMatch(/@media \(min-width: 768px\)\s*{[^}]*\.card-grid\s*{[^}]*repeat\(3, 1fr\)/s);
    ```
    A Playwright check at 1280px is not planned, because there is no route that renders paragraphs yet.
  - |
    AC4, mobile columns: the base `.card-grid` rule is a single column, and the 3-column rule exists only inside the 768px media query.
    ```ts
    expect(css).toMatch(/\.card-grid\s*{[^}]*grid-template-columns:\s*1fr/);
    expect(css.replace(/@media[^{]*{[\s\S]*?}\s*}/g, "")).not.toMatch(/repeat\(3, 1fr\)/);
    ```
  - |
    Regression: the registry exposes both types and the barrel test still passes.
    ```ts
    expect(defaultRegistry.types()).toEqual(expect.arrayContaining(["card", "card_grid"]));
    ```
    The existing `ParagraphBlocks.test.tsx` case "renders with the production registry, empty for now" uses `hero_banner`, so it still passes.
assumptions_or_open_questions:
  - |
    The Drupal field mapping and the production paragraph type machine names are not in this repo. I searched `apps/web` and the repo for `card`, `field_` and `drupal` and found no mapping. I assumed the types are `card` and `card_grid`, and that a block exposes `title`, `text`, `image {url, alt}` and `link {url, title}`, with `cards` as the array on a grid. The epic says to use the existing Drupal field mappings. Please confirm the real type names and field keys, or point to the mapping document, before implementation.
  - |
    The scope says "all single card and card-grid types". If production has several variants (for example an image-left card or a 2-column or 4-column grid), each needs its own file and its own column count from production. I could only plan the one card and one grid shown in the prototype, so please list the variants.
  - |
    The "same content as production" comparison cannot be run from here. Production's markup, link label and image handling (for example whether the whole card is a link) are unverified. The prototype shows the link as "Read more" plus a visually secondary "about ..." phrase, and that phrase is derived from the title. I assumed the link text comes from `link.title` when present and fall back to "Read more", so please confirm.
  - |
    `app/page.tsx` renders only the app title and there is no data fetch for page paragraphs yet. I assumed a later story wires `ParagraphBlocks` into a page. This plan therefore does not change `page.tsx`, and the prototype's page title and shell are not rebuilt here.
  - |
    Image rendering: I plan a plain `img` inside the 4:3 slot (object-fit cover) and no `next/image`, because the Drupal media host is not configured in `next.config`. I did not open `next.config`, so confirm if `next/image` is preferred. When there is no image URL the slot renders no `img`, and no placeholder icon is shown, because the prototype icon is only a stand-in for Drupal media.
  - |
    The open project-wide questions (performance budgets, observability) have no answer in the repo. This plan sets no budget and adds no logging.
estimated_points: 3
package_dependencies: []
notes: |
  ### Data & rollout

  None — presentational React components and CSS only. There is no stored data, schema, setting, env var or provisioning change.

  ### Design source

  I read the approved prototype `PROD-28OCT-STORY-031-design.html` in full:
  - Screen 1 "Page with a single card": `article.card.pcard` containing a `.pcard-image` (4:3, `--color-bg-subtle`, `role="img"`), an `h2` title, `.pcard-text` and `.pcard-link` ("Read more" plus a `.text-sm` suffix).
  - Screen 2 "Page with a card grid": six cards in `.card-grid`, 3 columns from 768px, 1 column below.
  - Screen 3: the same grid forced to 1 column in a 360px frame.
  - The prototype's `.page`, `.page-narrow`, `.phone-frame` and `.note` rules are demo scaffolding and are not built. The `.is-forced-mobile` class is also demo-only.

  The design agrees with the acceptance criteria. The single card is constrained to a narrow width in the prototype (`.page-narrow`), but that is page layout and not part of the paragraph component, so it is not built here.

  ### Token loading

  `apps/web/src/app/globals.css` line 1 imports Tailwind and line 2 imports `design-system/tokens.css`. New rules go in that same file and use `var(--token)` only. There are no colour or pixel literals except the 768px media-query breakpoint, which matches the existing `.shell-*` block in the same file.

  ### Reuse

  Existing catalogue: `ParagraphBlocks` (unchanged, dispatches by type) and `FixtureType` (test-only). There is no existing card component, so `Card` is new, and `CardGrid` reuses `CardItem` from it.

  ```mermaid
  flowchart TD
    PB[ParagraphBlocks.tsx] --> RD[registry.default.ts]
    RD --> IDX[types/index.ts]
    IDX --> CARD[types/Card.tsx]
    IDX --> GRID[types/CardGrid.tsx]
    GRID --> CARD
    CARD --> REG[registry.ts classNamesForType]
    GRID --> REG
    CARD --> CSS[app/globals.css]
    GRID --> CSS
    BT[types/barrel.test.ts] --> IDX
    classDef touched fill:#f96,color:#000
    class IDX,CARD,GRID,CSS touched
  ```

  The touched nodes are the barrel (registers the two types), the two new components, and `globals.css` (card and grid styles). `ParagraphBlocks`, `registry.default.ts` and `registry.ts` are read-only callers or callees.

  Narrow test command, for example: `cd apps/web && pnpm test -- src/components/paragraphs`.
review_focus: |
  IN: the `card` and `card_grid` paragraph components, their barrel lines, and the card and grid CSS. OUT: carousels, other paragraph types, page data fetching, `page.tsx`, and the unknown-type flagging (FR-13). The riskiest area is the guessed production type names and field keys, which are the first open question, and the column-count tests, which assert on the CSS source because jsdom has no media queries. The grid is a fixed 1 / 3 column layout and not the auto-fill `.grid` helper, which is deliberate.
