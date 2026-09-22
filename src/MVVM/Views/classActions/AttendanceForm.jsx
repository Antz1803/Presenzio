import { useState } from "react";

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const sessionTime = (section) =>
  Number(String(section?.time_start ?? "").split(":")[0]) >= 12 ? "PM" : "AM";

export function AttendanceForm({
  section,
  students,
  attendanceSessions,
  onSave,
  onClose,
}) {
  const time = sessionTime(section);
  const [date, setDate] = useState(today());
  const savedStatuses = (value) => {
    const saved = attendanceSessions.find(
      (item) =>
        item.sessionDate === value &&
        (!item.sessionTime || item.sessionTime === time),
    );
    return Object.fromEntries(
      students.map((student) => [
        student.id,
        saved?.statuses?.[student.id] ?? "present",
      ]),
    );
  };
  const [statuses, setStatuses] = useState(() => savedStatuses(date));
  const [saving, setSaving] = useState(false);
  const changeDate = (value) => {
    setDate(value);
    setStatuses(savedStatuses(value));
  };
  const save = async () => {
    setSaving(true);
    try {
      await onSave({ date, sessionTime: time, statuses });
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <div className="action-form-grid single">
        <label>
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => changeDate(e.target.value)}
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
              value={statuses[student.id] ?? "present"}
              onChange={(e) =>
                setStatuses({ ...statuses, [student.id]: e.target.value })
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
