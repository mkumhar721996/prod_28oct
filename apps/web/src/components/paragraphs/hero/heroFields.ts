import type { ParagraphBlock } from "../registry";

export interface HeroFields {
  title: string;
  text: string;
  cta: { label: string; href: string } | null;
  image: { src: string; alt: string } | null;
}

type Raw = Record<string, unknown> | undefined;

const asString = (value: unknown): string => (typeof value === "string" ? value : "");
const asRecord = (value: unknown): Raw =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;

// Field names other than the image field are unconfirmed against production Drupal data.
export function readHeroFields(block: ParagraphBlock, imageField: string): HeroFields {
  const cta = asRecord(block.field_cta);
  const image = asRecord(block[imageField]);
  const href = asString(cta?.uri);
  const src = asString(image?.url);
  return {
    title: asString(block.field_title),
    text: asString(block.field_text),
    cta: href ? { href, label: asString(cta?.title) } : null,
    image: src ? { src, alt: asString(image?.alt) } : null,
  };
}
