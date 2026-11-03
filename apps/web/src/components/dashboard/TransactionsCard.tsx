import { formatRupees, type CardState, type Transaction } from "@/lib/stocks";
import { DashboardCard } from "./DashboardCard";

export function TransactionsCard({ state }: { state: CardState<Transaction[]> }) {
  return (
    <DashboardCard label="transactions" title="Recent transactions" headingId="h-tx" state={state}>
      {state.status === "ready" && (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Stock</th>
                <th>Type</th>
                <th className="num">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {state.data.map((t) => (
                <tr key={t.id}>
                  <td>{t.date}</td>
                  <td>{t.stock}</td>
                  <td>{t.type}</td>
                  <td className="num">{formatRupees(t.amount)}</td>
                  <td>
                    <span className={`badge ${t.status === "Completed" ? "badge-success" : "badge-warning"}`}>
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardCard>
  );
}
