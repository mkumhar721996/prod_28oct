import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CardState } from "@/lib/stocks";
import { DashboardCard } from "./DashboardCard";

const render = (state: CardState<unknown>, label = "market overview") =>
  renderToStaticMarkup(
    <DashboardCard label={label} title="Market overview" headingId="h-market" state={state} onRetry={() => {}}>
      <p>figures</p>
    </DashboardCard>,
  );

describe("DashboardCard", () => {
  it("shows a loading placeholder instead of the figures (AC23)", () => {
    const html = render({ status: "loading" });
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Loading market overview"');
    expect(html).toContain('role="status"');
    expect(html).toContain('class="skeleton');
    expect(html).not.toContain("figures");
  });

  it("replaces the placeholder with the figures when ready (AC24)", () => {
    const html = render({ status: "ready", data: 1 });
    expect(html).toContain("<p>figures</p>");
    expect(html).not.toContain("skeleton");
    expect(html).not.toContain('role="alert"');
  });

  it("shows a failure message and a retry prompt (AC19, AC20)", () => {
    const html = render({ status: "error", attempts: 1 });
    expect(html).toContain('role="alert"');
    expect(html).toContain("We couldn&#x27;t load the market overview.");
    expect(html).toContain(">Try again<");
    expect(html).not.toContain("figures");
  });

  it("keeps the failure and the prompt after a failed retry (AC21)", () => {
    const html = render({ status: "error", attempts: 2 });
    expect(html).toContain('role="alert"');
    expect(html).toContain("Still couldn&#x27;t load the market overview.");
    expect(html).toContain(">Try again<");
  });

  it("disables the prompt while a retry is running", () => {
    const html = render({ status: "error", attempts: 1, retrying: true });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*Trying again/);
  });
});
