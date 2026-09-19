import { useEffect, useState } from "react";
import * as api from "../api/client";

export function DeliveryRoutesPage() {
  const [papers, setPapers] = useState<api.Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .fetchPapers()
      .then(setPapers)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load papers"))
      .finally(() => setLoading(false));
  }, []);

  async function handleExport(paper: api.Paper) {
    setExportingId(paper.id);
    setError(null);
    try {
      const csv = await api.exportRouteCsv(paper.id);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${paper.slug}-routes.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportingId(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Delivery Routes</h1>
      </div>

      <p style={{ color: "var(--ink-soft)", maxWidth: 560, marginBottom: 24 }}>
        Export a carrier route list for a paper, sorted by route and stop sequence, ready to hand
        to circulation staff.
      </p>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <p style={{ color: "var(--ink-soft)" }}>Loading…</p>
      ) : papers.length === 0 ? (
        <div className="empty-state">No papers configured yet.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Paper</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {papers.map((paper) => (
              <tr key={paper.id}>
                <td>{paper.name}</td>
                <td>
                  <button
                    className="btn btn-secondary"
                    disabled={exportingId === paper.id}
                    onClick={() => handleExport(paper)}
                  >
                    {exportingId === paper.id ? "Exporting…" : "Export route CSV"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
