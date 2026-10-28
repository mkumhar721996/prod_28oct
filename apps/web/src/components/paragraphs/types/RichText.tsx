import { classNamesForType, type ParagraphBlock } from "../registry";

interface ProcessedText {
  processed?: string;
}

// Renders Drupal's already-filtered `processed` HTML as-is so markup (and link hrefs) match production.
export default function RichText({ block }: { block: ParagraphBlock }) {
  const processed = (block.text as ProcessedText | undefined)?.processed;
  return (
    <div className={classNamesForType(block.type)}>
      {processed ? <div className="rich-text" dangerouslySetInnerHTML={{ __html: processed }} /> : null}
    </div>
  );
}
