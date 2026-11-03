import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QuantityStepper } from "./QuantityStepper";

const render = (quantity: number) =>
  renderToStaticMarkup(
    <QuantityStepper name="Margherita" quantity={quantity} onIncrease={() => {}} onDecrease={() => {}} />,
  );

describe("QuantityStepper", () => {
  it("labels the plus button (AC3)", () => {
    expect(render(2)).toContain('aria-label="Increase quantity of Margherita"');
  });

  it("decreases above 1 (AC4)", () => {
    const html = render(2);
    expect(html).toContain('aria-label="Decrease quantity of Margherita"');
    expect(html).toContain('aria-label="Quantity 2"');
  });

  it("becomes a remove bin at 1 (AC14)", () => {
    const html = render(1);
    expect(html).toContain('aria-label="Remove Margherita"');
    expect(html).not.toContain("Decrease quantity");
  });
});
