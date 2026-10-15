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
      <div className="grid grid-cols-[repeat(2,1fr)] gap-3 [&.single]:grid-cols-[1fr] [&_label]:flex [&_label]:flex-col [&_label]:gap-1.5 [&_label]:text-ink-2 [&_label]:text-[10px] [&_label]:font-semibold [&_input]:w-full [&_input]:box-border [&_input]:border [&_input]:border-white/10 [&_input]:rounded-[7px] [&_input]:bg-surface-1 [&_input]:text-ink-2 [&_input]:p-[9px] [&_input]:text-[11px] [&_input]:outline-none [&_select]:w-full [&_select]:box-border [&_select]:border [&_select]:border-white/10 [&_select]:rounded-[7px] [&_select]:bg-surface-1 [&_select]:text-ink-2 [&_select]:p-[9px] [&_select]:text-[11px] [&_select]:outline-none [&_input:focus]:border-accent/30 [&_input:focus]:[box-shadow:0_0_0_3px_#162032] [&_select:focus]:border-accent/30 [&_select:focus]:[box-shadow:0_0_0_3px_#162032] max-[760px]:grid-cols-[repeat(2,1fr)] [.action-modal_&_label]:text-ink-2 [.action-modal_&_label]:text-[10px] [.action-modal_&_label]:tracking-[.1px] [.action-modal_&_input]:border-white/10 [.action-modal_&_input]:rounded-[9px] [.action-modal_&_input]:bg-surface-1 [.action-modal_&_input]:[box-shadow:0_2px_5px_rgba(0,240,255,0.01)] [.action-modal_&_input]:transition [.action-modal_&_select]:border-white/10 [.action-modal_&_select]:rounded-[9px] [.action-modal_&_select]:bg-surface-1 [.action-modal_&_select]:[box-shadow:0_2px_5px_rgba(0,240,255,0.01)] [.action-modal_&_select]:transition [.action-modal_&_input:hover]:border-accent/30 [.action-modal_&_select:hover]:border-accent/30 [.action-modal_&_input:focus]:border-accent/30 [.action-modal_&_input:focus]:[box-shadow:0_0_0_3px_#162032] [.action-modal_&_select:focus]:border-accent/30 [.action-modal_&_select:focus]:[box-shadow:0_0_0_3px_#162032] single">
        <label>
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => changeDate(e.target.value)}
          />
        </label>
      </div>
      <div className="max-h-[390px] overflow-auto mt-[15px] border border-white/10 rounded-[9px] [.action-modal_&]:border-white/10 [.action-modal_&]:rounded-xl [.action-modal_&]:[box-shadow:0_5px_15px_rgba(0,240,255,0.02)]">
        {students.map((student) => (
          <div className="[&_select]:w-[105px] [&_select]:box-border [&_select]:border [&_select]:border-white/10 [&_select]:rounded-[7px] [&_select]:bg-surface-1 [&_select]:text-ink-2 [&_select]:p-[7px] [&_select]:text-[11px] [&_select]:outline-none [&_select:focus]:border-accent/30 [&_select:focus]:[box-shadow:0_0_0_3px_#162032] flex items-center justify-between gap-[15px] py-2.5 px-3 border-b border-white/10 last:border-b-0 [&_span]:min-w-0 [&_span]:flex-1 [&_b]:block [&_b]:overflow-hidden [&_b]:text-ellipsis [&_b]:whitespace-nowrap [&_b]:text-ink-2 [&_b]:text-[11px] [&_small]:block [&_small]:overflow-hidden [&_small]:text-ellipsis [&_small]:whitespace-nowrap [&_small]:mt-[3px] [&_small]:text-ink-3 [&_small]:text-[9px] max-[760px]:gap-2 max-[760px]:[&_select]:w-[95px] [.action-modal_&_select]:border-white/10 [.action-modal_&_select]:rounded-[9px] [.action-modal_&_select]:bg-surface-1 [.action-modal_&_select]:[box-shadow:0_2px_5px_rgba(0,240,255,0.01)] [.action-modal_&_select]:transition [.action-modal_&_select:hover]:border-accent/30 [.action-modal_&_select:focus]:border-accent/30 [.action-modal_&_select:focus]:[box-shadow:0_0_0_3px_#162032] [.action-modal_&]:py-[13px] [.action-modal_&]:px-3.5 [.action-modal_&]:border-white/10 [.action-modal_&:hover]:bg-surface-1" key={student.id}>
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
      <div className="flex justify-end gap-2 mt-5.5 pt-[17px] border-t border-white/10 max-[760px]:flex-wrap max-[760px]:[&_button]:flex-1 [.assessment-builder_&]:mt-0.5">
        <button className="inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50" onClick={onClose}>
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
        <button className="inline-flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-canvas transition hover:shadow-halo active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50" onClick={save} disabled={saving || deleting}>
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
                className="inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
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