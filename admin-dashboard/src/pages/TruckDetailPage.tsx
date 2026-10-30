import { FormEvent, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import * as api from "../api/client";import { formatDateUTC } from "../lib/dates";

export function TruckDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [truck, setTruck] = useState<api.Truck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) load(id);
  }, [id]);

  async function load(truckId: string) {
    setLoading(true);
    try {
      const t = await api.fetchTruck(truckId);
      setTruck(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load truck");
    } finally {
      setLoading(false);
    }
  }

  function refresh() {
    if (id) load(id);
  }

  if (loading) return <p style={{ color: "var(--ink-soft)" }}>Loading…</p>;
  if (error) return <div className="error-banner">{error}</div>;
  if (!truck) return null;

  return (
    <div>
      <Link to="/trucks" style={{ fontSize: 13 }}>
        ← Back to trucks
      </Link>

      <div className="page-header" style={{ marginTop: 12 }}>
        <h1>
          {truck.truckNumber} {truck.driverName ? `- ${truck.driverName}` : ""}
        </h1>
      </div>

      <div className="card" style={{ marginBottom: 24, maxWidth: 480 }}>
        <h3>Driver info</h3>
        <p style={{ margin: "4px 0", fontSize: 14 }}>Type: {truck.driverType}</p>
        <p style={{ margin: "4px 0", fontSize: 14 }}>Phone: {truck.phone ?? "—"}</p>
        <p style={{ margin: "4px 0", fontSize: 14, color: "var(--ink-soft)" }}>
          {truck.addressLine1 ?? "—"}
          {truck.city ? `, ${truck.city}` : ""} {truck.state ?? ""} {truck.zip ?? ""}
        </p>
        {truck.driverType === "CONTRACTOR" && (
          <p style={{ margin: "4px 0", fontSize: 14 }}>
            Pay per drop: {truck.payPerDropCents != null ? `$${(truck.payPerDropCents / 100).toFixed(2)}` : "—"}
          </p>
        )}
      </div>

      {truck.driverType === "CONTRACTOR" && (
        <>
          <h2>Generate pay period</h2>
          <GeneratePayPeriodForm truckId={truck.id} onGenerated={refresh} onError={setError} />

          <h2 style={{ marginTop: 32 }}>Pay periods</h2>
          <PayPeriodsTable payPeriods={truck.payPeriods ?? []} onChanged={refresh} onError={setError} />
        </>
      )}
    </div>
  );
}

function GeneratePayPeriodForm({
  truckId,
  onGenerated,
  onError,
}: {
  truckId: string;
  onGenerated: () => void;
  onError: (msg: string) => void;
}) {
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [fuelMileage, setFuelMileage] = useState("");
  const [postOfficeDrops, setPostOfficeDrops] = useState("");
  const [advertisingDelivery, setAdvertisingDelivery] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.generatePayPeriod(truckId, {
        periodStart,
        periodEnd,
        fuelMileageCents: fuelMileage ? Math.round(parseFloat(fuelMileage) * 100) : 0,
        postOfficeDropsCents: postOfficeDrops ? Math.round(parseFloat(postOfficeDrops) * 100) : 0,
        advertisingDeliveryCents: advertisingDelivery ? Math.round(parseFloat(advertisingDelivery) * 100) : 0,
      });
      setPeriodStart("");
      setPeriodEnd("");
      setFuelMileage("");
      setPostOfficeDrops("");
      setAdvertisingDelivery("");
      onGenerated();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't generate pay period");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card" style={{ maxWidth: 620, marginBottom: 24 }} onSubmit={handleSubmit}>
      <div style={{ display: "flex", gap: 12 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Period start</label>
          <input type="date" required value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Period end</label>
          <input type="date" required value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Fuel/Mileage ($)</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={fuelMileage}
            onChange={(e) => setFuelMileage(e.target.value)}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Post Office Drops ($)</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={postOfficeDrops}
            onChange={(e) => setPostOfficeDrops(e.target.value)}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Advertising Delivery ($)</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={advertisingDelivery}
            onChange={(e) => setAdvertisingDelivery(e.target.value)}
          />
        </div>
      </div>
      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? "Generating…" : "Generate pay period"}
      </button>
    </form>
  );
}

function PayPeriodsTable({
  payPeriods,
  onChanged,
  onError,
}: {
  payPeriods: api.DriverPayPeriod[];
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function handleStatusChange(id: string, status: "OPEN" | "INVOICED" | "PAID") {
    setUpdatingId(id);
    try {
      await api.updatePayPeriodStatus(id, status);
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't update status");
    } finally {
      setUpdatingId(null);
    }
  }

  if (payPeriods.length === 0) {
    return <div className="empty-state">No pay periods generated yet.</div>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Period</th>
          <th>Drops</th>
          <th>Drop pay</th>
          <th>Fuel</th>
          <th>Post Office</th>
          <th>Advertising</th>
          <th>Total</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {payPeriods.map((p) => (
          <tr key={p.id}>
            <td className="tabular">
              {formatDateUTC(p.periodStart)} - {formatDateUTC(p.periodEnd)}
            </td>
            <td className="tabular">{p.dropCount}</td>
            <td className="tabular">${(p.dropPayCents / 100).toFixed(2)}</td>
            <td className="tabular">${(p.fuelMileageCents / 100).toFixed(2)}</td>
            <td className="tabular">${(p.postOfficeDropsCents / 100).toFixed(2)}</td>
            <td className="tabular">${(p.advertisingDeliveryCents / 100).toFixed(2)}</td>
            <td className="tabular">${(p.totalCents / 100).toFixed(2)}</td>
            <td>
              <select
                value={p.status}
                disabled={updatingId === p.id}
                onChange={(e) => handleStatusChange(p.id, e.target.value as "OPEN" | "INVOICED" | "PAID")}
              >
                <option value="OPEN">Open</option>
                <option value="INVOICED">Invoiced</option>
                <option value="PAID">Paid</option>
              </select>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}