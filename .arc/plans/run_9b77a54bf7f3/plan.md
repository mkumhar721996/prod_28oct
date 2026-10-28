summary: |
  Add the three hero paragraph components shown in the approved prototype (`hero_split`, `hero_overlay`, `hero_feature`) to the existing paragraph registry in `apps/web`, so `ParagraphBlocks` renders each hero block in place with the production title, text, call-to-action and image, and the prototype's layout and styling. Components are dropped into `components/paragraphs/types/` and exported from the barrel; the registry derives the Drupal type from the file name, so no registry change is needed. Styling is added to `globals.css` using design tokens only. Cards, carousels and rich text are out of scope.

scope:
  - description: |
      Shared hero helpers (not a paragraph type, so NOT in `types/`, which would register it and fail the barrel test).
      `readHeroFields(block)` maps Drupal field values on a `ParagraphBlock` to `{ title, text, cta, image }`, with `cta = { label, href } | null` and `image = { src, alt } | null`.
      `HeroCopy` renders `.hero-copy`: the `.hero-type` label (the paragraph type name as the prototype shows it), an `h1.hero-title`, `p.hero-text` and an `a.btn.btn-primary` only when a cta exists.
      `HeroImage` renders `.hero-img` as an `<img>` with alt text when an image exists, and nothing when it is missing (the prototype does not design a missing-image state).
      ```ts
      export interface HeroFields { title: string; text: string; cta: { label: string; href: string } | null; image: { src: string; alt: string } | null }
      export function readHeroFields(block: ParagraphBlock, imageField: string): HeroFields
      ```
    files:
      - apps/web/src/components/paragraphs/hero/heroFields.ts
      - apps/web/src/components/paragraphs/hero/HeroCopy.tsx
      - apps/web/src/components/paragraphs/hero/HeroImage.tsx
    rationale: |
      One place for field mapping and markup keeps the three variants identical in text handling (AC2) and avoids three copies of the copy block.
  - description: |
      Three paragraph components, one per variant, each `export default`-style named export matching its file name so the registry maps it. Each root keeps the Drupal classes via `classNamesForType(block.type)` and adds the hero classes.
      - `HeroSplit` (type `hero_split`): `section.hero.hero--split`, copy left, image right, subtle background. Image field `field_hero_image`.
      - `HeroOverlay` (type `hero_overlay`): `section.hero.hero--overlay`, background image fills the section, copy centred over it. Image field `field_hero_background`.
      - `HeroFeature` (type `hero_feature`): `section.hero.hero--tint`, image left, copy right, primary tint background. Image field `field_hero_image`.
      Each section carries `aria-label` as the prototype does ("Hero variant N" in the prototype; production should use the title, see open questions).
      ```tsx
      export function HeroSplit({ block }: { block: ParagraphBlock }): JSX.Element
      ```
      Add the three `export { default as ... }` style lines to the barrel following the existing comment in that file, replacing `export {};`.
    files:
      - apps/web/src/components/paragraphs/types/HeroSplit.tsx
      - apps/web/src/components/paragraphs/types/HeroOverlay.tsx
      - apps/web/src/components/paragraphs/types/HeroFeature.tsx
      - apps/web/src/components/paragraphs/types/index.ts
    rationale: |
      `registry.default.ts` builds the registry from the barrel and `typeForModuleKey` turns `HeroSplit` into `hero_split`, so exporting from the barrel is the whole wiring (AC1). Note the barrel's header comment shows `export { default as HeroBanner }`, but `registry.default.ts` reads named exports and treats each as the component, so the barrel lines must be `export { HeroSplit } from "./HeroSplit";` — confirm by running the registry test.
  - description: |
      Hero styles appended to `apps/web/src/app/globals.css`, copied from the prototype's `<style>` block and using only tokens: `.heroes` is not needed (the page owns spacing), `.hero`, `.hero-copy`, `.hero-title`, `.hero-text`, `.hero-type`, `.hero-img` (+ `img` fit), `.hero--overlay`, `.hero--tint`, `.hero--split`.
      Tokens used: `--space-2`, `--space-3`, `--space-4`, `--radius-md`, `--radius-lg`, `--border-width`, `--color-border`, `--color-bg-subtle`, `--color-neutral-50`, `--color-neutral-200`, `--color-neutral-700`, `--color-neutral-800`, `--color-neutral-900`, `--color-primary`, `--color-primary-bg`, `--font-size-sm`, `--font-size-lg`, `--font-size-xl`, `--line-height-tight`, `--font-weight-semibold`, `--font-family-mono`.
      The `768px` media query for the two-column layout stays a literal, as in the prototype and the existing shell rules in that file ("custom properties cannot be used in media queries").
      `.btn-primary` is not yet in `globals.css` (only `.btn`, `.btn-secondary`, `.btn-ghost`, `.btn-sm` are), so add `.btn-primary` and its hover from `design-system/prototype-utils.css` using `--color-primary`, `--color-primary-fg`, `--color-primary-hover`.
      The prototype's `min-height: 480px` and `min-height: 240px` have no token; keep them as in the prototype and list them in open questions.
    files:
      - apps/web/src/app/globals.css
    rationale: |
      AC3 asks for the same layout and styling; the prototype is the approved record of it. Tokens are already loaded at `globals.css` line 2 (`@import "../../../../design-system/tokens.css"`), so nothing new is needed to load them.
  - description: |
      Update the production-registry test so it no longer relies on the registry being empty for hero types. It uses `hero_banner`, which stays unmapped, so it still passes; confirm and leave it unless it fails.
    files:
      - apps/web/src/components/paragraphs/ParagraphBlocks.test.tsx
    rationale: |
      Guards against the new barrel exports changing the unmapped-type behaviour.

