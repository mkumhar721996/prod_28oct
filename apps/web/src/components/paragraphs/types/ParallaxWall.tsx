import type { CSSProperties } from "react";
import { classNamesForType, type ParagraphBlock } from "../registry";
import { PARALLAX_LAYERS, type ParallaxLayer } from "./parallaxWall.config";

const layerStyle = ({ speed, direction }: ParallaxLayer) =>
  ({ "--parallax-speed": speed, "--parallax-dir": direction }) as CSSProperties;

export default function ParallaxWall({ block }: { block: ParagraphBlock }) {
  const text = typeof block.field_text === "string" ? block.field_text : "";
  const image =
    block.field_image && typeof block.field_image === "object"
      ? (block.field_image as { url?: unknown; alt?: unknown })
      : null;
  const src = typeof image?.url === "string" && image.url ? image.url : null;
  const alt = typeof image?.alt === "string" ? image.alt : "";

  return (
    <div className={`${classNamesForType(block.type)} parallax-wall`}>
      <div className="parallax-wall__viewport">
        <div className="parallax-wall__layer parallax-wall__layer--background" style={layerStyle(PARALLAX_LAYERS.background)}>
          {src ? <img className="parallax-wall__image" src={src} alt={alt} /> : null}
        </div>
        <div className="parallax-wall__layer parallax-wall__layer--foreground" style={layerStyle(PARALLAX_LAYERS.foreground)}>
          <p className="parallax-wall__text">{text}</p>
        </div>
        <div className="parallax-wall__scroll-space" />
      </div>
    </div>
  );
}
