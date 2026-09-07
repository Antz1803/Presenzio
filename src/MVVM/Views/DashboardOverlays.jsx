import { useEffect, useMemo, useState } from "react";
import { Icon } from "./DashboardShared";

const printActions = [
  ["prelim", "Print Prelim"],
  ["midterm", "Print Midterm"],
  ["semifinal", "Print Semi-Final"],
  ["final", "Print Final"],
  ["summary", "Print Summary"],
  ["monthly-attendance", "Print Monthly Attendance"],
];

function ClassOptionsModal({
  section,
  onClose,
  onOpenAction,
  onOpenPrint,
  onOpenStudentView,
  onSyncToExcel,
  syncReady,
}) {
  const [syncing, setSyncing] = useState(false);

  const handleSyncToExcel = async () => {
    setSyncing(true);
    try {
      await onSyncToExcel();
      onClose();
    } catch (error) {
      console.error("Excel sync failed:", error);
      window.alert(error?.message || "Excel synchronization failed.");
    } finally {
      setSyncing(false);
    }
  };

  const actions = [
    ["attendance", "Take Attendance"],
    ["attendance-list", "Attendance List"],
    ["create-assessment", "Create Assessment"],
    ["manage-assessments", "Manage Assessments"],
    ["record-score", "Record Score"],
    ["show-grades", "Show Grades"],
    ["grade-summary", "Record Summary"],
    ["grade-settings", "Grade Sheet Settings"],
  ];

  const buttonClass =
    "block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm print:hidden"
      onMouseDown={(event) => event.target === event.currentTarget && !syncing && onClose()}
    >
      <section
        className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="class-options-title"
      >
        <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
          <h2 id="class-options-title" className="text-sm font-extrabold uppercase tracking-wide text-slate-800">
            Class Options
          </h2>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
            disabled={syncing}
            aria-label="Close class options"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="mb-1 rounded-2xl bg-slate-50 p-3.5">
            <h3 className="text-sm font-bold text-slate-800">
              {section?.subject_code || "Class"} - {section?.subject_title || "Class subject"}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {section?.days || "Schedule not set"} · {section?.room || "Room not set"}
            </p>
          </div>

          {actions.map(([type, label]) => (
            <button
              className={buttonClass}
              key={type}
              disabled={syncing}
              onClick={() => onOpenAction(type, section.id)}
            >
              {label}
            </button>
          ))}

          <p className="mb-0.5 mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Print Records
          </p>
          {printActions.map(([type, label]) => (
            <button
              className={buttonClass}
              key={type}
              disabled={syncing}
              onClick={() => onOpenPrint(type, section.id)}
            >
              {label}
            </button>
          ))}

          <button
            className={`${buttonClass} mt-1`}
            disabled={syncing}
            onClick={() => {
              onClose();
              onOpenStudentView(section.id);
            }}
          >
            Open Student View
          </button>

          <button
            className="block w-full rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-2.5 text-left text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition hover:from-indigo-500 hover:to-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!syncReady || syncing}
            onClick={handleSyncToExcel}
          >
            {syncing ? "Syncing to Excel…" : syncReady ? "Sync to Excel" : "Loading class data..."}
          </button>

          <button
            className={buttonClass}
            disabled={syncing}
            onClick={() => onOpenAction("add-student", section.id)}
          >
            Add Student
          </button>
        </div>
      </section>
    </div>
  );
}

function StudentModal({ section, students, onClose }) {
  const sortedStudents = useMemo(
    () =>
      [...students].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", undefined, {
          sensitivity: "base",
        }),
      ),
    [students],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm print:hidden"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-modal-title"
      >
        <div className="mb-5 flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Class Students</p>
            <h2 id="student-modal-title" className="mt-1 text-lg font-bold text-slate-900">
              {section?.subject_code || "Students"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {section?.subject_title || "Students enrolled in this class"}
            </p>
          </div>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
            aria-label="Close students"
          >
            ×
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Student ID</th>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Gender</th>
                <th className="py-2 pr-3">Attendance</th>
                <th className="py-2 pr-3">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedStudents.map((student, index) => (
                <tr key={student.id}>
                  <td className="py-2 pr-3 text-slate-500">{index + 1}</td>
                  <td className="py-2 pr-3 text-slate-700">{student.number}</td>
                  <td className="py-2 pr-3 font-medium text-slate-800">{student.name}</td>
                  <td className="py-2 pr-3 text-slate-600">
                    {student.gender === "F" ? "Female" : student.gender === "M" ? "Male" : "—"}
                  </td>
                  <td className="py-2 pr-3 text-slate-600">{student.attendance}%</td>
                  <td className="py-2 pr-3 text-slate-600">{Number(student.grade || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {!sortedStudents.length && (
            <div className="py-10 text-center text-sm text-slate-500">
              No students have been imported for this class.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function DeleteClassModal({ section, deleting, error, onClose, onConfirm }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm print:hidden"
      onMouseDown={(event) => event.target === event.currentTarget && !deleting && onClose()}
    >
      <section
        className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-2xl"
        role="alertdialog"
        aria-modal="true"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-500">
          <Icon name="trash" size={22} />
        </div>

        <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Permanent Action</p>
        <h2 className="mt-1 text-lg font-bold text-slate-900">Delete this class?</h2>
        <p className="mt-2 text-sm text-slate-500">
          This will delete <strong>{section?.subject_code || "this class"}</strong>, including
          its students, scores, grades, and attendance records.
        </p>

        {error && <p className="mt-3 text-xs font-medium text-rose-600">{error}</p>}

        <div className="mt-6 flex justify-center gap-3">
          <button
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            onClick={onClose}
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:opacity-60"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete class"}
          </button>
        </div>
      </section>
    </div>
  );
}

function LiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const day = now.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="hidden sm:flex items-center gap-2.5 pl-3 pr-4 py-1.5 rounded-full bg-slate-900 text-white">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
      </span>
      <span className="text-xs font-mono font-semibold tracking-wide tabular-nums">{time}</span>
      <span className="w-px h-3 bg-white/20" />
      <span className="text-[11px] font-medium text-slate-300">{day}</span>
    </div>
  );
}

export { ClassOptionsModal, DeleteClassModal, LiveClock, StudentModal };
