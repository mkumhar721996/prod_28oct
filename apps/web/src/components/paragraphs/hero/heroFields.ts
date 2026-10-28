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

const SAFE_LINK = /^(https?:|mailto:|tel:)/i;
const SAFE_SRC = /^https?:/i;

/** Drupal link uri -> href; `internal:/x` becomes `/x`, unsupported schemes (`javascript:`, `entity:`) become "". */
function safeHref(uri: string): string {
  const value = uri.trim().replace(/^internal:(?=\/)/, "");
  if (value.startsWith("/")) return value.startsWith("//") ? "" : value;
  return SAFE_LINK.test(value) ? value : "";
}

function safeSrc(url: string): string {
  const value = url.trim();
  if (value.startsWith("/")) return value.startsWith("//") ? "" : value;
  return SAFE_SRC.test(value) ? value : "";
}

// Field names other than the image field are unconfirmed against production Drupal data.
export function readHeroFields(block: ParagraphBlock, imageField: string): HeroFields {
  const cta = asRecord(block.field_cta);
  const image = asRecord(block[imageField]);
  const href = safeHref(asString(cta?.uri));
  const src = safeSrc(asString(image?.url));
  return {
    title: asString(block.field_title),
    text: asString(block.field_text),
    cta: href ? { href, label: asString(cta?.title) } : null,
    image: src ? { src, alt: asString(image?.alt) } : null,
  };
}
