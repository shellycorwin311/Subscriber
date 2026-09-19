import { useEffect, useState } from "react";
import * as api from "../api/client";

export function ReportsPage() {
  const [circulation, setCirculation] = useState<api.CirculationRow[]>([]);
  const [revenue, setRevenue] = useState<{ totalRevenue: number; paymentCount: number } | null>(
    null
  );
  const [churn, setChurn] = useState<{ canceledCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.fetchCirculationReport(),
      api.fetchRevenueReport(),
      api.fetchChurnReport(),
    ])
      .then(([circ, rev, ch]) => {
        setCirculation(circ);
        setRevenue(rev);
        setChurn(ch);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load reports"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: "var(--ink-soft)" }}>Loading…</p>;
  if (error) return <div className="error-banner">{error}</div>;

  const totalActive = circulation.reduce((sum, row) => sum + row.total, 0);

  return (
    <div>
      <div className="page-header">
        <h1>Reports</h1>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="stat-value tabular">{totalActive.toLocaleString()}</div>
          <div className="stat-label">Active subscriptions, all papers</div>
        </div>
        <div className="stat">
          <div className="stat-value tabular">
            ${revenue ? revenue.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}
          </div>
          <div className="stat-label">Revenue, all time</div>
        </div>
        <div className="stat">
          <div className="stat-value tabular">{churn?.canceledCount ?? "—"}</div>
          <div className="stat-label">Cancellations, all time</div>
        </div>
      </div>

      <h2>Circulation by paper</h2>
      <table>
        <thead>
          <tr>
            <th>Paper</th>
            <th>Print</th>
            <th>Digital</th>
            <th>Print + Digital</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {circulation.map((row) => (
            <tr key={row.paper}>
              <td>{row.paper}</td>
              <td className="tabular">{row.print}</td>
              <td className="tabular">{row.digital}</td>
              <td className="tabular">{row.printAndDigital}</td>
              <td className="tabular">
                <strong>{row.total}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
