import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import * as api from "../api/client";
import { StatusPill } from "../components/StatusPill";

export function SubscriberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [subscriber, setSubscriber] = useState<api.Subscriber | null>(null);
  const [payments, setPayments] = useState<api.Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingField, setSavingField] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    load(id);
  }, [id]);

  async function load(subscriberId: string) {
    setLoading(true);
    setError(null);
    try {
      const [sub, hist] = await Promise.all([
        api.fetchSubscriber(subscriberId),
        api.fetchPaymentHistory(subscriberId),
      ]);
      setSubscriber(sub);
      setPayments(hist);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this subscriber");
    } finally {
      setLoading(false);
    }
  }

  async function handleFieldSave(field: keyof api.Subscriber, value: string) {
    if (!subscriber) return;
    setSavingField(true);
    try {
      const updated = await api.updateSubscriber(subscriber.id, { [field]: value });
      setSubscriber(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't save that change");
    } finally {
      setSavingField(false);
    }
  }

  async function handleSubscriptionAction(
    subId: string,
    action: "pause" | "resume" | "cancel"
  ) {
    if (!subscriber) return;
    setActionError(null);
    try {
      const fn =
        action === "pause"
          ? api.pauseSubscription
          : action === "resume"
          ? api.resumeSubscription
          : api.cancelSubscription;
      const updated = await fn(subId);
      setSubscriber({
        ...subscriber,
        subscriptions: subscriber.subscriptions.map((s) => (s.id === subId ? updated : s)),
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Couldn't ${action} that subscription`);
    }
  }

  if (loading) return <p style={{ color: "var(--ink-soft)" }}>Loading…</p>;
  if (error) return <div className="error-banner">{error}</div>;
  if (!subscriber) return null;

  return (
    <div>
      <Link to="/subscribers" style={{ fontSize: 13 }}>
        ← Back to subscribers
      </Link>

      <div className="page-header" style={{ marginTop: 12 }}>
        <h1>
          {subscriber.firstName} {subscriber.lastName}
        </h1>
      </div>

      {actionError && <div className="error-banner">{actionError}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
        <div className="card">
          <h3>Contact & billing</h3>
          <EditableField
            label="Email"
            value={subscriber.email}
            onSave={(v) => handleFieldSave("email", v)}
            disabled={savingField}
          />
          <EditableField
            label="Phone"
            value={subscriber.phone ?? ""}
            onSave={(v) => handleFieldSave("phone", v)}
            disabled={savingField}
          />
        </div>

        <div className="card">
          <h3>Delivery address</h3>
          <EditableField
            label="Address"
            value={subscriber.deliveryAddressLine1 ?? ""}
            onSave={(v) => handleFieldSave("deliveryAddressLine1", v)}
            disabled={savingField}
          />
          <EditableField
            label="City"
            value={subscriber.deliveryCity ?? ""}
            onSave={(v) => handleFieldSave("deliveryCity", v)}
            disabled={savingField}
          />
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <EditableField
                label="State"
                value={subscriber.deliveryState ?? ""}
                onSave={(v) => handleFieldSave("deliveryState", v)}
                disabled={savingField}
              />
            </div>
            <div style={{ flex: 1 }}>
              <EditableField
                label="Zip"
                value={subscriber.deliveryZip ?? ""}
                onSave={(v) => handleFieldSave("deliveryZip", v)}
                disabled={savingField}
              />
            </div>
          </div>
        </div>
      </div>

      <h2>Subscriptions</h2>
      {subscriber.subscriptions.length === 0 ? (
        <div className="empty-state">No subscriptions on this account.</div>
      ) : (
        <table style={{ marginBottom: 32 }}>
          <thead>
            <tr>
              <th>Paper</th>
              <th>Type</th>
              <th>Tier</th>
              <th>Status</th>
              <th>Renews</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {subscriber.subscriptions.map((sub) => (
              <tr key={sub.id}>
                <td>{sub.paper.name}</td>
                <td>{formatType(sub.type)}</td>
                <td>{sub.tier}</td>
                <td>
                  <StatusPill status={sub.status} />
                </td>
                <td className="tabular">{new Date(sub.renewalDate).toLocaleDateString()}</td>
                <td>
                  <div style={{ display: "flex", gap: 8 }}>
                    {sub.status === "ACTIVE" && (
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleSubscriptionAction(sub.id, "pause")}
                      >
                        Pause
                      </button>
                    )}
                    {sub.status === "PAUSED" && (
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleSubscriptionAction(sub.id, "resume")}
                      >
                        Resume
                      </button>
                    )}
                    {sub.status !== "CANCELED" && (
                      <button
                        className="btn btn-danger"
                        onClick={() => handleSubscriptionAction(sub.id, "cancel")}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Billing history</h2>
      {payments.length === 0 ? (
        <div className="empty-state">No payments recorded yet.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="tabular">
                  {new Date(p.processedAt ?? p.createdAt).toLocaleDateString()}
                </td>
                <td className="tabular">${(p.amountCents / 100).toFixed(2)}</td>
                <td>
                  <StatusPill status={p.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function formatType(type: string) {
  return type === "PRINT_DIGITAL" ? "Print + Digital" : type.charAt(0) + type.slice(1).toLowerCase();
}

function EditableField({
  label,
  value,
  onSave,
  disabled,
}: {
  label: string;
  value: string;
  onSave: (value: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);

  useEffect(() => setDraft(value), [value]);

  function commit() {
    setEditing(false);
    if (draft !== value) onSave(draft);
  }

  return (
    <div className="field">
      <label>{label}</label>
      <input
        value={draft}
        disabled={disabled}
        onFocus={() => setEditing(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        style={editing ? { borderColor: "var(--accent)" } : undefined}
      />
    </div>
  );
}
