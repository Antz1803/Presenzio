import { Navigate } from "react-router-dom";
import { useAuth } from "./useAuth";

function AdminLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-300">
      <p className="text-sm font-medium">Checking administrator access...</p>
    </main>
  );
}

export default function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <AdminLoading />;
  if (!user) return <Navigate to="/login?from=/admin" replace />;
  if (!user.isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}
