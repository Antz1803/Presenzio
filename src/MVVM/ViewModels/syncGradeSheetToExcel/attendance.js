import {
  attendanceLayout,
  attendanceRosterRows,
  maxAttendanceDatesPerPeriod,
} from "./constants";
import { formatDate } from "./formatters";
import { clearRange, patchCell } from "./patches";

function groupSessionsByPeriod(attendanceSessions) {
  const sessionsByPeriod = Object.fromEntries(
    Object.keys(attendanceLayout).map((periodCode) => [periodCode, []]),
  );
  attendanceSessions.forEach((session) => {
    if (sessionsByPeriod[session.periodCode]) sessionsByPeriod[session.periodCode].push(session);
  });
  Object.entries(sessionsByPeriod).forEach(([periodCode, sessions]) => {
    sessions.sort((a, b) => String(a.sessionDate).localeCompare(String(b.sessionDate)));
    if (sessions.length > maxAttendanceDatesPerPeriod) {
      throw new Error(
        `${periodCode} has more than ${maxAttendanceDatesPerPeriod} attendance dates, which the Excel template cannot display.`,
      );
    }
  });
  return sessionsByPeriod;
}

function clearAttendanceSheet(patches) {
  clearRange(patches, "Attendance", 5, 5, 0, 2);
  clearRange(patches, "Attendance", 6, attendanceRosterRows + 5, 0, 2);
  Object.values(attendanceLayout).forEach(({ startColumn, totalColumn }) => {
    clearRange(patches, "Attendance", 5, 5, startColumn, totalColumn);
    clearRange(patches, "Attendance", 6, attendanceRosterRows + 5, startColumn, totalColumn);
  });
}

function writeAttendanceHeaders(patches, sessionsByPeriod) {
  ["CtrlNo.", "Gender", "Student's Name"].forEach((value, column) => {
    patchCell(patches, "Attendance", 5, column, value);
  });
  Object.entries(attendanceLayout).forEach(([periodCode, layout]) => {
    sessionsByPeriod[periodCode].forEach((session, index) => {
      patchCell(patches, "Attendance", 5, layout.startColumn + index, formatDate(session.sessionDate));
    });
    patchCell(
      patches,
      "Attendance",
      5,
      layout.totalColumn,
      `TOTAL|${sessionsByPeriod[periodCode].length}`,
    );
  });
}

function writeStudentAttendance(patches, student, index, sessionsByPeriod) {
  const row = 6 + index;
  patchCell(patches, "Attendance", row, 0, index + 1);
  patchCell(patches, "Attendance", row, 1, ["M", "F"].includes(student.gender) ? student.gender : "");
  patchCell(patches, "Attendance", row, 2, student.name);

  Object.entries(attendanceLayout).forEach(([periodCode, layout]) => {
    let attended = 0;
    sessionsByPeriod[periodCode].forEach((session, sessionIndex) => {
      const status = session.statuses?.[student.id];
      if (status === "present" || status === "late") attended += 1;
      patchCell(
        patches,
        "Attendance",
        row,
        layout.startColumn + sessionIndex,
        { present: 1, absent: "A", late: "L", excused: "E" }[status] || "",
      );
    });
    patchCell(patches, "Attendance", row, layout.totalColumn, attended);
  });
}

export function fillAttendance(patches, students, attendanceSessions) {
  const sessionsByPeriod = groupSessionsByPeriod(attendanceSessions);
  clearAttendanceSheet(patches);
  writeAttendanceHeaders(patches, sessionsByPeriod);
  students.forEach((student, index) => writeStudentAttendance(patches, student, index, sessionsByPeriod));
}
