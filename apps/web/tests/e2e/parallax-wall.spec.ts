import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, type Page } from "@playwright/test";
import ParallaxWall from "../../src/components/paragraphs/types/ParallaxWall";
import { PARALLAX_LAYERS } from "../../src/components/paragraphs/types/parallaxWall.config";

// Layout tokens are irrelevant to scroll rate, so only the wall's own rules are loaded.
const css = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8").replace(
  /@import[^;]*;/g,
  "",
);
const wall = renderToStaticMarkup(
  createElement(ParallaxWall, {
    block: {
      type: "parallax_wall",
      field_text: "Wall headline",
      field_image: { url: "data:image/gif;base64,R0lGODlhAQABAAAAACw=", alt: "Wall" },
    },
  }),
);
const SCROLL = 400;

async function layerDelta(page: Page, selector: string) {
  const layer = page.locator(selector);
  // Start with the wall at the bottom edge of the viewport, then scroll the page.
  await page.evaluate(() => {
    const wall = document.querySelector(".parallax-wall")!;
    window.scrollTo(0, wall.getBoundingClientRect().top + window.scrollY - window.innerHeight + 1);
  });
  const before = (await layer.boundingBox())!.y;
  await page.evaluate((by) => window.scrollBy(0, by), SCROLL);
  const after = (await layer.boundingBox())!.y;
  // Movement relative to the content, which scrolls by exactly SCROLL.
  return after - before + SCROLL;
}

async function open(page: Page, width: number) {
  await page.setViewportSize({ width, height: 800 });
  const spacer = `<div style="height:2000px"></div>`;
  await page.setContent(`<style>${css}</style>${spacer}${wall}${spacer}`);
}

for (const width of [375, 768, 1280]) {
  test(`background layer moves at the production rate and direction at ${width}px`, async ({ page }) => {
    await open(page, width);
    const { speed, direction } = PARALLAX_LAYERS.background;
    const delta = await layerDelta(page, ".parallax-wall__layer--background");
    expect(delta / SCROLL).toBeCloseTo(speed * direction, 1);
  });

  test(`layers stay fixed relative to the content under reduced motion at ${width}px`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, width);
    const delta = await layerDelta(page, ".parallax-wall__layer--background");
    expect(delta).toBeCloseTo(0, 0);
  });
}
