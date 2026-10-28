import * as types from "./types";
import { createRegistry, type ParagraphComponent } from "./registry";

const modules = Object.fromEntries(
  Object.entries(types as Record<string, ParagraphComponent>).map(([name, component]) => [
    name,
    { default: component },
  ]),
);

export const defaultRegistry = createRegistry(modules);
