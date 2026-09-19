import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { SubscribersPage } from "./pages/SubscribersPage";
import { SubscriberDetailPage } from "./pages/SubscriberDetailPage";
import { DeliveryRoutesPage } from "./pages/DeliveryRoutesPage";
import { ReportsPage } from "./pages/ReportsPage";
import { StaffPage } from "./pages/StaffPage";

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/subscribers" replace />} />
            <Route path="/subscribers" element={<SubscribersPage />} />
            <Route path="/subscribers/:id" element={<SubscriberDetailPage />} />
            <Route path="/delivery-routes" element={<DeliveryRoutesPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/staff" element={<StaffPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
