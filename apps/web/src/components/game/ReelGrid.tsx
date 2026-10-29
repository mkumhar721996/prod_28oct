export const SYMBOL_TEXT: Record<string, string> = {
  cherry: "🍒",
  bell: "🔔",
  bar: "BAR",
  seven: "7",
};

type Props = {
  /** One symbol key per reel; a reel with no symbol shows a dash. */
  symbols: readonly (string | undefined)[];
  spinning: boolean;
};

export function ReelGrid({ symbols, spinning }: Props) {
  return (
    <div className="reels">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={spinning ? "reel is-spinning" : "reel"}
          role="img"
          aria-label={spinning ? `Reel ${i + 1} spinning` : `Reel ${i + 1}`}
        >
          {spinning ? (symbols[i] ? SYMBOL_TEXT[symbols[i]!] : "?") : (SYMBOL_TEXT[symbols[i] ?? ""] ?? "?")}
        </div>
      ))}
    </div>
  );
}
