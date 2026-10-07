import { lazy, Suspense } from "react";
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

const DashboardView = lazy(() => import("./MVVM/Views/DashboardShell"));
const StudentPortalView = lazy(() => import("./MVVM/Views/StudentPortalView"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboardV2"));

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
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
          Loading…
        </div>
      }
    >
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
    </Suspense>
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
