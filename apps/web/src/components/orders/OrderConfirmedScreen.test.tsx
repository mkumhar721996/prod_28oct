import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { MENU_HREF } from "@/lib/shell";
import { OrderConfirmedScreen } from "./OrderConfirmedScreen";

type Props = { children?: ReactNode; onClick?: () => void };

/** Walks the rendered element tree for buttons (no DOM test library in this app). */
function buttons(node: ReactNode, found: ReactElement<Props>[] = []): ReactElement<Props>[] {
  if (Array.isArray(node)) node.forEach((n) => buttons(n, found));
  else if (isValidElement<Props>(node)) {
    if (node.type === "button") found.push(node);
    buttons(node.props.children, found);
  }
  return found;
}
const press = (label: string) =>
  buttons(OrderConfirmedScreen({ orderNumber: "AB12CD" }))
    .find((b) => b.props.children === label)
    ?.props.onClick?.();

describe("OrderConfirmedScreen", () => {
  beforeEach(() => push.mockClear());

  it("shows the heading and the order number", () => {
    const html = renderToStaticMarkup(<OrderConfirmedScreen orderNumber="AB12CD" />);
    expect(html).toMatch(/<h1[^>]*>Thanks for your order<\/h1>/);
    expect(html).toMatch(/<strong[^>]*data-testid="order-number"[^>]*>AB12CD<\/strong>/);
    expect(html).toContain('role="status"');
  });

  it("Back to Menu goes to the Menu", () => {
    press("Back to Menu");
    expect(push).toHaveBeenCalledWith(MENU_HREF);
    expect(renderToStaticMarkup(<OrderConfirmedScreen orderNumber="AB12CD" />)).not.toMatch(/continue shopping/i);
  });

  it("View orders goes to Orders and is the only primary button", () => {
    press("View orders");
    expect(push).toHaveBeenCalledWith("/orders");
    const html = renderToStaticMarkup(<OrderConfirmedScreen orderNumber="AB12CD" />);
    expect(html.match(/btn-primary/g)).toHaveLength(1);
  });
});