tests:
  - |
    AC1 — new file `apps/web/src/components/paragraphs/types/HeroVariants.test.tsx`. Write first, fails because the production registry has no hero types.
    ```tsx
    const blocks = [
      { type: "hero_split", id: "1", ...fieldsFor("split") },
      { type: "hero_overlay", id: "2", ...fieldsFor("overlay") },
      { type: "hero_feature", id: "3", ...fieldsFor("feature") },
    ];
    const html = renderToStaticMarkup(<ParagraphBlocks blocks={blocks} />);
    expect((html.match(/<section/g) ?? []).length).toBe(3);
    expect(html.indexOf("hero--split")).toBeLessThan(html.indexOf("hero--overlay"));
    expect(html.indexOf("hero--overlay")).toBeLessThan(html.indexOf("hero--tint"));
    expect(defaultRegistry.types()).toEqual(expect.arrayContaining(["hero_split", "hero_overlay", "hero_feature"]));
    ```
  - |
    AC2 — same file. For each variant, render one block with the production field values and assert text and image.
    ```tsx
    expect(html).toContain("Plan your next trip with confidence");
    expect(html).toContain("Compare routes, book in minutes");
    expect(html).toContain('href="/plan"');
    expect(html).toContain("Start planning");
    expect(html).toContain('src="/img/hero-split.jpg"');
    expect(html).toContain('alt="Travellers checking a map at a station"');
    // overlay reads its own field, not field_hero_image
    expect(overlayHtml).toContain('src="/img/hero-bg.jpg"');
    // no cta field -> no button
    expect(renderHero({ type: "hero_split", title: "T" })).not.toContain("btn-primary");
    // text is escaped
    expect(renderHero({ type: "hero_split", title: "<b>x</b>" })).not.toContain("<b>x</b>");
    ```
    Also `heroFields.test.ts` for `readHeroFields` with missing and partial fields.
  - |
    AC3 — same file, structure and class assertions (jsdom is not configured, vitest runs in node, so assert on markup and on the CSS source).
    ```tsx
    expect(splitHtml).toContain('class="paragraph paragraph--type--hero-split hero hero--split"');
    expect(tintHtml).toContain("hero--tint");
    // image comes after copy for split, DOM order is preserved and CSS order:-1 mirrors feature
    expect(splitHtml.indexOf("hero-copy")).toBeLessThan(splitHtml.indexOf("hero-img"));
    // overlay image is first so it can sit behind the copy
    expect(overlayHtml.indexOf("hero-img")).toBeLessThan(overlayHtml.indexOf("hero-copy"));
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/\.hero--tint\s*\{[^}]*var\(--color-primary-bg\)/);
    // tokens only
    const heroCss = css.slice(css.indexOf(".hero {"));
    expect(heroCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/);
    ```
  - |
    Barrel guard — the existing `types/barrel.test.ts` must pass with the three new `.tsx` files (`expect(exported).toContain("HeroSplit")` etc. by its loop). `registry.test.ts` and `ParagraphBlocks.test.tsx` must still pass unchanged.
    Narrow command: `cd apps/web && pnpm test -- src/components/paragraphs`

