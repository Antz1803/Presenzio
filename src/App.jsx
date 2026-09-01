import DashboardView from './MVVM/Views/DashboardShell'
import StudentPortalView from './MVVM/Views/StudentPortalView'

export default function App() {
  const normalizedPathname = window.location.pathname.replace(/\/+$/, "") || "/"
  const isStudentView =
    normalizedPathname === '/student' ||
    new URLSearchParams(window.location.search).get('view') === 'student'

  return isStudentView ? <StudentPortalView /> : <DashboardView />
}


