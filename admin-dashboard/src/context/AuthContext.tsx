import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import * as api from "../api/client";

interface AuthContextValue {
  staff: api.StaffAccount | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<api.StaffAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!api.getToken()) {
      setLoading(false);
      return;
    }
    api
      .fetchMe()
      .then(setStaff)
      .catch(() => {
        // Stored token is invalid/expired - clear it so the login page shows.
        localStorage.removeItem("staffToken");
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const { token, staff: staffAccount } = await api.login(email, password);
    localStorage.setItem("staffToken", token);
    setStaff(staffAccount);
  }

  function logout() {
    localStorage.removeItem("staffToken");
    setStaff(null);
  }

  return (
    <AuthContext.Provider value={{ staff, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
