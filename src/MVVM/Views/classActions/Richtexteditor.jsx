import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

// Rename this if you want screenshots to land in a different bucket. The
// bucket must exist in Supabase Storage and allow public reads (or you'll
// need to swap getPublicUrl for a signed URL).
const INSTRUCTIONS_IMAGE_BUCKET = "assessment-instructions";

function sanitizePastedHtml(html) {
  // Strip script tags and inline event handlers from anything pasted in,
  // since execCommand("insertHTML") will otherwise happily insert them.
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
  const cell = () => `<td style="border:1px solid #cbd5e1;padding:6px 8px;min-width:60px;">&nbsp;</td>`;
  const headerCell = (index) => `<th style="border:1px solid #cbd5e1;padding:6px 8px;background:#f1f5f9;text-align:left;">Column ${index + 1}</th>`;
  const headerRow = `<tr>${Array.from({ length: columns }, (_, index) => headerCell(index)).join("")}</tr>`;
  const bodyRows = Array.from(
    { length: Math.max(rows - 1, 1) },
    () => `<tr>${Array.from({ length: columns }, () => cell()).join("")}</tr>`,
  ).join("");
  return `<table style="border-collapse:collapse;width:100%;margin:8px 0;">${headerRow}${bodyRows}</table><p><br></p>`;
}

/**
 * A minimal contentEditable-based rich text editor. Supports bold/italic/
 * underline, inserting a table, and inserting an image either by upload or
 * by pasting a screenshot from the clipboard. Stores/returns HTML.
 *
 * Note: uses document.execCommand, which is deprecated but still broadly
 * supported in every current browser and keeps this dependency-free. If you
 * later add a real editor library (TipTap, etc.) this component can be
 * swapped out without changing callers, since the contract is just
 * value (html string) + onChange(html string).
 */
function RichTextEditor({ value, onChange, placeholder, uploadPathPrefix = "instructions" }) {
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  // Keep the DOM in sync with external value changes (e.g. switching which
  // assessment is being edited) without fighting the user's own typing.
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== (value || "")) {
      editorRef.current.innerHTML = value || "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emitChange = useCallback(() => {
    onChange?.(editorRef.current?.innerHTML ?? "");
  }, [onChange]);

  const runCommand = (command, argument) => {
    editorRef.current?.focus();
    document.execCommand(command, false, argument);
    emitChange();
  };

  const insertTable = () => {
    const dimensions = window.prompt("Table size as rows x columns (e.g. 3x4):", "3x3");
    if (!dimensions) return;
    const match = dimensions.match(/^\s*(\d+)\s*[x×]\s*(\d+)\s*$/i);
    if (!match) {
      setError("Enter the table size like 3x4.");
      return;
    }
    const rows = Math.min(Math.max(Number(match[1]), 1), 20);
    const columns = Math.min(Math.max(Number(match[2]), 1), 10);
    setError("");
    runCommand("insertHTML", buildTableHtml(rows, columns));
  };

  const uploadImageFile = useCallback(
    async (file) => {
      if (!file || !file.type?.startsWith("image/")) return;
      if (!supabase) {
        setError("Image upload needs a live Supabase connection.");
        return;
      }
      setUploading(true);
      setError("");
      try {
        const extension = file.name?.split(".").pop() || "png";
        const path = `${uploadPathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from(INSTRUCTIONS_IMAGE_BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage
          .from(INSTRUCTIONS_IMAGE_BUCKET)
          .getPublicUrl(path);
        const imageUrl = publicUrlData?.publicUrl;
        if (!imageUrl) throw new Error("Could not resolve the uploaded image URL.");
        runCommand("insertHTML", `<img src="${imageUrl}" alt="Screenshot" style="max-width:100%;border-radius:6px;margin:8px 0;" />`);
      } catch (uploadFailure) {
        setError(uploadFailure?.message || "Screenshot could not be uploaded.");
      } finally {
        setUploading(false);
      }
    },
    [uploadPathPrefix],
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
    // Plain text paste falls through to the browser's default behavior.
  };

  const handleFileInputChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void uploadImageFile(file);
  };

  const toolbarButtonStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    background: "#fff",
    padding: "4px 10px",
    fontSize: "13px",
    cursor: "pointer",
    color: "#334155",
  };

  return (
    <div className="rich-text-editor" style={{ border: "1px solid #cbd5e1", borderRadius: "8px", overflow: "hidden" }}>
      <div
        className="rich-text-toolbar"
        role="toolbar"
        aria-label="Formatting"
        style={{ display: "flex", flexWrap: "wrap", gap: "6px", padding: "8px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}
      >
        <button type="button" style={toolbarButtonStyle} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("bold")} title="Bold">
          <strong>B</strong>
        </button>
        <button type="button" style={toolbarButtonStyle} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("italic")} title="Italic">
          <em>I</em>
        </button>
        <button type="button" style={toolbarButtonStyle} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("underline")} title="Underline">
          <span style={{ textDecoration: "underline" }}>U</span>
        </button>
        <span className="rich-text-toolbar-divider" style={{ width: "1px", background: "#e2e8f0", margin: "0 2px" }} />
        <button type="button" style={toolbarButtonStyle} onMouseDown={(event) => event.preventDefault()} onClick={insertTable} title="Insert table">
          ▦ Table
        </button>
        <button
          type="button"
          style={toolbarButtonStyle}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Insert screenshot"
        >
          {uploading ? "Uploading…" : "🖼 Screenshot"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="rich-text-file-input"
          onChange={handleFileInputChange}
          style={{ display: "none" }}
        />
      </div>
      <div
        ref={editorRef}
        className="rich-text-surface"
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder || "Rich text content"}
        data-placeholder={placeholder}
        onInput={emitChange}
        onBlur={emitChange}
        onPaste={handlePaste}
        suppressContentEditableWarning
        style={{ minHeight: "120px", padding: "10px 12px", fontSize: "14px", lineHeight: 1.5, outline: "none" }}
      />
      {error && (
        <p className="rich-text-error" role="status" style={{ margin: 0, padding: "6px 12px", background: "#fef2f2", color: "#b91c1c", fontSize: "12px" }}>
          {error}
        </p>
      )}
      <p className="rich-text-hint" style={{ margin: 0, padding: "6px 12px", fontSize: "12px", color: "#64748b", borderTop: "1px solid #e2e8f0" }}>
        Paste a screenshot directly, or use the Screenshot button. Tables are editable inline.
      </p>
    </div>
  );
}

export { RichTextEditor, INSTRUCTIONS_IMAGE_BUCKET };