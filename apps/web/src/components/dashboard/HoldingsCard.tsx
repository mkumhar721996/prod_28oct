import {
  formatPercent,
  formatRupees,
  formatSigned,
  formatSignedPercent,
  type CardState,
  type Holding,
} from "@/lib/stocks";
import { ComingSoonButton } from "./ComingSoon";
import { DashboardCard } from "./DashboardCard";
import { Trend } from "./Trend";

function RowActions({ name }: { name: string }) {
  return (
    <div className="cluster">
      <ComingSoonButton label="Buy" subject={name} compact />
      <ComingSoonButton label="Sell" subject={name} variant="ghost" compact />
    </div>
  );
}

export function HoldingsCard({ state }: { state: CardState<Holding[]> }) {
  return (
    <DashboardCard label="holdings" title="Holdings" headingId="h-hold" state={state}>
      {state.status === "ready" && (
        <>
          <div className="scroll holdings-table">
            <table>
              <thead>
                <tr>
                  <th>Stock</th>
                  <th className="num">Quantity</th>
                  <th className="num">Avg cost</th>
                  <th className="num">Value</th>
                  <th className="num">P&amp;L</th>
                  <th className="num">Change</th>
                  <th>
                    Actions <span className="soon">Coming soon</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.data.map((h) => (
                  <tr key={h.id}>
                    <td>{h.name}</td>
                    <td className="num">{h.quantity}</td>
                    <td className="num">{formatRupees(h.avgCost, 2)}</td>
                    <td className="num">{formatRupees(h.value)}</td>
                    <td className="num">
                      <Trend up={h.pnl >= 0}>{formatSigned(h.pnl)}</Trend>
                    </td>
                    <td className="num">
                      <Trend up={h.changePercent >= 0}>{formatPercent(h.changePercent)}</Trend>
                    </td>
                    <td>
                      <RowActions name={h.name} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="rows holdings-list">
            {state.data.map((h) => (
              <li key={h.id}>
                <span>
                  {h.name} · {h.quantity} {h.unit} · {formatSignedPercent(h.returnPercent)}
                </span>
                <span className={`badge ${h.returnPercent >= 0 ? "badge-success" : "badge-danger"}`}>
                  {h.returnPercent >= 0 ? "▲ Gain" : "▼ Loss"}
                </span>
                <span className="cluster">
                  <ComingSoonButton label="Buy" subject={h.name} compact />
                  <ComingSoonButton label="Sell" subject={h.name} variant="ghost" compact />
                  <span className="soon text-muted">Coming soon</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </DashboardCard>
  );
}
