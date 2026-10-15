import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth/useAuth";
import {
  createMaterialFolder,
  deleteMaterial,
  deleteMaterialFolder,
  getMaterialDataUrl,
  listMaterialFolders,
  listMaterials,
  moveMaterial,
  renameMaterial,
  renameMaterialFolder,
  uploadMaterial,
} from "../../lib/materialsStorage";
import { Icon } from "./DashboardShared";

// Realtime Database caps one string at 10 MB; base64 adds ~33%, so 7 MB is the safe maximum.
const MAX_FILE_SIZE = 7 * 1024 * 1024;
const categories = ["Lesson plan", "Learning material", "Assessment", "Other"];

const btnSoft =
  "rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50";
const btnDanger =
  "rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50";
const btnPlain =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2.5 text-sm font-normal outline-none focus:border-indigo-400";

function formatSize(bytes) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function splitName(name) {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? { base: name.slice(0, dot), ext: name.slice(dot) } : { base: name, ext: "" };
}

const canPreview = (material) => {
  const type = material.contentType || "";
  return type.startsWith("image/") || type === "application/pdf" || type === "text/plain";
};

async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
}

function Dialog({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-3xl border border-white/80 bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-label={title}>
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export default function MaterialsView() {
  const { user } = useAuth();
  const userId = user?.id;
  const fileInputRef = useRef(null);

  const [materials, setMaterials] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [category, setCategory] = useState(categories[0]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [status, setStatus] = useState({ type: "", message: "" });

  const [query, setQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [sort, setSort] = useState("newest");

  const [dialog, setDialog] = useState(null); // { kind, target }
  const [inputValue, setInputValue] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [dialogBusy, setDialogBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [nextMaterials, nextFolders] = await Promise.all([
        listMaterials(userId),
        listMaterialFolders(userId),
      ]);
      setMaterials(nextMaterials);
      setFolders(nextFolders);
    } catch (error) {
      setStatus({ type: "error", message: error?.message || "Materials could not be loaded." });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    Promise.resolve().then(() => refresh());
  }, [refresh]);

  // If the open folder was deleted (or never existed), fall back to the root.
  useEffect(() => {
    if (currentFolderId && !loading && !folders.some((folder) => folder.id === currentFolderId)) {
      setCurrentFolderId(null);
    }
  }, [folders, currentFolderId, loading]);

  const folderById = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);

  const pathOf = useCallback(
    (folderId) => {
      const trail = [];
      let cursor = folderId ? folderById.get(folderId) : null;
      const seen = new Set();
      while (cursor && !seen.has(cursor.id)) {
        seen.add(cursor.id);
        trail.unshift(cursor);
        cursor = cursor.parentId ? folderById.get(cursor.parentId) : null;
      }
      return trail;
    },
    [folderById],
  );

  const breadcrumb = useMemo(() => pathOf(currentFolderId), [pathOf, currentFolderId]);
  const currentFolder = currentFolderId ? folderById.get(currentFolderId) : null;

  const folderStats = useMemo(() => {
    const stats = new Map();
    const bump = (id, key) => {
      if (!id) return;
      const entry = stats.get(id) || { files: 0, folders: 0 };
      entry[key] += 1;
      stats.set(id, entry);
    };
    materials.forEach((material) => bump(material.folderId, "files"));
    folders.forEach((folder) => bump(folder.parentId, "folders"));
    return stats;
  }, [materials, folders]);

  const searching = query.trim().length > 0;
  const needle = query.trim().toLowerCase();

  const visibleFolders = useMemo(() => {
    const list = searching
      ? folders.filter((folder) => String(folder.name).toLowerCase().includes(needle))
      : folders.filter((folder) => (folder.parentId || null) === currentFolderId);
    return [...list].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [folders, currentFolderId, searching, needle]);

  const visibleMaterials = useMemo(() => {
    let list = searching
      ? materials.filter((material) => material.name.toLowerCase().includes(needle))
      : materials.filter((material) => (material.folderId || null) === currentFolderId);
    if (filterCategory !== "All") list = list.filter((material) => material.category === filterCategory);
    const sorters = {
      newest: (a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0),
      oldest: (a, b) => Number(a.updatedAt || 0) - Number(b.updatedAt || 0),
      name: (a, b) => a.name.localeCompare(b.name),
      size: (a, b) => Number(b.size || 0) - Number(a.size || 0),
    };
    return [...list].sort(sorters[sort]);
  }, [materials, currentFolderId, searching, needle, filterCategory, sort]);

  const moveOptions = useMemo(
    () =>
      folders
        .map((folder) => ({ id: folder.id, label: pathOf(folder.id).map((item) => item.name).join(" / ") }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [folders, pathOf],
  );

  /* ---------- dialogs ---------- */
  const openDialog = (kind, target = null) => {
    setDialogError("");
    setDialogBusy(false);
    if (kind === "folder-rename") setInputValue(target.name);
    else if (kind === "file-rename") setInputValue(splitName(target.name).base);
    else if (kind === "file-move") setInputValue(target.folderId || "");
    else setInputValue("");
    setDialog({ kind, target });
  };

  const closeDialog = useCallback(() => {
    if (!dialogBusy) setDialog(null);
  }, [dialogBusy]);

  const submitDialog = async (event) => {
    event.preventDefault();
    if (!dialog || !userId) return;
    const { kind, target } = dialog;
    setDialogBusy(true);
    setDialogError("");
    try {
      let message = "";
      if (kind === "folder-create") {
        await createMaterialFolder(userId, inputValue, currentFolderId);
        message = "Folder created.";
      } else if (kind === "folder-rename") {
        await renameMaterialFolder(userId, target.id, inputValue);
        message = "Folder renamed.";
      } else if (kind === "folder-delete") {
        await deleteMaterialFolder(userId, target.id);
        message = "Folder deleted.";
      } else if (kind === "file-rename") {
        const base = inputValue.trim();
        if (!base) throw new Error("Enter a file name.");
        await renameMaterial(userId, target.id, `${base}${splitName(target.name).ext}`);
        message = "File renamed.";
      } else if (kind === "file-move") {
        await moveMaterial(userId, target.id, inputValue || null);
        message = "File moved.";
      } else if (kind === "file-delete") {
        await deleteMaterial(userId, target.id);
        message = "File deleted.";
      }
      await refresh();
      setStatus({ type: "success", message });
      setDialog(null);
    } catch (error) {
      setDialogError(error?.message || "That action could not be completed.");
    } finally {
      setDialogBusy(false);
    }
  };

  /* ---------- files ---------- */
  const handleUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length || !userId) return;

    const oversized = files.find((file) => file.size > MAX_FILE_SIZE);
    if (oversized) {
      setStatus({
        type: "error",
        message: `${oversized.name} is ${formatSize(oversized.size)}, which is over the 7 MB limit. Compress its images (in Word: Picture Format → Compress Pictures) or split it into smaller files, then upload again.`,
      });
      return;
    }

    setUploading(true);
    let done = 0;
    try {
      for (const file of files) {
        setStatus({ type: "", message: `Uploading ${file.name} (${done + 1} of ${files.length})…` });
        await uploadMaterial(userId, file, category, currentFolderId);
        done += 1;
      }
      await refresh();
      setStatus({ type: "success", message: `${done} file${done === 1 ? "" : "s"} uploaded.` });
    } catch (error) {
      await refresh();
      setStatus({
        type: "error",
        message: `${error?.message || "The files could not be uploaded."}${done ? ` ${done} uploaded before the error.` : ""}`,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (material) => {
    setBusyId(material.id);
    try {
      const blob = await dataUrlToBlob(await getMaterialDataUrl(userId, material.id));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = material.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (error) {
      setStatus({ type: "error", message: error?.message || "The file could not be downloaded." });
    } finally {
      setBusyId(null);
    }
  };

  const handleOpen = async (material) => {
    // Open the tab synchronously so the popup blocker allows it.
    const tab = window.open("", "_blank");
    setBusyId(material.id);
    try {
      const raw = await dataUrlToBlob(await getMaterialDataUrl(userId, material.id));
      const blob = new Blob([raw], { type: material.contentType || raw.type });
      const url = URL.createObjectURL(blob);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      tab?.close();
      setStatus({ type: "error", message: error?.message || "The file could not be opened." });
    } finally {
      setBusyId(null);
    }
  };

  /* ---------- render ---------- */
  const isEmptyFolder = !loading && !visibleFolders.length && !visibleMaterials.length;
  const dialogKind = dialog?.kind;

  return (
    <div className="relative flex min-h-full flex-col gap-8 text-slate-900">
      <header className="relative overflow-hidden rounded-3xl border border-white/80 bg-white/40 p-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] backdrop-blur-xl">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative z-10 flex items-center justify-between gap-6 max-md:flex-col max-md:items-start">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/80 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg shadow-indigo-500/20">
              <Icon name="folder" size={26} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">DOCUMENT CENTER</p>
              <h1 className="mt-0.5 text-3xl font-extrabold tracking-tight text-slate-900">Materials</h1>
              <p className="mt-0.5 text-xs font-medium text-slate-500">Store lesson plans and learning materials for easy access.</p>
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Upload */}
        <article className="h-fit rounded-3xl border border-white/80 bg-white/50 p-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] backdrop-blur-xl">
          <h2 className="font-bold text-slate-800">Upload a file</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">PDF, Word, PowerPoint, Excel, images, and text files up to 7 MB.</p>
          <p className="mt-3 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700">
            Saving to: {breadcrumb.length ? breadcrumb.map((item) => item.name).join(" / ") : "Materials (main folder)"}
          </p>
          <label className="mt-4 flex flex-col gap-2 text-xs font-semibold text-slate-700">
            File category
            <select id="material-upload-category" name="uploadCategory" className={inputCls} value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <button
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-3 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 transition hover:from-indigo-500 hover:to-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Icon name="file" size={16} />
            {uploading ? "Uploading…" : "Choose files"}
          </button>
          <input ref={fileInputRef} id="material-file-input" name="materialFiles" className="hidden" type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png" onChange={handleUpload} />
        </article>

        {/* Browser */}
        <article className="rounded-3xl border border-white/80 bg-white/50 p-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] backdrop-blur-xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">YOUR FILES</p>
              <nav className="mt-1 flex flex-wrap items-center gap-1 text-sm font-bold text-slate-800" aria-label="Folder path">
                <button type="button" className={`rounded-md px-1 hover:bg-indigo-50 ${currentFolderId ? "text-indigo-600" : ""}`} onClick={() => setCurrentFolderId(null)}>
                  Materials
                </button>
                {breadcrumb.map((item, index) => (
                  <span className="flex items-center gap-1" key={item.id}>
                    <span className="text-slate-400">/</span>
                    <button
                      type="button"
                      className={`rounded-md px-1 hover:bg-indigo-50 ${index < breadcrumb.length - 1 ? "text-indigo-600" : ""}`}
                      onClick={() => setCurrentFolderId(item.id)}
                    >
                      {item.name}
                    </button>
                  </span>
                ))}
              </nav>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {currentFolder && (
                <button className={btnPlain} type="button" onClick={() => setCurrentFolderId(currentFolder.parentId || null)}>Back</button>
              )}
              <button className={btnSoft} type="button" onClick={() => openDialog("folder-create")}>New folder</button>
              <button className={btnSoft} type="button" onClick={() => void refresh()} disabled={loading}>Refresh</button>
            </div>
          </div>

          <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_130px]">
            <input id="material-search" name="materialSearch" className={inputCls} type="search" placeholder="Search all files and folders…" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search materials" />
            <select id="material-filter-category" name="filterCategory" className={inputCls} value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)} aria-label="Filter by category">
              <option>All</option>
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select id="material-sort" name="sortBy" className={inputCls} value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort files">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name</option>
              <option value="size">Largest</option>
            </select>
          </div>

          {status.message && (
            <p
              className={`mb-4 flex items-start justify-between gap-3 rounded-xl border p-3 text-xs font-medium ${status.type === "error" ? "border-rose-200 bg-rose-50 text-rose-600" : status.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}
              role="status"
            >
              <span>{status.message}</span>
              {!uploading && <button type="button" className="font-bold" onClick={() => setStatus({ type: "", message: "" })} aria-label="Dismiss">×</button>}
            </p>
          )}

          {loading ? (
            <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">Loading materials…</p>
          ) : isEmptyFolder ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
              <Icon name="folder" size={28} />
              <p className="mt-3">
                {searching || filterCategory !== "All"
                  ? "Nothing matches your search or filter."
                  : currentFolder
                    ? "This folder is empty. Upload a file or create a subfolder."
                    : "No materials uploaded yet. Choose files to add your first one."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {visibleFolders.map((folder) => {
                const stats = folderStats.get(folder.id) || { files: 0, folders: 0 };
                return (
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/60 p-4" key={folder.id}>
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => { setQuery(""); setCurrentFolderId(folder.id); }}>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Icon name="folder" size={19} /></span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-800" title={folder.name}>{folder.name}</span>
                        <span className="mt-1 block text-[11px] text-slate-500">
                          {stats.files} file{stats.files === 1 ? "" : "s"}, {stats.folders} folder{stats.folders === 1 ? "" : "s"}
                          {searching && folder.parentId ? ` in ${pathOf(folder.parentId).map((item) => item.name).join(" / ")}` : ""}
                        </span>
                      </span>
                    </button>
                    <button className={btnPlain} type="button" onClick={() => openDialog("folder-rename", folder)}>Rename</button>
                    <button className={btnDanger} type="button" onClick={() => openDialog("folder-delete", folder)}>Delete</button>
                  </div>
                );
              })}

              {visibleMaterials.map((material) => {
                const busy = busyId === material.id;
                const location = searching && material.folderId ? pathOf(material.folderId).map((item) => item.name).join(" / ") : "";
                return (
                  <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/60 p-4" key={material.id}>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Icon name="file" size={19} /></div>
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="truncate text-sm font-semibold text-slate-800" title={material.name}>{material.name}</p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {material.category} · {formatSize(material.size)} · {formatDate(material.updatedAt)}{location ? ` · ${location}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {canPreview(material) && <button className={btnPlain} type="button" disabled={busy} onClick={() => void handleOpen(material)}>Open</button>}
                      <button className={btnSoft} type="button" disabled={busy} onClick={() => void handleDownload(material)}>{busy ? "Working…" : "Download"}</button>
                      <button className={btnPlain} type="button" onClick={() => openDialog("file-rename", material)}>Rename</button>
                      <button className={btnPlain} type="button" onClick={() => openDialog("file-move", material)}>Move</button>
                      <button className={btnDanger} type="button" onClick={() => openDialog("file-delete", material)}>Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </section>

      {dialog && (
        <Dialog
          onClose={closeDialog}
          title={
            { "folder-create": "New folder", "folder-rename": "Rename folder", "folder-delete": "Delete folder", "file-rename": "Rename file", "file-move": "Move file", "file-delete": "Delete file" }[dialogKind]
          }
        >
          <form onSubmit={submitDialog} className="mt-4 flex flex-col gap-4">
            {(dialogKind === "folder-create" || dialogKind === "folder-rename") && (
              <label className="flex flex-col gap-2 text-xs font-semibold text-slate-700">
                Folder name
                <input id="material-folder-name" name="folderName" className={inputCls} autoFocus maxLength={80} value={inputValue} onChange={(event) => setInputValue(event.target.value)} />
              </label>
            )}
            {dialogKind === "file-rename" && (
              <label className="flex flex-col gap-2 text-xs font-semibold text-slate-700">
                File name{splitName(dialog.target.name).ext ? ` (${splitName(dialog.target.name).ext} is kept)` : ""}
                <input id="material-file-name" name="fileName" className={inputCls} autoFocus maxLength={140} value={inputValue} onChange={(event) => setInputValue(event.target.value)} />
              </label>
            )}
            {dialogKind === "file-move" && (
              <label className="flex flex-col gap-2 text-xs font-semibold text-slate-700">
                Move “{dialog.target.name}” to
                <select id="material-move-target" name="moveTarget" className={inputCls} value={inputValue} onChange={(event) => setInputValue(event.target.value)}>
                  <option value="">Materials (main folder)</option>
                  {moveOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
            )}
            {dialogKind === "file-delete" && (
              <p className="text-sm text-slate-600">Delete “{dialog.target.name}”? This cannot be undone.</p>
            )}
            {dialogKind === "folder-delete" && (() => {
              const ids = new Set([dialog.target.id]);
              let grew = true;
              while (grew) {
                grew = false;
                folders.forEach((folder) => {
                  if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) { ids.add(folder.id); grew = true; }
                });
              }
              const fileCount = materials.filter((material) => material.folderId && ids.has(material.folderId)).length;
              return (
                <p className="text-sm text-slate-600">
                  Delete “{dialog.target.name}”? This also deletes {ids.size - 1} subfolder{ids.size - 1 === 1 ? "" : "s"} and {fileCount} file{fileCount === 1 ? "" : "s"} inside it. This cannot be undone.
                </p>
              );
            })()}

            {dialogError && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-600" role="alert">{dialogError}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" className={btnPlain} onClick={closeDialog} disabled={dialogBusy}>Cancel</button>
              <button
                type="submit"
                disabled={dialogBusy}
                className={`rounded-xl px-4 py-2 text-xs font-semibold text-white transition disabled:opacity-60 ${dialogKind?.endsWith("delete") ? "bg-rose-600 hover:bg-rose-500" : "bg-indigo-600 hover:bg-indigo-500"}`}
              >
                {dialogBusy
                  ? "Working…"
                  : { "folder-create": "Create folder", "folder-rename": "Save name", "folder-delete": "Delete folder", "file-rename": "Save name", "file-move": "Move file", "file-delete": "Delete file" }[dialogKind]}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}