import { getPeriodGradingWeights } from "./dashboardConstants";
import { transmutePercentage } from "./dashboardUtils";

const PERIOD_ALIASES = {
  prelim: "prelim",
  midterm: "midterm",
  semifinal: "semifinal",
  "semi-final": "semifinal",
  final: "final",
};

const periodCode = (value) => PERIOD_ALIASES[String(value ?? "").toLowerCase()] ?? value;

const isBlank = (value) =>
  value == null || (typeof value === "string" && value.trim() === "");

const hasNumericValue = (value) => !isBlank(value) && Number.isFinite(Number(value));

// Mirrors Excel AVERAGE over cells: blanks are ignored.
const averageDefined = (values) => {
  const valid = values.filter((value) => hasNumericValue(value));
  return valid.length
    ? valid.reduce((sum, value) => sum + Number(value), 0) / valid.length
    : null;
};

function sessionsFor(period, sessions) {
  return (sessions ?? []).filter((session) => {
    const code = periodCode(
      session.periodCode ?? session.period?.code ?? session.period_id,
    );
    if (code !== period.code) return false;
    const date = String(session.sessionDate ?? session.session_date ?? "").slice(0, 10);
    if (!date || !period.start_date || !period.end_date) return true;
    return date >= period.start_date && date <= period.end_date;
  });
}

function attendanceStatus(session, studentId) {
  if (session.statuses?.[studentId] != null) return session.statuses[studentId];
  return (session.attendance_records ?? []).find(
    (record) => String(record.enrollment_id) === String(studentId),
  )?.status;
}

// Excel: attendance cells are summed (=SUM(E7:S7)). Blank/absent counts as 0.
// present/late = 1; a raw number (e.g. 0.5) is used as-is.
function attendanceValue(status) {
  if (isBlank(status)) return 0;
  if (hasNumericValue(status)) return Number(status);
  const s = String(status).toLowerCase();
  return s === "present" || s === "late" ? 1 : 0;
}

export function calculateGradeDetailsFromRecords({
  students = [],
  assessmentScores = [],
  attendanceSessions = [],
  gradingPeriods = [],
  gradeOverrides = {},
}) {
  const ownGrades = new Map();

  gradingPeriods.forEach((period) => {
    const code = periodCode(period.code);
    const weights = getPeriodGradingWeights(period);
    const sessions = sessionsFor({ ...period, code }, attendanceSessions);
    const periodGrades = new Map();

    students.forEach((student) => {
      const categoryGrades = {};

      Object.keys(weights).forEach((category) => {
        if (category === "attendance" || category === "spacer") return;
        const itemGrades = assessmentScores
          .filter(
            (row) =>
              periodCode(row.period?.code ?? row.period_id) === code &&
              String(row.enrollment_id) === String(student.id) &&
              row.category === category &&
              // Excel skips an item only when its max score is blank/0.
              hasNumericValue(row.max_score) &&
              Number(row.max_score) > 0,
          )
          .map((row) => {
            // Excel: a blank score on a listed student is treated as 0 (-> 5.0).
            const score = hasNumericValue(row.score) ? Number(row.score) : 0;
            return transmutePercentage((score / Number(row.max_score)) * 100);
          })
          .filter((grade) => grade != null);
        if (itemGrades.length) {
          categoryGrades[category] =
            itemGrades.reduce((sum, value) => sum + value, 0) / itemGrades.length;
        }
      });

      // Excel: AG = transmute(SUM(attendance) / COUNT(dated columns) * 100),
      // computed for every listed student whenever the period has sessions.
      if (sessions.length > 0) {
        const attended = sessions.reduce(
          (sum, session) =>
            sum + attendanceValue(attendanceStatus(session, student.id)),
          0,
        );
        categoryGrades.attendance = transmutePercentage(
          (attended / sessions.length) * 100,
        );
      }

      // Excel: SUM(PRODUCT(category, weight)); missing categories add 0.
      const contributing = Object.entries(weights).filter(
        ([category]) => categoryGrades[category] != null,
      );
      let gradePoint = null;
      if (contributing.length) {
        gradePoint = contributing.reduce(
          (sum, [category, weight]) => sum + categoryGrades[category] * weight,
          0,
        );
      } else {
        const overrideOwn = gradeOverrides?.[code]?.[student.id]?.own;
        if (hasNumericValue(overrideOwn)) gradePoint = Number(overrideOwn);
      }
      if (gradePoint != null) periodGrades.set(student.id, gradePoint);
    });
    ownGrades.set(code, periodGrades);
  });

  const cumulativeByStudent = new Map();
  const result = students.map((student) => {
    const prelim = ownGrades.get("prelim")?.get(student.id) ?? null;
    const midterm = ownGrades.get("midterm")?.get(student.id) ?? null;
    const semifinal = ownGrades.get("semifinal")?.get(student.id) ?? null;
    const final = ownGrades.get("final")?.get(student.id) ?? null;

    // Midterm!AL: TMG*0.7 + PG*0.3 (needs both)
    const cumulativeMidterm =
      prelim != null && midterm != null ? midterm * 0.7 + prelim * 0.3 : null;
    // SemiFinal!AM: AVERAGE(PG, MG, own SF)
    const cumulativeSemifinal =
      semifinal != null
        ? averageDefined([prelim, cumulativeMidterm, semifinal])
        : null;
    // Final!AN: AVERAGE(AVERAGE(PG, MG), AVERAGE(SFG, own Final))
    const cumulativeFinal =
      final != null
        ? averageDefined([
            averageDefined([prelim, cumulativeMidterm]),
            averageDefined([cumulativeSemifinal, final]),
          ])
        : gradeOverrides?.final?.[student.id]?.cumulative ?? null;

    const cumulative = {
      prelim,
      midterm:
        cumulativeMidterm ?? gradeOverrides?.midterm?.[student.id]?.cumulative ?? null,
      semifinal:
        cumulativeSemifinal ?? gradeOverrides?.semifinal?.[student.id]?.cumulative ?? null,
      final: cumulativeFinal,
    };
    cumulativeByStudent.set(student.id, cumulative);

    const grades = {};
    if (cumulative.prelim != null) grades.prelim = cumulative.prelim;
    if (cumulative.midterm != null) grades.midterm = cumulative.midterm;
    if (cumulative.semifinal != null) grades.semifinal = cumulative.semifinal;
    // Summary!F: <= 3.05 keeps the grade, otherwise 5
    if (cumulative.final != null)
      grades.final = cumulative.final <= 3.05 ? cumulative.final : 5;
    return { ...student, grades };
  });

  return { ownGrades, cumulativeByStudent, students: result };
}

export function calculateGradesFromRecords(inputs) {
  return calculateGradeDetailsFromRecords(inputs).students;
}
