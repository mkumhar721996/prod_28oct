import type { ReactNode } from "react";

export interface ParagraphBlock {
  type: string;
  id?: string;
  [field: string]: unknown;
}

export type ParagraphComponent = (props: { block: ParagraphBlock }) => ReactNode;

export type ParagraphRegistry = ReturnType<typeof createRegistry>;

/** "hero_banner" -> "HeroBanner" */
export function componentNameForType(type: string): string {
  return type
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/** Drupal's default Twig classes: "hero_banner" -> "paragraph paragraph--type--hero-banner" */
export function classNamesForType(type: string): string {
  return `paragraph paragraph--type--${type.replace(/_/g, "-")}`;
}

/** "HeroBanner" or "hero-banner" -> "hero_banner" */
function typeForModuleKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/-/g, "_")
    .toLowerCase();
}

export function createRegistry(modules: Record<string, { default: ParagraphComponent }>) {
  const components = new Map<string, ParagraphComponent>();
  for (const [key, mod] of Object.entries(modules)) {
    const type = typeForModuleKey(key);
    if (components.has(type)) {
      throw new Error(`Duplicate component for paragraph type "${type}" (module "${key}")`);
    }
    components.set(type, mod.default);
  }
  return {
    lookup: (type: string): ParagraphComponent | undefined => components.get(type),
    types: (): string[] => [...components.keys()],
  };
}
