import { FormEvent, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import * as api from "../api/client";import { formatDateUTC } from "../lib/dates";

export function DealerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [dealer, setDealer] = useState<api.Dealer | null>(null);
  const [papers, setPapers] = useState<api.Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingNumber, setEditingNumber] = useState(false);
  const [numberDraft, setNumberDraft] = useState("");
  const [savingNumber, setSavingNumber] = useState(false);

  useEffect(() => {
    if (!id) return;
    load(id);
  }, [id]);

  async function load(dealerId: string) {
    setLoading(true);
    setError(null);
    try {
      const [d, p] = await Promise.all([api.fetchDealer(dealerId), api.fetchPapers()]);
      setDealer(d);
      setPapers(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this dealer");
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    if (id) await load(id);
  }

  async function handleSaveNumber() {
    if (!dealer) return;
    setSavingNumber(true);
    try {
      const updated = await api.updateDealer(dealer.id, { dealerNumber: numberDraft || null });
      setDealer(updated);
      setEditingNumber(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't save the dealer number");
    } finally {
      setSavingNumber(false);
    }
  }

  if (loading) return <p style={{ color: "var(--ink-soft)" }}>Loading…</p>;
  if (error) return <div className="error-banner">{error}</div>;
  if (!dealer) return null;

  return (
    <div>
      <Link to="/dealers" style={{ fontSize: 13 }}>
        ← Back to dealers
      </Link>

      <div className="page-header" style={{ marginTop: 12 }}>
        <h1>{dealer.name}</h1>
      </div>

      {actionError && <div className="error-banner">{actionError}</div>}

      <div className="card" style={{ marginBottom: 24, maxWidth: 480 }}>
        <h3>Contact & address</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0" }}>
          <span style={{ fontSize: 14, color: "var(--ink-soft)" }}>Dealer #:</span>
          {editingNumber ? (
            <>
              <input
                autoFocus
                value={numberDraft}
                onChange={(e) => setNumberDraft(e.target.value)}
                style={{ width: 140 }}
              />
              <button className="btn btn-primary" disabled={savingNumber} onClick={handleSaveNumber}>
                Save
              </button>
              <button className="btn btn-secondary" onClick={() => setEditingNumber(false)}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <span style={{ fontSize: 14 }} className="tabular">
                {dealer.dealerNumber ?? "Not set"}
              </span>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setNumberDraft(dealer.dealerNumber ?? "");
                  setEditingNumber(true);
                }}
              >
                {dealer.dealerNumber ? "Edit" : "Set"}
              </button>
            </>
          )}
        </div>
        <p style={{ margin: "4px 0", fontSize: 14 }}>{dealer.contactName ?? "No contact listed"}</p>
        <p style={{ margin: "4px 0", fontSize: 14, color: "var(--ink-soft)" }}>
          {dealer.addressLine1 ?? "—"}
          {dealer.city ? `, ${dealer.city}` : ""} {dealer.state ?? ""} {dealer.zip ?? ""}
        </p>
        <p style={{ margin: "4px 0", fontSize: 14, color: "var(--ink-soft)" }}>
          Credit terms: {dealer.creditTerms ?? "Not set"}
        </p>
      </div>

      <h2>Standing orders</h2>
      <p style={{ color: "var(--ink-soft)", marginTop: -8, marginBottom: 16, fontSize: 13 }}>
        Default quantity dropped per paper, per issue day (e.g. Daily Gazette Mon/Wed/Fri).
      </p>
      <StandingOrdersTable dealer={dealer} papers={papers} onChanged={refresh} onError={setActionError} />
<h2 style={{ marginTop: 32 }}>Wholesale pricing</h2>
<p style={{ color: "var(--ink-soft)", marginTop: -8, marginBottom: 16, fontSize: 13 }}>
  This dealer's negotiated price per paper, per issue day.
</p>
<DealerPricingTable dealer={dealer} papers={papers} onChanged={refresh} onError={setActionError} />

<h2 style={{ marginTop: 32 }}>Payments</h2>
<p style={{ color: "var(--ink-soft)", marginTop: -8, marginBottom: 16, fontSize: 13 }}>
  Payments received from this dealer (checks, cash, etc.).
</p>
<RecordPaymentForm dealerId={dealer.id} onRecorded={refresh} onError={setActionError} />
<PaymentsTable payments={dealer.payments ?? []} />


      <h2 style={{ marginTop: 32 }}>Record a delivery</h2>
      <RecordDeliveryForm dealerId={dealer.id} papers={papers} onRecorded={refresh} onError={setActionError} />

      <h2 style={{ marginTop: 32 }}>Recent deliveries</h2>
      <DeliveriesTable deliveries={dealer.deliveries ?? []} onReconciled={refresh} onError={setActionError} />
    </div>
  );
}

