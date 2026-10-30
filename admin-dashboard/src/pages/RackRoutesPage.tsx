import { FormEvent, useEffect, useState } from "react";
import * as api from "../api/client";

export function RackRoutesPage() {
  const [papers, setPapers] = useState<api.Paper[]>([]);
  const [trucks, setTrucks] = useState<api.Truck[]>([]);
  const [dealers, setDealers] = useState<api.Dealer[]>([]);
  const [selectedPaperId, setSelectedPaperId] = useState("");
  const [routes, setRoutes] = useState<api.RackRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.fetchPapers(), api.fetchTrucks(), api.searchDealers("")])
      .then(([p, t, d]) => {
        setPapers(p);
        setTrucks(t);
        setDealers(d);
        if (p.length > 0) setSelectedPaperId(p[0].id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load data"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedPaperId) return;
    loadRoutes(selectedPaperId);
  }, [selectedPaperId]);

  async function loadRoutes(paperId: string) {
    try {
      const r = await api.fetchRackRoutes(paperId);
      setRoutes(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load rack routes");
    }
  }

  function refresh() {
    if (selectedPaperId) loadRoutes(selectedPaperId);
  }

  if (loading) return <p style={{ color: "var(--ink-soft)" }}>Loading…</p>;

  return (
    <div>
      <div className="page-header">
        <h1>Rack Routes</h1>
      </div>

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

      <NewRouteForm paperId={selectedPaperId} onCreated={refresh} onError={setError} />

      {routes.length === 0 ? (
        <div className="empty-state">No rack routes for this paper yet.</div>
      ) : (
        routes.map((route) => (
          <RackRouteCard
            key={route.id}
            route={route}
            trucks={trucks}
            dealers={dealers}
            onChanged={refresh}
            onError={setError}
          />
        ))
      )}
    </div>
  );
}

function NewRouteForm({
  paperId,
  onCreated,
  onError,
}: {
  paperId: string;
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!paperId) return;
    setSubmitting(true);
    try {
      await api.createRackRoute({ paperId, name });
      setName("");
      onCreated();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't create route");
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
      <div className="field" style={{ flex: 1 }}>
        <label>New route name</label>
        <input
          placeholder="e.g. Rack Route 3 - Downtown"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? "Creating…" : "Create route"}
      </button>
    </form>
  );
}

function RackRouteCard({
  route,
  trucks,
  dealers,
  onChanged,
  onError,
}: {
  route: api.RackRoute;
  trucks: api.Truck[];
  dealers: api.Dealer[];
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [savingTruck, setSavingTruck] = useState(false);
  const [addDealerId, setAddDealerId] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleTruckChange(truckId: string) {
    setSavingTruck(true);
    try {
      await api.assignTruckToRoute(route.id, truckId || null);
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't assign truck");
    } finally {
      setSavingTruck(false);
    }
  }

  async function handleAddStop(e: FormEvent) {
    e.preventDefault();
    if (!addDealerId) return;
    setAdding(true);
    try {
      const nextSequence = route.stops.length > 0 ? Math.max(...route.stops.map((s) => s.sequence)) + 10 : 10;
      await api.addRackRouteStop(route.id, { dealerId: addDealerId, sequence: nextSequence });
      setAddDealerId("");
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't add stop");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 24, maxWidth: 620 }}>
      <h3>{route.name}</h3>

      <div className="field" style={{ maxWidth: 280 }}>
        <label>Truck / driver</label>
        <select
          value={route.truckId ?? ""}
          disabled={savingTruck}
          onChange={(e) => handleTruckChange(e.target.value)}
        >
          <option value="">Unassigned</option>
          {trucks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.truckNumber} {t.driverName ? `- ${t.driverName}` : ""}
            </option>
          ))}
        </select>
      </div>

      <h4 style={{ marginTop: 20 }}>Stops</h4>
      {route.stops.length === 0 ? (
        <div className="empty-state">No stops yet.</div>
      ) : (
        <table style={{ marginBottom: 16 }}>
          <thead>
            <tr>
              <th>Seq</th>
              <th>Dealer</th>
              <th>Address</th>
            </tr>
          </thead>
          <tbody>
            {route.stops.map((stop) => (
              <tr key={stop.id}>
                <td className="tabular">{stop.sequence}</td>
                <td>{stop.dealer.name}</td>
                <td style={{ color: "var(--ink-soft)" }}>
                  {stop.dealer.addressLine1 ?? "—"}
                  {stop.dealer.city ? `, ${stop.dealer.city}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form onSubmit={handleAddStop} style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Add dealer stop</label>
          <select value={addDealerId} onChange={(e) => setAddDealerId(e.target.value)}>
            <option value="">Select a dealer…</option>
            {dealers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-secondary" type="submit" disabled={adding || !addDealerId}>
          {adding ? "Adding…" : "Add stop"}
        </button>
      </form>
    </div>
  );
}