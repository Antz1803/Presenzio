import { useCallback, useEffect, useMemo, useState } from "react";
import { importMasterListFile } from "./importMasterList";
import { importGradeSheetFile } from "./importRecord";
import { syncGradeSheetToExcel } from "./syncGradeSheetToExcelPreservingTemplate";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";
import {
  countOfflineMutations,
  enqueueOfflineMutation,
  listOfflineMutations,
  readOfflineSnapshot,
  removeOfflineMutation,
  replayOfflineMutation,
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

export function useDashboardViewModel() {
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

  const filteredStudents = useMemo(
    () =>
      students.filter((student) =>
        student.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [query, students],
  );

  const clearLiveData = () => {
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
  };

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

  const loadOfflineData = useCallback(async (preferredSectionId) => {
    const sectionList = (await readOfflineSnapshot("sections")) ?? [];
    const selectedSectionId =
      sectionList.find((item) => item.id === preferredSectionId)?.id ??
      sectionList[0]?.id;
    const snapshot = selectedSectionId
      ? await readOfflineSnapshot(`section:${selectedSectionId}`)
      : null;
    if (!applyOfflineSnapshot(snapshot, sectionList)) {
      clearLiveData();
      setSections(sectionList);
    }
    if (selectedSectionId) {
      const lanScores = await callLanApi(
        `/api/submissions?sectionId=${encodeURIComponent(selectedSectionId)}`,
      );
      if (lanScores?.scores?.length) {
        setAssessmentScores((current) =>
          mergeAssessmentScores(current, lanScores.scores),
        );
      }
    }
    setConnectionStatus("offline");
    setConnectionMessage(
      snapshot ? "Offline · saved locally" : "Offline · no cached class data",
    );
    setPendingSyncCount(await countOfflineMutations());
    return snapshot;
  }, [applyOfflineSnapshot]);

  const loadLiveData = useCallback(async (preferredSectionId) => {
    if (browserIsOffline()) {
      return loadOfflineData(preferredSectionId);
    }
    if (!supabase) {
      setConnectionStatus("not-configured");
      setConnectionMessage("Configure Supabase to load records");
      return loadOfflineData(preferredSectionId);
    }

    setConnectionStatus("connecting");
    try {
      const { data: sectionList, error: sectionListError } = await supabase
        .from("sections")
        .select("*")
        .order("id", { ascending: false });
      if (sectionListError) throw sectionListError;
      const sectionData =
        sectionList?.find((item) => item.id === preferredSectionId) ??
        sectionList?.[0];
      if (!sectionData) {
        clearLiveData();
        setConnectionStatus("live");
        setConnectionMessage("Live · Supabase");
        return;
      }

      const { data: enrollments, error: enrollmentError } = await supabase
        .from("enrollments")
        .select(
          "id, ctrl_no, status, student:students(id, full_name, gender, student_no)",
        )
        .eq("section_id", sectionData.id)
        .order("ctrl_no");
      if (enrollmentError) throw enrollmentError;

      // The "Total students" stat card is meant to reflect every student
      // in the system, not just the roster of the currently selected
      // class — enrollments above are scoped to one section_id, so a
      // separate, unfiltered query against the students table is needed
      // for a true system-wide count and gender breakdown.
      const { data: allStudentsData, error: allStudentsError } = await supabase
        .from("students")
        .select("id, gender");
      if (allStudentsError) throw allStudentsError;
      const totalStudentsAll = allStudentsData?.length ?? 0;
      const maleAll = (allStudentsData ?? []).filter(
        (studentRow) => studentRow.gender === "M",
      ).length;
      const femaleAll = (allStudentsData ?? []).filter(
        (studentRow) => studentRow.gender === "F",
      ).length;

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
      setAssessmentAttempts(attemptRows);
      setAssessmentAttemptGrants(grantRows);
      setAssessmentViolations(violationRows);
      setAssessmentDefinitions(liveAssessmentDefinitions);

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

      setSection(sectionData);
      setSections(sectionList ?? []);
      setStudents(liveRoster);
      setGradeRows(toGradeRows(liveRoster));
      setGradingPeriods(periods ?? []);
      setAssessmentScores(combinedAssessmentScoreData);
      const liveAttendanceSessions = [...sessionsData]
        .sort((first, second) => first.session_date.localeCompare(second.session_date))
        .map((session) => ({
          id: session.id,
          date: formatShortDate(session.session_date),
          sessionDate: session.session_date,
          sessionTime: session.session_time,
          periodCode:
            periods?.find((periodItem) => periodItem.id === session.period_id)
              ?.code ?? "",
          statuses: Object.fromEntries(
            (session.attendance_records ?? []).map((record) => [
              record.enrollment_id,
              record.status,
            ]),
          ),
        }));
      setAttendanceSessions(liveAttendanceSessions);
      setSessions(
        sessionsData.map((session) => {
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
        }),
      );
      setStats({
        // These three now reflect every student in the system, not just
        // this section's roster — see the unfiltered students query above.
        totalStudents: totalStudentsAll,
        male: maleAll,
        female: femaleAll,
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
      });
      setConnectionStatus("live");
      setConnectionMessage(
        "Live · " + (sectionData.subject_code ?? "Supabase"),
      );
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
        return loadOfflineData(preferredSectionId);
      }
      clearLiveData();
      setConnectionStatus("error");
      setConnectionMessage(error.message ?? "Supabase connection failed");
    }
  }, [loadOfflineData]);

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
    const timer = setTimeout(() => loadLiveData(), 0);
    return () => clearTimeout(timer);
  }, [loadLiveData]);

  const queueOfflineChange = useCallback(async (type, payload) => {
    await enqueueOfflineMutation(type, payload);
    setPendingSyncCount(await countOfflineMutations());
    setConnectionStatus("offline");
    setConnectionMessage("Offline · saved locally; waiting to sync");
    return { queued: true };
  }, []);

  useEffect(() => {
    if (!supabase || !currentSectionId) return undefined;
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
        () => loadLiveData(currentSectionId),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "assessment_scores",
          filter: "section_id=eq." + currentSectionId,
        },
        () => loadLiveData(currentSectionId),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "class_sessions",
          filter: "section_id=eq." + currentSectionId,
        },
        () => loadLiveData(currentSectionId),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_records" },
        () => loadLiveData(currentSectionId),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentSectionId, loadLiveData]);

  const selectSection = useCallback(
    (sectionId) => {
      if (sectionId) loadLiveData(sectionId);
    },
    [loadLiveData],
  );

  const saveGradingPeriods = useCallback(
    async (dateRanges) => {
      if (!supabase) throw new Error("Supabase is not configured.");

      const invalidPeriod = Object.entries(dateRanges).find(([, dates]) => {
        const hasStart = Boolean(dates.start);
        const hasEnd = Boolean(dates.end);
        return (
          hasStart !== hasEnd ||
          (hasStart && hasEnd && dates.start > dates.end)
        );
      });
      if (invalidPeriod) {
        throw new Error(
          "Each period needs both dates, and the start date must be before the end date.",
        );
      }

      const rows = Object.entries(dateRanges).map(([code, dates], index) => ({
        code,
        sort_order:
          gradingPeriods.find((periodItem) => periodItem.code === code)
            ?.sort_order ?? index + 1,
        start_date: dates.start || null,
        end_date: dates.end || null,
      }));
      if (browserIsOffline() || !supabase) {
        await queueOfflineChange("save-grading-periods", { rows });
        setGradingPeriods((current) =>
          current.map((currentPeriod) => {
            const next = rows.find((row) => row.code === currentPeriod.code);
            return next
              ? {
                  ...currentPeriod,
                  start_date: next.start_date,
                  end_date: next.end_date,
                }
              : currentPeriod;
          }),
        );
        return;
      }
      const { error } = await supabase
        .from("grading_periods")
        .upsert(rows, { onConflict: "code" });
      if (error) throw error;

      // Keep existing attendance sessions aligned with the date ranges. This
      // repairs sessions that were previously assigned from the selected tab
      // instead of from their actual date.
      const { data: existingSessions, error: existingSessionsError } =
        await supabase
          .from("class_sessions")
          .select("id, session_date")
          .eq("section_id", currentSectionId);
      if (existingSessionsError) throw existingSessionsError;
      for (const session of existingSessions ?? []) {
        const matchingPeriod = rows
          .filter((row) => row.start_date && row.end_date)
          .sort((first, second) => first.sort_order - second.sort_order)
          .find(
            (row) =>
              session.session_date >= row.start_date &&
              session.session_date <= row.end_date,
          );
        if (!matchingPeriod) continue;
        const periodId = gradingPeriods.find(
          (periodItem) => periodItem.code === matchingPeriod.code,
        )?.id;
        if (!periodId) continue;
        const { error: sessionUpdateError } = await supabase
          .from("class_sessions")
          .update({ period_id: periodId })
          .eq("id", session.id);
        if (sessionUpdateError) throw sessionUpdateError;
      }
      await loadLiveData(currentSectionId);
    },
    [currentSectionId, gradingPeriods, loadLiveData, queueOfflineChange],
  );

  const importMasterList = useCallback(
    async (file) => {
      setImportState({ status: "working", message: "Reading master list…" });
      try {
        if (browserIsOffline() || !supabase) {
          await queueOfflineChange("import-master-list", { file });
          setImportState({
            status: "success",
            message: "Master list saved offline and queued for automatic sync.",
          });
          return;
        }
        const result = await importMasterListFile({ file, supabase });
        const preferredSectionId = result.sectionIds?.includes(currentSectionId)
          ? currentSectionId
          : result.sectionId;
        await loadLiveData(preferredSectionId);
        setImportState({
          status: "success",
          message:
            result.count +
            " student records imported from " +
            result.sheetName +
            ".",
        });
      } catch (error) {
        setImportState({
          status: "error",
          message: error.message ?? "Master-list import failed.",
        });
      }
    },
    [currentSectionId, loadLiveData, queueOfflineChange],
  );

  const syncToExcel = useCallback(async () => {
    if (!section?.id) throw new Error("No active class is selected.");
    if (browserIsOffline() || !supabase) {
      throw new Error(
        "Excel sync requires a live database connection so every record can be included.",
      );
    }
    const fresh = await loadLiveData(section.id);
    if (!fresh?.live || fresh.sectionId !== section.id) {
      throw new Error("The latest class records could not be loaded for Excel sync.");
    }
    await syncGradeSheetToExcel({
      section: fresh.section,
      students: fresh.students,
      assessmentScores: fresh.assessmentScores,
      assessmentDefinitions: fresh.assessmentDefinitions,
      attendanceSessions: fresh.attendanceSessions,
      gradingPeriods: fresh.periods,
    });
   }, [section, loadLiveData]);

  const recalculatePeriodGrades = useCallback(
    async (periodId, sectionId = currentSectionId, roster = students, gradeOverrides = {}) => {
      if (!periodId) return;
      const [
        { data: assessmentRows, error: assessmentError },
        { data: sessionRows, error: sessionError },
        { data: periodRows, error: periodError },
      ] =
        await Promise.all([
          supabase
            .from("assessment_scores")
            .select("period_id, enrollment_id, category, score, max_score")
            .eq("section_id", sectionId),
          supabase
            .from("class_sessions")
            .select("id, period_id, attendance_records(enrollment_id, status)")
            .eq("section_id", sectionId),
          supabase
            .from("grading_periods")
            .select("id, code, sort_order")
            .order("sort_order"),
        ]);
      if (assessmentError) throw assessmentError;
      if (sessionError) throw sessionError;
      if (periodError) throw periodError;

      const periods = (periodRows ?? []).sort(
        (first, second) => first.sort_order - second.sort_order,
      );
      const ownGrades = new Map();
      periods.forEach((period) => {
        const periodSessions = (sessionRows ?? []).filter(
          (session) => session.period_id === period.id,
        );
        const periodStudentGrades = new Map();
        roster.forEach((student) => {
          const categoryGrades = {};
          Object.keys(gradingWeights).forEach((categoryKey) => {
            if (categoryKey === "attendance") return;
            // Excel's point cells are blank for blank raw-score cells, and
            // its category average uses COUNT/AVERAGE. Use only recorded
            // numeric score rows here; an explicit zero is still included.
            const itemGrades = (assessmentRows ?? [])
              .filter(
                (row) =>
                  row.period_id === period.id &&
                  row.enrollment_id === student.id &&
                  row.category === categoryKey &&
                  Number.isFinite(Number(row.score)) &&
                  Number(row.max_score) > 0,
              )
              .map((row) =>
                transmutePercentage(
                  (Number(row.score) / Number(row.max_score)) * 100,
                ),
              )
              .filter((grade) => grade !== null);
            if (itemGrades.length) categoryGrades[categoryKey] = average(itemGrades);
          });

          if (periodSessions.length) {
            const records = periodSessions.flatMap(
              (session) => session.attendance_records ?? [],
            );
            const attended = records.filter(
              (record) =>
                record.enrollment_id === student.id &&
                (record.status === "present" || record.status === "late"),
            ).length;
            categoryGrades.attendance = transmutePercentage(
              (attended / periodSessions.length) * 100,
            );
          }

          const contributingGrades = Object.entries(gradingWeights).filter(
            ([categoryKey]) => categoryGrades[categoryKey] != null,
          );

          let gradePoint = null;
          if (contributingGrades.length) {
            gradePoint = contributingGrades.reduce(
              (total, [categoryKey, weight]) =>
                total + categoryGrades[categoryKey] * weight,
              0,
            );
          } else {
            const overrideOwn = gradeOverrides?.[period.code]?.[student.id]?.own;
            if (Number.isFinite(Number(overrideOwn))) gradePoint = Number(overrideOwn);
          }

          if (gradePoint == null) return;
          periodStudentGrades.set(student.id, gradePoint);
        });
        ownGrades.set(period.code, periodStudentGrades);
      });

      const averageDefined = (values) => {
        const validValues = values.filter((value) => value != null);
        return validValues.length
          ? validValues.reduce((total, value) => total + value, 0) / validValues.length
          : null;
      };
      const periodGradeRows = [];
      roster.forEach((student) => {
        const overrideFor = (code) => gradeOverrides?.[code]?.[student.id]?.cumulative ?? null;
        const prelim = ownGrades.get("prelim")?.get(student.id) ?? null;
        const midterm = ownGrades.get("midterm")?.get(student.id) ?? null;
        const semifinal = ownGrades.get("semifinal")?.get(student.id) ?? null;
        const final = ownGrades.get("final")?.get(student.id) ?? null;

        const cumulative = { prelim };
        cumulative.midterm =
          prelim != null && midterm != null
            ? midterm * 0.7 + prelim * 0.3
            : overrideFor("midterm");
        cumulative.semifinal =
          semifinal != null
            ? averageDefined([prelim, cumulative.midterm, semifinal])
            : overrideFor("semifinal");
        cumulative.final =
          final != null
            ? averageDefined([
                averageDefined([prelim, cumulative.midterm]),
                averageDefined([cumulative.semifinal, final]),
              ])
            : overrideFor("final");

        periods.forEach((period) => {
          const own = ownGrades.get(period.code)?.get(student.id) ?? null;
          const cumulativeValue = cumulative[period.code] ?? null;
          if (own == null && cumulativeValue == null) return;
          periodGradeRows.push({
            section_id: sectionId,
            period_id: period.id,
            enrollment_id: student.id,
            own_period_grade: own,
            cumulative_grade: cumulativeValue,
          });
        });
      });

      const { error: deleteError } = await supabase
        .from("period_grades")
        .delete()
        .eq("section_id", sectionId);
      if (deleteError) throw deleteError;
      if (periodGradeRows.length) {
        const { error: upsertError } = await supabase
          .from("period_grades")
          .upsert(periodGradeRows, {
            onConflict: "section_id,period_id,enrollment_id",
          });
        if (upsertError) throw upsertError;
      }
    },
    [currentSectionId, students],
  );

  const refreshGrades = useCallback(async (sectionId = currentSectionId) => {
    if (!sectionId || !supabase || browserIsOffline()) return;
    const loaded = await loadLiveData(sectionId);
    if (!loaded?.students?.length || !loaded.periods?.length) return;
    const gradeOverrides = {};
    loaded.students.forEach((student) => {
      Object.entries(student.gradeDetails ?? {}).forEach(([periodCode, details]) => {
        if (details?.own == null && details?.cumulative == null) return;
        gradeOverrides[periodCode] ??= {};
        gradeOverrides[periodCode][student.id] = details;
      });
    });
    for (const periodRow of loaded.periods) {
      await recalculatePeriodGrades(
        periodRow.id,
        sectionId,
        loaded.students,
        gradeOverrides,
      );
    }
    await loadLiveData(sectionId);
  }, [currentSectionId, loadLiveData, recalculatePeriodGrades]);

  const importGradeSheet = useCallback(
    async (file) => {
      setGradeSheetImportState({
        status: "working",
        message: "Reading grade sheet and finding its class…",
      });
      try {
        if (browserIsOffline() || !supabase) {
          await queueOfflineChange("import-grade-sheet", { file });
          setGradeSheetImportState({
            status: "success",
            message: "Grade sheet saved offline and queued for automatic sync.",
          });
          return;
        }
        const result = await importGradeSheetFile({ file, supabase });
        for (const periodId of result.periodIds) {
          await recalculatePeriodGrades(periodId, result.sectionId, result.students,result.gradeOverrides);
        }
        await loadLiveData(result.sectionId);
        setGradeSheetImportState({
          status: "success",
          message:
            result.scoreCount +
            " scores and " +
            result.attendanceCount +
            " attendance records imported into " +
            (result.subjectCode || "the matching class") +
            "." +
            (result.rosterChanges?.createdStudents?.length
              ? ` ${result.rosterChanges.createdStudents.length} missing student(s) were added to the class.`
              : "") +
            (result.unmatchedStudents
              ? ` ${result.unmatchedStudents} student row(s) were not matched.`
              : ""),
        });
      } catch (error) {
        setGradeSheetImportState({
          status: "error",
          message: error.message ?? "Grade-sheet import failed.",
        });
      }
    },
    [recalculatePeriodGrades, loadLiveData, queueOfflineChange],
  );

  const saveAttendance = useCallback(
    async ({ date, sessionTime, statuses }) => {
      if (!currentSectionId)
        throw new Error("No active Supabase section.");
      const selectedPeriodCode = period.toLowerCase();
      const datePeriodCode = gradingPeriods
        .filter((periodItem) => periodItem.start_date && periodItem.end_date)
        .sort((first, second) => first.sort_order - second.sort_order)
        .find(
          (periodItem) =>
            date >= periodItem.start_date && date <= periodItem.end_date,
        )?.code;
      const periodCode = datePeriodCode ?? selectedPeriodCode;
      if (browserIsOffline() || !supabase) {
        const existingSession = attendanceSessions.find(
          (session) =>
            session.sessionDate === date &&
            session.sessionTime === sessionTime &&
            session.periodCode === periodCode,
        );
        const sessionId =
          existingSession?.id ??
          createLocalId();
        await queueOfflineChange("save-attendance", {
          sectionId: currentSectionId,
          periodCode,
          date,
          sessionTime,
          statuses,
          sessionId,
        });
        setAttendanceSessions((current) => {
          const existing = current.find(
            (session) =>
              session.sessionDate === date &&
              session.sessionTime === sessionTime &&
              session.periodCode === periodCode,
          );
          const next = {
            id: existing?.id ?? sessionId,
            date: formatShortDate(date),
            sessionDate: date,
            sessionTime,
            periodCode,
            statuses,
          };
          return existing
            ? current.map((session) => (session.id === existing.id ? next : session))
            : [...current, next].sort((first, second) =>
                first.sessionDate.localeCompare(second.sessionDate),
              );
        });
        return;
      }
      const { data: periodRow, error: periodError } = await supabase
        .from("grading_periods")
        .select("id")
        .eq("code", periodCode)
        .single();
      if (periodError) throw periodError;
      let { data: session, error: sessionLookupError } = await supabase
        .from("class_sessions")
        .select("id, period_id")
        .eq("section_id", currentSectionId)
        .eq("session_date", date)
        .eq("session_time", sessionTime)
        .maybeSingle();
      if (sessionLookupError) throw sessionLookupError;
      if (!session) {
        const result = await supabase
          .from("class_sessions")
          .insert({
            section_id: currentSectionId,
            period_id: periodRow.id,
            session_date: date,
            session_time: sessionTime,
          })
          .select("id")
          .single();
        if (result.error) throw result.error;
        session = result.data;
      }
      if (session.period_id !== periodRow.id) {
        const { error } = await supabase
          .from("class_sessions")
          .update({ period_id: periodRow.id })
          .eq("id", session.id);
        if (error) throw error;
      }
      const records = Object.entries(statuses).map(
        ([enrollmentId, status]) => ({
          session_id: session.id,
          enrollment_id: enrollmentId,
          status,
        }),
      );
      if (records.length) {
        const { error } = await supabase
          .from("attendance_records")
          .upsert(records, { onConflict: "session_id,enrollment_id" });
        if (error) throw error;
      }
      await recalculatePeriodGrades(periodRow.id);
      await loadLiveData(currentSectionId);
    },
    [
      currentSectionId,
      loadLiveData,
      period,
      gradingPeriods,
      attendanceSessions,
      queueOfflineChange,
      recalculatePeriodGrades,
    ],
  );

  const saveGrades = useCallback(
    async ({ period, grades }) => {
      if (!currentSectionId)
        throw new Error("No active Supabase section.");
      const periodCode = period.toLowerCase();
      const baseRows = Object.entries(grades)
        .filter(([, value]) => value !== "" && Number.isFinite(Number(value)))
        .map(([enrollmentId, value]) => ({
          section_id: currentSectionId,
          enrollment_id: enrollmentId,
          own_period_grade: Number(value),
          cumulative_grade: Number(value),
        }));
      if (browserIsOffline() || !supabase) {
        await queueOfflineChange("save-grades", {
          sectionId: currentSectionId,
          periodCode,
          rows: baseRows,
        });
        setStudents((current) =>
          current.map((student) => {
            const value = grades[student.id];
            if (value === "" || !Number.isFinite(Number(value))) return student;
            const nextGrades = { ...student.grades, [periodCode]: Number(value) };
            return {
              ...student,
              grades: nextGrades,
              grade: nextGrades.prelim ?? student.grade,
            };
          }),
        );
        return;
      }
      const { data: periodRow, error: periodError } = await supabase
        .from("grading_periods")
        .select("id")
        .eq("code", periodCode)
        .single();
      if (periodError) throw periodError;
      const rows = baseRows.map((row) => ({ ...row, period_id: periodRow.id }));
      if (rows.length) {
        const { error } = await supabase
          .from("period_grades")
          .upsert(rows, { onConflict: "section_id,period_id,enrollment_id" });
        if (error) throw error;
      }
      await loadLiveData(currentSectionId);
    },
    [currentSectionId, loadLiveData, queueOfflineChange],
  );

  const saveAssessmentScores = useCallback(
    async ({ period, category, scores, maxScores }) => {
      if (!currentSectionId)
        throw new Error("No active Supabase section.");
      const periodCode = period.toLowerCase();
      const baseRows = Object.entries(scores)
        .map(([itemNo, value]) => {
          const itemNumber = Number(itemNo.split(":")[1]);
          const itemMaxScore = Number(maxScores?.[String(itemNumber)]);

          if (value === "" && (!Number.isFinite(itemMaxScore) || itemMaxScore <= 0)) {
            return null;
          }
          if (!Number.isFinite(itemMaxScore) || itemMaxScore <= 0) {
            throw new Error(
              "Enter a maximum score for every column that has a score.",
            );
          }
          if (value !== "" && !Number.isFinite(Number(value))) {
            throw new Error("Scores must contain valid numbers.");
          }

          return {
            section_id: currentSectionId,
            enrollment_id: itemNo.split(":")[0],
            category,
            item_no: itemNumber,
            score:
              value === ""
                ? 0
                : Math.max(0, Math.min(Number(value), itemMaxScore)),
            max_score: itemMaxScore,
          };
        })
        .filter(Boolean);

      if (browserIsOffline() || !supabase) {
        await queueOfflineChange("save-assessment-scores", {
          sectionId: currentSectionId,
          periodCode,
          category,
          rows: baseRows,
        });
        setAssessmentScores((current) => [
          ...current.filter(
            (row) =>
              !(
                row.period?.code === periodCode &&
                row.category === category
              ),
          ),
          ...baseRows.map((row) => ({
            ...row,
            period: { code: periodCode },
          })),
        ]);
        return;
      }

      const { data: periodRow, error: periodError } = await supabase
        .from("grading_periods")
        .select("id")
        .eq("code", periodCode)
        .single();
      if (periodError) throw periodError;
      const assessmentRows = baseRows.map((row) => ({
        ...row,
        period_id: periodRow.id,
      }));

      const { error: clearError } = await supabase
        .from("assessment_scores")
        .delete()
        .eq("section_id", currentSectionId)
        .eq("period_id", periodRow.id)
        .eq("category", category);
      if (clearError) throw clearError;

      if (assessmentRows.length) {
        const { error } = await supabase
          .from("assessment_scores")
          .upsert(assessmentRows, {
            onConflict: "section_id,period_id,enrollment_id,category,item_no",
          });
        if (error) throw error;
      }
      await recalculatePeriodGrades(periodRow.id);
      await loadLiveData(currentSectionId);
    },
    [currentSectionId, loadLiveData, queueOfflineChange, recalculatePeriodGrades],
  );

  const saveAssessment = useCallback(
    async ({ title, category, period, instructions, timeLimitMinutes, availableFrom, availableUntil, questions }) => {
      if (!currentSectionId)
        throw new Error("No active Supabase section.");
      if (!title?.trim()) throw new Error("An assessment title is required.");
      if (!Array.isArray(questions) || !questions.length)
        throw new Error("Add at least one assessment question.");

      const periodRow = gradingPeriods.find((item) => item.code === period);
      if (!periodRow) {
        throw new Error("The selected grading period is not available.");
      }

      if (browserIsOffline() || !supabase) {
        const usedItemNumbers = new Set([
          ...assessmentDefinitions
            .filter(
              (item) =>
                item.period?.code === period && item.category === category,
            )
            .map((item) => Number(item.item_no)),
          ...assessmentScores
            .filter(
              (item) =>
                item.period?.code === period && item.category === category,
            )
            .map((item) => Number(item.item_no)),
        ]);
        const itemLimit = assessmentItemLimits[category] ?? 1;
        const itemNo = Array.from(
          { length: itemLimit },
          (_, index) => index + 1,
        ).find((candidate) => !usedItemNumbers.has(candidate));
        if (!itemNo) {
          throw new Error(`All ${itemLimit} ${category} score columns are already in use.`);
        }
        const assessmentId =
          createLocalId();
        const accessKey = createAssessmentAccessKey();
        const questionRows = questions.map((question, index) => ({
          id:
            createLocalId(),
          assessment_id: assessmentId,
          question_no: index + 1,
          question_type: question.type,
          prompt: question.prompt,
          points: Number(question.points),
          choices: question.choices ?? [],
          correct_answer: question.correctAnswer || null,
          language: question.language || null,
          starter_code: question.starterCode || null,
          expected_output: question.expectedOutput || null,
        }));
        const maxScore = questions.reduce(
          (total, question) => total + Number(question.points || 0),
          0,
        );
        const assessment = {
          id: assessmentId,
          section_id: currentSectionId,
          period_id: periodRow.id,
          category,
          item_no: itemNo,
          access_key: accessKey,
          title: title.trim(),
          instructions: instructions?.trim() || null,
          time_limit_minutes: timeLimitMinutes ? Number(timeLimitMinutes) : null,
          available_from: serializeAssessmentDate(availableFrom),
          available_until: serializeAssessmentDate(availableUntil),
        };
        const scoreRows = students.map((student) => ({
          section_id: currentSectionId,
          period_id: periodRow.id,
          enrollment_id: student.id,
          category,
          item_no: itemNo,
          score: 0,
          max_score: maxScore,
        }));
        await queueOfflineChange("save-assessment", {
          assessment,
          questions: questionRows,
          scoreRows,
        });
        setAssessmentDefinitions((current) => [
          {
            ...assessment,
            period: { code: period },
            questions: questionRows,
          },
          ...current,
        ]);
        setAssessmentScores((current) => [
          ...current,
          ...scoreRows.map((row) => ({ ...row, period: { code: period } })),
        ]);
        return { id: assessmentId, access_key: accessKey };
      }

      const [{ data: existingAssessments, error: existingAssessmentError }, { data: existingScores, error: existingScoreError }] = await Promise.all([
        supabase
          .from("assessments")
          .select("item_no")
          .eq("section_id", currentSectionId)
          .eq("period_id", periodRow.id)
          .eq("category", category),
        supabase
          .from("assessment_scores")
          .select("item_no")
          .eq("section_id", currentSectionId)
          .eq("period_id", periodRow.id)
          .eq("category", category),
      ]);
      if (existingAssessmentError) throw existingAssessmentError;
      if (existingScoreError) throw existingScoreError;
      const usedItemNumbers = new Set([
        ...(existingAssessments ?? []).map((item) => Number(item.item_no)),
        ...(existingScores ?? []).map((item) => Number(item.item_no)),
      ]);
      const itemLimit = assessmentItemLimits[category] ?? 1;
      const itemNo = Array.from({ length: itemLimit }, (_, index) => index + 1).find(
        (candidate) => !usedItemNumbers.has(candidate),
      );
      if (!itemNo) {
        throw new Error(`All ${itemLimit} ${category} score columns are already in use.`);
      }

      const { data: assessment, error: assessmentError } = await supabase
        .from("assessments")
        .insert({
          section_id: currentSectionId,
          period_id: periodRow.id,
          category,
          item_no: itemNo,
          access_key: createAssessmentAccessKey(),
          title: title.trim(),
          instructions: instructions?.trim() || null,
          time_limit_minutes: timeLimitMinutes ? Number(timeLimitMinutes) : null,
          available_from: serializeAssessmentDate(availableFrom),
          available_until: serializeAssessmentDate(availableUntil),
        })
        .select("id, access_key")
        .single();
      if (assessmentError) throw assessmentError;

      const questionRows = questions.map((question, index) => ({
        assessment_id: assessment.id,
        question_no: index + 1,
        question_type: question.type,
        prompt: question.prompt,
        points: Number(question.points),
        choices: question.choices ?? [],
        correct_answer: question.correctAnswer || null,
        language: question.language || null,
        starter_code: question.starterCode || null,
        expected_output: question.expectedOutput || null,
      }));
      const { error: questionError } = await supabase
        .from("assessment_questions")
        .insert(questionRows);
      if (questionError) {
        await supabase.from("assessments").delete().eq("id", assessment.id);
        throw questionError;
      }
      const maxScore = questions.reduce(
        (total, question) => total + Number(question.points || 0),
        0,
      );
      const initialScoreRows = students.map((student) => ({
        section_id: currentSectionId,
        period_id: periodRow.id,
        enrollment_id: student.id,
        category,
        item_no: itemNo,
        score: 0,
        max_score: maxScore,
      }));
      if (initialScoreRows.length) {
        const { error: scoreError } = await supabase
          .from("assessment_scores")
          .upsert(initialScoreRows, {
            onConflict: "section_id,period_id,enrollment_id,category,item_no",
          });
        if (scoreError) throw scoreError;
      }
      await loadLiveData(currentSectionId);
      return assessment;
    },
    [
      assessmentDefinitions,
      assessmentScores,
      currentSectionId,
      gradingPeriods,
      loadLiveData,
      queueOfflineChange,
      students,
    ],
  );

  const updateAssessment = useCallback(
    async ({ assessmentId, itemNo, title, category, period, instructions, timeLimitMinutes, availableFrom, availableUntil, questions }) => {
      if (!currentSectionId)
        throw new Error("No active Supabase section.");
      const periodRow = gradingPeriods.find((item) => item.code === period);
      if (!periodRow) throw new Error("The selected grading period is not available.");
      if (!title?.trim()) throw new Error("An assessment title is required.");
      if (!Array.isArray(questions) || !questions.length)
        throw new Error("Add at least one assessment question.");

      if (browserIsOffline() || !supabase) {
        const existing = assessmentDefinitions.find((item) => item.id === assessmentId);
        const questionRows = questions.map((question, index) => ({
          id:
            createLocalId(),
          assessment_id: assessmentId,
          question_no: index + 1,
          question_type: question.type,
          prompt: question.prompt,
          points: Number(question.points),
          choices: question.choices ?? [],
          correct_answer: question.correctAnswer || null,
          language: question.language || null,
          starter_code: question.starterCode || null,
          expected_output: question.expectedOutput || null,
        }));
        const maxScore = questions.reduce(
          (total, question) => total + Number(question.points || 0),
          0,
        );
        const assessment = {
          id: assessmentId,
          section_id: currentSectionId,
          period_id: periodRow.id,
          category,
          item_no: Number(itemNo ?? existing?.item_no),
          access_key: existing?.access_key,
          title: title.trim(),
          instructions: instructions?.trim() || null,
          time_limit_minutes: timeLimitMinutes ? Number(timeLimitMinutes) : null,
          available_from: serializeAssessmentDate(availableFrom),
          available_until: serializeAssessmentDate(availableUntil),
        };
        await queueOfflineChange("update-assessment", {
          assessmentId,
          itemNo,
          assessment,
          questions: questionRows,
          maxScore,
        });
        setAssessmentDefinitions((current) =>
          current.map((item) =>
            item.id === assessmentId
              ? { ...assessment, period: { code: period }, questions: questionRows }
              : item,
          ),
        );
        setAssessmentScores((current) =>
          current.map((row) =>
            row.section_id === currentSectionId &&
            row.category === category &&
            Number(row.item_no) === Number(itemNo)
              ? { ...row, max_score: maxScore }
              : row,
          ),
        );
        return { id: assessmentId, access_key: existing?.access_key };
      }

      const { data: assessment, error: assessmentError } = await supabase
        .from("assessments")
        .update({
          title: title.trim(),
          category,
          period_id: periodRow.id,
          instructions: instructions?.trim() || null,
          time_limit_minutes: timeLimitMinutes ? Number(timeLimitMinutes) : null,
          available_from: serializeAssessmentDate(availableFrom),
          available_until: serializeAssessmentDate(availableUntil),
        })
        .eq("id", assessmentId)
        .eq("section_id", currentSectionId)
        .select("id, access_key")
        .single();
      if (assessmentError) throw assessmentError;

      const { error: clearQuestionsError } = await supabase
        .from("assessment_questions")
        .delete()
        .eq("assessment_id", assessmentId);
      if (clearQuestionsError) throw clearQuestionsError;
      const questionRows = questions.map((question, index) => ({
        assessment_id: assessmentId,
        question_no: index + 1,
        question_type: question.type,
        prompt: question.prompt,
        points: Number(question.points),
        choices: question.choices ?? [],
        correct_answer: question.correctAnswer || null,
        language: question.language || null,
        starter_code: question.starterCode || null,
        expected_output: question.expectedOutput || null,
      }));
      const { error: questionError } = await supabase
        .from("assessment_questions")
        .insert(questionRows);
      if (questionError) throw questionError;
      const maxScore = questions.reduce(
        (total, question) => total + Number(question.points || 0),
        0,
      );
      if (itemNo) {
        const { error: scoreMaxError } = await supabase
          .from("assessment_scores")
          .update({ max_score: maxScore })
          .eq("section_id", currentSectionId)
          .eq("period_id", periodRow.id)
          .eq("category", category)
          .eq("item_no", Number(itemNo));
        if (scoreMaxError) throw scoreMaxError;
      }
      await loadLiveData(currentSectionId);
      return assessment;
    },
    [
      assessmentDefinitions,
      currentSectionId,
      gradingPeriods,
      loadLiveData,
      queueOfflineChange,
    ],
  );

  const deleteAssessment = useCallback(
    async (assessmentId) => {
      if (!currentSectionId)
        throw new Error("No active Supabase section.");
      if (browserIsOffline() || !supabase) {
        await queueOfflineChange("delete-assessment", {
          assessmentId,
          sectionId: currentSectionId,
        });
        setAssessmentDefinitions((current) =>
          current.filter((item) => item.id !== assessmentId),
        );
        return;
      }
      const { error } = await supabase
        .from("assessments")
        .delete()
        .eq("id", assessmentId)
        .eq("section_id", currentSectionId);
      if (error) throw error;
      await loadLiveData(currentSectionId);
    },
    [currentSectionId, loadLiveData, queueOfflineChange],
  );

  const grantAssessmentAttempt = useCallback(
    async ({ assessmentId, studentId }) => {
      if (!currentSectionId) throw new Error("No active Supabase section.");
      if (!assessmentId || !studentId) throw new Error("Select an assessment and student.");
      const payload = {
        assessment_id: assessmentId,
        student_id: studentId,
        section_id: currentSectionId,
      };
      const lanResult = await callLanApi("/api/assessment-attempt-grants", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (lanResult?.grant) {
        const grant = lanResult.grant;
        setAssessmentAttemptGrants((current) => [
          ...current.filter((item) => item.id !== grant.id),
          grant,
        ]);
        setAssessmentDefinitions((current) =>
          current.map((assessment) =>
            assessment.id === assessmentId
              ? {
                  ...assessment,
                  attemptGrants: [
                    ...(assessment.attemptGrants ?? []).filter((item) => item.id !== grant.id),
                    grant,
                  ],
                }
              : assessment,
          ),
        );
        return grant;
      }
      if (browserIsOffline() || !supabase) {
        await queueOfflineChange("grant-assessment-attempt", payload);
        return { ...payload, extra_attempts: 1, queued: true };
      }
      const { data: existing, error: existingError } = await supabase
        .from("assessment_attempt_grants")
        .select("id, extra_attempts")
        .eq("assessment_id", assessmentId)
        .eq("student_id", studentId)
        .maybeSingle();
      if (existingError) throw existingError;
      const { data: grant, error } = await supabase
        .from("assessment_attempt_grants")
        .upsert(
          {
            id: existing?.id,
            assessment_id: assessmentId,
            student_id: studentId,
            extra_attempts: Number(existing?.extra_attempts || 0) + 1,
          },
          { onConflict: "assessment_id,student_id" },
        )
        .select("id, assessment_id, student_id, extra_attempts, granted_at")
        .single();
      if (error) throw error;
      await callLanApi("/api/sync", { method: "POST" });
      await loadLiveData(currentSectionId);
      return grant;
    },
    [currentSectionId, loadLiveData, queueOfflineChange],
  );

  const loadStudentAssessment = useCallback(async ({ accessKey, studentNumber }) => {
    const normalizedKey = accessKey?.trim().toUpperCase();
    const normalizedStudentNumber = studentNumber?.trim();
    if (!normalizedKey) throw new Error("Enter the Assessment Key ID.");
    if (!normalizedStudentNumber) throw new Error("Enter your student ID number.");

    const lanResult = await callLanApi(
      `/api/student-assessment?accessKey=${encodeURIComponent(normalizedKey)}&studentNumber=${encodeURIComponent(normalizedStudentNumber)}`,
    );
    if (lanResult) return lanResult;

    if (browserIsOffline() || !supabase) {
      const cachedSections = (await readOfflineSnapshot("sections")) ?? sections;
      const cachedSnapshots = await Promise.all(
        cachedSections.map((item) => readOfflineSnapshot(`section:${item.id}`)),
      );
      const cachedAssessment = cachedSnapshots
        .flatMap((snapshot) => snapshot?.assessmentDefinitions ?? [])
        .find((item) => item.access_key?.toUpperCase() === normalizedKey);
      if (!cachedAssessment) throw new Error("Assessment Key ID not found offline.");
      const cachedSection =
        cachedSections.find((item) => item.id === cachedAssessment.section_id) ??
        cachedAssessment.section;
      const cachedSnapshot =
        cachedSnapshots.find(
          (snapshot) => snapshot?.section?.id === cachedAssessment.section_id,
        ) ?? null;
      const cachedStudent = (cachedSnapshot?.students ?? students).find(
        (item) => String(item.number).trim() === normalizedStudentNumber,
      );
      if (!cachedStudent) throw new Error("Student ID number not found offline.");
      return {
        assessment: {
          ...cachedAssessment,
          section: cachedSection,
        },
        enrollmentId: cachedStudent.id,
        attemptsUsed: 0,
        attemptsRemaining: 1,
        attemptNumber: 1,
        attemptLimit: 1,
        availableFrom: cachedAssessment.available_from || null,
        availableUntil: cachedAssessment.available_until || null,
        serverNow: new Date().toISOString(),
        student: {
          id: cachedStudent.studentId ?? cachedStudent.id,
          number: cachedStudent.number,
          name: cachedStudent.name,
        },
      };
    }

    let { data: assessment, error: assessmentError } = await supabase
      .from("assessments")
      .select(
        "id, section_id, period_id, category, item_no, access_key, title, instructions, time_limit_minutes, available_from, available_until, created_at, period:grading_periods(code), section:sections(id, subject_code, subject_title), questions:assessment_questions(id, question_no, question_type, prompt, points, choices, correct_answer, language, starter_code, expected_output)",
      )
      .eq("access_key", normalizedKey)
      .maybeSingle();
    if (assessmentError) {
      const fallbackAssessment = await supabase
        .from("assessments")
        .select(
          "id, section_id, period_id, category, item_no, access_key, title, instructions, created_at, period:grading_periods(code), section:sections(id, subject_code, subject_title), questions:assessment_questions(id, question_no, question_type, prompt, points, choices, correct_answer, language, starter_code, expected_output)",
        )
        .eq("access_key", normalizedKey)
        .maybeSingle();
      if (fallbackAssessment.error) throw assessmentError;
      assessment = fallbackAssessment.data
        ? { ...fallbackAssessment.data, time_limit_minutes: null, available_from: null, available_until: null }
        : null;
    }
    if (!assessment) throw new Error("Assessment Key ID not found.");

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, student_no, full_name")
      .eq("student_no", normalizedStudentNumber)
      .maybeSingle();
    if (studentError) throw studentError;
    if (!student) throw new Error("Student ID number not found.");

    const { data: enrollment, error: enrollmentError } = await supabase
      .from("enrollments")
      .select("id")
      .eq("section_id", assessment.section_id)
      .eq("student_id", student.id)
      .maybeSingle();
    if (enrollmentError) throw enrollmentError;
    if (!enrollment) throw new Error("This student is not enrolled in the assessment class.");

    const { data: grantRow } = await supabase
      .from("assessment_attempt_grants")
      .select("extra_attempts")
      .eq("assessment_id", assessment.id)
      .eq("student_id", student.id)
      .maybeSingle();
    const grantedAttempts = Math.max(0, Number(grantRow?.extra_attempts || 0));
    assessment = {
      ...assessment,
      attemptGrants: grantRow ? [grantRow] : [],
    };
    const { count: attemptCount, error: attemptCountError } = await supabase
      .from("assessment_attempts")
      .select("id", { count: "exact", head: true })
      .eq("assessment_id", assessment.id)
      .eq("student_id", student.id);
    if (!attemptCountError) {
      const attemptsUsed = attemptCount || 0;
      const attemptLimit = 1 + grantedAttempts;
      if (attemptsUsed >= attemptLimit) {
        throw new Error(`You have used all ${attemptLimit} allowed attempt${attemptLimit === 1 ? "" : "s"}.`);
      }
      const now = Date.now();
      const availableFrom = assessment.available_from ? Date.parse(assessment.available_from) : NaN;
      const availableUntil = assessment.available_until ? Date.parse(assessment.available_until) : NaN;
      if (Number.isFinite(availableFrom) && now < availableFrom) throw new Error("This assessment is not open yet.");
      if (Number.isFinite(availableUntil) && now > availableUntil) throw new Error("The answer time for this assessment has ended.");
      return {
        assessment,
        enrollmentId: enrollment.id,
        attemptsUsed,
        attemptsRemaining: attemptLimit - attemptsUsed,
        attemptNumber: attemptsUsed + 1,
        attemptLimit,
        availableFrom: assessment.available_from || null,
        availableUntil: assessment.available_until || null,
        serverNow: new Date().toISOString(),
        student: { id: student.id, number: student.student_no, name: student.full_name },
      };
    }

    return {
      assessment,
      enrollmentId: enrollment.id,
      attemptsUsed: 0,
      attemptsRemaining: 1 + grantedAttempts,
      attemptNumber: 1,
      attemptLimit: 1 + grantedAttempts,
      availableFrom: assessment.available_from || null,
      availableUntil: assessment.available_until || null,
      serverNow: new Date().toISOString(),
      student: {
        id: student.id,
        number: student.student_no,
        name: student.full_name,
      },
    };
  }, [sections, students]);

  const submitAssessment = useCallback(
    async ({ assessmentId, studentId, answers, assessment: loadedAssessment, enrollmentId, attemptNumber = 1, autoSubmit = false, violations = [] }) => {
      const assessment =
        loadedAssessment ??
        assessmentDefinitions.find((item) => item.id === assessmentId);
      if (!assessment) throw new Error("The selected assessment was not found.");
      const grantedAttempts = Math.max(
        0,
        Number(
          assessment.attemptGrants?.find((grant) => grant.student_id === studentId)
            ?.extra_attempts || 0,
        ),
      );
      const attemptLimit = 1 + grantedAttempts;
      const targetSectionId = currentSectionId ?? assessment.section_id;
      if (!targetSectionId) throw new Error("No active Supabase section.");
      if (!loadedAssessment && !students.some((student) => student.id === studentId))
        throw new Error("Select a valid student before submitting.");
      if (!enrollmentId) throw new Error("The student enrollment could not be identified.");

      const questions = [...(assessment.questions ?? [])].sort(
        (first, second) => Number(first.question_no) - Number(second.question_no),
      );
      const maxScore = questions.reduce(
        (total, question) => total + Number(question.points || 0),
        0,
      );
      const answerRows = questions.map((question) => {
        const answer = String(answers?.[question.id] ?? "");
        const isMultipleChoice = question.question_type === "multiple_choice";
        const hasExpectedCodingAnswer = Boolean(question.expected_output?.trim());
        const codingSimilarity = hasExpectedCodingAnswer
          ? answerSimilarity(answer, question.expected_output)
          : 0;
        const isCorrect = isMultipleChoice
          ? answer === question.correct_answer
          : hasExpectedCodingAnswer && codingSimilarity === 1;
        const isPartial =
          !isMultipleChoice &&
          hasExpectedCodingAnswer &&
          codingSimilarity >= 0.75 &&
          codingSimilarity < 1;
        const pointsMultiplier = isCorrect ? 1 : isPartial ? 0.5 : 0;
        return {
          question_id: question.id,
          answer,
          is_correct: isMultipleChoice || hasExpectedCodingAnswer ? isCorrect : null,
          points_earned: Number(question.points || 0) * pointsMultiplier,
        };
      });
      if (!autoSubmit && answerRows.some((answer) => !answer.answer.trim())) {
        throw new Error("Answer every question before submitting.");
      }
      const score = answerRows.reduce(
        (total, answer) => total + Number(answer.points_earned || 0),
        0,
      );
      const needsReview = questions.some(
        (question) =>
          question.question_type === "coding" &&
          !question.expected_output?.trim(),
      );

      const lanAttemptId = createLocalId();
      const lanResult = await callLanApi("/api/student-assessment/submit", {
        method: "POST",
        body: JSON.stringify({
          attempt: {
            id: lanAttemptId,
            assessment_id: assessmentId,
            student_id: studentId,
            status: needsReview ? "needs_review" : "submitted",
            score,
            max_score: maxScore,
            attempt_no: Number(attemptNumber) || 1,
            submitted_at: new Date().toISOString(),
          },
          answers: answerRows.map((answer) => ({
            ...answer,
            attempt_id: lanAttemptId,
          })),
          violations,
          score: {
            section_id: assessment.section_id,
            period_id: assessment.period_id,
            enrollment_id: enrollmentId,
            category: assessment.category,
            item_no: assessment.item_no,
            score,
            max_score: maxScore,
          },
          periodCode: assessment.period?.code || null,
          autoSubmit,
        }),
      });
      if (lanResult) return lanResult;

      if (browserIsOffline() || !supabase) {
        if (!assessment.item_no) {
          throw new Error("This assessment is missing its Record Score column.");
        }
        const attemptId =
          createLocalId();
        await queueOfflineChange("submit-assessment", {
          attempt: {
            id: attemptId,
            assessment_id: assessmentId,
            student_id: studentId,
            attempt_no: Number(attemptNumber) || 1,
            status: needsReview ? "needs_review" : "submitted",
            score,
            max_score: maxScore,
            submitted_at: new Date().toISOString(),
          },
          answers: answerRows.map((answer) => ({ ...answer, attempt_id: attemptId })),
          violations: violations.map((violation) => ({
            ...violation,
            assessment_id: assessmentId,
            student_id: studentId,
            attempt_no: Number(attemptNumber) || 1,
          })),
          score: {
            section_id: targetSectionId,
            period_id: assessment.period_id,
            enrollment_id: enrollmentId,
            category: assessment.category,
            item_no: assessment.item_no,
            score,
            max_score: maxScore,
          },
        });
        return {
          score,
          maxScore,
          needsReview,
          queued: true,
          attemptNumber: Number(attemptNumber) || 1,
          attemptsRemaining: Math.max(0, attemptLimit - (Number(attemptNumber) || 1)),
          autoSubmitted: autoSubmit,
        };
      }
      const { data: attempt, error: attemptError } = await supabase
        .from("assessment_attempts")
        .insert(
          {
            assessment_id: assessmentId,
            student_id: studentId,
            attempt_no: Number(attemptNumber) || 1,
            status: needsReview ? "needs_review" : "submitted",
            score,
            max_score: maxScore,
            submitted_at: new Date().toISOString(),
          },
        )
        .select("id")
        .single();
      if (attemptError) throw attemptError;

      const { error: clearAnswersError } = await supabase
        .from("assessment_answers")
        .delete()
        .eq("attempt_id", attempt.id);
      if (clearAnswersError) throw clearAnswersError;
      if (answerRows.length) {
        const { error: answerError } = await supabase
          .from("assessment_answers")
          .insert(answerRows.map((answer) => ({ ...answer, attempt_id: attempt.id })));
        if (answerError) throw answerError;
      }
      if (violations.length) {
        const { error: violationError } = await supabase
          .from("assessment_violations")
          .insert(violations.map((violation) => ({
            ...violation,
            assessment_id: assessmentId,
            student_id: studentId,
            attempt_no: Number(attemptNumber) || 1,
          })));
        if (violationError) throw violationError;
      }
      if (!assessment.item_no) {
        throw new Error("This assessment is missing its Record Score column. Re-run the latest schema migration.");
      }
      const { error: scoreError } = await supabase
        .from("assessment_scores")
        .upsert(
          {
            section_id: assessment.section_id,
            period_id: assessment.period_id,
            enrollment_id: enrollmentId,
            category: assessment.category,
            item_no: assessment.item_no,
            score,
            max_score: maxScore,
          },
          { onConflict: "section_id,period_id,enrollment_id,category,item_no" },
        );
      if (scoreError) throw scoreError;
      await loadLiveData(assessment.section_id);
      return {
        score,
        maxScore,
        needsReview,
        attemptNumber: Number(attemptNumber) || 1,
        attemptsRemaining: Math.max(0, attemptLimit - (Number(attemptNumber) || 1)),
        autoSubmitted: autoSubmit,
      };
    },
    [
      assessmentDefinitions,
      currentSectionId,
      loadLiveData,
      queueOfflineChange,
      students,
    ],
  );

  const addStudent = useCallback(
    async (student) => {
      if (!currentSectionId)
        throw new Error("No active Supabase section.");
      if (browserIsOffline() || !supabase) {
        const studentId =
          createLocalId();
        const enrollmentId =
          createLocalId();
        const studentRow = {
          id: studentId,
          ...student,
          gender: student.gender || null,
        };
        const enrollment = {
          id: enrollmentId,
          section_id: currentSectionId,
          student_id: studentId,
          ctrl_no: students.length + 1,
          status: "active",
        };
        await queueOfflineChange("add-student", {
          student: studentRow,
          enrollment,
        });
        const fullName = student.full_name || "Unnamed student";
        setStudents((current) => [
          ...current,
          {
            id: enrollmentId,
            studentId,
            ctrlNo: enrollment.ctrl_no,
            name: fullName,
            initials: fullName
              .split(" ")
              .map((part) => part[0])
              .slice(0, 2)
              .join("")
              .toUpperCase(),
            color: "plum",
            number: student.student_no || `CTRL-${enrollment.ctrl_no}`,
            gender: student.gender || "—",
            attendance: 0,
            grades: {},
            grade: 0,
            status: "On track",
          },
        ]);
        return;
      }
      const { data: createdStudent, error: studentError } = await supabase
        .from("students")
        .insert({ ...student, gender: student.gender || null })
        .select("id")
        .single();
      if (studentError) throw studentError;
      const { error: enrollmentError } = await supabase
        .from("enrollments")
        .insert({
          section_id: currentSectionId,
          student_id: createdStudent.id,
          status: "active",
        });
      if (enrollmentError) throw enrollmentError;
      await loadLiveData(currentSectionId);
    },
    [currentSectionId, loadLiveData, queueOfflineChange, students.length],
  );

  const updateSection = useCallback(
    async (sectionId, changes) => {
      if (!sectionId) throw new Error("No class was selected for editing.");

      const subjectCode = String(changes?.subject_code ?? "").trim();
      if (!subjectCode) throw new Error("Subject code is required.");

      const sectionChanges = {
        days: String(changes?.days ?? "").trim() || null,
        time_start: changes?.time_start || null,
        time_end: changes?.time_end || null,
        edp_code: String(changes?.edp_code ?? "").trim() || null,
        subject_code: subjectCode,
        subject_title: String(changes?.subject_title ?? "").trim() || null,
        room: String(changes?.room ?? "").trim() || null,
        year_level: String(changes?.year_level ?? "").trim() || null,
        section_no: String(changes?.section_no ?? "").trim() || null,
      };

      if (browserIsOffline() || !supabase) {
        await queueOfflineChange("update-section", {
          sectionId,
          changes: sectionChanges,
        });
        setSections((current) =>
          current.map((item) =>
            item.id === sectionId ? { ...item, ...sectionChanges } : item,
          ),
        );
        setSection((current) =>
          current?.id === sectionId ? { ...current, ...sectionChanges } : current,
        );
        return;
      }

      const { error } = await supabase
        .from("sections")
        .update(sectionChanges)
        .eq("id", sectionId);
      if (error) throw error;
      await loadLiveData(sectionId);
    },
    [loadLiveData, queueOfflineChange],
  );

  const deleteSection = useCallback(
    async (sectionId) => {
      if (!sectionId)
        throw new Error("No class was selected for deletion.");

      if (browserIsOffline() || !supabase) {
        await queueOfflineChange("delete-section", { sectionId });
        setSections((current) => current.filter((item) => item.id !== sectionId));
        if (currentSectionId === sectionId) clearLiveData();
        return;
      }

      const { data: enrollments, error: enrollmentError } = await supabase
        .from("enrollments")
        .select("student_id")
        .eq("section_id", sectionId);
      if (enrollmentError) throw enrollmentError;

      // The database cascades this deletion to enrollments, scores, grades,
      // class sessions, and attendance records.
      const { error: sectionError } = await supabase
        .from("sections")
        .delete()
        .eq("id", sectionId);
      if (sectionError) throw sectionError;

      // Keep shared student profiles, but remove profiles that no longer
      // belong to any class.
      const studentIds = [
        ...new Set((enrollments ?? []).map((enrollment) => enrollment.student_id)),
      ];
      if (studentIds.length) {
        const { data: remainingEnrollments, error: remainingError } = await supabase
          .from("enrollments")
          .select("student_id")
          .in("student_id", studentIds);
        if (!remainingError) {
          const remainingIds = new Set(
            (remainingEnrollments ?? []).map((enrollment) => enrollment.student_id),
          );
          const orphanedStudentIds = studentIds.filter(
            (studentId) => !remainingIds.has(studentId),
          );
          if (orphanedStudentIds.length) {
            await supabase.from("students").delete().in("id", orphanedStudentIds);
          }
        }
      }

      await loadLiveData();
    },
    [currentSectionId, loadLiveData, queueOfflineChange],
  );

  const flushOfflineMutations = useCallback(async () => {
    if (!supabase || browserIsOffline()) return;
    const mutations = await listOfflineMutations();
    setPendingSyncCount(mutations.length);
    if (!mutations.length) return;

    const affectedSections = new Set();
    try {
      for (const mutation of mutations) {
        const result = await replayOfflineMutation({
          supabase,
          mutation,
          importMasterList: (file) => importMasterListFile({ file, supabase }),
          importGradeSheet: (file) => importGradeSheetFile({ file, supabase }),
        });
        if (result?.sectionId) affectedSections.add(result.sectionId);
        await removeOfflineMutation(mutation.id);
        setPendingSyncCount((current) => Math.max(current - 1, 0));
      }

      for (const sectionId of affectedSections) {
        const loaded = await loadLiveData(sectionId);
        if (loaded?.students?.length && loaded.periods?.length) {
          for (const periodRow of loaded.periods) {
            await recalculatePeriodGrades(periodRow.id, sectionId, loaded.students);
          }
          await loadLiveData(sectionId);
        }
      }
      setConnectionStatus("live");
      setConnectionMessage("Online · changes synced");
    } catch (error) {
      if (isNetworkError(error)) {
        setConnectionStatus("offline");
        setConnectionMessage("Offline · changes remain queued");
      } else {
        setConnectionStatus("error");
        setConnectionMessage("Sync paused · " + (error.message ?? "retrying later"));
      }
      setPendingSyncCount(await countOfflineMutations());
    }
  }, [loadLiveData, recalculatePeriodGrades]);

  useEffect(() => {
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
  }, [currentSectionId, flushOfflineMutations, loadLiveData]);

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
    updateSection,
    deleteSection,
    refreshGrades,
    refresh: loadLiveData,
  };
}