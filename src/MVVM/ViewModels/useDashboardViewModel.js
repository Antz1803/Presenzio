import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/useAuth";
import { useDashboardActions } from "./useDashboardActions";
import {
  countOfflineMutations,
  enqueueOfflineMutation,
  readOfflineSnapshot,
  writeOfflineSnapshot,
} from "../../lib/offlineStore";

const emptyStats = {
  totalStudents: 0,
  male: 0,
  female: 0,
  todayAttendance: "—",
  todayPresent: 0,
  todayAbsent: 0,
  classAverage: "—",
  needsAttention: 0,
  monthAttendance: "—",
  attendanceBars: [0, 0, 0, 0, 0, 0, 0],
  totalPresent: 0,
  totalAbsent: 0,
  totalLate: 0,
  sessionsHeld: 0,
  sessionsThisWeek: 0,
  mostConsistent: "—",
  excellentCount: 0,
  goodCount: 0,
  needsReviewCount: 0,
  passingRate: "—",
};

// These are the weights and transmutation breakpoints used by the uploaded
// grading workbook. The workbook uses VLOOKUP's approximate-match behavior,
// so each breakpoint applies until the next breakpoint is reached.
const gradingWeights = {
  quiz: 0.2,
  assignment: 0.1,
  activity: 0.3,
  // The workbook has a sixth spacer component (AD/AE) with a blank/zero
  // weight. Keep it in the model so the calculation mirrors the sheet's
  // six-term SUM(PRODUCT(...)) expression without affecting the result.
  spacer: 0,
  attendance: 0.05,
  exam: 0.35,
};

const assessmentItemLimits = {
  quiz: 4,
  assignment: 4,
  activity: 4,
  exam: 1,
};

const transmutationBreakpoints = [
  [0, 5],
  [1, 4],
  [6, 3.9],
  [12, 3.8],
  [18, 3.7],
  [24, 3.6],
  [30, 3.5],
  [36, 3.4],
  [42, 3.3],
  [48, 3.2],
  [54, 3.1],
  [60, 3],
  [62, 2.9],
  [64, 2.8],
  [66, 2.7],
  [68, 2.6],
  [70, 2.5],
  [72, 2.4],
  [74, 2.3],
  [76, 2.2],
  [78, 2.1],
  [80, 2],
  [82, 1.9],
  [84, 1.8],
  [86, 1.7],
  [88, 1.6],
  [90, 1.5],
  [92, 1.4],
  [94, 1.3],
  [96, 1.2],
  [98, 1.1],
  [100, 1],
];

function transmutePercentage(value) {
  if (!Number.isFinite(Number(value))) return null;
  // Match Excel's approximate VLOOKUP against the transmutation table.
  const percentage = Math.max(0, Math.min(100, Number(value)));
  let gradePoint = transmutationBreakpoints[0][1];
  transmutationBreakpoints.forEach(([breakpoint, grade]) => {
    if (percentage >= breakpoint) gradePoint = grade;
  });
  return gradePoint;
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value + "T00:00:00"));
}
function formatDay(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
    new Date(value + "T00:00:00"),
  );
}
function formatShortDate(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).split("-");
  return `${month}-${day}-${String(year).slice(-2)}`;
}
function resolvePeriodCodeForSession({ sessionDate, periodId, periods }) {
  const dateMatch = (periods ?? [])
    .filter((periodItem) => periodItem.start_date && periodItem.end_date)
    .sort((first, second) => first.sort_order - second.sort_order)
    .find(
      (periodItem) =>
        sessionDate >= periodItem.start_date && sessionDate <= periodItem.end_date,
    );
  if (dateMatch) return dateMatch.code;
  return (periods ?? []).find((periodItem) => periodItem.id === periodId)?.code ?? "";
}
function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  return valid.length
    ? valid.reduce((sum, value) => sum + value, 0) / valid.length
    : 0;
}
function toGradeRows(roster) {
  return roster.map((student) => ({
    student: student.name,
    initials: student.initials,
    color: student.color,
    q1: "",
    q2: "",
    q3: "",
    q4: "",
    average: Number(student.grade ?? 0),
  }));
}

