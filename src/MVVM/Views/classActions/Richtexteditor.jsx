import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
function sanitizePastedHtml(html) {
  const container = document.createElement("div");
  container.innerHTML = html;
  container.querySelectorAll("script").forEach((node) => node.remove());
  container.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      if (attribute.name.toLowerCase().startsWith("on")) {
        node.removeAttribute(attribute.name);
      }
    });
  });
  return container.innerHTML;
}
function buildTableHtml(rows, columns) {
  const cell = () =>
    `<td style="border:1px solid rgba(148,163,184,0.45);padding:6px 8px;min-width:60px;">&nbsp;</td>`;
  const headerCell = (index) =>
    `<th style="border:1px solid rgba(148,163,184,0.45);padding:6px 8px;background:rgba(148,163,184,0.16);text-align:left;">Column ${index + 1}</th>`;
  const headerRow = `<tr>${Array.from({ length: columns }, (_, index) => headerCell(index)).join("")}</tr>`;
  const bodyRows = Array.from(
    { length: Math.max(rows - 1, 1) },
    () => `<tr>${Array.from({ length: columns }, () => cell()).join("")}</tr>`,
  ).join("");
  return `<table style="border-collapse:collapse;width:100%;margin:8px 0;">${headerRow}${bodyRows}</table><p><br></p>`;
}
const clampSize = (value, min, max) =>
  Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);
