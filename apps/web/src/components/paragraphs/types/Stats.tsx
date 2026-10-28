import { asRecords, asString } from "../fields";
import { classNamesForType, type ParagraphBlock } from "../registry";

export default function Stats({ block }: { block: ParagraphBlock }) {
  return (
    <ul
      className={`${classNamesForType(block.type)} m-0 grid list-none gap-[var(--space-4)] p-0 text-[var(--color-fg)]`}
    >
      {asRecords(block.items).map((item, index) => (
        <li key={index} className="flex flex-col">
          <span className="text-[length:var(--font-size-xl)] font-[var(--font-weight-semibold)]">
            {asString(item.figure)}
          </span>
          <span className="text-[length:var(--font-size-md)] text-[var(--color-fg-muted)]">
            {asString(item.label)}
          </span>
        </li>
      ))}
    </ul>
  );
}
