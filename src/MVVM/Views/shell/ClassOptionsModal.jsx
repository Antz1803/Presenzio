import { useState } from "react";

const ACTIONS = [
  ["attendance", "Take Attendance"],
  ["attendance-list", "Attendance List"],
  ["create-assessment", "Create Assessment"],
  ["manage-assessments", "Manage Assessments"],
  ["record-score", "Record Score"],
  ["group-activities", "Group Activities"],
  ["show-grades", "Show Grades"],
  ["grade-summary", "Record Summary"],
  ["grade-settings", "Grade Sheet Settings"],
];

const OPTION =
  "block w-full rounded-lg border border-white/10 bg-surface-2 px-4 py-2.5 text-left text-sm font-medium text-ink-2 transition hover:border-accent/40 hover:bg-accent/5 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50";

export default function ClassOptionsModal({
  section,
  onClose,
  onOpenAction,
  onOpenStudentView,
  onSyncToExcel,
  syncReady,
}) {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/70 p-4 backdrop-blur-xl print:hidden"
      onMouseDown={(e) =>
        e.target === e.currentTarget && !syncing && onClose()
      }
    >
      <section
        className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border border-accent/35 border-b-accent-2/20 bg-surface-3 p-6 shadow-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="class-options-title"
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between border-b border-white/5 pb-4">
          <h2
            id="class-options-title"
            className="font-mono text-xs font-bold uppercase tracking-wider text-accent"
          >
            Class Options
          </h2>

          <button
            type="button"
            onClick={onClose}
            disabled={syncing}
            aria-label="Close class options"
            className="grid size-8 place-items-center rounded-full text-lg text-ink-3 transition hover:bg-surface-2 hover:text-accent disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          {/* Class Information */}
          <div className="mb-2 rounded-lg border border-white/5 bg-surface-1 p-3.5">
            <h3 className="font-display text-sm font-semibold text-ink">
              {section?.subject_code || "Class"} -{" "}
              {section?.subject_title || "Class subject"}
            </h3>

            <p className="mt-0.5 font-mono text-xs text-ink-2">
              {section?.days || "Schedule not set"} ·{" "}
              {section?.room || "Room not set"}
            </p>
          </div>

          {/* Class Actions */}
          <p className="mb-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink-3">
            Class Actions
          </p>

          {ACTIONS.map(([id, label]) => (
            <button
              type="button"
              key={id}
              className={OPTION}
              disabled={syncing}
              onClick={() => onOpenAction(id, section.id)}
            >
              {label}
            </button>
          ))}

          {/* Student View */}
          <div className="mt-3 border-t border-white/10 pt-3">
            <button
              type="button"
              className={OPTION}
              disabled={syncing}
              onClick={() => {
                onClose();
                onOpenStudentView(section);
              }}
            >
              Open Student View
            </button>
          </div>

          {/* Excel Synchronization */}
          <button
            type="button"
            disabled={!syncReady || syncing}
            onClick={handleSync}
            className="block w-full rounded-lg bg-accent px-4 py-3 text-left font-mono text-xs font-bold uppercase tracking-wider text-canvas transition hover:shadow-halo disabled:cursor-not-allowed disabled:opacity-60"
          >
            {syncing
              ? "Syncing to Excel..."
              : syncReady
                ? "Sync to Excel"
                : "Loading class data..."}
          </button>

          {/* Add Student */}
          <button
            type="button"
            className={OPTION}
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
