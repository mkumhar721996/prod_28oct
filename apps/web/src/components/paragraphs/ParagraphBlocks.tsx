import { defaultRegistry } from "./registry.default";
import type { ParagraphBlock, ParagraphRegistry } from "./registry";

export function ParagraphBlocks({
  blocks,
  registry = defaultRegistry,
}: {
  blocks: ParagraphBlock[];
  registry?: ParagraphRegistry;
}) {
  return (
    <>
      {blocks.map((block, index) => {
        const Component = registry.lookup(block.type);
        return Component ? <Component block={block} key={block.id ?? index} /> : null;
      })}
    </>
  );
}
