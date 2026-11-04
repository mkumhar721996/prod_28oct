import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SAMPLE_GAMES } from "@/lib/games";
import { GameCard } from "./GameCard";

describe("GameCard", () => {
  it("greys out an unavailable game with a Coming soon marker", () => {
    const html = renderToStaticMarkup(
      <GameCard
        game={{ id: "g8", name: "Pyramid Dice", category: "Dice", available: false }}
        onPlay={() => {}}
      />,
    );
    expect(html).toContain("is-unavailable");
    expect(html).toContain("Coming soon");
    expect(html).toContain("badge-warning");
  });

  it("shows an available game plain, with name, category and Play", () => {
    const html = renderToStaticMarkup(
      <GameCard
        game={{ id: "g2", name: "Dice Duel", category: "Dice", available: true }}
        onPlay={() => {}}
      />,
    );
    expect(html).not.toContain("Coming soon");
    expect(html).not.toContain("is-unavailable");
    expect(html).toContain("Dice Duel");
    expect(html).toContain(">Dice</span>");
    expect(html).toContain(">Play</button>");
  });

  it("disables Play on a Coming soon card but not on an available one", () => {
    const off = renderToStaticMarkup(<GameCard game={SAMPLE_GAMES[3]} onPlay={() => {}} />);
    expect(off).toMatch(/<button[^>]*disabled[^>]*>Play<\/button>/);
    const on = renderToStaticMarkup(<GameCard game={SAMPLE_GAMES[0]} onPlay={() => {}} />);
    expect(on).not.toMatch(/<button[^>]*disabled/);
  });
});
