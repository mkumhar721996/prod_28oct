summary: |
  Add carousel paragraph components to the Web App's paragraph registry. One shared client component, `CarouselView`, renders the slides and the previous/next navigation. A pure `carouselNav` module holds the index logic, so the interaction rules can be unit tested under the node-only vitest setup (no DOM testing library is installed). Each carousel paragraph type is a thin file in `apps/web/src/components/paragraphs/types/` that the barrel exports, so the existing registry picks it up by naming convention. Behaviour: the first slide is visible on load, next and previous move one slide, a single slide shows no controls, and zero slides render nothing. Styling uses only design-system tokens. The repo has no carousel code yet, and the exact carousel type names, slide field shape, and wrap-around behaviour are not in the repo. These are listed as open questions that must be resolved against production before code is written.
scope:
  - description: |
      Pure navigation helpers, written test-first.
      ```ts
      export function nextIndex(current: number, count: number): number
      export function prevIndex(current: number, count: number): number
      export function showsControls(count: number): boolean   // count > 1
      ```
      Wrap-around is the assumed default (see open questions). Both helpers return 0 when count is 0 or 1.
    files:
      - apps/web/src/lib/carouselNav.ts
      - apps/web/src/lib/carouselNav.test.ts
    rationale: |
      AC2, 3, 5, 6 and 8 are index rules. Isolating them as pure functions makes them testable without a DOM, which matches the existing `shell.ts` and `title.ts` pattern in `lib/`.
  - description: |
      Shared `CarouselView` client component ("use client"). It takes `slides: ReactNode[]` and a `className`. It returns null when there are no slides. It renders only the active slide, in order, starting at index 0. It renders Previous and Next buttons only when `showsControls(slides.length)` is true. The buttons use the existing `.btn .btn-secondary .btn-sm` classes from `globals.css`. State is `useState(0)`, updated through `nextIndex` and `prevIndex`. The root keeps the Drupal classes from `classNamesForType`. Layout CSS goes in `globals.css` under a `.carousel` block, using only tokens: `--space-2`, `--space-3`, `--color-border`, `--radius-lg`, `--color-bg`, `--color-fg` and `--size-control`. Mobile versus desktop uses one `@media (min-width: 768px)` block, with the breakpoint literal commented as `.shell-main` already does. No colour or px literals.
    files:
      - apps/web/src/components/paragraphs/CarouselView.tsx
      - apps/web/src/components/paragraphs/CarouselView.test.tsx
      - apps/web/src/app/globals.css
    rationale: |
      One implementation serves all carousel types (AC12), and the same control logic serves mobile and desktop (AC10, 11). Tokens are loaded already via `globals.css` line 2, `@import "../../../../design-system/tokens.css"`.
  - description: |
      One thin type file per carousel paragraph type, each mapping the block's slide field to `CarouselView`. Add one barrel line per type in `types/index.ts`; `barrel.test.ts` enforces this. The file names must give the Drupal machine name through `typeForModuleKey` (for example `Carousel.tsx` becomes `carousel`). The real type list and slide field names are open questions and must be confirmed first.
      ```ts
      export default function Carousel({ block }: { block: ParagraphBlock }) {
        const slides = (block.slides as SlideBlock[] | undefined) ?? [];
        return <CarouselView className={classNamesForType(block.type)} slides={slides.map(renderSlide)} />;
      }
      ```
      Slide content is rendered through `ParagraphBlocks` with the same registry where slides are nested paragraphs, so slide order follows the Drupal field order.
    files:
      - apps/web/src/components/paragraphs/types/Carousel.tsx
      - apps/web/src/components/paragraphs/types/index.ts
      - apps/web/src/components/paragraphs/types/Carousel.test.tsx
    rationale: |
      Reuses the registry and `ParagraphBlocks` rather than adding a new lookup mechanism. AC1, 4, 7, 9 and 12 are verified here against block fixtures.
  - description: |
      Playwright spec for the navigation behaviour in a real browser at a 375px and a 1280px viewport. It covers next, previous, wrap, single slide and empty. It needs a page that renders a carousel fixture; the exact mechanism is an open question.
    files:
      - apps/web/e2e/carousel.spec.ts
    rationale: |
      Vitest here is node-only, so the click behaviour and the viewport behaviour (AC2, 3, 5, 6, 10, 11) need a browser to be fully proved.
