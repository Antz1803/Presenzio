import { useState } from "react";
import { isDateInPeriodRange, formatDisplayDate, gradePeriods } from "./actionUtils";

function getSessionTime(section) {
  const hour = Number(String(section?.time_start ?? "").split(":")[0]);
  return Number.isFinite(hour) && hour >= 12 ? "PM" : "AM";
}

function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function AttendanceForm({
  section,
  students,
  attendanceSessions,
  onSave,
  onClose,
}) {
  const sessionTime = getSessionTime(section);
  const [date, setDate] = useState(getLocalDateInputValue());
  const statusesForDate = (selectedDate) => {
    const savedSession = attendanceSessions.find(
      (session) =>
        session.sessionDate === selectedDate &&
        (!session.sessionTime || session.sessionTime === sessionTime),
    );
    return Object.fromEntries(
      students.map((student) => [
        student.id,
        savedSession?.statuses?.[student.id] ?? "present",
      ]),
    );
  };
  const [statuses, setStatuses] = useState(() => statusesForDate(date));
  const [saving, setSaving] = useState(false);
  const changeDate = (nextDate) => {
    setDate(nextDate);
    setStatuses(statusesForDate(nextDate));
  };
  const save = async () => {
    setSaving(true);
    await onSave({ date, sessionTime, statuses });
    setSaving(false);
  };
  return (
    <>
      <div className="action-form-grid single">
        <label>
          Date
          <input
            name="attendanceDate"
            type="date"
            value={date}
            onChange={(event) => changeDate(event.target.value)}
          />
        </label>
      </div>
      <div className="action-roster">
        {students.map((student) => (
          <div className="action-roster-row" key={student.id}>
            <span>
              <b>{student.name}</b>
              <small>{student.number}</small>
            </span>
            <select
              name={`attendance-${student.id}`}
              value={statuses[student.id] ?? "present"}
              onChange={(event) =>
                setStatuses({ ...statuses, [student.id]: event.target.value })
              }
            >
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
              <option value="excused">Excused</option>
            </select>
          </div>
        ))}
      </div>
      <div className="action-modal-footer">
        <button className="outline-button" onClick={onClose}>
          Cancel
        </button>
        <button className="primary-button" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save attendance"}
        </button>
      </div>
    </>
  );
}

function attendanceSymbol(status) {
  return {
    present: "1",
    absent: "A",
    late: "L",
    excused: "E",
  }[status] ?? "—";
}

function AttendanceMatrix({ students, attendanceSessions, gradingPeriods }) {
  const [period, setPeriod] = useState("prelim");
  const selectedPeriod = gradingPeriods.find((item) => item.code === period);
  const periodDates = {
    start: selectedPeriod?.start_date ?? "",
    end: selectedPeriod?.end_date ?? "",
  };
  const visibleAttendanceSessions = attendanceSessions.filter((session) =>
    isDateInPeriodRange(session.sessionDate, periodDates),
  );
  const copy = async (text) => {
    if (navigator.clipboard) await navigator.clipboard.writeText(text);
  };

  const copyDateColumn = (session) =>
    copy(
      students
        .map((student) => attendanceSymbol(session.statuses[student.id]))
        .join("\n"),
    );

  return (
    <div className="attendance-matrix-wrap">
      <div className="record-summary-toolbar attendance-list-toolbar">
        <div className="period-pills" role="tablist" aria-label="Grading period">
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
          {periodDates.start && periodDates.end
            ? `${formatDisplayDate(periodDates.start)} – ${formatDisplayDate(periodDates.end)}`
            : "No date range set"}
        </span>
      </div>
      {periodDates.start && periodDates.end ? (
        <div className="table-wrap attendance-matrix-table">
          <table>
            <thead>
              <tr>
                <th className="attendance-name-column">
                  <span>STUDENT NAME</span>
                  <button
                    className="copy-button"
                    onClick={() => copy(students.map((student) => student.name).join("\n"))}
                  >
                    Copy
                  </button>
                </th>
                {visibleAttendanceSessions.map((session) => (
                  <th key={session.id}>
                    <span>
                      {session.sessionDate
                        ? formatDisplayDate(session.sessionDate)
                        : session.date}
                    </span>
                    <button className="copy-button" onClick={() => copyDateColumn(session)}>
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
                    <button className="copy-button" onClick={() => copy(student.name)}>
                      Copy
                    </button>
                  </td>
                  {visibleAttendanceSessions.map((session) => (
                    <td key={session.id}>
                      {attendanceSymbol(session.statuses[student.id])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!students.length && (
            <div className="empty-state">No students are enrolled in this class.</div>
          )}
          {!visibleAttendanceSessions.length && students.length > 0 && (
            <div className="empty-state">No attendance dates in this period.</div>
          )}
        </div>
      ) : (
        <div className="empty-state record-summary-date-empty">
          Please set a start date and end date for {gradePeriods.find((item) => item.key === period)?.label}
          in Grade Sheet Settings.
        </div>
      )}
    </div>
  );
}

export { AttendanceForm, AttendanceMatrix };
