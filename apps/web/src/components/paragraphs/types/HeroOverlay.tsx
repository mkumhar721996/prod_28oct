import { HeroCopy } from "../hero/HeroCopy";
import { HeroImage } from "../hero/HeroImage";
import { readHeroFields } from "../hero/heroFields";
import { classNamesForType, type ParagraphBlock } from "../registry";

export function HeroOverlay({ block }: { block: ParagraphBlock }) {
  const { title, text, cta, image } = readHeroFields(block, "field_hero_background");
  return (
    <section className={`${classNamesForType(block.type)} hero hero--overlay`} aria-label={title}>
      <HeroImage image={image} />
      <HeroCopy title={title} text={text} cta={cta} />
    </section>
  );
}
