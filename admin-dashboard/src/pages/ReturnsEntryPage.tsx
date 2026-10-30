import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import * as api from "../api/client";

type Tab = "single" | "route";

export function ReturnsEntryPage() {
  const [papers, setPapers] = useState<api.Paper[]>([]);
  const [tab, setTab] = useState<Tab>("single");

  useEffect(() => {
    api.fetchPapers().then((p: api.Paper[]) => setPapers(p));
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1>Returns Entry</h1>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          type="button"
          className={tab === "single" ? "btn btn-primary" : "btn"}
          onClick={() => setTab("single")}
        >
          Single dealer
        </button>
        <button
          type="button"
          className={tab === "route" ? "btn btn-primary" : "btn"}
          onClick={() => setTab("route")}
        >
          Route list
        </button>
      </div>

      {papers.length > 0 && tab === "single" && <SingleDealerTab papers={papers} />}
      {papers.length > 0 && tab === "route" && <RouteListTab papers={papers} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Single dealer tab                                                   */
/* ------------------------------------------------------------------ */

interface RecentEntry {
  dealerName: string;
  date: string;
  delivered: number;
  sold: number;
  returned: number;
}

function SingleDealerTab({ papers }: { papers: api.Paper[] }) {
  const [paperId, setPaperId] = useState(papers[0].id);
  const [dealerNumber, setDealerNumber] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dealer, setDealer] = useState<api.Dealer | null>(null);
  const [delivery, setDelivery] = useState<api.RackDelivery | null>(null);
  const [returned, setReturned] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);

  // Sold is always Delivered minus Returned - staff only type Returned.
  const delivered = delivery?.quantityDelivered ?? 0;
  const returnedQty = returned === "" ? NaN : parseInt(returned, 10);
  const returnedValid = Number.isFinite(returnedQty) && returnedQty >= 0 && returnedQty <= delivered;
  const soldQty = returnedValid ? delivered - returnedQty : null;

  async function handleLookup(e: FormEvent) {
    e.preventDefault();
    if (!dealerNumber || !paperId || !date) return;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setDealer(null);
    setDelivery(null);
    try {
      const results = await api.searchDealers(dealerNumber);
      const match =
        results.find((d: api.Dealer) => d.dealerNumber?.toLowerCase() === dealerNumber.trim().toLowerCase()) ??
        results[0];
      if (!match) {
        setError(`No dealer found matching "${dealerNumber}".`);
        return;
      }
      setDealer(match);

      const found = await api.fetchDeliveryByDate(match.id, paperId, date);
      setDelivery(found);
      setReturned(found.quantityReturned != null ? String(found.quantityReturned) : "");
    } catch (err) {
      if (err instanceof api.ApiError && err.status === 404) {
        setError("Dealer found, but no delivery exists for that paper/date.");
      } else {
        setError(err instanceof Error ? err.message : "Lookup failed");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!delivery || !dealer) return;
    if (!returnedValid || soldQty === null) {
      setError(`Returned must be a number from 0 to ${delivered}.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.reconcileDelivery(delivery.id, {
        quantitySold: soldQty,
        quantityReturned: returnedQty,
      });
      setSuccessMsg(`Saved: ${dealer.name} — ${soldQty} sold, ${returnedQty} returned.`);
      const newEntry: RecentEntry = {
        dealerName: dealer.name,
        date,
        delivered,
        sold: soldQty,
        returned: returnedQty,
      };
      setRecentEntries((prev: RecentEntry[]) => [newEntry, ...prev]);
      setDealer(null);
      setDelivery(null);
      setDealerNumber("");
      setReturned("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save reconciliation");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <p style={{ color: "var(--ink-soft)", maxWidth: 560, marginBottom: 24 }}>
        Look up a dealer by number and enter their returns for the date. Sold is calculated
        automatically (delivered minus returned) and saved directly to their account.
      </p>

      {error && <div className="error-banner">{error}</div>}
      {successMsg && (
        <div className="card" style={{ background: "#e6f4ea", marginBottom: 16 }}>
          {successMsg}
        </div>
      )}

      <form
        onSubmit={handleLookup}
        className="card"
        style={{ display: "flex", gap: 12, alignItems: "flex-end", maxWidth: 620, marginBottom: 24 }}
      >
        <div className="field" style={{ flex: 1 }}>
          <label>Dealer #</label>
          <input
            required
            placeholder="e.g. DL529963"
            value={dealerNumber}
            onChange={(e) => setDealerNumber(e.target.value)}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Paper</label>
          <select value={paperId} onChange={(e) => setPaperId(e.target.value)}>
            {papers.map((p: api.Paper) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Looking up…" : "Look up"}
        </button>
      </form>

      {dealer && delivery && (
        <form className="card" style={{ maxWidth: 480, marginBottom: 24 }} onSubmit={handleSubmit}>
          <h3>
            {dealer.name} {dealer.dealerNumber ? `(#${dealer.dealerNumber})` : ""}
          </h3>
          <p style={{ fontSize: 14, color: "var(--ink-soft)" }}>
            {delivery.paper.name} — delivered {delivered}
            {delivery.status === "RECONCILED" ? " — already entered, saving will update it" : ""}
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Returned</label>
              <input
                type="number"
                min={0}
                max={delivered}
                required
                autoFocus
                value={returned}
                onChange={(e) => setReturned(e.target.value)}
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Sold (calculated)</label>
              <input
                readOnly
                tabIndex={-1}
                value={soldQty === null ? "" : soldQty}
                style={{ background: "#f0eee8", fontWeight: 600 }}
              />
            </div>
          </div>
          {returned !== "" && !returnedValid && (
            <p style={{ color: "#B4453D", fontSize: 13 }}>
              Returned can't be more than the {delivered} delivered.
            </p>
          )}
          <button className="btn btn-primary" type="submit" disabled={submitting || !returnedValid}>
            {submitting ? "Saving…" : "Save & next"}
          </button>
        </form>
      )}

      {recentEntries.length > 0 && (
        <>
          <h2 style={{ marginTop: 32 }}>Entered this session</h2>
          <table>
            <thead>
              <tr>
                <th>Dealer</th>
                <th>Date</th>
                <th>Delivered</th>
                <th>Returned</th>
                <th>Sold</th>
              </tr>
            </thead>
            <tbody>
              {recentEntries.map((entry: RecentEntry, i: number) => (
                <tr key={i}>
                  <td>{entry.dealerName}</td>
                  <td className="tabular">{entry.date}</td>
                  <td className="tabular">{entry.delivered}</td>
                  <td className="tabular">{entry.returned}</td>
                  <td className="tabular">{entry.sold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Route list tab                                                      */
/* ------------------------------------------------------------------ */

interface RouteRow {
  stopId: string;
  sequence: number;
  dealer: api.Dealer;
  delivery: api.RackDelivery | null;
  returned: string;
  saved: boolean;
  rowError: string | null;
}

function rowReturned(row: RouteRow): number {
  return row.returned === "" ? NaN : parseInt(row.returned, 10);
}

function rowIsValid(row: RouteRow): boolean {
  if (!row.delivery) return true;
  if (row.returned === "") return true; // blank = skip for now
  const r = rowReturned(row);
  return Number.isFinite(r) && r >= 0 && r <= row.delivery.quantityDelivered;
}

function RouteListTab({ papers }: { papers: api.Paper[] }) {
  const [paperId, setPaperId] = useState(papers[0].id);
  const [routes, setRoutes] = useState<api.RackRoute[]>([]);
  const [routeId, setRouteId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<RouteRow[]>([]);
  const [loadedLabel, setLoadedLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load the routes for the chosen paper.
  useEffect(() => {
    setRoutes([]);
    setRouteId("");
    setRows([]);
    setLoadedLabel(null);
    api
      .fetchRackRoutes(paperId)
      .then((r: api.RackRoute[]) => {
        setRoutes(r);
        if (r.length > 0) setRouteId(r[0].id);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Couldn't load routes"));
  }, [paperId]);

  async function handleLoad(e: FormEvent) {
    e.preventDefault();
    const route = routes.find((r: api.RackRoute) => r.id === routeId);
    if (!route) return;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setRows([]);
    try {
      const stops = [...route.stops].sort(
        (a: api.RackRouteStop, b: api.RackRouteStop) => a.sequence - b.sequence
      );
      const loaded = await Promise.all(
        stops.map(async (stop: api.RackRouteStop): Promise<RouteRow> => {
          let delivery: api.RackDelivery | null = null;
          let rowError: string | null = null;
          try {
              delivery = await api.fetchDeliveryByDate(stop.dealer?.id ?? stop.dealerId, paperId, date);
          } catch (err) {
            if (!(err instanceof api.ApiError && err.status === 404)) {
              rowError = err instanceof Error ? err.message : "Lookup failed";
            }
          }
          return {
            stopId: stop.id,
            sequence: stop.sequence,
            dealer: stop.dealer,
            delivery,
            returned:
              delivery && delivery.quantityReturned != null ? String(delivery.quantityReturned) : "",
            saved: false,
            rowError,
          };
        })
      );
      setRows(loaded);
      setLoadedLabel(`${route.name} — ${date}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the route");
    } finally {
      setLoading(false);
    }
  }

  function updateReturned(index: number, value: string) {
    setRows((prev: RouteRow[]) =>
      prev.map((row: RouteRow, i: number) =>
        i === index ? { ...row, returned: value, saved: false, rowError: null } : row
      )
    );
  }

  // Enter jumps to the next stop's Returned box, like working down the driver sheet.
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const next = document.querySelector<HTMLInputElement>(`[data-ret-index="${index + 1}"]`);
    if (next) next.focus();
  }

  async function handleSaveAll() {
    const invalid = rows.filter((row: RouteRow) => !rowIsValid(row));
    if (invalid.length > 0) {
      setError(
        `Fix the highlighted row${invalid.length > 1 ? "s" : ""} first — returned can't be more than delivered.`
      );
      return;
    }
    const toSave = rows
      .map((row: RouteRow, i: number) => ({ row, i }))
      .filter(({ row }) => {
        if (!row.delivery || row.returned === "" || row.saved) return false;
        const unchanged =
          row.delivery.status === "RECONCILED" &&
          String(row.delivery.quantityReturned) === row.returned;
        return !unchanged;
      });

    if (toSave.length === 0) {
      setError("Nothing new to save — enter returns for at least one stop.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    let savedCount = 0;
    let failedCount = 0;
    const updated = [...rows];

    for (const { row, i } of toSave) {
      const returnedQty = rowReturned(row);
      const soldQty = row.delivery!.quantityDelivered - returnedQty;
      try {
        const result = await api.reconcileDelivery(row.delivery!.id, {
          quantitySold: soldQty,
          quantityReturned: returnedQty,
        });
        updated[i] = { ...row, delivery: { ...row.delivery!, ...result }, saved: true, rowError: null };
        savedCount++;
      } catch (err) {
        updated[i] = { ...row, rowError: err instanceof Error ? err.message : "Save failed" };
        failedCount++;
      }
    }

    setRows(updated);
    setSaving(false);
    if (failedCount === 0) {
      setSuccessMsg(`Saved returns for ${savedCount} stop${savedCount === 1 ? "" : "s"}.`);
    } else {
      setError(`Saved ${savedCount}, but ${failedCount} didn't save — see the rows marked in red.`);
    }
  }

  const totals = rows.reduce(
    (acc, row: RouteRow) => {
      if (!row.delivery) return acc;
      acc.delivered += row.delivery.quantityDelivered;
      const r = rowReturned(row);
      if (Number.isFinite(r) && rowIsValid(row)) {
        acc.returned += r;
        acc.sold += row.delivery.quantityDelivered - r;
      }
      return acc;
    },
    { delivered: 0, returned: 0, sold: 0 }
  );

  return (
    <div>
      <p style={{ color: "var(--ink-soft)", maxWidth: 620, marginBottom: 24 }}>
        Pick a route and date to list every stop in delivery order. Type each stop's returns from
        the driver sheet (press Enter to jump to the next stop), then click Save all. Sold is
        calculated automatically. Leave a box blank to skip that stop for now.
      </p>

      {error && <div className="error-banner">{error}</div>}
      {successMsg && (
        <div className="card" style={{ background: "#e6f4ea", marginBottom: 16 }}>
          {successMsg}
        </div>
      )}

      <form
        onSubmit={handleLoad}
        className="card"
        style={{ display: "flex", gap: 12, alignItems: "flex-end", maxWidth: 720, marginBottom: 24 }}
      >
        <div className="field" style={{ flex: 1 }}>
          <label>Paper</label>
          <select value={paperId} onChange={(e) => setPaperId(e.target.value)}>
            {papers.map((p: api.Paper) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Route</label>
          <select value={routeId} onChange={(e) => setRouteId(e.target.value)}>
            {routes.length === 0 && <option value="">No routes for this paper</option>}
            {routes.map((r: api.RackRoute) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.truck ? ` (Truck ${r.truck.truckNumber})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading || !routeId}>
          {loading ? "Loading…" : "Load route"}
        </button>
      </form>

      {loadedLabel && rows.length === 0 && !loading && (
        <div className="card">This route has no stops yet. Add stops on the Rack Routes page.</div>
      )}

      {rows.length > 0 && (
        <>
          <h2>{loadedLabel}</h2>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Dealer</th>
                <th>Delivered</th>
                <th>Returned</th>
                <th>Sold</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: RouteRow, i: number) => {
                const valid = rowIsValid(row);
                const r = rowReturned(row);
                const sold =
                  row.delivery && Number.isFinite(r) && valid
                    ? row.delivery.quantityDelivered - r
                    : null;
                let status = "";
                if (row.rowError) status = row.rowError;
                else if (!row.delivery) status = "No delivery this date";
                else if (row.saved) status = "Saved ✓";
                else if (row.delivery.status === "RECONCILED") status = "Previously entered";
                else status = "Not entered";

                return (
                  <tr
                    key={row.stopId}
                    style={{
                      background: !valid || row.rowError ? "#fbe9e7" : row.saved ? "#e6f4ea" : undefined,
                      color: row.delivery ? undefined : "var(--ink-soft)",
                    }}
                  >
                    <td className="tabular">{row.sequence}</td>
                    <td>
                      {row.dealer.name}
                      {row.dealer.dealerNumber ? (
                        <span style={{ color: "var(--ink-soft)", fontSize: 13 }}>
                          {" "}
                          #{row.dealer.dealerNumber}
                        </span>
                      ) : null}
                    </td>
                    <td className="tabular">{row.delivery ? row.delivery.quantityDelivered : "—"}</td>
                    <td>
                      {row.delivery ? (
                        <input
                          type="number"
                          min={0}
                          max={row.delivery.quantityDelivered}
                          data-ret-index={i}
                          value={row.returned}
                          onChange={(e) => updateReturned(i, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, i)}
                          style={{ width: 80 }}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="tabular" style={{ fontWeight: 600 }}>
                      {sold === null ? "" : sold}
                    </td>
                    <td style={{ fontSize: 13 }}>{status}</td>
                  </tr>
                );
              })}
              <tr style={{ fontWeight: 700, borderTop: "2px solid var(--ink-soft)" }}>
                <td></td>
                <td>Route total</td>
                <td className="tabular">{totals.delivered}</td>
                <td className="tabular">{totals.returned}</td>
                <td className="tabular">{totals.sold}</td>
                <td></td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: 16 }}>
            <button className="btn btn-primary" type="button" onClick={handleSaveAll} disabled={saving}>
              {saving ? "Saving…" : "Save all"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}