import { HeroCopy } from "../hero/HeroCopy";
import { HeroImage } from "../hero/HeroImage";
import { readHeroFields } from "../hero/heroFields";
import { classNamesForType, type ParagraphBlock } from "../registry";

export function HeroSplit({ block }: { block: ParagraphBlock }) {
  const { title, text, cta, image } = readHeroFields(block, "field_hero_image");
  return (
    <section className={`${classNamesForType(block.type)} hero hero--split`} aria-label={title}>
      <HeroCopy title={title} text={text} cta={cta} />
      <HeroImage image={image} />
    </section>
  );
}
