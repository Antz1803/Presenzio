export function ModalShell({ title, section, onClose, children, size = "default" }) {
  return (
    <div
      className="modal-backdrop action-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={`action-modal action-modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-modal-title"
      >
        <header className="action-modal-header">
          <div>
            <p>CLASS ACTION</p>
            <h2 id="action-modal-title">{title}</h2>
            <small>
              {section?.subject_code} · {section?.subject_title}
            </small>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="action-modal-body">{children}</div>
      </section>
    </div>
  );
}