assumptions_or_open_questions:
  - |
    BLOCKER for exact production parity (AC2, AC3): the repository holds no Drupal field mapping or production sample data for hero paragraphs (I grepped `hero` and `field_` across the repo; only the registry tests and an old plan mention hero). The paragraph type names `hero_split`, `hero_overlay`, `hero_feature` and image fields `field_hero_image`, `field_hero_background` come only from the prototype labels. The title, text and cta field names and the shape of the image field (URL string, Drupal media object, with or without alt) and cta (link field with `uri`/`title`) are not stated anywhere, so `readHeroFields` uses placeholders (`field_title`, `field_text`, `field_cta`) that a human must confirm against the real Drupal JSON:API/export before implementation.
  - |
    The prototype shows three variants labelled as hero variants 1 to 3. I assumed these are all the production hero types; if production has more, each is one more file in `types/` plus a barrel line and a test case.
  - |
    Images: I plan a plain `<img>` because `next.config.ts` has no `images.remotePatterns` and the image host is unknown. If production images are served from a Drupal host and `next/image` is wanted, `next.config.ts` needs that host (not planned).
  - |
    The prototype's `hero-type` label (for example `paragraph--hero_split`) and "Image: field_hero_image" placeholder text are reviewer aids. I assume the production hero should NOT show the type label, so `HeroCopy` omits it unless told otherwise. This is a conflict between the prototype ("each labelled with its paragraph type name") and AC2/AC3 ("same text and images as production"), so I follow the ACs.
  - |
    Hero `min-height: 480px` / `240px` and the 768px breakpoint have no token. Kept as literals copied from the prototype.
  - |
    Not wired into `app/page.tsx`: today it shows only the title and there is no content source feeding paragraph blocks yet. AC1 is verified through `ParagraphBlocks` with a mixed block list. Needs a decision if the page itself must render heroes in this story.
  - |
    Open deferred questions: performance budgets (page weight, load time) and observability for the new front end are not answered by the item or code. This story adds static markup and CSS only; no budget is enforced and no logging is added.

estimated_points: 3

package_dependencies: []

notes: |
  ### Data & rollout
  None — front-end components and CSS only; no stored data, migration, setting or env var.

  Design source: `PROD-28OCT-STORY-030-design.html`, screen "Page with one hero per variant". Elements used: `.heroes` stack separated by `--space-4`; `.hero--split` (text left, image right, `--color-bg-subtle`); `.hero--overlay` (image absolutely positioned behind, copy centred in a `--color-neutral-900` panel); `.hero--tint` (`--color-primary-bg` with `--color-primary` border, image first at 768px and up via `order: -1`); each with `.hero-title` (h1, `--font-size-xl`), `.hero-text` (`--font-size-lg`, `--color-neutral-700`), and a `.btn.btn-primary`. Below 768px all three are single-column.

  Token loading today: `apps/web/src/app/globals.css` line 2 imports `design-system/tokens.css`; `layout.tsx` loads `globals.css`. Nothing to add.

  The prototype uses `h1` for each hero title. Several heroes on one page produce several `h1`s; kept as designed, flagged for review.

  Accessibility: each hero is a `section` with an `aria-label`; images need real alt text from the Drupal field.

  ```mermaid
  flowchart TD
    PB[ParagraphBlocks.tsx] --> RD[registry.default.ts]
    RD --> BR[types/index.ts barrel]
    BR --> HS[HeroSplit.tsx]
    BR --> HO[HeroOverlay.tsx]
    BR --> HF[HeroFeature.tsx]
    HS --> HC[hero/HeroCopy.tsx]
    HO --> HC
    HF --> HC
    HS --> HI[hero/HeroImage.tsx]
    HO --> HI
    HF --> HI
    HC --> HFD[hero/heroFields.ts]
    HS --> CSS[globals.css]
    RD --> REG[registry.ts]
    classDef touched fill:#f96,color:#000
    class BR,HS,HO,HF,HC,HI,HFD,CSS touched
  ```
  Touched nodes: the barrel (wires the types), the three hero components (the work), the shared helpers (single field mapping), and `globals.css` (hero styling).

review_focus: |
  IN: the three hero types and their styling only, wired through the existing barrel and registry; OUT: cards, carousels, rich text, `page.tsx` wiring, and `next/image` configuration. Riskiest area is the unconfirmed Drupal field names and image/link field shapes, so check the `readHeroFields` mapping against real production data before approving. Deliberate: helpers live in `paragraphs/hero/`, not `types/`, so they are not registered as paragraph types; the production hero omits the prototype's type-name label and image placeholder text.
