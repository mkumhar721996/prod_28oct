import { asString } from "../fields";
import { classNamesForType, type ParagraphBlock } from "../registry";

export default function Quote({ block }: { block: ParagraphBlock }) {
  const source = asString(block.source);
  return (
    <blockquote
      className={`${classNamesForType(block.type)} m-0 border-l-[length:var(--border-width-strong)] border-[var(--color-primary)] py-[var(--space-2)] pl-[var(--space-4)] text-[length:var(--font-size-xl)] leading-[var(--line-height-base)] text-[var(--color-fg)]`}
    >
      <p className="m-0">{asString(block.text)}</p>
      {source ? (
        <cite className="mt-[var(--space-2)] block text-[length:var(--font-size-md)] text-[var(--color-fg-muted)] not-italic">
          {source}
        </cite>
      ) : null}
    </blockquote>
  );
}
