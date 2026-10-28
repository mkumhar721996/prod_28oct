summary: |
  Add a `ParallaxWall` paragraph component to the Web App's paragraph registry (`apps/web/src/components/paragraphs/types/`). It renders the wall's existing Drupal text and image fields, keeps Drupal's `paragraph paragraph--type--parallax-wall` root classes, and reproduces the production scroll effect with a CSS-only layered parallax. The CSS is driven by per-layer rate and direction constants and styled with design-system tokens. Reduced motion is handled by a `prefers-reduced-motion: reduce` media query that turns the layer offset off, so the wall does not move relative to the page. The production rate, direction and layout values are not in this repository, so they are isolated in one config module and flagged as open questions for the reviewer to fill from production.
scope:
  - description: |
      Create the wall's configuration module: layer definitions with production rate and direction.
      ```ts
      export interface ParallaxLayer { speed: number; direction: 1 | -1 }
      export const PARALLAX_LAYERS: Record<"background" | "foreground", ParallaxLayer>
      ```
      Values are copied from production (see open questions). Component and CSS read only from here.
    files:
      - apps/web/src/components/paragraphs/types/parallaxWall.config.ts
    rationale: One place to correct production parity values (AC2, AC3). Must be a .ts file so barrel.test.ts, which only checks *.tsx, is unaffected.
  - description: |
      Create the `ParallaxWall` component. It renders the wall as a server component with no client JS.
      ```tsx
      export default function ParallaxWall({ block }: { block: ParagraphBlock }): ReactNode
      ```
      - Root element has `className={classNamesForType(block.type)}` plus a `parallax-wall` class.
      - Text comes from the block's existing Drupal text field.
      - Image comes from the existing image field, rendered as `<img>` with its alt text.
      - Each layer gets its rate and direction as CSS custom properties, `--parallax-speed` and `--parallax-dir`, from the config module.
      - Fields are read defensively, and a missing image renders no `<img>`.
    files:
      - apps/web/src/components/paragraphs/types/ParallaxWall.tsx
    rationale: AC1, AC3, AC5. Reuses the registry convention, where `parallax_wall` maps to the `ParallaxWall` export.
  - description: |
      Export the component from the barrel with the line `export { default as ParallaxWall } from "./ParallaxWall";`, replacing the placeholder `export {};` if no other type has landed by then. `registry.default.ts` then picks it up with no change.
    files:
      - apps/web/src/components/paragraphs/types/index.ts
    rationale: barrel.test.ts requires every *.tsx in the folder to be exported.
  - description: |
      Add `.parallax-wall` styles to the app stylesheet, after the app-shell block.
      - Use the CSS 3D perspective technique: a clipped scroll container, with layers translated in Z and scaled by `--parallax-speed` and `--parallax-dir`.
      - Add `@media (prefers-reduced-motion: reduce)`, which resets the layer transform and perspective to `none`, so the layers stay fixed relative to the page content.
      - Tokens used: `--space-3`, `--space-4`, `--color-bg-subtle`, `--color-fg`, `--font-size-xl`, `--font-weight-semibold`, `--line-height-tight`, `--size-shell-max`. Any production size or colour with no token goes to the open questions, not in as a literal.
      - Media-query breakpoints follow the existing literal convention in this file.
    files:
      - apps/web/src/app/globals.css
    rationale: AC2, AC3, AC4. Tokens are already loaded at globals.css line 2, `@import "../../../../design-system/tokens.css"`, and imported by layout.tsx.
  - description: |
      Add unit tests (vitest, `renderToStaticMarkup`, the same style as ParagraphBlocks.test.tsx) and a Playwright e2e spec. The e2e spec renders a page fixture containing the wall, scrolls, and compares layer offset to scroll offset under normal and reduced motion, at several viewport widths.
    files:
      - apps/web/src/components/paragraphs/types/ParallaxWall.test.tsx
      - apps/web/tests/e2e/parallax-wall.spec.ts
    rationale: Test-first coverage for all five ACs. The e2e spec is needed because the node-environment unit tests cannot observe scrolling.
