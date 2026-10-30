import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import * as api from "../api/client";

export function TrucksPage() {
  const [trucks, setTrucks] = useState<api.Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const t = await api.fetchTrucks();
      setTrucks(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load trucks");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <p style={{ color: "var(--ink-soft)" }}>Loading…</p>;

  return (
    <div>
      <div className="page-header">
        <h1>Trucks & Drivers</h1>
        <button className="btn btn-primary" onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? "Cancel" : "+ Add truck"}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {showAddForm && (
        <AddTruckForm
          onCreated={() => {
            setShowAddForm(false);
            load();
          }}
        />
      )}

      {trucks.length === 0 ? (
        <div className="empty-state">No trucks added yet.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Truck #</th>
              <th>Driver</th>
              <th>Phone</th>
              <th>Type</th>
              <th>Pay/drop</th>
            </tr>
          </thead>
          <tbody>
            {trucks.map((t) => (
              <tr key={t.id} className="clickable" onClick={() => navigate(`/trucks/${t.id}`)}>
                <td className="tabular">{t.truckNumber}</td>
                <td>{t.driverName ?? "—"}</td>
                <td>{t.phone ?? "—"}</td>
                <td>{t.driverType}</td>
                <td className="tabular">
                  {t.payPerDropCents != null ? `$${(t.payPerDropCents / 100).toFixed(2)}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function AddTruckForm({ onCreated }: { onCreated: () => void }) {
  const [truckNumber, setTruckNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [phone, setPhone] = useState("");
  const [driverType, setDriverType] = useState<"EMPLOYEE" | "CONTRACTOR">("EMPLOYEE");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [payPerDrop, setPayPerDrop] = useState("1.50");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payPerDropCents = payPerDrop ? Math.round(parseFloat(payPerDrop) * 100) : undefined;
      await api.createTruck({
        truckNumber,
        driverName,
        phone,
        driverType,
        addressLine1,
        city,
        state,
        zip,
        payPerDropCents,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create truck");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card" style={{ maxWidth: 480, marginBottom: 24 }} onSubmit={handleSubmit}>
      <h3>New truck / driver</h3>
      {error && <div className="error-banner">{error}</div>}
      <div className="field">
        <label>Truck number</label>
        <input required value={truckNumber} onChange={(e) => setTruckNumber(e.target.value)} />
      </div>
      <div className="field">
        <label>Driver name</label>
        <input value={driverName} onChange={(e) => setDriverName(e.target.value)} />
      </div>
      <div className="field">
        <label>Phone</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className="field">
        <label>Type</label>
        <select value={driverType} onChange={(e) => setDriverType(e.target.value as "EMPLOYEE" | "CONTRACTOR")}>
          <option value="EMPLOYEE">Employee</option>
          <option value="CONTRACTOR">Contractor</option>
        </select>
      </div>
      <div className="field">
        <label>Address</label>
        <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>City</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>State</label>
          <input value={state} onChange={(e) => setState(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Zip</label>
          <input value={zip} onChange={(e) => setZip(e.target.value)} />
        </div>
      </div>
      {driverType === "CONTRACTOR" && (
        <div className="field">
          <label>Pay per drop ($)</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={payPerDrop}
            onChange={(e) => setPayPerDrop(e.target.value)}
            style={{ width: 100 }}
          />
        </div>
      )}
      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? "Creating…" : "Create truck"}
      </button>
    </form>
  );
}