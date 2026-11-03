const GLYPHS: Record<string, string> = { cherry: "🍒", bell: "🔔", bar: "BAR", seven: "7" };
const CYCLE = Object.keys(GLYPHS);

const glyph = (symbol: string) => GLYPHS[symbol] ?? symbol;

/** Three reels. While spinning they cycle symbols by `frame` (first frame shows "?"). */
export function ReelGrid({
  symbols,
  spinning,
  frame,
}: {
  symbols: readonly string[];
  spinning: boolean;
  frame: number;
}) {
  return (
    <div className="reels">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={spinning ? "reel is-spinning" : "reel"}
          role="img"
          aria-label={spinning ? `Reel ${i + 1} spinning` : `Reel ${i + 1}`}
        >
          {spinning ? (frame === 0 ? "?" : glyph(CYCLE[(frame + i) % CYCLE.length])) : glyph(symbols[i])}
        </div>
      ))}
    </div>
  );
}
