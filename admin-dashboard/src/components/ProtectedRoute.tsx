import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { staff, loading } = useAuth();

  if (loading) return null; // avoid a login-page flash while checking the stored token
  if (!staff) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
