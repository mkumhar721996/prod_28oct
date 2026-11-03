import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GameCard } from "./GameCard";

describe("GameCard", () => {
  it("greys out an unavailable game with a Coming soon marker", () => {
    const html = renderToStaticMarkup(
      <GameCard game={{ id: "g8", name: "Pyramid Dice", category: "Dice", available: false }} />,
    );
    expect(html).toContain("is-unavailable");
    expect(html).toContain("Coming soon");
    expect(html).toContain("badge-warning");
  });

  it("shows an available game plain, with name and category", () => {
    const html = renderToStaticMarkup(
      <GameCard game={{ id: "g2", name: "Dice Duel", category: "Dice", available: true }} />,
    );
    expect(html).not.toContain("Coming soon");
    expect(html).not.toContain("is-unavailable");
    expect(html).toContain("Dice Duel");
    expect(html).toContain(">Dice</span>");
  });
});