tests:
  - |
    AC1 and AC4 (Carousel.test.tsx). Slides render in order and the first is visible on load.
    ```ts
    const html = renderToStaticMarkup(<ParagraphBlocks blocks={[carousel3]} />);
    expect(html).toContain("Slide A");
    expect(html).not.toContain("Slide B");
    expect(html).not.toContain("Slide C");
    ```
    An assertion on the order of the slides in the underlying `slides` array comes from the `CarouselView` test with a `slides` prop.
  - |
    AC2 (carouselNav.test.ts)
    ```ts
    expect(nextIndex(0, 3)).toBe(1);
    ```
    The e2e spec clicks Next and expects slide 2 to be visible.
  - |
    AC3 (carouselNav.test.ts)
    ```ts
    expect(prevIndex(1, 3)).toBe(0);
    ```
    The e2e spec clicks Previous and expects slide 1 to be visible.
  - |
    AC5 (carouselNav.test.ts). The expected value depends on the production behaviour (open question 1). Under the wrap-around assumption:
    ```ts
    expect(nextIndex(2, 3)).toBe(0);
    ```
  - |
    AC6 (carouselNav.test.ts). Same assumption as AC5.
    ```ts
    expect(prevIndex(0, 3)).toBe(2);
    ```
  - |
    AC7 (Carousel.test.tsx)
    ```ts
    expect(renderToStaticMarkup(<ParagraphBlocks blocks={[carousel1]} />)).toContain("Only slide");
    ```
  - |
    AC8 (Carousel.test.tsx and carouselNav.test.ts)
    ```ts
    expect(showsControls(1)).toBe(false);
    expect(renderToStaticMarkup(<ParagraphBlocks blocks={[carousel1]} />)).not.toMatch(/Previous|Next/);
    ```
  - |
    AC9 (Carousel.test.tsx)
    ```ts
    expect(renderToStaticMarkup(<ParagraphBlocks blocks={[carouselEmpty]} />)).toBe("");
    ```
  - |
    AC10 and AC11 (e2e/carousel.spec.ts). Run at 375px and 1280px widths. Assert the slide and the controls are visible and match the production reference captured for the same content. These ACs can only be confirmed against production output, so the reference capture method is an open question.
    ```ts
    await page.setViewportSize({ width: 375, height: 800 });
    await expect(page.getByRole("button", { name: /next/i })).toBeVisible();
    ```
  - |
    AC12 (Carousel.test.tsx). A table-driven test over every carousel type in `defaultRegistry.types()`, using the confirmed type list.
    ```ts
    it.each(carouselTypes)("%s renders 3 slides with controls", (type) => {
      const html = renderToStaticMarkup(<ParagraphBlocks blocks={[{ type, slides: three }]} />);
      expect(html).toContain("Next");
    });
    ```
assumptions_or_open_questions:
  - |
    Which carousel paragraph types exist in production, and what are their Drupal machine names? A search of the worktree for "carousel" and "slide" found nothing. The type files and barrel lines depend on this list, so it must be confirmed before implementation.
  - |
    What are the slide field names and shape on a carousel block, and are slides nested paragraphs or inline objects? The plan assumes a `slides` array and must be checked against the existing Drupal field mappings.
  - |
    Does production wrap around at the last or first slide (AC5, 6), or does it stop? The plan assumes wrap-around. If production stops, the `carouselNav` expectations change and the controls may need a disabled state.
  - |
    Does production autoplay, show dots or thumbnails, or support swipe and keyboard? The ACs only name previous and next, so none is planned. Any extra production behaviour needs a separate decision.
  - |
    How is "matches production" checked (AC1, 4, 10, 11, 12)? The plan assumes reference markup or screenshots supplied by the team. No production reference exists in the repo.
  - |
    Where does the Playwright spec get a page with carousel data? It needs a fixture route or a Records API stub. `playwright.config.ts` was not read for a webServer setup.
  - |
    Deferred project questions on performance budgets and observability are not answered by this item. The plan sets no budget and adds no logging.
estimated_points: 5
package_dependencies: []
notes: |
  ### Data & rollout
  None — front-end components only. No stored data, migrations, settings or env vars change.

  Reuse. The catalogue's `ParagraphBlocks` and the registry (`registry.ts`, `registry.default.ts`) are reused unchanged. `registry.default.ts` builds the registry from the `types/index.ts` barrel, so adding a type needs only a file and a barrel line. The `.btn` classes in `globals.css` are reused for the controls. No new UI component is added beyond `CarouselView`, because the catalogue has none for carousels.

  Tokens. `globals.css` line 2 imports `design-system/tokens.css`, and `body` already uses `var(--color-bg)`. The new rules extend this file and add no new loader.

  Testing constraint. `apps/web/package.json` has vitest and Playwright, but no `@testing-library/*` and no jsdom. Interaction is therefore tested through the pure `carouselNav` functions plus Playwright. I did not read `vitest.config.ts` for its environment setting.

  Narrow test command, to run after each task:
  ```
  cd apps/web && pnpm vitest run src/lib/carouselNav.test.ts src/components/paragraphs/types/Carousel.test.tsx
  ```

  ```mermaid
  flowchart TD
    PB[ParagraphBlocks] --> REG[registry.default.ts]
    REG --> IDX[types/index.ts]
    IDX --> CAR[types/Carousel.tsx]
    CAR --> CV[CarouselView.tsx]
    CV --> NAV[lib/carouselNav.ts]
    CV --> CSS[globals.css]
    BT[types/barrel.test.ts] --> IDX
    classDef touched fill:#f96,color:#000
    class IDX,CAR,CV,NAV,CSS touched
  ```
  `index.ts` gets a new barrel line, `Carousel.tsx` is the per-type mapping, `CarouselView` is the shared UI, `carouselNav` holds the index rules, and `globals.css` gets the token-based styles.
review_focus: |
  IN scope: carousel paragraph types, previous/next navigation, and the single-slide and empty cases. OUT of scope: autoplay, dots and swipe unless the team confirms production has them, plus performance budgets and observability. The riskiest part is that the type list, slide shape and wrap-around behaviour are assumptions with no code or production reference in the repo, so check them against the open questions. Splitting the logic into pure `carouselNav` functions is deliberate: no DOM test library is installed.