function TableSizeDialog({ onConfirm, onCancel }) {
  const [rows, setRows] = useState(3);
  const [columns, setColumns] = useState(3);
  const previewRows = Math.min(rows, 6);
  const previewColumns = Math.min(columns, 8);
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);
  const stepper = (label, value, setValue, max) => (
    <label className="flex flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
      {label}
      <div className="flex h-10 items-stretch overflow-hidden rounded-lg border border-white/10 bg-surface-2 transition focus-within:border-accent/60">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => setValue(clampSize(value - 1, 1, max))}
          className="w-9 text-lg text-ink-2 transition hover:bg-accent/10 hover:text-accent"
        >
          −
        </button>
        <input
          type="number"
          min={1}
          max={max}
          value={value}
          onChange={(event) =>
            setValue(clampSize(Number(event.target.value), 1, max))
          }
          className="w-full min-w-0 bg-transparent text-center text-sm font-bold text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => setValue(clampSize(value + 1, 1, max))}
          className="w-9 text-lg text-ink-2 transition hover:bg-accent/10 hover:text-accent"
        >
          +
        </button>
      </div>
    </label>
  );
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Insert table"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(rows, columns);
        }}
        className="w-[min(360px,100%)] overflow-hidden rounded-2xl border border-accent/30 bg-surface-1 shadow-[0_24px_60px_rgba(0,0,0,0.55),0_0_0_1px_rgba(0,240,255,0.06)]"
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent/10 text-accent">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
            </svg>
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">Insert table</h3>
            <p className="text-[11px] text-ink-3">Choose the table size</p>
          </div>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            {stepper("Rows", rows, setRows, 20)}
            {stepper("Columns", columns, setColumns, 10)}
          </div>
          <div
            aria-hidden="true"
            className="grid gap-1 rounded-lg border border-white/5 bg-surface-2/60 p-3"
            style={{
              gridTemplateColumns: `repeat(${previewColumns}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: previewRows * previewColumns }, (_, index) => (
              <span
                key={index}
                className={`h-3.5 rounded-sm border ${
                  index < previewColumns
                    ? "border-accent/50 bg-accent/25"
                    : "border-white/10 bg-white/5"
                }`}
              />
            ))}
          </div>
          <p className="text-center text-[11px] text-ink-3">
            {rows} × {columns} table · first row is the header
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-white/10 bg-surface-2/40 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-white/10 px-3.5 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-ink-2 transition hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            autoFocus
            className="rounded bg-accent px-3.5 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-canvas transition hover:shadow-halo active:scale-[0.98]"
          >
            Insert
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
function RichTextEditor({
  value,
  onChange,
  placeholder,
}) {
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const savedRangeRef = useRef(null);
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== (value || "")) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);
  const emitChange = useCallback(() => {
    onChange?.(editorRef.current?.innerHTML ?? "");
  }, [onChange]);
  const runCommand = useCallback(
    (command, argument) => {
      editorRef.current?.focus();
      document.execCommand(command, false, argument);
      emitChange();
    },
    [emitChange],
  );
  const insertTable = () => {
    const selection = window.getSelection();
    savedRangeRef.current =
      selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)
        ? selection.getRangeAt(0).cloneRange()
        : null;
    setError("");
    setTableDialogOpen(true);
  };
  const confirmTable = (rows, columns) => {
    setTableDialogOpen(false);
    const editor = editorRef.current;
    editor?.focus();
    const range = savedRangeRef.current;
    if (range) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    runCommand(
      "insertHTML",
      buildTableHtml(clampSize(rows, 1, 20), clampSize(columns, 1, 10)),
    );
  };
  const uploadImageFile = useCallback(
    async (file) => {
      if (!file || !file.type?.startsWith("image/")) return;
      if (file.size > 2 * 1024 * 1024) {
        setError("Images must be 2 MB or smaller.");
        return;
      }
      setUploading(true);
      setError("");
      try {
        const imageUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("Could not read the image."));
          reader.readAsDataURL(file);
        });
        runCommand(
          "insertHTML",
          `<img src="${imageUrl}" alt="Screenshot" style="max-width:100%;border-radius:6px;margin:8px 0;" />`,
        );
      } catch (uploadFailure) {
        setError(uploadFailure?.message || "Screenshot could not be uploaded.");
      } finally {
        setUploading(false);
      }
    },
    [runCommand],
  );
  const handlePaste = (event) => {
    const items = [...(event.clipboardData?.items ?? [])];
    const imageItem = items.find((item) => item.type?.startsWith("image/"));
    if (imageItem) {
      event.preventDefault();
      const file = imageItem.getAsFile();
      void uploadImageFile(file);
      return;
    }
    const pastedHtml = event.clipboardData?.getData("text/html");
    if (pastedHtml) {
      event.preventDefault();
      runCommand("insertHTML", sanitizePastedHtml(pastedHtml));
    }
  };
  const handleFileInputChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void uploadImageFile(file);
  };
  const toolbarButton =
    "inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded border border-white/10 bg-surface-2 px-2.5 text-xs font-medium text-ink-2 transition hover:border-accent/40 hover:bg-accent/10 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50";
  const keepFocus = (event) => event.preventDefault();
  const iconProps = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  return (
    <div className="overflow-hidden rounded-lg border border-ink-3/30 bg-surface-1 transition focus-within:border-accent focus-within:shadow-focus">
      <div
        role="toolbar"
        aria-label="Formatting"
        className="flex flex-wrap items-center gap-1.5 border-b border-white/5 bg-surface-2/70 p-2"
      >
        <button
          type="button"
          className={`${toolbarButton} font-bold`}
          onMouseDown={keepFocus}
          onClick={() => runCommand("bold")}
          title="Bold"
        >
          B
        </button>
        <button
          type="button"
          className={`${toolbarButton} italic`}
          onMouseDown={keepFocus}
          onClick={() => runCommand("italic")}
          title="Italic"
        >
          I
        </button>
        <button
          type="button"
          className={`${toolbarButton} underline`}
          onMouseDown={keepFocus}
          onClick={() => runCommand("underline")}
          title="Underline"
        >
          U
        </button>
        <span className="mx-1 h-5 w-px bg-white/10" />
        <button
          type="button"
          className={toolbarButton}
          onMouseDown={keepFocus}
          onClick={insertTable}
          title="Insert table"
        >
          <svg {...iconProps}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
          </svg>
          Table
        </button>
        <button
          type="button"
          className={toolbarButton}
          onMouseDown={keepFocus}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Insert screenshot"
        >
          <svg {...iconProps}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
          {uploading ? "Uploading..." : "Screenshot"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>

      <div
        ref={editorRef}
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder || "Rich text content"}
        data-placeholder={placeholder}
        onInput={emitChange}
        onBlur={emitChange}
        onPaste={handlePaste}
        suppressContentEditableWarning
        className="min-h-[120px] px-3.5 py-3 text-sm leading-6 text-ink outline-none empty:before:pointer-events-none empty:before:text-ink-3 empty:before:content-[attr(data-placeholder)] [&_img]:my-2 [&_img]:max-w-full [&_img]:rounded-md [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse"
      />

      {tableDialogOpen && (
        <TableSizeDialog
          onConfirm={confirmTable}
          onCancel={() => setTableDialogOpen(false)}
        />
      )}
      {error && (
        <p
          role="status"
          className="border-t border-rose-400/20 bg-rose-500/10 px-3.5 py-2 text-xs font-medium text-rose-300"
        >
          {error}
        </p>
      )}
      <p className="border-t border-white/5 bg-surface-2/40 px-3.5 py-2 text-[11px] text-ink-3">
        Paste a screenshot directly, or use the Screenshot button. Tables are
        editable inline.
      </p>
    </div>
  );
}
export { RichTextEditor };
