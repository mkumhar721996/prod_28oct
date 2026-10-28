import { asString } from "../fields";
import { classNamesForType, type ParagraphBlock } from "../registry";

export default function Testimonial({ block }: { block: ParagraphBlock }) {
  const text = asString(block.text);
  const author = asString(block.author);
  const role = asString(block.role);
  return (
    <figure
      className={`${classNamesForType(block.type)} m-0 rounded-[var(--radius-lg)] bg-[var(--color-bg-subtle)] p-[var(--space-5)] text-[var(--color-fg)]`}
    >
      <blockquote className="m-0 text-[length:var(--font-size-lg)] leading-[var(--line-height-base)]">
        {text}
      </blockquote>
      {author || role ? (
        <footer className="mt-[var(--space-3)] text-[length:var(--font-size-md)] text-[var(--color-fg-muted)]">
          {author ? (
            <cite className="font-[var(--font-weight-semibold)] not-italic">{author}</cite>
          ) : null}
          {author && role ? ", " : null}
          {role}
        </footer>
      ) : null}
    </figure>
  );
}
