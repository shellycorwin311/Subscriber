import { useEffect, useMemo, useState } from "react";
import * as api from "../api/client";

const PRODUCT_LABEL: Record<api.Rate["product"], string> = {
  PRINT: "Print only",
  PRINT_DIGITAL: "Print + Digital",
  DIGITAL: "Digital only",
};
const DELIVERY_LABEL: Record<api.Rate["deliveryMethod"], string> = {
  CARRIER: "Carrier",
  MAIL: "Mail",
  DIGITAL: "Online",
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
function lengthText(r: api.Rate) {
  if (r.lengthUnit === "DAYS") return `${r.lengthCount} day${r.lengthCount === 1 ? "" : "s"}`;
  return `${r.lengthCount} wk${r.lengthCount === 1 ? "" : "s"}`;
}

export function RatesPage() {
  const [papers, setPapers] = useState<api.Paper[]>([]);
  const [paperId, setPaperId] = useState("");
  const [rates, setRates] = useState<api.Rate[]>([]);
  const [product, setProduct] = useState("");
  const [delivery, setDelivery] = useState("");
  const [search, setSearch] = useState("");
  const [showOld, setShowOld] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<api.Rate | null>(null);

  useEffect(() => {
    api.fetchPapers().then((p) => {
      setPapers(p);
      if (p.length > 0) setPaperId(p[0].id);
    });
  }, []);

  useEffect(() => {
    if (!paperId) return;
    setLoading(true);
    setError(null);
    api
      .fetchRates(paperId, showInactive)
      .then(setRates)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Couldn't load rates"))
      .finally(() => setLoading(false));
  }, [paperId, showInactive]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rates.filter(
      (r) =>
        (!product || r.product === product) &&
        (!delivery || r.deliveryMethod === delivery) &&
        (showOld || !r.isOldRate) &&
        (!q || r.description.toLowerCase().includes(q) || (r.onlineDescription ?? "").toLowerCase().includes(q))
    );
  }, [rates, product, delivery, search, showOld]);

  function handleSaved(updated: api.Rate) {
    setRates((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setEditing(null);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Rates</h1>
      </div>

      <p style={{ color: "var(--ink-soft)", maxWidth: 640, marginBottom: 24 }}>
        Subscription prices for each paper. Promo rates with steps roll into the next step automatically
        when each billing period ends.
      </p>

      {error && <div className="error-banner">{error}</div>}

      <div className="card" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
        <div className="field">
          <label>Paper</label>
          <select value={paperId} onChange={(e) => setPaperId(e.target.value)}>
            {papers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Type</label>
          <select value={product} onChange={(e) => setProduct(e.target.value)}>
            <option value="">All</option>
            <option value="PRINT">Print only</option>
            <option value="PRINT_DIGITAL">Print + Digital</option>
            <option value="DIGITAL">Digital only</option>
          </select>
        </div>
        <div className="field">
          <label>Delivery</label>
          <select value={delivery} onChange={(e) => setDelivery(e.target.value)}>
            <option value="">All</option>
            <option value="CARRIER">Carrier</option>
            <option value="MAIL">Mail</option>
            <option value="DIGITAL">Online</option>
          </select>
        </div>
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <label>Search</label>
          <input placeholder="e.g. senior, EZPAY, holiday" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14 }}>
          <input type="checkbox" checked={showOld} onChange={(e) => setShowOld(e.target.checked)} /> Show old rates
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14 }}>
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show turned-off
        </label>
      </div>

      <p style={{ fontSize: 14, color: "var(--ink-soft)" }}>
        {loading ? "Loading…" : `${shown.length} of ${rates.length} rates`}
      </p>

      {editing && <EditRate rate={editing} onCancel={() => setEditing(null)} onSaved={handleSaved} />}

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Type</th>
            <th>Delivery</th>
            <th>Days</th>
            <th>Length</th>
            <th style={{ textAlign: "right" }}>Price</th>
            <th>Step</th>
            <th>Tags</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.id} style={!r.active ? { opacity: 0.5 } : undefined}>
              <td>
                {r.description}
                {r.onlineDescription && r.onlineDescription !== r.description && (
                  <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>Online: {r.onlineDescription}</div>
                )}
              </td>
              <td>{PRODUCT_LABEL[r.product] ?? r.product}</td>
              <td>{DELIVERY_LABEL[r.deliveryMethod] ?? r.deliveryMethod}</td>
              <td>{r.issueDays}</td>
              <td className="tabular">{lengthText(r)}</td>
              <td className="tabular" style={{ textAlign: "right" }}>
                {money(r.priceCents)}
                {r.fullRateCents > r.priceCents && (
                  <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>full {money(r.fullRateCents)}</div>
                )}
              </td>
              <td className="tabular">
                {r.step > 0 || r.nextStep > 0 ? `${r.step}${r.nextStep > 0 ? ` → ${r.nextStep}` : ""}` : ""}
              </td>
              <td style={{ fontSize: 12 }}>
                {[
                  r.easyPay && "EZPAY",
                  r.isGift && "Gift",
                  r.payMethod === "COMP" && "Comp",
                  r.isOldRate && "Old rate",
                  r.showOnline && "Online",
                  !r.active && "Off",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </td>
              <td>
                <button className="btn" onClick={() => setEditing(r)}>Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditRate({
  rate,
  onCancel,
  onSaved,
}: {
  rate: api.Rate;
  onCancel: () => void;
  onSaved: (r: api.Rate) => void;
}) {
  const [description, setDescription] = useState(rate.description);
  const [onlineDescription, setOnlineDescription] = useState(rate.onlineDescription ?? "");
  const [price, setPrice] = useState((rate.priceCents / 100).toFixed(2));
  const [fullRate, setFullRate] = useState((rate.fullRateCents / 100).toFixed(2));
  const [active, setActive] = useState(rate.active);
  const [isOldRate, setIsOldRate] = useState(rate.isOldRate);
  const [showOnline, setShowOnline] = useState(rate.showOnline);
  const [easyPay, setEasyPay] = useState(rate.easyPay);
  const [isGift, setIsGift] = useState(rate.isGift);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const priceCents = Math.round(parseFloat(price) * 100);
    const fullRateCents = Math.round(parseFloat(fullRate) * 100);
    if (!Number.isFinite(priceCents) || priceCents < 0 || !Number.isFinite(fullRateCents) || fullRateCents < 0) {
      setError("Enter valid dollar amounts.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateRate(rate.id, {
        description,
        onlineDescription,
        priceCents,
        fullRateCents,
        active,
        isOldRate,
        showOnline,
        easyPay,
        isGift,
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  const check = (label: string, value: boolean, set: (v: boolean) => void) => (
    <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14 }}>
      <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} /> {label}
    </label>
  );

  return (
    <div className="card" style={{ maxWidth: 640, marginBottom: 16 }}>
      <h3>Edit rate</h3>
      {error && <div className="error-banner">{error}</div>}
      <div className="field">
        <label>Description</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="field">
        <label>Online description (what customers see)</label>
        <input value={onlineDescription} onChange={(e) => setOnlineDescription(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Price ($)</label>
          <input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Full rate ($)</label>
          <input type="number" min={0} step="0.01" value={fullRate} onChange={(e) => setFullRate(e.target.value)} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "8px 0 16px" }}>
        {check("Turned on", active, setActive)}
        {check("Old rate", isOldRate, setIsOldRate)}
        {check("Show online", showOnline, setShowOnline)}
        {check("EZPAY", easyPay, setEasyPay)}
        {check("Gift", isGift, setIsGift)}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}