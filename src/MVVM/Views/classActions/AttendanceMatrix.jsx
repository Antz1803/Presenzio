import { useState } from "react";
import {
  isDateInPeriodRange,
  formatDisplayDate,
  gradePeriods,
} from "./actionUtils";

const symbols = { present: "1", absent: "A" };
const statusLabels = {
  present: "Present",
  absent: "Absent",
};

const copyStatuses = (sessions) =>
  Object.fromEntries(
    sessions.map((session) => [session.id, { ...(session.statuses ?? {}) }]),
  );

const statusesMatch = (first = {}, second = {}) => {
  const keys = new Set([...Object.keys(first), ...Object.keys(second)]);
  return [...keys].every((key) => first[key] === second[key]);
};
export function AttendanceMatrix({
  students,
  attendanceSessions,
  gradingPeriods,
  onSave,
}) {
  const [period, setPeriod] = useState("prelim");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [draftStatuses, setDraftStatuses] = useState(() =>
    copyStatuses(attendanceSessions),
  );
  const selected = gradingPeriods.find((item) => item.code === period);
  const dates = {
    start: selected?.start_date ?? "",
    end: selected?.end_date ?? "",
  };
  const sessions = attendanceSessions.filter((session) =>
    isDateInPeriodRange(session.sessionDate, dates),
  );
  const copy = (value) => navigator.clipboard?.writeText(value);

  const toggleEditing = async () => {
    if (!editing) {
      setDraftStatuses(copyStatuses(attendanceSessions));
      setSaveError("");
      setEditing(true);
      return;
    }

    setSaving(true);
    setSaveError("");
    try {
      const changedSessions = attendanceSessions.filter(
        (session) =>
          !statusesMatch(session.statuses, draftStatuses[session.id]),
      );
      for (const session of changedSessions) {
        await onSave?.(
          {
            date: session.sessionDate || session.date,
            sessionTime: session.sessionTime,
            statuses: draftStatuses[session.id],
          },
          { keepOpen: true },
        );
      }
      setEditing(false);
    } catch (error) {
      setSaveError(
        error?.message || "The attendance changes could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = (sessionId, studentId, status) => {
    setDraftStatuses((current) => ({
      ...current,
      [sessionId]: {
        ...(current[sessionId] ?? {}),
        [studentId]: status,
      },
    }));
  };
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
        <div className="attendance-list-actions">
          <span className="record-period-range">
            {dates.start && dates.end
              ? `${formatDisplayDate(dates.start)} – ${formatDisplayDate(dates.end)}`
              : "No date range set"}
          </span>
          <button
            className={editing ? "primary-button" : "outline-button"}
            type="button"
            onClick={toggleEditing}
            disabled={saving}
          >
            {saving ? "Saving…" : editing ? "Read-only" : "Edit"}
          </button>
        </div>
      </div>
      {saveError && <p className="attendance-save-error">{saveError}</p>}
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
                      {editing ? (
                        <select
                          className="attendance-status-select"
                          aria-label={`${student.name} attendance on ${formatDisplayDate(session.sessionDate || session.date)}`}
                          value={draftStatuses[session.id]?.[student.id] ?? "present"}
                          onChange={(event) =>
                            updateStatus(
                              session.id,
                              student.id,
                              event.target.value,
                            )
                          }
                        >
                          {Object.entries(statusLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        symbols[session.statuses[student.id]] ?? "—"
                      )}
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
