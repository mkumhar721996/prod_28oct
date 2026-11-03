import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_PERIOD, SAMPLE_PORTFOLIO, type Period } from "@/lib/stocks";
import { PerformanceCard } from "./PerformanceCard";

const at = (p?: Period) =>
  renderToStaticMarkup(
    <PerformanceCard
      state={{ status: "ready", data: SAMPLE_PORTFOLIO.performance }}
      onRetry={() => {}}
      initialPeriod={p}
    />,
  );

describe("PerformanceCard", () => {
  it("starts on the 1M tab showing the 1M period (AC18)", () => {
    expect(DEFAULT_PERIOD).toBe("1M");
    const html = at();
    expect(html).toMatch(/<button[^>]*role="tab"[^>]*aria-selected="true"[^>]*>1M</);
    expect(html).toContain("Portfolio +3.4%");
    expect(html).toContain("Showing the last month, 1 Oct to 29 Oct.");
  });

  it("shows only the selected period on the chart (AC6)", () => {
    expect(at("6M")).toContain("Portfolio +9.3%");
    expect(at("6M")).not.toContain("Portfolio +3.4%");
    expect(at("6M")).toMatch(/<button[^>]*role="tab"[^>]*aria-selected="true"[^>]*>6M</);
    expect(at("1Y")).toContain("NIFTY 50 +10.9%");
    expect(at("1Y")).not.toContain("Portfolio +9.3%");
  });

  it("gives the tabs a roving tab stop", () => {
    expect(at("6M")).toMatch(/<button[^>]*role="tab"[^>]*tabindex="-1"[^>]*>1M</);
  });

  it("explains the benchmark and labels the legend", () => {
    const html = at();
    expect(html).toContain("Benchmark (NIFTY 50)");
    expect(html).toContain('role="tooltip"');
  });
});
