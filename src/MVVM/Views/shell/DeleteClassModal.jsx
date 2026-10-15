import { Icon } from "../DashboardShared";

export default function DeleteClassModal({
  section,
  deleting,
  error,
  onClose,
  onConfirm,
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/70 p-4 backdrop-blur-xl print:hidden"
      onMouseDown={(e) => e.target === e.currentTarget && !deleting && onClose()}
    >
      <section
        className="w-full max-w-sm rounded-xl border border-rose-400/40 bg-surface-3 p-6 text-center shadow-modal"
        role="alertdialog"
        aria-modal="true"
      >
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full border border-rose-400/40 bg-rose-500/10 text-rose-400">
          <Icon name="trash" size={22} />
        </div>
        <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-rose-400">
          Permanent action
        </p>
        <h2 className="mt-1 font-display text-lg font-semibold text-ink">
          Delete this class?
        </h2>
        <p className="mt-2 text-sm text-ink-2">
          This will delete{" "}
          <strong className="text-ink">
            {section?.subject_code || "this class"}
          </strong>
          , including its students, scores, grades, and attendance records.
        </p>
        {error && (
          <p className="mt-3 text-xs font-medium text-rose-300">{error}</p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded border border-accent/40 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="rounded bg-rose-500 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white transition hover:bg-rose-400 hover:shadow-[0_0_16px_rgba(244,63,94,0.5)] disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete class"}
          </button>
        </div>
      </section>
    </div>
  );
}
