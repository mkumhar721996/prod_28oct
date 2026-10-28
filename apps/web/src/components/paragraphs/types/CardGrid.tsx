import type { ReactNode } from "react";
import { classNamesForType, type ParagraphBlock } from "../registry";
import { CardItem, type CardData } from "./Card";

export default function CardGrid({ block }: { block: ParagraphBlock }): ReactNode {
  const cards = Array.isArray(block.cards) ? (block.cards as CardData[]) : [];
  return (
    <div className={classNamesForType("card_grid")}>
      <div className="card-grid">
        {cards.map((card, index) => (
          <CardItem card={card} key={index} />
        ))}
      </div>
    </div>
  );
}
