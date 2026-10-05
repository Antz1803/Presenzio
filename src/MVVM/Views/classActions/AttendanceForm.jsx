import { useState, useMemo } from "react";
import { formatDisplayDate } from "./actionUtils";

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
  onDelete,
  onClose,
}) {
  const time = sessionTime(section);
  const [date, setDate] = useState(today());

  const existingSession = useMemo(
    () =>
      attendanceSessions.find(
        (item) =>
          item.sessionDate === date &&
          (!item.sessionTime || item.sessionTime === time),
      ),
    [attendanceSessions, date, time],
  );

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
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

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

  const confirmDelete = async () => {
    if (!existingSession || !onDelete) return;
    setDeleting(true);
    try {
      await onDelete({ date, sessionTime: time, session: existingSession });
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
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
            </select>
          </div>
        ))}
      </div>
      <div className="action-modal-footer">
        <button className="outline-button" onClick={onClose}>
          Cancel
        </button>
        {existingSession && onDelete && (
          <button
            className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:border-rose-400 hover:bg-rose-50 disabled:opacity-50"
            onClick={() => setConfirmOpen(true)}
            disabled={deleting || saving}
          >
            Delete attendance
          </button>
        )}
        <button className="primary-button" onClick={save} disabled={saving || deleting}>
          {saving ? "Saving…" : "Save attendance"}
        </button>
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-[90%] max-w-sm rounded-2xl bg-white p-7 shadow-2xl">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-lg font-extrabold text-rose-600">
              !
            </div>
            <h3 className="mb-2 text-base font-bold text-slate-900">
              Delete this attendance record?
            </h3>
            <p className="mb-6 text-sm leading-relaxed text-slate-500">
              Attendance for <b className="text-slate-700">{formatDisplayDate(date)}</b>{" "}
              will be permanently removed for all students. This can't be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="outline-button"
                onClick={() => setConfirmOpen(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}