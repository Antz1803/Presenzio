import DashboardView from './MVVM/Views/DashboardShell'
import StudentPortalView from './MVVM/Views/StudentPortalView'
import LoginPage from './pages/LoginPage'
import ProtectedRoute from './auth/ProtectedRoute'
import { AuthProvider } from './auth/AuthContext'
import { useAuth } from './auth/useAuth'

function AuthLoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-300">
      <p className="text-sm font-medium">Restoring your session...</p>
    </main>
  )
}

function ApplicationRoutes() {
  const { loading, user } = useAuth()
  const normalizedPathname = window.location.pathname.replace(/\/+$/, "") || "/"
  const isStudentView =
    normalizedPathname === '/student' ||
    new URLSearchParams(window.location.search).get('view') === 'student'

  if (isStudentView) return <StudentPortalView />
  if (loading) return <AuthLoadingScreen />
  if (normalizedPathname === "/login") return user ? <DashboardView /> : <LoginPage />
  return (
    <ProtectedRoute>
      <DashboardView />
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ApplicationRoutes />
    </AuthProvider>
  )
}