tests:
  - |
    AC1, write first and expect it to fail with a null render. Same text and image as production for that paragraph.
    ```tsx
    const html = renderToStaticMarkup(<ParagraphBlocks blocks={[wallBlock]} />);
    expect(html).toContain("Wall headline");
    expect(html).toContain('src="/files/wall.jpg"');
    expect(html).toContain('class="paragraph paragraph--type--parallax-wall');
    ```
  - |
    AC2, in the unit test. Layer rate and direction match the config, which holds the production values.
    ```tsx
    expect(html).toContain(`--parallax-speed:${PARALLAX_LAYERS.background.speed}`);
    expect(html).toContain(`--parallax-dir:${PARALLAX_LAYERS.background.direction}`);
    ```
    In the e2e spec, at widths 375, 768 and 1280:
    ```ts
    await page.mouse.wheel(0, 400);
    expect(bgDelta / 400).toBeCloseTo(PARALLAX_LAYERS.background.speed, 1);
    expect(Math.sign(bgDelta)).toBe(PARALLAX_LAYERS.background.direction);
    ```
  - |
    AC3, in the e2e spec. Position and size of text and images match production at the same viewport width.
    ```ts
    expect(await wallText.boundingBox()).toMatchObject(PROD_BOXES[width].text);
    ```
    `PROD_BOXES` is captured from production per width, and tolerance is an open question.
  - |
    AC4, in the e2e spec with `page.emulateMedia({ reducedMotion: "reduce" })`. The layers stay fixed relative to the page content.
    ```ts
    const before = await layer.boundingBox();
    await page.mouse.wheel(0, 400);
    const after = await layer.boundingBox();
    expect(after!.y - before!.y).toBeCloseTo(-400, 0);
    ```
    In the unit test, a stylesheet check:
    ```ts
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[^}]*\.parallax-wall/s);
    ```
  - |
    AC5, in the unit test. An edited field value is rendered.
    ```tsx
    const edited = { ...wallBlock, field_text: "Edited", field_image: { url: "/files/new.jpg", alt: "New" } };
    expect(renderToStaticMarkup(<ParagraphBlocks blocks={[edited]} />)).toContain("Edited");
    ```
  - |
    Existing suite stays green: barrel.test.ts and registry.test.ts. The narrow command is `(cd apps/web && pnpm test src/components/paragraphs)`. The e2e spec runs with `(cd apps/web && pnpm exec playwright test tests/e2e/parallax-wall.spec.ts)`.
assumptions_or_open_questions:
  - |
    Reduced-motion behaviour (deferred question). AC4 says the wall does not move relative to the page content. I plan to disable the parallax transform entirely under `prefers-reduced-motion: reduce` and show the layers statically. Please confirm this matches production, with no reduced-motion alternative such as a fade.
  - |
    Production parity values are not in this repo. A search for "parallax" outside node_modules found nothing. Please provide the production per-layer scroll rate and direction, the layout dimensions and the image sizes per viewport width, and the Drupal field machine names (assumed `field_text` and `field_image`). The paragraph type machine name is assumed to be `parallax_wall`.
  - |
    Implementation technique: I assumed a CSS-only parallax. If production uses a JS scroll listener, or `background-attachment: fixed`, the rate cannot be matched exactly with the CSS-only technique. Please confirm the production technique.
  - |
    Tolerance for the position and size comparison in AC3 (assumed 1px), and how production boxes are captured as fixtures.
  - |
    Performance budget (epic-level open question). Not specified, so none is enforced here. The plan adds no JS and no dependencies, and images are rendered as plain `<img>`. Please confirm whether `next/image` is expected.
  - |
    Observability (project-level open question). Not applicable to a static presentational component, so nothing is planned.
estimated_points: 3
package_dependencies: []
notes: |
  ### Data & rollout

  None — presentational component only, with no schema, stored data, seed or settings changes. The component reads the existing Drupal fields. To roll back, revert the commit.

  Design tokens are loaded in `apps/web/src/app/globals.css` line 2. The token names used are listed in the globals.css scope item.

  Existing paragraph infrastructure was read: `registry.ts` maps module key `ParallaxWall` to type `parallax_wall`, `registry.default.ts` builds the registry from the `types` barrel, and `ParagraphBlocks.tsx` renders unmapped types as nothing. The existing "empty for now" test uses `hero_banner`, so it is unaffected.

  ```mermaid
  flowchart TD
    PB[ParagraphBlocks.tsx] --> RD[registry.default.ts]
    RD --> IDX[types/index.ts]
    IDX --> PW[types/ParallaxWall.tsx]
    PW --> CFG[types/parallaxWall.config.ts]
    PW --> REG[registry.ts classNamesForType]
    PW -.styled by.-> CSS[app/globals.css]
    classDef touched fill:#f96,color:#000
    class IDX,PW,CFG,CSS touched
  ```

  Touched nodes: the barrel (export), the component (render), the config (parity values), and globals.css (layer styles and reduced-motion).

  Reuse: `ParagraphBlocks` and `classNamesForType` are reused as-is. No new shared UI component is introduced.
review_focus: |
  IN scope: the parallax wall paragraph only, meaning component, barrel export, CSS and tests. OUT of scope: other paragraph types and the FR-13 unmapped-type flagging. Riskiest area: production parity of rate, direction and layout, since the values are not in the repo and sit behind open questions. Deliberate choices: CSS-only parallax with a reduced-motion media query, no new dependencies, and parity values isolated in `parallaxWall.config.ts`.
