const titles = {
  attendance: "Take Attendance",
  "attendance-list": "Attendance List",
  "record-score": "Record Score",
  "create-assessment": "Create Assessment",
  "manage-assessments": "Manage Assessments",
  "show-grades": "Show Grades",
  "grade-summary": "Record Summary",
  "grade-settings": "Grade Sheet Settings",
  "add-student": "Add Student",
};


export const gradePeriods = [
  { key: "prelim", label: "Prelim" },
  { key: "midterm", label: "Midterm" },
  { key: "semifinal", label: "Semi-final" },
  { key: "final", label: "Final" },
];

export function getGradeRemark(student) {
  // The workbook's Summary remarks are based only on the Final grade. An
  // earlier passing period must not make an unfinished Final appear passed.
  const finalGrade = student.grades?.final;
  if (finalGrade == null || !Number.isFinite(Number(finalGrade))) return "—";
  return Number(finalGrade) <= 3.05
    ? "Passed"
    : "Failed";
}

function formatRecordNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return Number.isInteger(number) ? String(number) : number.toFixed(2);
}

export function isDateInPeriodRange(dateValue, periodDates) {
  if (!periodDates?.start && !periodDates?.end) return true;
  const date = String(dateValue ?? "").slice(0, 10);
  if (!date) return false;
  return (
    (!periodDates.start || date >= periodDates.start) &&
    (!periodDates.end || date <= periodDates.end)
  );
}

export function formatDisplayDate(dateValue) {
  const date = new Date(`${String(dateValue).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue;
  const months = [
    "Jan.",
    "Feb.",
    "Mar.",
    "Apr.",
    "May",
    "Jun.",
    "Jul.",
    "Aug.",
    "Sep.",
    "Oct.",
    "Nov.",
    "Dec.",
  ];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function getAssessmentItem(
  studentId,
  category,
  itemNo,
  period,
  assessmentScores,
) {
  const record = assessmentScores.find(
    (row) =>
      row.enrollment_id === studentId &&
      row.category === category &&
      Number(row.item_no) === itemNo &&
      row.period?.code === period,
  );
  if (!record) return "0";
  const score = Number(record.score) || 0;
  const maximum = Number(record.max_score);
  return maximum > 0
    ? `${formatRecordNumber(score)}/${formatRecordNumber(maximum)}`
    : formatRecordNumber(score);
}

export function getAttendanceTotal(studentId, period, attendanceSessions, periodDates) {
  const hasDateRange = Boolean(periodDates?.start || periodDates?.end);
  const periodSessions = attendanceSessions.filter(
    (session) =>
      hasDateRange
        ? isDateInPeriodRange(session.sessionDate, periodDates)
        : !session.periodCode || session.periodCode === period,
  );
  const attended = periodSessions.filter((session) => {
    const status = session.statuses[studentId];
    return status === "present" || status === "late";
  }).length;
  return `${attended}/${periodSessions.length}`;
}

export function localDateTimeInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export { titles, formatRecordNumber };

export const recordSummaryGroups = [
  { key: "quiz", label: "QUIZ", prefix: "Q", count: 4 },
  { key: "assignment", label: "ASSIGNMENT", prefix: "A", count: 4 },
  { key: "activity", label: "GRADED ACTIVITY", prefix: "GA", count: 4 },
  { key: "exam", label: "EXAM", prefix: "E", count: 1 },
];
