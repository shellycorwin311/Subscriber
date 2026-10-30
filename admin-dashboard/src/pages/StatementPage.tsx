import { FormEvent, useEffect, useState } from "react";
import * as api from "../api/client";import { formatDateUTC } from "../lib/dates";

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function StatementPage() {
  const [dealers, setDealers] = useState<api.Dealer[]>([]);
  const [papers, setPapers] = useState<api.Paper[]>([]);
  const [dealerId, setDealerId] = useState("");
  const [paperId, setPaperId] = useState("");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [statement, setStatement] = useState<api.Statement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.searchDealers(""), api.fetchPapers()]).then(([d, p]) => {
      setDealers(d);
      setPapers(p);
      if (d.length > 0) setDealerId(d[0].id);
      if (p.length > 0) setPaperId(p[0].id);
    });
  }, []);

  async function handleGenerate(e: FormEvent) {
    e.preventDefault();
    if (!dealerId || !paperId || !month) return;
    setLoading(true);
    setError(null);
    try {
      const s = await api.fetchStatement(dealerId, paperId, month);
      setStatement(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate statement");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Dealer Statement</h1>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <form
        onSubmit={handleGenerate}
        className="card"
        style={{ display: "flex", gap: 12, alignItems: "flex-end", maxWidth: 620, marginBottom: 24 }}
      >
        <div className="field" style={{ flex: 1 }}>
          <label>Dealer</label>
          <select value={dealerId} onChange={(e) => setDealerId(e.target.value)}>
            {dealers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Paper</label>
          <select value={paperId} onChange={(e) => setPaperId(e.target.value)}>
            {papers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Month</label>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Loading…" : "Generate"}
        </button>
      </form>

      {statement && <StatementView statement={statement} />}
    </div>
  );
}

function StatementView({ statement }: { statement: api.Statement }) {
  return (
    <div className="card" style={{ maxWidth: 700 }}>
      <h2 style={{ marginBottom: 0 }}>{statement.dealer.name}</h2>
      <p style={{ color: "var(--ink-soft)", marginTop: 4 }}>
        {statement.dealer.dealerNumber ? `Dealer #${statement.dealer.dealerNumber} — ` : ""}
        {statement.paper.name} — {statement.month}
      </p>

      {statement.weeks.length === 0 ? (
        <div className="empty-state">No activity for this month.</div>
      ) : (
        statement.weeks.map((week) => (
          <div key={week.weekEnding} style={{ marginBottom: 20 }}>
            <h4 style={{ marginBottom: 8 }}>
              Week Ending {formatDateUTC(week.weekEnding)}
            </h4>

            {week.charges.length > 0 && (
              <div style={{ fontSize: 14, marginBottom: 4 }}>
                {week.charges.map((c, i) => (
                  <span key={i} style={{ marginRight: 20 }}>
                    {statement.paper.name.split(" ")[0]} ({c.dayOfWeek}) {c.quantity} @ ${(c.priceCents / 100).toFixed(2)}
                  </span>
                ))}
              </div>
            )}

            {week.returns.length > 0 && (
              <div style={{ fontSize: 14, marginBottom: 4, color: "var(--status-canceled)" }}>
                {week.returns.map((r, i) => (
                  <span key={i} style={{ marginRight: 20 }}>
                    {statement.paper.name.split(" ")[0]} ({r.dayOfWeek}) -{r.quantity} @ ${(r.priceCents / 100).toFixed(2)}
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
        ))
      )}

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
  );
}