const DAY_ORDER: api.DealerStandingOrder["dayOfWeek"][] = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
];
const DAY_LABELS: Record<api.DealerStandingOrder["dayOfWeek"], string> = {
  MON: "Mon",
  TUE: "Tue",
  WED: "Wed",
  THU: "Thu",
  FRI: "Fri",
  SAT: "Sat",
  SUN: "Sun",
};

function StandingOrdersTable({
  dealer,
  papers,
  onChanged,
  onError,
}: {
  dealer: api.Dealer;
  papers: api.Paper[];
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [addPaperId, setAddPaperId] = useState(papers[0]?.id ?? "");
  const [addDay, setAddDay] = useState<api.DealerStandingOrder["dayOfWeek"]>("MON");
  const [addQuantity, setAddQuantity] = useState("");
  const [adding, setAdding] = useState(false);

  const sortedOrders = [...dealer.standingOrders].sort((a, b) => {
    const paperCompare = a.paper.name.localeCompare(b.paper.name);
    if (paperCompare !== 0) return paperCompare;
    return DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek);
  });

  async function handleSaveEdit(order: api.DealerStandingOrder) {
    const qty = parseInt(quantity, 10);
    if (!Number.isFinite(qty) || qty <= 0) {
      onError("Enter a quantity greater than zero.");
      return;
    }
    setSaving(true);
    try {
      await api.setStandingOrder(dealer.id, order.paperId, order.dayOfWeek, qty);
      setEditingId(null);
      setQuantity("");
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't save the standing order");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(order: api.DealerStandingOrder) {
    setRemovingId(order.id);
    try {
      await api.deleteStandingOrder(order.id);
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't remove that standing order");
    } finally {
      setRemovingId(null);
    }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const qty = parseInt(addQuantity, 10);
    if (!Number.isFinite(qty) || qty <= 0) {
      onError("Enter a quantity greater than zero.");
      return;
    }
    if (!addPaperId) return;
    setAdding(true);
    try {
      await api.setStandingOrder(dealer.id, addPaperId, addDay, qty);
      setAddQuantity("");
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't add that standing order");
    } finally {
      setAdding(false);
    }
  }

  const grouped = new Map<string, { paper: api.Paper; orders: api.DealerStandingOrder[] }>();
  for (const order of sortedOrders) {
    if (!grouped.has(order.paperId)) grouped.set(order.paperId, { paper: order.paper, orders: [] });
    grouped.get(order.paperId)!.orders.push(order);
  }
  const groupedRows = [...grouped.values()];

  const ghostBtn = {
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    fontSize: 12,
    textDecoration: "underline",
    color: "inherit",
  } as const;

  return (
    <>
      {groupedRows.length === 0 ? (
        <div className="empty-state">No standing orders set yet.</div>
      ) : (
        <table style={{ marginBottom: 16 }}>
          <thead>
            <tr>
              <th>Paper</th>
              <th>Issue days</th>
            </tr>
          </thead>
          <tbody>
            {groupedRows.map(({ paper, orders }) => (
              <tr key={paper.id}>
                <td style={{ whiteSpace: "nowrap" }}>{paper.name}</td>
                <td>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
                    {orders.map((order) => {
                      const isEditing = editingId === order.id;
                      return isEditing ? (
                        <span key={order.id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 13 }}>{DAY_LABELS[order.dayOfWeek]}</span>
                          <input
                            type="number"
                            min={1}
                            autoFocus
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            style={{ width: 70 }}
                          />
                          <button
                            className="btn btn-primary"
                            disabled={saving}
                            onClick={() => handleSaveEdit(order)}
                          >
                            Save
                          </button>
                          <button className="btn btn-secondary" onClick={() => setEditingId(null)}>
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <span key={order.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14 }}>
                          <span className="tabular">
                            {DAY_LABELS[order.dayOfWeek]} ({order.quantity})
                          </span>
                          <button
                            style={ghostBtn}
                            onClick={() => {
                              setEditingId(order.id);
                              setQuantity(String(order.quantity));
                            }}
                          >
                            Edit
                          </button>
                          <button
                            style={{ ...ghostBtn, color: "var(--status-canceled)" }}
                            disabled={removingId === order.id}
                            onClick={() => handleRemove(order)}
                          >
                            Remove
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form
        onSubmit={handleAdd}
        style={{ display: "flex", gap: 12, alignItems: "flex-end", maxWidth: 560 }}
      >
        <div className="field" style={{ flex: 1 }}>
          <label>Paper</label>
          <select value={addPaperId} onChange={(e) => setAddPaperId(e.target.value)}>
            {papers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Issue day</label>
          <select
            value={addDay}
            onChange={(e) => setAddDay(e.target.value as api.DealerStandingOrder["dayOfWeek"])}
          >
            {DAY_ORDER.map((d) => (
              <option key={d} value={d}>
                {DAY_LABELS[d]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Quantity</label>
          <input
            type="number"
            min={1}
            required
            value={addQuantity}
            onChange={(e) => setAddQuantity(e.target.value)}
            style={{ width: 90 }}
        />
      </div>
        <button className="btn btn-primary" type="submit" disabled={adding}>
          {adding ? "Adding…" : "Add"}
        </button>
      </form>
    </>
  );
}


const DAY_LABELS_PRICING: Record<api.DealerStandingOrder["dayOfWeek"], string> = DAY_LABELS;

function DealerPricingTable({
  dealer,
  papers,
  onChanged,
  onError,
}: {
  dealer: api.Dealer;
  papers: api.Paper[];
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [addPaperId, setAddPaperId] = useState(papers[0]?.id ?? "");
  const [addDay, setAddDay] = useState<api.DealerStandingOrder["dayOfWeek"]>("MON");
  const [addPrice, setAddPrice] = useState("");
  const [adding, setAdding] = useState(false);

  const pricingRows = dealer.pricing ?? [];
  const sortedPricing = [...pricingRows].sort((a, b) => {
    const paperCompare = a.paper.name.localeCompare(b.paper.name);
    if (paperCompare !== 0) return paperCompare;
    return DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek);
  });

  const grouped = new Map<string, { paper: api.Paper; rows: api.DealerPricing[] }>();
  for (const row of sortedPricing) {
    if (!grouped.has(row.paperId)) grouped.set(row.paperId, { paper: row.paper, rows: [] });
    grouped.get(row.paperId)!.rows.push(row);
  }
  const groupedRows = [...grouped.values()];

  async function handleSaveEdit(row: api.DealerPricing) {
    const priceCents = Math.round(parseFloat(priceDraft) * 100);
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      onError("Enter a valid price.");
      return;
    }
    setSaving(true);
    try {
      await api.setDealerPricing(dealer.id, { paperId: row.paperId, dayOfWeek: row.dayOfWeek, priceCents });
      setEditingId(null);
      setPriceDraft("");
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't save that price");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(row: api.DealerPricing) {
    setRemovingId(row.id);
    try {
      await api.deleteDealerPricing(row.id);
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't remove that price");
    } finally {
      setRemovingId(null);
    }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const priceCents = Math.round(parseFloat(addPrice) * 100);
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      onError("Enter a valid price.");
      return;
    }
    if (!addPaperId) return;
    setAdding(true);
    try {
      await api.setDealerPricing(dealer.id, { paperId: addPaperId, dayOfWeek: addDay, priceCents });
      setAddPrice("");
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't add that price");
    } finally {
      setAdding(false);
    }
  }

  const ghostBtn = {
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    fontSize: 12,
    textDecoration: "underline",
    color: "inherit",
  } as const;

  return (
    <>
      {groupedRows.length === 0 ? (
        <div className="empty-state">No pricing set yet.</div>
      ) : (
        <table style={{ marginBottom: 16 }}>
          <thead>
            <tr>
              <th>Paper</th>
              <th>Price by day</th>
            </tr>
          </thead>
          <tbody>
            {groupedRows.map(({ paper, rows }) => (
              <tr key={paper.id}>
                <td style={{ whiteSpace: "nowrap" }}>{paper.name}</td>
                <td>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
                    {rows.map((row) => {
                      const isEditing = editingId === row.id;
                      return isEditing ? (
                        <span key={row.id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 13 }}>{DAY_LABELS_PRICING[row.dayOfWeek]}</span>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            autoFocus
                            value={priceDraft}
                            onChange={(e) => setPriceDraft(e.target.value)}
                            style={{ width: 80 }}
                          />
                          <button className="btn btn-primary" disabled={saving} onClick={() => handleSaveEdit(row)}>
                            Save
                          </button>
                          <button className="btn btn-secondary" onClick={() => setEditingId(null)}>
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <span key={row.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14 }}>
                          <span className="tabular">
                            {DAY_LABELS_PRICING[row.dayOfWeek]} (${(row.priceCents / 100).toFixed(2)})
                          </span>
                          <button
                            style={ghostBtn}
                            onClick={() => {
                              setEditingId(row.id);
                              setPriceDraft((row.priceCents / 100).toFixed(2));
                            }}
                          >
                            Edit
                          </button>
                          <button
                            style={{ ...ghostBtn, color: "var(--status-canceled)" }}
                            disabled={removingId === row.id}
                            onClick={() => handleRemove(row)}
                          >
                            Remove
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form onSubmit={handleAdd} style={{ display: "flex", gap: 12, alignItems: "flex-end", maxWidth: 560 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Paper</label>
          <select value={addPaperId} onChange={(e) => setAddPaperId(e.target.value)}>
            {papers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Issue day</label>
          <select value={addDay} onChange={(e) => setAddDay(e.target.value as api.DealerStandingOrder["dayOfWeek"])}>
            {DAY_ORDER.map((d) => (
              <option key={d} value={d}>
                {DAY_LABELS_PRICING[d]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Price ($)</label>
          <input
            type="number"
            step="0.01"
            min={0}
            required
            value={addPrice}
            onChange={(e) => setAddPrice(e.target.value)}
            style={{ width: 90 }}
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={adding}>
          {adding ? "Adding…" : "Add"}
        </button>
      </form>
    </>
  );
}
function RecordDeliveryForm({
  dealerId,
  papers,
  onRecorded,
  onError,
}: {
  dealerId: string;
  papers: api.Paper[];
  onRecorded: () => void;
  onError: (msg: string) => void;
}) {
  const [paperId, setPaperId] = useState(papers[0]?.id ?? "");
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!paperId && papers.length > 0) setPaperId(papers[0].id);
  }, [papers, paperId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const qty = parseInt(quantity, 10);
    if (!Number.isFinite(qty) || qty < 0) {
      onError("Enter a valid quantity delivered.");
      return;
    }
    setSubmitting(true);
    try {
      await api.recordDelivery(dealerId, { paperId, deliveryDate, quantityDelivered: qty });
      setQuantity("");
      onRecorded();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't record the delivery");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="card"
      style={{ display: "flex", gap: 12, alignItems: "flex-end", maxWidth: 620, marginBottom: 24 }}
      onSubmit={handleSubmit}
    >
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
        <label>Date</label>
        <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
      </div>
      <div className="field">
        <label>Quantity delivered</label>
        <input
          type="number"
          min={0}
          required
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          style={{ width: 100 }}
        />
      </div>
      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? "Recording…" : "Record delivery"}
      </button>
    </form>
  );
}

function DeliveriesTable({
  deliveries,
  onReconciled,
  onError,
}: {
  deliveries: api.RackDelivery[];
  onReconciled: () => void;
  onError: (msg: string) => void;
}) {
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  const [sold, setSold] = useState("");
  const [returned, setReturned] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleReconcile(deliveryId: string) {
    const soldQty = parseInt(sold, 10);
    const returnedQty = parseInt(returned, 10);
    if (!Number.isFinite(soldQty) || !Number.isFinite(returnedQty) || soldQty < 0 || returnedQty < 0) {
      onError("Enter valid sold and returned quantities.");
      return;
    }
    setSubmitting(true);
    try {
      await api.reconcileDelivery(deliveryId, { quantitySold: soldQty, quantityReturned: returnedQty });
      setReconcilingId(null);
      setSold("");
      setReturned("");
      onReconciled();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't reconcile this delivery");
    } finally {
      setSubmitting(false);
    }
  }

  if (deliveries.length === 0) {
    return <div className="empty-state">No deliveries recorded yet.</div>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Paper</th>
          <th>Delivered</th>
          <th>Sold</th>
          <th>Returned</th>
          <th>Credit</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {deliveries.map((d) => {
          const isReconciling = reconcilingId === d.id;
          return (
            <tr key={d.id}>
              <td className="tabular">{formatDateUTC(d.deliveryDate)}</td>
              <td>{d.paper.name}</td>
              <td className="tabular">{d.quantityDelivered}</td>
              <td className="tabular">
                {isReconciling ? (
                  <input
                    type="number"
                    min={0}
                    autoFocus
                    value={sold}
                    onChange={(e) => setSold(e.target.value)}
                    style={{ width: 70 }}
                  />
                ) : (
                  d.quantitySold ?? "—"
                )}
              </td>
              <td className="tabular">
                {isReconciling ? (
                  <input
                    type="number"
                    min={0}
                    value={returned}
                    onChange={(e) => setReturned(e.target.value)}
                    style={{ width: 70 }}
                  />
                ) : (
                  d.quantityReturned ?? "—"
                )}
              </td>
              <td className="tabular">
                {d.creditCents != null ? `$${(d.creditCents / 100).toFixed(2)}` : "—"}
              </td>
              <td>
                {d.status === "DELIVERED" ? (
                  isReconciling ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="btn btn-primary"
                        disabled={submitting}
                        onClick={() => handleReconcile(d.id)}
                      >
                        Save
                      </button>
                      <button className="btn btn-secondary" onClick={() => setReconcilingId(null)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setReconcilingId(d.id);
                        setSold("");
                        setReturned("");
                      }}
                    >
                      Reconcile
                    </button>
                  )
                ) : (
                  <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Reconciled</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function RecordPaymentForm({
  dealerId,
  onRecorded,
  onError,
}: {
  dealerId: string;
  onRecorded: () => void;
  onError: (msg: string) => void;
}) {
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
    const [paymentMethod, setPaymentMethod] = useState<"CHECK" | "CARD" | "ACH">("CHECK");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      onError("Enter a valid payment amount.");
      return;
    }
    setSubmitting(true);
    try {
      await api.recordPayment(dealerId, {
        paymentDate,
        amountCents,
        referenceNumber: referenceNumber || undefined,
                paymentMethod,
      });
      setAmount("");
      setReferenceNumber("");
      onRecorded();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't record the payment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="card"
      style={{ display: "flex", gap: 12, alignItems: "flex-end", maxWidth: 620, marginBottom: 24 }}
      onSubmit={handleSubmit}
    >
      <div className="field">
        <label>Date</label>
        <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
      </div>
      <div className="field">
        <label>Amount ($)</label>
        <input
          type="number"
          step="0.01"
          min={0}
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ width: 100 }}
        />
      </div>
      <div className="field" style={{ flex: 1 }}>
        <label>Reference # (check, etc.)</label>
        <input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
      </div>
            <div className="field">
        <label>Method</label>
        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as "CHECK" | "CARD" | "ACH")}>
          <option value="CHECK">Check</option>
          <option value="CARD">Card</option>
          <option value="ACH">ACH</option>
        </select>
      </div>
      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? "Recording…" : "Record payment"}
      </button>
    </form>
  );
}

function PaymentsTable({ payments }: { payments: api.DealerPayment[] }) {
  if (payments.length === 0) {
    return <div className="empty-state">No payments recorded yet.</div>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Amount</th>
          <th>Reference #</th>
                    <th>Method</th>
        </tr>
      </thead>
      <tbody>
        {payments.map((p) => (
          <tr key={p.id}>
            <td className="tabular">{formatDateUTC(p.paymentDate)}</td>
            <td className="tabular">${(p.amountCents / 100).toFixed(2)}</td>
            <td>{p.referenceNumber ?? "—"}</td>
                        <td>{p.paymentMethod}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
