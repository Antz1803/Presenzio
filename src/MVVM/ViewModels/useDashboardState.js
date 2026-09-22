import { useRef, useState } from "react";
import { isSupabaseConfigured } from "../../lib/supabaseClient";
import { emptyStats } from "./dashboardConstants";

export function useDashboardState() {
  const [active, setActive] = useState("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [period, setPeriod] = useState("Prelim");
  const [category, setCategory] = useState("Quiz");
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState([]);
  const [gradeRows, setGradeRows] = useState([]);
  const [gradingPeriods, setGradingPeriods] = useState([]);
  const [assessmentScores, setAssessmentScores] = useState([]);
  const [assessmentDefinitions, setAssessmentDefinitions] = useState([]);
  const [studentGroups, setStudentGroups] = useState([]);
  const [assessmentAttempts, setAssessmentAttempts] = useState([]);
  const [assessmentAttemptGrants, setAssessmentAttemptGrants] = useState([]);
  const [assessmentViolations, setAssessmentViolations] = useState([]);
  const [attendanceSessions, setAttendanceSessions] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [sections, setSections] = useState([]);
  const [stats, setStats] = useState(emptyStats);
  const [section, setSection] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(
    isSupabaseConfigured ? "connecting" : "not-configured",
  );
  const [connectionMessage, setConnectionMessage] = useState(
    isSupabaseConfigured
      ? "Connecting to Supabase…"
      : "Configure Supabase to load records",
  );
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [importState, setImportState] = useState({
    status: "idle",
    message: "",
  });
  const [gradeSheetImportState, setGradeSheetImportState] = useState({
    status: "idle",
    message: "",
  });
  return {
    active,
    setActive,
    mobileNav,
    setMobileNav,
    period,
    setPeriod,
    category,
    setCategory,
    query,
    setQuery,
    students,
    setStudents,
    gradeRows,
    setGradeRows,
    gradingPeriods,
    setGradingPeriods,
    assessmentScores,
    setAssessmentScores,
    assessmentDefinitions,
    setAssessmentDefinitions,
    studentGroups,
    setStudentGroups,
    assessmentAttempts,
    setAssessmentAttempts,
    assessmentAttemptGrants,
    setAssessmentAttemptGrants,
    assessmentViolations,
    setAssessmentViolations,
    attendanceSessions,
    setAttendanceSessions,
    sessions,
    setSessions,
    sections,
    setSections,
    stats,
    setStats,
    section,
    setSection,
    connectionStatus,
    setConnectionStatus,
    connectionMessage,
    setConnectionMessage,
    pendingSyncCount,
    setPendingSyncCount,
    importState,
    setImportState,
    gradeSheetImportState,
    setGradeSheetImportState,
    loadRequestIdRef: useRef(0),
  };
}
