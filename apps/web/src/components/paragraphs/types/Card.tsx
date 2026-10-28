import type { ReactNode } from "react";
import { classNamesForType, type ParagraphBlock } from "../registry";

export interface CardData {
  title?: string;
  text?: string;
  image?: { url: string; alt?: string };
  link?: { url: string; title?: string };
}

export function CardItem({ card }: { card: CardData }): ReactNode {
  return (
    <article className="card pcard">
      {card.image?.url ? (
        <div className="pcard-image">
          {/* Plain img: the Drupal media host is not configured for next/image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={card.image.url} alt={card.image.alt ?? ""} />
        </div>
      ) : null}
      {card.title ? <h2>{card.title}</h2> : null}
      {card.text ? <p className="pcard-text">{card.text}</p> : null}
      {card.link?.url ? (
        <a className="pcard-link" href={card.link.url}>
          {card.link.title || "Read more"}
        </a>
      ) : null}
    </article>
  );
}

export default function Card({ block }: { block: ParagraphBlock }): ReactNode {
  return (
    <div className={classNamesForType("card")}>
      <CardItem card={block as CardData} />
    </div>
  );
}
