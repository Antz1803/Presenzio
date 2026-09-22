import { useState } from "react";
import {
  isDateInPeriodRange,
  formatDisplayDate,
  gradePeriods,
} from "./actionUtils";

const symbols = { present: "1", absent: "A", late: "L", excused: "E" };
export function AttendanceMatrix({
  students,
  attendanceSessions,
  gradingPeriods,
}) {
  const [period, setPeriod] = useState("prelim");
  const selected = gradingPeriods.find((item) => item.code === period);
  const dates = {
    start: selected?.start_date ?? "",
    end: selected?.end_date ?? "",
  };
  const sessions = attendanceSessions.filter((session) =>
    isDateInPeriodRange(session.sessionDate, dates),
  );
  const copy = (value) => navigator.clipboard?.writeText(value);
  return (
    <div className="attendance-matrix-wrap">
      <div className="record-summary-toolbar attendance-list-toolbar">
        <div className="period-pills" role="tablist">
          {gradePeriods.map((item) => (
            <button
              key={item.key}
              className={period === item.key ? "active" : ""}
              onClick={() => setPeriod(item.key)}
              role="tab"
              aria-selected={period === item.key}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="record-period-range">
          {dates.start && dates.end
            ? `${formatDisplayDate(dates.start)} – ${formatDisplayDate(dates.end)}`
            : "No date range set"}
        </span>
      </div>
      {dates.start && dates.end ? (
        <div className="table-wrap attendance-matrix-table">
          <table>
            <thead>
              <tr>
                <th className="attendance-name-column">
                  <span>STUDENT NAME</span>
                  <button
                    className="copy-button"
                    onClick={() =>
                      copy(students.map((student) => student.name).join("\n"))
                    }
                  >
                    Copy
                  </button>
                </th>
                {sessions.map((session) => (
                  <th key={session.id}>
                    <span>
                      {formatDisplayDate(session.sessionDate || session.date)}
                    </span>
                    <button
                      className="copy-button"
                      onClick={() =>
                        copy(
                          students
                            .map(
                              (student) =>
                                symbols[session.statuses[student.id]] ?? "—",
                            )
                            .join("\n"),
                        )
                      }
                    >
                      Copy
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td className="attendance-student-name">
                    <span>{student.name}</span>
                    <button
                      className="copy-button"
                      onClick={() => copy(student.name)}
                    >
                      Copy
                    </button>
                  </td>
                  {sessions.map((session) => (
                    <td key={session.id}>
                      {symbols[session.statuses[student.id]] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!students.length && (
            <div className="empty-state">
              No students are enrolled in this class.
            </div>
          )}
          {!sessions.length && students.length > 0 && (
            <div className="empty-state">
              No attendance dates in this period.
            </div>
          )}
        </div>
      ) : (
        <div className="empty-state record-summary-date-empty">
          Please set dates for{" "}
          {gradePeriods.find((item) => item.key === period)?.label} in Grade
          Sheet Settings.
        </div>
      )}
    </div>
  );
}
