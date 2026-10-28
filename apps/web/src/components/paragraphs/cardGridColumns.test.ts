import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// jsdom has no media queries, so assert on the stylesheet source.
const css = readFileSync(join(__dirname, "../../app/globals.css"), "utf8");

describe("card-grid columns", () => {
  it("is 3 columns from 768px (AC3)", () => {
    expect(css).toMatch(
      /@media \(min-width: 768px\)\s*{[^}]*\.card-grid\s*{[^}]*repeat\(3, 1fr\)/s,
    );
  });

  it("is 1 column on mobile (AC4)", () => {
    expect(css).toMatch(/\.card-grid\s*{[^}]*grid-template-columns:\s*1fr/);
    expect(css.replace(/@media[^{]*{[\s\S]*?}\s*}/g, "")).not.toMatch(/repeat\(3, 1fr\)/);
  });
});
