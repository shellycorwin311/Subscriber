import { NavLink, Outlet, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { to: "/subscribers", label: "Subscribers" },
  { to: "/delivery-routes", label: "Delivery Routes" },
  { to: "/dealers", label: "Dealers" },
  { to: "/rack-routes", label: "Rack Routes" },
  { to: "/trucks", label: "Trucks" },
  { to: "/press-runs", label: "Press Runs" },
  { to: "/returns", label: "Returns Entry" },
  { to: "/statements", label: "Statements" },
  { to: "/statements/all", label: "All Statements" },
  { to: "/reports", label: "Reports" },
  { to: "/staff", label: "Staff" },
];

export function Layout() {
  const { staff, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">Subscriber Hub</div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div>{staff?.email}</div>
          <Link
            to="/change-password"
            style={{ color: "inherit", fontSize: 13, textDecoration: "underline", display: "block", marginTop: 8 }}
          >
            Change password
          </Link>
          <button
            className="btn"
            style={{
              color: "inherit",
              background: "none",
              border: "none",
              padding: 0,
              marginTop: 8,
              cursor: "pointer",
              fontSize: 13,
              textDecoration: "underline",
            }}
            onClick={logout}
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
