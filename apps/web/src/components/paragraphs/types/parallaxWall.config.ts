/**
 * Parallax wall layer parity values — the single place to correct them.
 * `speed` is the layer's movement relative to the scroll of the wall's own
 * container (0 = moves with the content, 0.5 = half-rate); `direction` is 1
 * for slower than the content, -1 for faster.
 * TODO(parity): placeholders — copy the production per-layer rate and direction.
 */
export interface ParallaxLayer {
  speed: number;
  direction: 1 | -1;
}

export const PARALLAX_LAYERS: Record<"background" | "foreground", ParallaxLayer> = {
  background: { speed: 0.5, direction: 1 },
  foreground: { speed: 0, direction: 1 },
};
