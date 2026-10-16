const SIZES = {
  default: "w-[min(620px,100%)]",
  wide: "w-[min(900px,calc(100vw-2rem))] [&:has(.h-grade-sheet-preview)]:w-[min(1040px,calc(100vw-2rem))]",
};

export function ModalShell({
  title,
  section,
  onClose,
  children,
  size = "default",
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-canvas/70 p-4 backdrop-blur-xl max-sm:p-2.5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {/* `h-action-modal` / `h-action-modal-<size>` are hook classes: other
          components target them with [.h-action-modal_&]: variants. */}
      <section
        className={`h-action-modal h-action-modal-${size} flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl border border-accent/35 border-b-accent-2/20 bg-surface-3 shadow-modal ${SIZES[size] || SIZES.default}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-modal-title"
      >
        <header className="relative flex shrink-0 items-start justify-between gap-4 border-b border-white/5 bg-surface-2/60 px-6 pb-4 pt-5">
          <div>
            <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
              Class action
            </p>
            <h2
              id="action-modal-title"
              className="font-display text-xl font-semibold tracking-tight text-ink"
            >
              {title}
            </h2>
            <small className="mt-1 block text-[11px] text-ink-2">
              {section?.subject_code} · {section?.subject_title}
            </small>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 shrink-0 place-items-center rounded-full border border-white/10 bg-surface-2 text-xl leading-none text-ink-3 transition hover:border-accent/40 hover:text-accent"
          >
            ×
          </button>
        </header>
        <div className="min-h-0 overflow-auto px-6 pb-6 pt-5">{children}</div>
      </section>
    </div>
  );
}
