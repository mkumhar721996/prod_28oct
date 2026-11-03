import type { PerformanceSeries } from "@/lib/stocks";

/** Portfolio (solid) against NIFTY 50 (dashed) for one period; drawn in the prototype's 544 x 220 viewBox. */
export function PerformanceChart({ series }: { series: PerformanceSeries }) {
  return (
    <svg
      className="chart"
      viewBox="0 0 544 220"
      role="img"
      aria-label="Line chart of portfolio return against NIFTY 50 for the selected period, x axis date, y axis return in percent"
    >
      {series.gridLines.map((line) => (
        <line key={line.y} className={line.axis ? "ax" : "grid-l"} x1="48" x2="528" y1={line.y} y2={line.y} />
      ))}
      {series.yTicks.map((tick) => (
        <text key={tick.label} className="txt" x="40" y={tick.y} textAnchor="end">
          {tick.label}
        </text>
      ))}
      {series.xTicks.map((tick) => (
        <text key={tick.label} className="txt" x={tick.x} y="208" textAnchor="middle">
          {tick.label}
        </text>
      ))}
      <polyline className="l-bench" points={series.benchmarkPoints} />
      <polyline className="l-port" points={series.portfolioPoints} />
      <circle className="d-port" cx="528" cy={series.portfolioEnd} r="4" />
      <circle className="d-bench" cx="528" cy={series.benchmarkEnd} r="3" />
      <text className="txt t-port" x="520" y={series.portfolioLabel.y} textAnchor="end">
        {series.portfolioLabel.text}
      </text>
      <text className="txt t-bench" x="520" y={series.benchmarkLabel.y} textAnchor="end">
        {series.benchmarkLabel.text}
      </text>
    </svg>
  );
}
