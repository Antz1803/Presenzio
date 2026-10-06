import { Navigate } from "react-router-dom";
import { useAuth } from "./useAuth";

function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-300">
      <p className="text-sm font-medium">Restoring your session...</p>
    </main>
  );
}

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.isAdmin) {
    return <Navigate to="/admin" replace />;
  }
  return children;
}
