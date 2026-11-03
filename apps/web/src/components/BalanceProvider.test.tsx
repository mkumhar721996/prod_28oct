import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BalanceProvider, nextBalance, useBalance } from "./BalanceProvider";

function Show() {
  const { balance } = useBalance();
  return <span>{String(balance)}</span>;
}

describe("BalanceProvider", () => {
  it("gives consumers the initial balance", () => {
    const html = renderToStaticMarkup(
      <BalanceProvider initial={1000}>
        <Show />
      </BalanceProvider>,
    );
    expect(html).toContain("1000");
  });

  it("gives consumers null when the balance could not load", () => {
    const html = renderToStaticMarkup(
      <BalanceProvider initial={null}>
        <Show />
      </BalanceProvider>,
    );
    expect(html).toContain("null");
  });

  it("a published value replaces a null state", () => {
    expect(nextBalance(null, 700)).toBe(700);
    expect(nextBalance(1000, 900)).toBe(900);
  });
});