function createAssessmentAccessKey() {
  const randomPart = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `ASM-${randomPart.replaceAll("-", "").slice(0, 10).toUpperCase()}`;
}

function browserIsOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function createLocalId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.random() * 16 | 0;
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function isNetworkError(error) {
  return browserIsOffline(error) || error?.status === 0 || error?.name === "TypeError";
}

async function callLanApi(path, options = {}) {
  let response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    response = await fetch(path, {
      ...options,
      signal: options.signal ?? controller.signal,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return null;
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error || "LAN service request failed.");
    error.lanApi = true;
    error.status = response.status;
    throw error;
  }
  return body;
}

function assessmentScoreKey(row) {
  return [
    row.section_id,
    row.period_id,
    row.enrollment_id,
    row.category,
    row.item_no,
  ].join(":");
}

function mergeAssessmentScores(remoteRows = [], lanRows = []) {
  const rows = new Map(remoteRows.map((row) => [assessmentScoreKey(row), row]));
  lanRows.forEach((row) => rows.set(assessmentScoreKey(row), row));
  return [...rows.values()];
}

function normalizeSubmittedAnswer(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function serializeAssessmentDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function answerSimilarity(firstValue, secondValue) {
  const first = normalizeSubmittedAnswer(firstValue);
  const second = normalizeSubmittedAnswer(secondValue);
  if (!first || !second) return 0;
  if (first === second) return 1;
  const maxLength = Math.max(first.length, second.length);
  if (maxLength > 2000) return 0;
  let previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
    const current = [firstIndex];
    for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
      current[secondIndex] = Math.min(
        current[secondIndex - 1] + 1,
        previous[secondIndex] + 1,
        previous[secondIndex - 1] + (first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return 1 - previous[second.length] / maxLength;
}

export function useDashboardViewModel({ accountScoped = true } = {}) {
  const { user } = useAuth();
  const accountId = user?.id ?? null;
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
  const currentSectionId = section?.id;

  // Every call to loadLiveData/loadOfflineData is tagged with a
  // monotonically increasing request id. Supabase realtime subscriptions
  // (below) call loadLiveData on every relevant table change, and a single
  // grade-sheet import performs many sequential writes (per-period score
  // cleanup, a bulk score upsert, per-session attendance upserts, and a
  // period_grades recompute per grading period). Each of those writes fires
  // its own postgres_changes event, so several *independent* loadLiveData
  // calls can be in flight at once, and — because network timing is not
  // guaranteed to match call order — an older call (kicked off by an early,
  // partial write) can resolve *after* a newer call that already reflects
  // every write the import made. Without a guard, that stale response
  // clobbers the fresh one and the UI keeps showing pre-edit values even
  // though the database was updated correctly. Only the result of the most
  // recently *started* call is committed to state; anything older is
  // discarded (its resolved data is still returned to its own caller, so
  // callers that `await loadLiveData(...)` directly — like the importers —
  // always get correct data regardless of this guard).
  const loadRequestIdRef = useRef(0);

  const filteredStudents = useMemo(
  () =>
    students
      .filter((student) =>
        student.name.toLowerCase().includes(query.toLowerCase()),
      )
      .sort((first, second) =>
        first.name.localeCompare(second.name, undefined, {
          sensitivity: "base",
        }),
      ),
  [query, students],
);

  const clearLiveData = useCallback(() => {
    setSection(null);
    setSections([]);
    setStudents([]);
    setGradeRows([]);
    setGradingPeriods([]);
    setAssessmentScores([]);
    setAssessmentDefinitions([]);
    setAssessmentAttempts([]);
    setAssessmentAttemptGrants([]);
    setAssessmentViolations([]);
    setAttendanceSessions([]);
    setSessions([]);
    setStats(emptyStats);
  }, []);

  const applyOfflineSnapshot = useCallback((snapshot, sectionList = []) => {
    if (!snapshot) return false;
    setSection(snapshot.section ?? null);
    setSections(sectionList.length ? sectionList : snapshot.sections ?? []);
    setStudents(snapshot.students ?? []);
    setGradeRows(snapshot.gradeRows ?? []);
    setGradingPeriods(snapshot.gradingPeriods ?? []);
    setAssessmentScores(snapshot.assessmentScores ?? []);
    setAssessmentDefinitions(snapshot.assessmentDefinitions ?? []);
    setAssessmentAttempts(snapshot.assessmentAttempts ?? []);
    setAssessmentAttemptGrants(snapshot.assessmentAttemptGrants ?? []);
    setAssessmentViolations(snapshot.assessmentViolations ?? []);
    setAttendanceSessions(snapshot.attendanceSessions ?? []);
    setSessions(snapshot.sessions ?? []);
    setStats(snapshot.stats ?? emptyStats);
    return true;
  }, []);

  const loadOfflineData = useCallback(async (preferredSectionId, requestId) => {
    const sectionList = (await readOfflineSnapshot("sections")) ?? [];
    const selectedSectionId =
      sectionList.find((item) => item.id === preferredSectionId)?.id ??
      sectionList[0]?.id;
    const snapshot = selectedSectionId
      ? await readOfflineSnapshot(`section:${selectedSectionId}`)
      : null;
    if (requestId != null && loadRequestIdRef.current !== requestId) return snapshot;
    if (!applyOfflineSnapshot(snapshot, sectionList)) {
      clearLiveData();
      setSections(sectionList);
    }
    if (selectedSectionId) {
      const lanScores = await callLanApi(
        `/api/submissions?sectionId=${encodeURIComponent(selectedSectionId)}`,
      );
      if (lanScores?.scores?.length && loadRequestIdRef.current === requestId) {
        setAssessmentScores((current) =>
          mergeAssessmentScores(current, lanScores.scores),
        );
      }
    }
    if (requestId == null || loadRequestIdRef.current === requestId) {
      setConnectionStatus("offline");
      setConnectionMessage(
        snapshot ? "Offline · saved locally" : "Offline · no cached class data",
      );
      setPendingSyncCount(await countOfflineMutations());
    }
    return snapshot;
  }, [applyOfflineSnapshot, clearLiveData]);

  const loadLiveData = useCallback(async (preferredSectionId) => {
    const requestId = ++loadRequestIdRef.current;
    const isStale = () => loadRequestIdRef.current !== requestId;

    if (accountScoped && !accountId) {
      if (!isStale()) {
        clearLiveData();
        setConnectionStatus("connecting");
        setConnectionMessage("Waiting for the account session");
      }
      return null;
    }

    if (browserIsOffline()) {
      return loadOfflineData(preferredSectionId, requestId);
    }
    if (!supabase) {
      if (!isStale()) {
        setConnectionStatus("not-configured");
        setConnectionMessage("Configure Supabase to load records");
      }
      return loadOfflineData(preferredSectionId, requestId);
    }
    if (!isStale()) setConnectionStatus("connecting");
    try {
      let sectionQuery = supabase.from("sections").select("*");
      if (accountScoped) sectionQuery = sectionQuery.eq("teacher_id", accountId);
      const { data: sectionList, error: sectionListError } = await sectionQuery.order("id", { ascending: false });
      if (sectionListError) throw sectionListError;
      const sectionData =
        sectionList?.find((item) => item.id === preferredSectionId) ??
        sectionList?.[0];
      if (!sectionData) {
        if (!isStale()) {
          clearLiveData();
          setConnectionStatus("live");
          setConnectionMessage("Live · Supabase");
        }
        return;
      }

      const { data: enrollments, error: enrollmentError } = await supabase
        .from("enrollments")
        .select(
          "id, ctrl_no, status, student:students(id, full_name, gender, student_no, course, year_level, contact_no, email, photo_url)",
        )
        .eq("section_id", sectionData.id)
        .order("ctrl_no");
      if (enrollmentError) throw enrollmentError;

      // Every student saved in the database, independent of which section is
      // currently selected. Used to power the "Total students" stat card so
      // it reflects the whole roster rather than just the active class.
      const sectionIds = (sectionList ?? []).map((item) => item.id);
      const { data: allEnrollmentRows, error: allStudentsError } = sectionIds.length
        ? await supabase
            .from("enrollments")
            .select("section_id, student:students(id, gender)")
            .in("section_id", sectionIds)
        : { data: [], error: null };
      if (allStudentsError) throw allStudentsError;
      const allStudentsData = (allEnrollmentRows ?? [])
        .map((row) => row.student)
        .filter(Boolean)
        .filter((student, index, rows) => rows.findIndex((item) => item.id === student.id) === index);

      let { data: periods, error: periodError } = await supabase
        .from("grading_periods")
        .select("id, code, sort_order, start_date, end_date")
        .order("sort_order");
      if (periodError) {
        // Keep existing classes visible until the date columns are added to
        // an existing Supabase project through the schema migration.
        const fallbackPeriods = await supabase
          .from("grading_periods")
          .select("id, code, sort_order")
          .order("sort_order");
        if (fallbackPeriods.error) throw periodError;
        periods = fallbackPeriods.data ?? [];
      }

      const { data: periodGrades, error: gradeError } = await supabase
        .from("period_grades")
        .select(
          "enrollment_id, own_period_grade, cumulative_grade, period:grading_periods(code)",
        )
        .eq("section_id", sectionData.id);
      if (gradeError) throw gradeError;

      const { data: assessmentScoreData, error: assessmentScoreError } =
        await supabase
          .from("assessment_scores")
          .select(
            "period_id, enrollment_id, category, item_no, score, max_score, recorded_at, period:grading_periods(code)",
          )
          .eq("section_id", sectionData.id);
      if (assessmentScoreError) throw assessmentScoreError;

      const lanScores = await callLanApi(
        `/api/submissions?sectionId=${encodeURIComponent(sectionData.id)}`,
      );
      const combinedAssessmentScoreData = mergeAssessmentScores(
        assessmentScoreData ?? [],
        lanScores?.scores ?? [],
      );

      // Assessment authoring is optional for existing projects. If the new
      // tables have not been migrated yet, keep the class dashboard usable.
      let { data: assessmentData, error: assessmentDataError } = await supabase
        .from("assessments")
        .select(
          "id, section_id, period_id, category, item_no, access_key, title, instructions, time_limit_minutes, available_from, available_until, created_at, period:grading_periods(code), section:sections(id, subject_code, subject_title), questions:assessment_questions(id, question_no, question_type, prompt, points, choices, correct_answer, language, starter_code, expected_output)",
        )
        .eq("section_id", sectionData.id)
        .order("created_at", { ascending: false });
      if (assessmentDataError) {
        const fallbackAssessments = await supabase
          .from("assessments")
          .select(
            "id, section_id, period_id, category, item_no, access_key, title, instructions, created_at, period:grading_periods(code), section:sections(id, subject_code, subject_title), questions:assessment_questions(id, question_no, question_type, prompt, points, choices, correct_answer, language, starter_code, expected_output)",
          )
          .eq("section_id", sectionData.id)
          .order("created_at", { ascending: false });
        if (!fallbackAssessments.error) {
          assessmentData = (fallbackAssessments.data ?? []).map((assessment) => ({
            ...assessment,
            time_limit_minutes: null,
            available_from: null,
            available_until: null,
          }));
          assessmentDataError = null;
        }
      }
      const assessmentRows = assessmentDataError ? [] : assessmentData ?? [];
      const assessmentIds = assessmentRows.map((assessment) => assessment.id);
      const lanManagement = await callLanApi(
        `/api/assessment-management?sectionId=${encodeURIComponent(sectionData.id)}`,
      );
      let attemptRows = [];
      let grantRows = [];
      let violationRows = [];
      if (assessmentIds.length) {
        const [attemptResult, grantResult, violationResult] = await Promise.all([
          supabase
            .from("assessment_attempts")
            .select("id, assessment_id, student_id, attempt_no, score, max_score, status, submitted_at")
            .in("assessment_id", assessmentIds),
          supabase
            .from("assessment_attempt_grants")
            .select("id, assessment_id, student_id, extra_attempts, granted_at")
            .in("assessment_id", assessmentIds),
          supabase
            .from("assessment_violations")
            .select("id, assessment_id, student_id, attempt_no, violation_type, details, occurred_at")
            .in("assessment_id", assessmentIds)
            .order("occurred_at", { ascending: false }),
        ]);
        attemptRows = attemptResult.error ? [] : attemptResult.data ?? [];
        grantRows = grantResult.error ? [] : grantResult.data ?? [];
        violationRows = violationResult.error ? [] : violationResult.data ?? [];
      }
      const mergeById = (remoteRows, lanRows) => [
        ...new Map([...remoteRows, ...lanRows].filter((row) => row?.id).map((row) => [row.id, row])).values(),
      ];
      attemptRows = mergeById(attemptRows, lanManagement?.attempts ?? []);
      grantRows = mergeById(grantRows, lanManagement?.attemptGrants ?? []);
      violationRows = mergeById(violationRows, lanManagement?.violations ?? []);
      const liveAssessmentDefinitions = assessmentRows.map((assessment) => ({
        ...assessment,
        attempts: attemptRows.filter((attempt) => attempt.assessment_id === assessment.id),
        attemptGrants: grantRows.filter((grant) => grant.assessment_id === assessment.id),
        violations: violationRows.filter((violation) => violation.assessment_id === assessment.id),
      }));

      const { data: classSessions, error: sessionError } = await supabase
        .from("class_sessions")
        .select(
          "id, period_id, session_date, session_time, attendance_records(enrollment_id, status)",
        )
        .eq("section_id", sectionData.id)
        .order("session_date", { ascending: false })
        ;
      if (sessionError) throw sessionError;

      const sessionsData = classSessions ?? [];
      const gradeData = periodGrades ?? [];
      const gradePeriodCodes = ["prelim", "midterm", "semifinal", "final"];
      const gradeByEnrollment = new Map();
      const gradeDetailsByEnrollment = new Map();
      gradeData.forEach((item) => {
        const periodCode =
          item.period?.code ??
          periods?.find((periodItem) => periodItem.id === item.period_id)?.code;
        if (!gradePeriodCodes.includes(periodCode)) return;

        const grades = gradeByEnrollment.get(item.enrollment_id) ?? {};
        const rawGrade =
          periodCode === "prelim"
            ? item.own_period_grade
            : item.cumulative_grade;
        // The Final sheet keeps the raw cumulative grade in AN, but the
        // displayed grade in AO/Summary uses the template's 3.05 cap rule.
        const displayGrade =
          periodCode === "final" && rawGrade != null && Number(rawGrade) > 3.05
            ? 5
            : rawGrade;
        const grade = Number(displayGrade);
        if (displayGrade != null && Number.isFinite(grade)) {
          grades[periodCode] = grade;
        }
        gradeByEnrollment.set(item.enrollment_id, grades);
        const details = gradeDetailsByEnrollment.get(item.enrollment_id) ?? {};
        details[periodCode] = {
          own: item.own_period_grade,
          cumulative: item.cumulative_grade,
        };
        gradeDetailsByEnrollment.set(item.enrollment_id, details);
      });
      const attendanceByEnrollment = new Map();

      sessionsData.forEach((session) =>
        session.attendance_records?.forEach((record) => {
          const current = attendanceByEnrollment.get(record.enrollment_id) ?? {
            attended: 0,
          };
          if (record.status === "present" || record.status === "late")
            current.attended += 1;
          attendanceByEnrollment.set(record.enrollment_id, current);
        }),
      );

      const liveRoster = (enrollments ?? []).map((enrollment, enrollmentIndex) => {
        const student = enrollment.student;
        const attendance = attendanceByEnrollment.get(enrollment.id);
        const attendanceRate = sessionsData.length
          ? Math.round(
              ((attendance?.attended ?? 0) / sessionsData.length) * 100,
            )
          : 0;
        const fullName = student?.full_name ?? "Unnamed student";
        const grades = gradeByEnrollment.get(enrollment.id) ?? {};
        const gradeDetails = gradeDetailsByEnrollment.get(enrollment.id) ?? {};
        return {
          id: enrollment.id,
          studentId: student?.id,
          ctrlNo: enrollment.ctrl_no ?? enrollmentIndex + 1,
          name: fullName,
          initials: fullName
            .split(" ")
            .map((part) => part[0])
            .slice(0, 2)
            .join("")
            .toUpperCase(),
          color:
            ["plum", "blue", "peach", "green", "yellow", "lavender"][
              (enrollment.ctrl_no ?? 0) % 6
            ] ?? "plum",
          number: student?.student_no ?? "CTRL-" + (enrollment.ctrl_no ?? "—"),
          gender: student?.gender ?? "—",
          course: student?.course ?? "",
          yearLevel: student?.year_level ?? "",
          contactNo: student?.contact_no ?? "",
          email: student?.email ?? "",
          photoUrl: student?.photo_url ?? "",
          attendance: attendanceRate,
          grades,
          gradeDetails,
          grade: grades.prelim ?? 0,
          status:
            enrollment.status === "active"
              ? attendanceRate < 80
                ? "At risk"
                : "On track"
              : enrollment.status.toUpperCase(),
        };
      });

      // Total headcount and gender breakdown reflect every student saved in
      // the database, not just those enrolled in the currently selected
      // class/section. Falls back to the current roster if the students
      // table can't be read for some reason.
      const totalStudentsCount = allStudentsData?.length ?? liveRoster.length;
      const male = allStudentsData
        ? allStudentsData.filter((student) => student.gender === "M").length
        : liveRoster.filter((student) => student.gender === "M").length;
      const female = allStudentsData
        ? allStudentsData.filter((student) => student.gender === "F").length
        : liveRoster.filter((student) => student.gender === "F").length;
      const todayRecords = sessionsData[0]?.attendance_records ?? [];
      const todayPresent = todayRecords.filter(
        (record) => record.status === "present" || record.status === "late",
      ).length;
      const allRecords = sessionsData.flatMap(
        (session) => session.attendance_records ?? [],
      );
      const totalPresent = allRecords.filter(
        (record) => record.status === "present",
      ).length;
      const totalLate = allRecords.filter(
        (record) => record.status === "late",
      ).length;
      const totalAbsent = Math.max(
        liveRoster.length * sessionsData.length - allRecords.length,
        0,
      );
      const classAverage = average(
        liveRoster.map((student) => student.grade).filter((grade) => grade > 0),
      );
      const gradedStudents = liveRoster.filter((student) => student.grade > 0);
      const attendanceRates = sessionsData.slice(0, 7).map((session) => {
        const records = session.attendance_records ?? [];
        return records.length && liveRoster.length
          ? Math.round(
              (records.filter(
                (record) =>
                  record.status === "present" || record.status === "late",
              ).length /
                liveRoster.length) *
                100,
            )
          : 0;
      });
      const currentWeek = new Date();
      const sessionsThisWeek = sessionsData.filter((session) => {
        const date = new Date(session.session_date + "T00:00:00");
        return (currentWeek - date) / 86400000 < 7;
      }).length;
      const mostConsistent =
        [...liveRoster].sort((a, b) => b.attendance - a.attendance)[0]?.name ??
        "—";

      const liveAttendanceSessions = [...sessionsData]
        .sort((first, second) => first.session_date.localeCompare(second.session_date))
        .map((session) => ({
          id: session.id,
          date: formatShortDate(session.session_date),
          sessionDate: session.session_date,
          sessionTime: session.session_time,
          periodCode: resolvePeriodCodeForSession({
            sessionDate: session.session_date,
            periodId: session.period_id,
            periods: periods ?? [],
          }),
          statuses: Object.fromEntries(
            (session.attendance_records ?? []).map((record) => [
              record.enrollment_id,
              record.status,
            ]),
          ),
        }));

      const liveSessions = sessionsData.map((session) => {
        const records = session.attendance_records ?? [];
        const present = records.filter(
          (record) => record.status === "present",
        ).length;
        const absent = Math.max(liveRoster.length - records.length, 0);
        const late = records.filter(
          (record) => record.status === "late",
        ).length;
        const rate = liveRoster.length
          ? ((present + late) / liveRoster.length) * 100
          : 0;
        return [
          formatDate(session.session_date),
          formatDay(session.session_date),
          String(present),
          String(absent),
          String(late),
          rate.toFixed(1) + "%",
        ];
      });

      const liveStats = {
        totalStudents: totalStudentsCount,
        male,
        female,
        todayAttendance: liveRoster.length
          ? ((todayPresent / liveRoster.length) * 100).toFixed(1) + "%"
          : "—",
        todayPresent,
        todayAbsent: Math.max(liveRoster.length - todayPresent, 0),
        classAverage: classAverage ? classAverage.toFixed(2) : "—",
        needsAttention: liveRoster.filter((student) => student.attendance < 80)
          .length,
        monthAttendance: liveRoster.length
          ? average(liveRoster.map((student) => student.attendance)).toFixed(
              1,
            ) + "%"
          : "—",
        attendanceBars: attendanceRates,
        totalPresent,
        totalAbsent,
        totalLate,
        sessionsHeld: sessionsData.length,
        sessionsThisWeek,
        mostConsistent,
        excellentCount: gradedStudents.filter((student) => student.grade <= 2)
          .length,
        goodCount: gradedStudents.filter(
          (student) => student.grade > 2 && student.grade <= 3.05,
        ).length,
        needsReviewCount: gradedStudents.filter(
          (student) => student.grade > 3.05,
        ).length,
        passingRate: gradedStudents.length
          ? (
              (gradedStudents.filter((student) => student.grade <= 3.05)
                .length /
                gradedStudents.length) *
              100
            ).toFixed(1) + "%"
          : "—",
      };

      // Commit to React state only if this is still the most recently
      // *initiated* loadLiveData call. See the loadRequestIdRef comment
      // above for why this guard exists: without it, an older call that
      // happens to resolve later (e.g. one triggered by a realtime event
      // fired mid-way through a multi-step import) can overwrite the
      // correct, fully up-to-date state that a newer call already
      // committed — which is exactly what makes a re-imported grade sheet
      // appear to keep showing old values.
      if (!isStale()) {
        setSection(sectionData);
        setSections(sectionList ?? []);
        setStudents(liveRoster);
        setGradeRows(toGradeRows(liveRoster));
        setGradingPeriods(periods ?? []);
        setAssessmentScores(combinedAssessmentScoreData);
        setAssessmentAttempts(attemptRows);
        setAssessmentAttemptGrants(grantRows);
        setAssessmentViolations(violationRows);
        setAssessmentDefinitions(liveAssessmentDefinitions);
        setAttendanceSessions(liveAttendanceSessions);
        setSessions(liveSessions);
        setStats(liveStats);
        setConnectionStatus("live");
        setConnectionMessage(
          "Live · " + (sectionData.subject_code ?? "Supabase"),
        );
      }
      void callLanApi("/api/sync", { method: "POST" }).catch(() => {});
      return {
        live: true,
        sectionId: sectionData.id,
        section: sectionData,
        students: liveRoster,
        periods: periods ?? [],
        assessmentScores: combinedAssessmentScoreData,
        assessmentDefinitions: liveAssessmentDefinitions,
        attendanceSessions: liveAttendanceSessions,
      };
    } catch (error) {
      if (isNetworkError(error)) {
        return loadOfflineData(preferredSectionId, requestId);
      }
      if (!isStale()) {
        clearLiveData();
        setConnectionStatus("error");
        setConnectionMessage(error.message ?? "Supabase connection failed");
      }
    }
  }, [accountId, accountScoped, clearLiveData, loadOfflineData]);

  const reloadTimerRef = useRef(null);
  const scheduleReload = useCallback(() => {
    clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = setTimeout(() => {
      reloadTimerRef.current = null;
      void loadLiveData(currentSectionId);
    }, 300);
  }, [currentSectionId, loadLiveData]);

  useEffect(() => {
    const persistSections = setTimeout(() => {
      if (sections.length) void writeOfflineSnapshot("sections", sections);
    }, 250);
    return () => clearTimeout(persistSections);
  }, [sections]);

  useEffect(() => {
    if (!section?.id) return undefined;
    const persistSnapshot = setTimeout(() => {
      void writeOfflineSnapshot(`section:${section.id}`, {
        section,
        sections,
        students,
        gradeRows,
        gradingPeriods,
        assessmentScores,
        assessmentDefinitions,
        assessmentAttempts,
        assessmentAttemptGrants,
        assessmentViolations,
        attendanceSessions,
        sessions,
        stats,
      });
    }, 250);
    return () => clearTimeout(persistSnapshot);
  }, [
    section,
    sections,
    students,
    gradeRows,
    gradingPeriods,
    assessmentScores,
    assessmentDefinitions,
    assessmentAttempts,
    assessmentAttemptGrants,
    assessmentViolations,
    attendanceSessions,
    sessions,
    stats,
  ]);

  useEffect(() => {
    if (!accountScoped || !accountId) return undefined;
    const timer = setTimeout(() => loadLiveData(), 0);
    return () => clearTimeout(timer);
  }, [accountId, accountScoped, loadLiveData]);

  const queueOfflineChange = useCallback(async (type, payload) => {
    await enqueueOfflineMutation(type, payload);
    setPendingSyncCount(await countOfflineMutations());
    setConnectionStatus("offline");
    setConnectionMessage("Offline · saved locally; waiting to sync");
    return { queued: true };
  }, []);

  useEffect(() => {
    if (!accountScoped || !accountId || !supabase || !currentSectionId) return undefined;
    const channel = supabase
      .channel("section-" + currentSectionId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "period_grades",
          filter: "section_id=eq." + currentSectionId,
        },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "assessment_scores",
          filter: "section_id=eq." + currentSectionId,
        },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "class_sessions",
          filter: "section_id=eq." + currentSectionId,
        },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_records" },
        scheduleReload,
      )
      .subscribe();
    return () => {
      clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [accountId, accountScoped, currentSectionId, scheduleReload]);

const {
  selectSection, saveGradingPeriods, importMasterList, syncToExcel,
  refreshGrades, importGradeSheet, saveAttendance,
  saveGrades, saveAssessmentScores, saveAssessment, updateAssessment,
  deleteAssessment, grantAssessmentAttempt, loadStudentAssessment,
   submitAssessment, addStudent, updateStudent, updateSection, deleteSection,
  flushOfflineMutations,
} = useDashboardActions({
  accountId, accountScoped, currentSectionId, period, section, sections, students,
  gradingPeriods, assessmentScores, assessmentDefinitions, attendanceSessions,
  loadLiveData, clearLiveData, queueOfflineChange, setSection, setSections,
  setStudents,
  setGradingPeriods, setAssessmentScores, setAssessmentDefinitions,
  setAttendanceSessions, setConnectionStatus, setConnectionMessage,
  setPendingSyncCount, setImportState, setGradeSheetImportState,
  helpers: {
    answerSimilarity, assessmentItemLimits, average, browserIsOffline, callLanApi,
    createAssessmentAccessKey, createLocalId, formatShortDate, gradingWeights,
    isNetworkError, serializeAssessmentDate, transmutePercentage,
  },
});

  useEffect(() => {
    if (!accountScoped || !accountId) return undefined;
    const handleOffline = () => {
      setConnectionStatus("offline");
      setConnectionMessage("Offline · changes will be saved locally");
    };
    const handleOnline = () => {
      setConnectionStatus("connecting");
      setConnectionMessage("Online · syncing saved changes…");
      void flushOfflineMutations().then(() => loadLiveData(currentSectionId));
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    void countOfflineMutations().then(setPendingSyncCount);
    const syncTimer = setTimeout(() => {
      if (!browserIsOffline()) void flushOfflineMutations();
    }, 0);
    return () => {
      clearTimeout(syncTimer);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [accountId, accountScoped, currentSectionId, flushOfflineMutations, loadLiveData]);

  return {
    active,
    mobileNav,
    period,
    category,
    query,
    students,
    assessmentScores,
    attendanceSessions,
    gradeRows,
    sessions,
    stats,
    section,
    sections,
    gradingPeriods,
    filteredStudents,
    connectionStatus,
    connectionMessage,
    pendingSyncCount,
    importState,
    gradeSheetImportState,
    importMasterList,
    importGradeSheet,
    syncToExcel,
    setActive,
    setMobileNav,
    setPeriod,
    setCategory,
    setQuery,
    selectSection,
    saveGradingPeriods,
    saveAttendance,
    saveGrades,
    saveAssessmentScores,
    saveAssessment,
    updateAssessment,
    grantAssessmentAttempt,
    deleteAssessment,
    assessmentDefinitions,
    assessmentAttempts,
    assessmentAttemptGrants,
    assessmentViolations,
    loadStudentAssessment,
    submitAssessment,
    addStudent,
    updateStudent,
    updateSection,
    deleteSection,
    refreshGrades,
    refresh: loadLiveData,
  };
}
