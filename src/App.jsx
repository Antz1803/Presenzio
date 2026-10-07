import DashboardView from "./MVVM/Views/DashboardShell";
import StudentPortalView from "./MVVM/Views/StudentPortalView";
import LoginPage from "./pages/LoginPage";
import AdminDashboard from "./pages/AdminDashboardV2";
import ProtectedRoute from "./auth/ProtectedRoute";
import AdminRoute from "./auth/AdminRoute";
import { AuthProvider } from "./auth/AuthContext";
import { BrandingProvider } from "./lib/branding";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

function LegacyRootRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  if (params.get("view") === "student") {
    params.delete("view");
    const query = params.toString();
    return <Navigate to={`/student${query ? `?${query}` : ""}`} replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

function ApplicationRoutes() {
  return (
    <Routes>
      <Route path="/student/:sectionSlug" element={<StudentPortalView />} />
      <Route path="/student" element={<StudentPortalView />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        }
      />
      <Route
        path="/dashboard/:section"
        element={
          <ProtectedRoute>
            <DashboardView />
          </ProtectedRoute>
        }
      />
      <Route path="/dashboard" element={<Navigate to="/dashboard/overview" replace />} />
      <Route path="/" element={<LegacyRootRedirect />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrandingProvider>
        <BrowserRouter>
          <ApplicationRoutes />
        </BrowserRouter>
      </BrandingProvider>
    </AuthProvider>
  );
}
