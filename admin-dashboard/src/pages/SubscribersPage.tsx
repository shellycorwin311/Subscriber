import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../api/client";
import { StatusPill } from "../components/StatusPill";

export function SubscribersPage() {
  const [query, setQuery] = useState("");
  const [subscribers, setSubscribers] = useState<api.Subscriber[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    runSearch("");
  }, []);

  async function runSearch(q: string) {
    setLoading(true);
    setError(null);
    try {
      const results = await api.searchSubscribers(q);
      setSubscribers(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch(query);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Subscribers</h1>
      </div>

      <form onSubmit={handleSubmit} style={{ marginBottom: 24, display: "flex", gap: 8 }}>
        <input
          type="text"
          placeholder="Search by name, email, or phone"
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
      ) : subscribers.length === 0 ? (
        <div className="empty-state">No subscribers match that search.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Papers</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {subscribers.map((s) => (
              <tr
                key={s.id}
                className="clickable"
                onClick={() => navigate(`/subscribers/${s.id}`)}
              >
                <td>
                  {s.firstName} {s.lastName}
                </td>
                <td>{s.email}</td>
                <td>{s.subscriptions.map((sub) => sub.paper.name).join(", ") || "—"}</td>
                <td>
                  {s.subscriptions.length === 0 ? (
                    "—"
                  ) : (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {s.subscriptions.map((sub) => (
                        <StatusPill key={sub.id} status={sub.status} />
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
