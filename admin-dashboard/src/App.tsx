import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { SubscribersPage } from "./pages/SubscribersPage";
import { SubscriberDetailPage } from "./pages/SubscriberDetailPage";
import { DeliveryRoutesPage } from "./pages/DeliveryRoutesPage";
import { DealersPage } from "./pages/DealersPage";
import { DealerDetailPage } from "./pages/DealerDetailPage";
import { RackRoutesPage } from "./pages/RackRoutesPage";
import { TrucksPage } from "./pages/TrucksPage";
import { TruckDetailPage } from "./pages/TruckDetailPage";
import { PressRunsPage } from "./pages/PressRunsPage";import { ReturnsEntryPage } from "./pages/ReturnsEntryPage";
import { StatementPage } from "./pages/StatementPage";
import { BatchStatementsPage } from "./pages/BatchStatementsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { StaffPage } from "./pages/StaffPage";
import { ChangePasswordPage } from "./pages/ChangePasswordPage";

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
            <Route path="/dealers" element={<DealersPage />} />
            <Route path="/dealers/:id" element={<DealerDetailPage />} />
            <Route path="/rack-routes" element={<RackRoutesPage />} />
            <Route path="/trucks" element={<TrucksPage />} />
<Route path="/trucks/:id" element={<TruckDetailPage />} />
<Route path="/press-runs" element={<PressRunsPage />} /><Route path="/returns" element={<ReturnsEntryPage />} />
<Route path="/statements" element={<StatementPage />} />
<Route path="/statements/all" element={<BatchStatementsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/staff" element={<StaffPage />} />
            <Route path="/change-password" element={<ChangePasswordPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
