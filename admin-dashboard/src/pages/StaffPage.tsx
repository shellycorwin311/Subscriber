import { FormEvent, useState } from "react";
import { useAuth } from "../context/AuthContext";
import * as api from "../api/client";

export function StaffPage() {
  const { staff } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<api.StaffAccount["role"]>("CUSTOMER_SERVICE");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isAdmin = staff?.role === "ADMIN";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const created = await api.createStaffAccount({ email, password, role });
      setSuccess(`Created ${created.email} as ${created.role.replace("_", " ").toLowerCase()}.`);
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create that account");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Staff</h1>
      </div>

      {!isAdmin ? (
        <p style={{ color: "var(--ink-soft)" }}>
          Only admins can create new staff accounts. Ask an admin if you need one set up.
        </p>
      ) : (
        <form className="card" style={{ maxWidth: 420 }} onSubmit={handleSubmit}>
          <h3>Create a staff account</h3>

          {error && <div className="error-banner">{error}</div>}
          {success && (
            <div className="error-banner" style={{ background: "var(--status-active-bg)", color: "var(--status-active)" }}>
              {success}
            </div>
          )}

          <div className="field">
            <label htmlFor="staff-email">Email</label>
            <input
              id="staff-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="staff-password">Temporary password</label>
            <input
              id="staff-password"
              type="text"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="staff-role">Role</label>
            <select
              id="staff-role"
              value={role}
              onChange={(e) => setRole(e.target.value as api.StaffAccount["role"])}
            >
              <option value="CUSTOMER_SERVICE">Customer Service</option>
              <option value="CIRCULATION">Circulation</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create account"}
          </button>
        </form>
      )}
    </div>
  );
}
