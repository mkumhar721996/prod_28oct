import { HOME_HREF } from "@/lib/shell";
import { Icon } from "../orders/Icon";

export function NoAlerts() {
  return (
    <div className="empty-state">
      <Icon name="bell" />
      <h2>No alerts yet</h2>
      <p>When you receive money, you&apos;ll see it here.</p>
      <a className="btn btn-primary" href={HOME_HREF}>
        Back to home
      </a>
    </div>
  );
}
