import { formatPrice, type MenuItem } from "@/lib/menu";

type MenuItemCardProps = { item: MenuItem; onAdd: (itemId: string) => void };

export function MenuItemCard({ item, onAdd }: MenuItemCardProps) {
  return (
    <li className="card stack stack-2" data-testid="menu-item">
      {/* Decorative: the dish name is the text alternative. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="menu-image" data-testid="item-image" src={item.imageSrc} alt="" />
      <h2 className="text-base font-semibold" data-testid="item-name">
        {item.name}
      </h2>
      <p className="menu-price" data-testid="item-price">
        {formatPrice(item.pricePaise)}
      </p>
      <button
        type="button"
        className="btn btn-primary"
        data-testid="add-to-cart"
        aria-label={`Add ${item.name} to cart`}
        onClick={() => onAdd(item.id)}
      >
        Add to cart
      </button>
    </li>
  );
}
