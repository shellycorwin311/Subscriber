import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../api/client";

export function DealersPage() {
  const [query, setQuery] = useState("");
  const [dealers, setDealers] = useState<api.Dealer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    runSearch("");
  }, []);

  async function runSearch(q: string) {
    setLoading(true);
    setError(null);
    try {
      const results = await api.searchDealers(q);
      setDealers(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    runSearch(query);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Dealers</h1>
        <button className="btn btn-primary" onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? "Cancel" : "+ Add dealer"}
        </button>
      </div>

      {showAddForm && (
        <AddDealerForm
          onCreated={() => {
            setShowAddForm(false);
            runSearch(query);
          }}
        />
      )}

      <form onSubmit={handleSubmit} style={{ marginBottom: 24, display: "flex", gap: 8 }}>
        <input
          type="text"
          placeholder="Search by name or zip"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, maxWidth: 400 }}
        />
        <button className="btn btn-secondary" type="submit">
          Search
        </button>
      </form>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <p style={{ color: "var(--ink-soft)" }}>Searching…</p>
      ) : dealers.length === 0 ? (
        <div className="empty-state">No dealers match that search.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Dealer #</th>
              <th>Name</th>
              <th>City</th>
              <th>Papers</th>
                            <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {dealers.map((d) => (
              <tr key={d.id} className="clickable" onClick={() => navigate(`/dealers/${d.id}`)}>
                <td className="tabular">{d.dealerNumber ?? "—"}</td>
                <td>{d.name}</td>
                <td>{d.city ?? "—"}</td>
                <td>{d.standingOrders.map((o) => o.paper.name).join(", ") || "—"}</td>
                
                                <td>{d.dealerType}</td>
                                                <td>{d.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function AddDealerForm({ onCreated }: { onCreated: () => void }) {
  const [dealerNumber, setDealerNumber] = useState("");
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [creditTerms, setCreditTerms] = useState("");
    const [dealerType, setDealerType] = useState<"DEALER" | "VENDING" | "SERVICE">("DEALER");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.createDealer({ dealerNumber, name, contactName, addressLine1, city, state, zip, creditTerms, dealerType });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create dealer");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card" style={{ maxWidth: 480, marginBottom: 24 }} onSubmit={handleSubmit}>
      <h3>New dealer</h3>
      {error && <div className="error-banner">{error}</div>}
      <div className="field">
        <label>Dealer number</label>
        <input
          placeholder="e.g. D-1001"
          value={dealerNumber}
          onChange={(e) => setDealerNumber(e.target.value)}
        />
      </div>
      <div className="field">
        <label>Business name</label>
        <input required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>Contact name</label>
        <input value={contactName} onChange={(e) => setContactName(e.target.value)} />
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

     <div className="field">
        <label>Type</label>
        <select value={dealerType} onChange={(e) => setDealerType(e.target.value as "DEALER" | "VENDING" | "SERVICE")}>
          <option value="DEALER">Dealer</option>
          <option value="VENDING">Vending Machine</option>
          <option value="SERVICE">Service Copies</option>
        </select>
      </div>
      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? "Creating…" : "Create dealer"}
      </button>
    </form>
  );
}
