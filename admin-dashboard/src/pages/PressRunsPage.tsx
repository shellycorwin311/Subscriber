import { FormEvent, useEffect, useState } from "react";
import * as api from "../api/client";import { formatDateUTC } from "../lib/dates";

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function PressRunsPage() {
  const [papers, setPapers] = useState<api.Paper[]>([]);
  const [selectedPaperId, setSelectedPaperId] = useState("");
  const [pressRuns, setPressRuns] = useState<api.PressRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [pressOrder, setPressOrder] = useState<api.PressOrder | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);

  useEffect(() => {
    api
      .fetchPapers()
      .then((p) => {
        setPapers(p);
        if (p.length > 0) setSelectedPaperId(p[0].id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load papers"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedPaperId) load(selectedPaperId);
  }, [selectedPaperId]);

  async function load(paperId: string) {
    try {
      const runs = await api.fetchPressRuns(paperId);
      setPressRuns(runs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load press runs");
    }
  }

  function refresh() {
    if (selectedPaperId) load(selectedPaperId);
  }

  async function handleViewPressOrder(pressRunId: string) {
    if (openOrderId === pressRunId) {
      setOpenOrderId(null);
      setPressOrder(null);
      return;
    }
    setOpenOrderId(pressRunId);
    setLoadingOrder(true);
    setPressOrder(null);
    try {
      const order = await api.fetchPressOrder(pressRunId);
      setPressOrder(order);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load press order");
    } finally {
      setLoadingOrder(false);
    }
  }

  if (loading) return <p style={{ color: "var(--ink-soft)" }}>Loading…</p>;

  return (
    <div>
      <div className="page-header">
        <h1>Press Runs</h1>
      </div>

      <p style={{ color: "var(--ink-soft)", maxWidth: 560, marginBottom: 24 }}>
        A press run must exist for a paper on a given date before dealer deliveries can be recorded
        for that date.
      </p>

      {error && <div className="error-banner">{error}</div>}

      <div className="field" style={{ maxWidth: 300, marginBottom: 24 }}>
        <label>Paper</label>
        <select value={selectedPaperId} onChange={(e) => setSelectedPaperId(e.target.value)}>
          {papers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <NewPressRunForm paperId={selectedPaperId} onCreated={refresh} onError={setError} />

      {pressRuns.length === 0 ? (
        <div className="empty-state">No press runs for this paper yet.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Bundle size</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pressRuns.map((run) => (
              <>
                <tr key={run.id}>
                  <td className="tabular">{formatDateUTC(run.runDate)}</td>
                  <td className="tabular">{run.bundleSize}</td>
                  <td>
                    <button className="btn btn-secondary" onClick={() => handleViewPressOrder(run.id)}>
                      {openOrderId === run.id ? "Hide press order" : "View press order"}
                    </button>
                  </td>
                </tr>
                {openOrderId === run.id && (
                  <tr>
                    <td colSpan={3}>
                      {loadingOrder ? (
                        <p style={{ color: "var(--ink-soft)" }}>Loading…</p>
                      ) : pressOrder ? (
                        <PressOrderView order={pressOrder} />
                      ) : null}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PressOrderView({ order }: { order: api.PressOrder }) {
  return (
    <div className="card" style={{ maxWidth: 480, marginTop: 8, marginBottom: 8 }}>
      <h4 style={{ marginTop: 0 }}>
        Press Order — {order.paper.name} — {formatDateUTC(order.runDate)}
      </h4>
      <table>
        <tbody>
          <tr>
            <td>Dealer</td>
            <td className="tabular">{order.dealer}</td>
          </tr>
          <tr>
            <td>Mail</td>
            <td className="tabular">{order.mail}</td>
          </tr>
          <tr>
            <td>Service Copies</td>
            <td className="tabular">{order.serviceCopies}</td>
          </tr>
          <tr>
            <td>Vending Machine</td>
            <td className="tabular">{order.vending}</td>
          </tr>
          <tr style={{ borderTop: "2px solid var(--ink)", fontWeight: 700 }}>
            <td>Subtotal Print</td>
            <td className="tabular">{order.printSubtotal}</td>
          </tr>
          <tr>
            <td style={{ color: "var(--ink-soft)" }}>Internet Subscribers (excluded)</td>
            <td className="tabular" style={{ color: "var(--ink-soft)" }}>
              {order.internetSubscribers}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function NewPressRunForm({
  paperId,
  onCreated,
  onError,
}: {
  paperId: string;
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [runDate, setRunDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [bundleSize, setBundleSize] = useState("25");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!paperId) return;
    const size = parseInt(bundleSize, 10);
    if (!Number.isFinite(size) || size <= 0) {
      onError("Enter a valid bundle size.");
      return;
    }
    setSubmitting(true);
    try {
      await api.createPressRun({ paperId, runDate, bundleSize: size });
      onCreated();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't create press run");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="card"
      style={{ display: "flex", gap: 12, alignItems: "flex-end", maxWidth: 480, marginBottom: 24 }}
      onSubmit={handleSubmit}
    >
      <div className="field">
        <label>Run date</label>
        <input type="date" value={runDate} onChange={(e) => setRunDate(e.target.value)} />
      </div>
      <div className="field">
        <label>Bundle size</label>
        <input
          type="number"
          min={1}
          required
          value={bundleSize}
          onChange={(e) => setBundleSize(e.target.value)}
          style={{ width: 100 }}
        />
      </div>
      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? "Creating…" : "Create press run"}
      </button>
    </form>
  );
}