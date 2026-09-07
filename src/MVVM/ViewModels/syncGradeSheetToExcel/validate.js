import { maxStudents, periodSheets } from "./constants";
import { periodCodeForRow } from "./periods";

export function validateExportSnapshot({
  students,
  assessmentScores,
  attendanceSessions,
  gradingPeriods,
}) {
  if (!Array.isArray(students) || !students.length) {
    throw new Error("Excel sync stopped: no students were loaded from the database.");
  }
  if (students.length > maxStudents) {
    throw new Error(
      `Excel sync stopped: ${students.length} students exceed the template limit of ${maxStudents}.`,
    );
  }

  const studentIds = new Set();
  students.forEach((student) => {
    if (!student?.id || studentIds.has(student.id)) {
      throw new Error("Excel sync stopped: duplicate or missing enrollment IDs were found.");
    }
    studentIds.add(student.id);
  });

  const periodsById = new Map((gradingPeriods ?? []).map((period) => [period.id, period]));
  const periodCodes = new Set(Object.keys(periodSheets));
  const itemLimits = { quiz: 4, assignment: 4, activity: 4, exam: 1 };
  const invalidScores = (assessmentScores ?? []).filter((row) => {
    const periodCode = periodCodeForRow(row, periodsById);
    return (
      !periodCodes.has(periodCode) ||
      !studentIds.has(row.enrollment_id) ||
      !itemLimits[row.category] ||
      Number(row.item_no) < 1 ||
      Number(row.item_no) > itemLimits[row.category]
    );
  });
  if (invalidScores.length) {
    throw new Error(
      `Excel sync stopped: ${invalidScores.length} assessment record(s) cannot be mapped to the template.`,
    );
  }

  const invalidSessions = (attendanceSessions ?? []).filter(
    (session) => !periodCodes.has(session.periodCode),
  );
  if (invalidSessions.length) {
    throw new Error(
      `Excel sync stopped: ${invalidSessions.length} attendance session(s) have no valid grading period.`,
    );
  }

  const invalidAttendance = (attendanceSessions ?? []).flatMap((session) =>
    Object.keys(session.statuses ?? {}).filter((enrollmentId) => !studentIds.has(enrollmentId)),
  );
  if (invalidAttendance.length) {
    throw new Error(
      `Excel sync stopped: ${invalidAttendance.length} attendance record(s) belong to an unknown enrollment.`,
    );
  }

  return periodsById;
}
