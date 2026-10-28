import { Icon } from "./Icon";

export const MENU_HREF = "/menu";

export function NoOrders() {
  return (
    <div className="empty-state">
      <Icon name="bag" />
      <h2>You have no orders yet</h2>
      <p>When you place an order, you can follow it here.</p>
      <a className="btn btn-primary" href={MENU_HREF}>
        Browse the menu
      </a>
    </div>
  );
}
