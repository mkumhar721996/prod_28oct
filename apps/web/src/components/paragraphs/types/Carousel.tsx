import { CarouselView } from "../CarouselView";
import { ParagraphBlocks } from "../ParagraphBlocks";
import { classNamesForType, type ParagraphBlock } from "../registry";

// Assumes slides are nested paragraphs in a `slides` field (unconfirmed plan assumption).
export default function Carousel({ block }: { block: ParagraphBlock }) {
  const slides = (block.slides as ParagraphBlock[] | undefined) ?? [];
  return (
    <CarouselView
      className={classNamesForType(block.type)}
      slides={slides.map((slide, i) => (
        <ParagraphBlocks blocks={[slide]} key={slide.id ?? i} />
      ))}
    />
  );
}
