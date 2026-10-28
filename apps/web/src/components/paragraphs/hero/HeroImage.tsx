import type { HeroFields } from "./heroFields";

export function HeroImage({ image }: { image: HeroFields["image"] }) {
  if (!image) return null;
  return (
    <div className="hero-img">
      {/* Plain img: next.config has no image host configured. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.src} alt={image.alt} />
    </div>
  );
}
