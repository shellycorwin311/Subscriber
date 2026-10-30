import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import * as api from "../api/client";
import { StatusPill } from "../components/StatusPill";

interface EditableFields {
  email: string;
  phone: string;
  deliveryAddressLine1: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryZip: string;
}

function fieldsFromSubscriber(sub: api.Subscriber): EditableFields {
  return {
    email: sub.email,
    phone: sub.phone ?? "",
    deliveryAddressLine1: sub.deliveryAddressLine1 ?? "",
    deliveryCity: sub.deliveryCity ?? "",
    deliveryState: sub.deliveryState ?? "",
    deliveryZip: sub.deliveryZip ?? "",
  };
}

export function SubscriberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [subscriber, setSubscriber] = useState<api.Subscriber | null>(null);
  const [payments, setPayments] = useState<api.Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [fields, setFields] = useState<EditableFields | null>(null);
  const [savedFields, setSavedFields] = useState<EditableFields | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

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
      const initial = fieldsFromSubscriber(sub);
      setFields(initial);
      setSavedFields(initial);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this subscriber");
    } finally {
      setLoading(false);
    }
  }

  const isDirty =
    fields !== null && savedFields !== null && JSON.stringify(fields) !== JSON.stringify(savedFields);

  function updateField(key: keyof EditableFields, value: string) {
    setSaveSuccess(false);
    setFields((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSave() {
    if (!subscriber || !fields) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const updated = await api.updateSubscriber(subscriber.id, fields);
      setSubscriber(updated);
      const newFields = fieldsFromSubscriber(updated);
      setFields(newFields);
      setSavedFields(newFields);
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't save these changes");
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    if (savedFields) setFields(savedFields);
    setSaveError(null);
    setSaveSuccess(false);
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
  if (!subscriber || !fields) return null;

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
      {saveError && <div className="error-banner">{saveError}</div>}
      {saveSuccess && (
        <div
          className="error-banner"
          style={{ background: "var(--status-active-bg)", color: "var(--status-active)" }}
        >
          Changes saved.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 16 }}>
        <div className="card">
          <h3>Contact & billing</h3>
          <div className="field">
            <label htmlFor="field-email">Email</label>
            <input
              id="field-email"
              value={fields.email}
              disabled={saving}
              onChange={(e) => updateField("email", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="field-phone">Phone</label>
            <input
              id="field-phone"
              value={fields.phone}
              disabled={saving}
              onChange={(e) => updateField("phone", e.target.value)}
            />
          </div>
        </div>

        <div className="card">
          <h3>Delivery address</h3>
          <div className="field">
            <label htmlFor="field-address">Address</label>
            <input
              id="field-address"
              value={fields.deliveryAddressLine1}
              disabled={saving}
              onChange={(e) => updateField("deliveryAddressLine1", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="field-city">City</label>
            <input
              id="field-city"
              value={fields.deliveryCity}
              disabled={saving}
              onChange={(e) => updateField("deliveryCity", e.target.value)}
            />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }} className="field">
              <label htmlFor="field-state">State</label>
              <input
                id="field-state"
                value={fields.deliveryState}
                disabled={saving}
                onChange={(e) => updateField("deliveryState", e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }} className="field">
              <label htmlFor="field-zip">Zip</label>
              <input
                id="field-zip"
                value={fields.deliveryZip}
                disabled={saving}
                onChange={(e) => updateField("deliveryZip", e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
        <button className="btn btn-primary" disabled={!isDirty || saving} onClick={handleSave}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        {isDirty && !saving && (
          <button className="btn btn-secondary" onClick={handleDiscard}>
            Discard changes
          </button>
        )}
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
