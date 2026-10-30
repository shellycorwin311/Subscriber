import { FormEvent, useState } from "react";
import * as api from "../api/client";import { formatDateUTC } from "../lib/dates";

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function BatchStatementsPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [batch, setBatch] = useState<api.BatchStatements | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"summary" | "full">("summary");

  async function handleGenerate(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await api.fetchBatchStatements(month);
      setBatch(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate statements");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>All Dealer Statements</h1>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <form
        onSubmit={handleGenerate}
        className="card"
        style={{ display: "flex", gap: 12, alignItems: "flex-end", maxWidth: 480, marginBottom: 24 }}
      >
        <div className="field">
          <label>Month</label>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Loading…" : "Generate all"}
        </button>
      </form>

      {batch && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button
              className={view === "summary" ? "btn btn-primary" : "btn btn-secondary"}
              onClick={() => setView("summary")}
            >
              Summary
            </button>
            <button
              className={view === "full" ? "btn btn-primary" : "btn btn-secondary"}
              onClick={() => setView("full")}
            >
              Full statements (print view)
            </button>
          </div>

          {batch.statements.length === 0 ? (
            <div className="empty-state">No dealer activity for this month.</div>
          ) : view === "summary" ? (
            <SummaryTable statements={batch.statements} />
          ) : (
            <FullView statements={batch.statements} />
          )}
        </>
      )}
    </div>
  );
}

function SummaryTable({ statements }: { statements: api.Statement[] }) {
  const totalCharges = statements.reduce((sum, s) => sum + s.totalChargesCents, 0);
  const totalReturns = statements.reduce((sum, s) => sum + s.totalReturnsCents, 0);
  const totalPayments = statements.reduce((sum, s) => sum + s.totalPaymentsCents, 0);
  const totalNet = statements.reduce((sum, s) => sum + s.netOwedCents, 0);

  return (
    <table>
      <thead>
        <tr>
          <th>Dealer</th>
          <th>Paper</th>
          <th>Charges</th>
          <th>Returns</th>
          <th>Payments</th>
          <th>Net Owed</th>
        </tr>
      </thead>
      <tbody>
        {statements.map((s, i) => (
          <tr key={i}>
            <td>
              {s.dealer.name}
              {s.dealer.dealerNumber ? ` (#${s.dealer.dealerNumber})` : ""}
            </td>
            <td>{s.paper.name}</td>
            <td className="tabular">{formatMoney(s.totalChargesCents)}</td>
            <td className="tabular">({formatMoney(s.totalReturnsCents)})</td>
            <td className="tabular">({formatMoney(s.totalPaymentsCents)})</td>
            <td className="tabular" style={{ fontWeight: 700 }}>
              {formatMoney(s.netOwedCents)}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr style={{ fontWeight: 700, borderTop: "2px solid var(--ink)" }}>
          <td colSpan={2}>Totals</td>
          <td className="tabular">{formatMoney(totalCharges)}</td>
          <td className="tabular">({formatMoney(totalReturns)})</td>
          <td className="tabular">({formatMoney(totalPayments)})</td>
          <td className="tabular">{formatMoney(totalNet)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function FullView({ statements }: { statements: api.Statement[] }) {
  return (
    <div>
      {statements.map((statement, idx) => (
        <div
          key={idx}
          className="card"
          style={{ maxWidth: 700, marginBottom: 24, pageBreakAfter: "always" }}
        >
          <h2 style={{ marginBottom: 0 }}>{statement.dealer.name}</h2>
          <p style={{ color: "var(--ink-soft)", marginTop: 4 }}>
            {statement.dealer.dealerNumber ? `Dealer #${statement.dealer.dealerNumber} — ` : ""}
            {statement.paper.name} — {statement.month}
          </p>

          {statement.weeks.map((week) => (
            <div key={week.weekEnding} style={{ marginBottom: 20 }}>
              <h4 style={{ marginBottom: 8 }}>
                Week Ending {formatDateUTC(week.weekEnding)}
              </h4>

              {week.charges.length > 0 && (
                <div style={{ fontSize: 14, marginBottom: 4 }}>
                  {week.charges.map((c, i) => (
                    <span key={i} style={{ marginRight: 20 }}>
                      {statement.paper.name.split(" ")[0]} ({c.dayOfWeek}) {c.quantity} @ $
                      {(c.priceCents / 100).toFixed(2)}
                    </span>
                  ))}
                </div>
              )}

              {week.returns.length > 0 && (
                <div style={{ fontSize: 14, marginBottom: 4, color: "var(--status-canceled)" }}>
                  {week.returns.map((r, i) => (
                    <span key={i} style={{ marginRight: 20 }}>
                      {statement.paper.name.split(" ")[0]} ({r.dayOfWeek}) -{r.quantity} @ $
                      {(r.priceCents / 100).toFixed(2)}
                    </span>
                  ))}
                </div>
              )}

              {week.payments.map((p, i) => (
                <div key={i} style={{ fontSize: 14 }}>
                  Payment {formatDateUTC(p.date)}
                  {p.referenceNumber ? ` ${p.referenceNumber}` : ""} ({formatMoney(p.amountCents)})
                </div>
              ))}
            </div>
          ))}

          <div style={{ borderTop: "2px solid var(--ink)", paddingTop: 12, marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span>Total Charges:</span>
              <span className="tabular">{formatMoney(statement.totalChargesCents)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span>Total Returns:</span>
              <span className="tabular">({formatMoney(statement.totalReturnsCents)})</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span>Total Payments:</span>
              <span className="tabular">({formatMoney(statement.totalPaymentsCents)})</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 16,
                fontWeight: 700,
                marginTop: 8,
              }}
            >
              <span>Net Owed:</span>
              <span className="tabular">{formatMoney(statement.netOwedCents)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}