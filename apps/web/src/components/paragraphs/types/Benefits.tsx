import { asRecords, asString } from "../fields";
import { classNamesForType, type ParagraphBlock } from "../registry";

export default function Benefits({ block }: { block: ParagraphBlock }) {
  return (
    <ul
      className={`${classNamesForType(block.type)} m-0 grid list-none gap-[var(--space-4)] p-0 text-[var(--color-fg)]`}
    >
      {asRecords(block.items).map((item, index) => {
        const description = asString(item.description);
        return (
          <li
            key={index}
            className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-[var(--space-4)]"
          >
            <strong className="font-[var(--font-weight-semibold)]">{asString(item.title)}</strong>
            {description ? (
              <p className="m-0 mt-[var(--space-2)] text-[var(--color-fg-muted)]">{description}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
