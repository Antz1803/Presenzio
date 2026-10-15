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

const FOCUS = "focus-visible:outline-accent!";
const BTN_PRIMARY = `inline-flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-canvas transition hover:shadow-halo active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
const BTN_SECONDARY = `inline-flex items-center justify-center gap-2 rounded border border-accent/40 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
const BTN_GHOST = `inline-flex items-center justify-center gap-2 rounded border border-white/10 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-ink-2 transition hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
const BTN_DANGER = `inline-flex items-center justify-center gap-2 rounded bg-rose-400 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-canvas transition hover:bg-rose-300 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
const ICON_BTN = `grid size-8 shrink-0 place-items-center rounded border border-white/10 bg-surface-1 text-ink-2 transition hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
const ICON_BTN_DANGER = `grid size-8 shrink-0 place-items-center rounded border border-white/10 bg-surface-1 text-ink-2 transition hover:border-rose-400/50 hover:bg-rose-400/10 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
const INPUT =
  "w-full rounded border border-ink-3/30 bg-surface-1 px-3 py-2.5 font-sans! text-sm font-normal normal-case tracking-normal text-ink placeholder:text-ink-3 transition focus:border-accent focus:shadow-focus focus:outline-none disabled:opacity-50";
const LABEL =
  "flex flex-col gap-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-3";
const PANEL =
  "rounded-xl border border-accent/20 bg-surface-1/85 p-5 backdrop-blur-xl";
const EYEBROW =
  "font-mono text-[10px] font-bold uppercase tracking-wider text-accent";
const ROW =
  "flex flex-wrap items-center gap-3 rounded-lg border border-white/5 bg-surface-2/70 p-3 transition hover:border-accent/30";
const STATUS_TONES = {
  error: "border-rose-400/30 bg-rose-500/10 text-rose-300",
  success: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
  info: "border-white/10 bg-surface-2 text-ink-2",
};
const FILE_TONES = {
  pdf: "border-rose-400/30 bg-rose-400/10 text-rose-300",
  doc: "border-accent-2/30 bg-accent-2/15 text-accent-4",
  sheet: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  slide: "border-orange-400/30 bg-orange-400/10 text-orange-300",
  image: "border-violet-400/30 bg-violet-400/10 text-violet-300",
  other: "border-accent/30 bg-accent/10 text-accent",
};

// Colour-code files by type so a long list can be scanned at a glance.
function fileTone(name = "") {
  const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  if (ext === "pdf") return FILE_TONES.pdf;
  if (["doc", "docx"].includes(ext)) return FILE_TONES.doc;
  if (["xls", "xlsx", "csv"].includes(ext)) return FILE_TONES.sheet;
  if (["ppt", "pptx"].includes(ext)) return FILE_TONES.slide;
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return FILE_TONES.image;
  return FILE_TONES.other;
}

function fileExtLabel(name = "") {
  const ext = name.includes(".") ? name.split(".").pop() : "";
  return ext ? ext.slice(0, 4).toUpperCase() : "FILE";
}

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/70 p-4 backdrop-blur-xl"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border border-accent/35 border-b-accent-2/20 bg-surface-3 p-6 shadow-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h3 className="border-b border-white/5 pb-4 font-display text-base font-semibold tracking-tight text-ink">
          {title}
        </h3>
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
  const totalSize = materials.reduce((sum, material) => sum + Number(material.size || 0), 0);
  const isDeleteDialog = dialogKind?.endsWith("delete");

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4">
      {/* Page header */}
      <header className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-xl border border-accent/20 bg-surface-1 p-6 shadow-xl shadow-black/40 md:flex-row md:items-center">
        <div className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full bg-accent/5 blur-3xl" />
        <div className="relative z-10 flex items-start gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-linear-to-br from-accent via-sky-600 to-[#0D82FF] text-canvas shadow-lg shadow-accent/30">
            <Icon name="folder" size={24} />
          </div>
          <div>
            <span className={EYEBROW}>Document center</span>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Materials</h1>
            <p className="mt-0.5 text-xs text-ink-2">Store lesson plans and learning materials for easy access.</p>
          </div>
        </div>
        <dl className="relative z-10 flex flex-wrap gap-2 font-mono text-[10px] font-bold uppercase tracking-wider">
          {[
            [materials.length, materials.length === 1 ? "file" : "files"],
            [folders.length, folders.length === 1 ? "folder" : "folders"],
            [formatSize(totalSize), "used"],
          ].map(([value, label]) => (
            <div key={label} className="flex items-baseline gap-1.5 rounded border border-accent/30 bg-accent/10 px-2.5 py-1.5">
              <dt className="sr-only">{label}</dt>
              <dd className="text-accent">{value}</dd>
              <span className="text-ink-2" aria-hidden="true">{label}</span>
            </div>
          ))}
        </dl>
      </header>

      <section className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Upload */}
        <article className={`${PANEL} lg:sticky lg:top-4`}>
          <h2 className="font-display text-base font-semibold tracking-tight text-ink">Upload a file</h2>
          <p className="mt-1 text-xs leading-5 text-ink-2">PDF, Word, PowerPoint, Excel, images, and text files up to 7 MB.</p>

          <div className="mt-4 flex items-start gap-2 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2.5">
            <span className="mt-0.5 shrink-0 text-accent"><Icon name="folder" size={14} /></span>
            <p className="min-w-0 break-words font-mono text-[11px] leading-4 text-ink-2">
              Saving to{" "}
              <span className="font-bold text-accent">
                {breadcrumb.length ? breadcrumb.map((item) => item.name).join(" / ") : "Materials (main folder)"}
              </span>
            </p>
          </div>

          <label className={`${LABEL} mt-4`}>
            File category
            <select id="material-upload-category" name="uploadCategory" className={INPUT} value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>

          <button
            className={`${BTN_PRIMARY} mt-4 w-full`}
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Icon name="upload" size={16} />
            {uploading ? "Uploading…" : "Choose files"}
          </button>
          <input ref={fileInputRef} id="material-file-input" name="materialFiles" className="hidden" type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png" onChange={handleUpload} />
        </article>

        {/* Browser */}
        <article className={PANEL}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <nav className="flex min-w-0 flex-wrap items-center gap-1 font-mono text-sm font-bold text-ink" aria-label="Folder path">
              <button type="button" className={`rounded px-1.5 py-0.5 transition hover:bg-accent/10 hover:text-accent ${FOCUS} ${currentFolderId ? "text-accent" : ""}`} onClick={() => setCurrentFolderId(null)}>
                Materials
              </button>
              {breadcrumb.map((item, index) => (
                <span className="flex items-center gap-1" key={item.id}>
                  <span className="text-ink-3" aria-hidden="true">/</span>
                  <button
                    type="button"
                    className={`rounded px-1.5 py-0.5 transition hover:bg-accent/10 hover:text-accent ${FOCUS} ${index < breadcrumb.length - 1 ? "text-accent" : ""}`}
                    onClick={() => setCurrentFolderId(item.id)}
                  >
                    {item.name}
                  </button>
                </span>
              ))}
            </nav>
            <div className="flex flex-wrap items-center gap-2">
              {currentFolder && (
                <button className={BTN_GHOST} type="button" onClick={() => setCurrentFolderId(currentFolder.parentId || null)}>Back</button>
              )}
              <button className={BTN_SECONDARY} type="button" onClick={() => openDialog("folder-create")}>
                <Icon name="plus" size={14} /> New folder
              </button>
              <button className={BTN_GHOST} type="button" onClick={() => void refresh()} disabled={loading}>
                <Icon name="refresh" size={14} /> Refresh
              </button>
            </div>
          </div>

          <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_160px_130px]">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"><Icon name="search" size={16} /></span>
              <input id="material-search" name="materialSearch" className={`${INPUT} pl-10`} type="search" placeholder="Search all files and folders…" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search materials" />
            </div>
            <select id="material-filter-category" name="filterCategory" className={INPUT} value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)} aria-label="Filter by category">
              <option>All</option>
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select id="material-sort" name="sortBy" className={INPUT} value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort files">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name</option>
              <option value="size">Largest</option>
            </select>
          </div>

          {status.message && (
            <p
              className={`mb-4 flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-xs font-medium ${STATUS_TONES[status.type] || STATUS_TONES.info}`}
              role="status"
            >
              <span>{status.message}</span>
              {!uploading && (
                <button type="button" className={`shrink-0 rounded p-0.5 opacity-80 transition hover:opacity-100 ${FOCUS}`} onClick={() => setStatus({ type: "", message: "" })} aria-label="Dismiss">
                  <Icon name="x" size={14} />
                </button>
              )}
            </p>
          )}

          {loading ? (
            <p className="rounded-lg border border-dashed border-white/10 p-8 text-center font-mono text-xs text-ink-3">Loading materials…</p>
          ) : isEmptyFolder ? (
            <div className="grid place-items-center gap-3 rounded-lg border border-dashed border-white/10 px-6 py-10 text-center text-xs text-ink-2">
              <span className="grid size-12 place-items-center rounded-xl border border-accent/20 bg-accent/5 text-accent"><Icon name="folder" size={24} /></span>
              <p className="max-w-xs leading-5">
                {searching || filterCategory !== "All"
                  ? "Nothing matches your search or filter."
                  : currentFolder
                    ? "This folder is empty. Upload a file or create a subfolder."
                    : "No materials uploaded yet. Choose files to add your first one."}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {visibleFolders.map((folder) => {
                const stats = folderStats.get(folder.id) || { files: 0, folders: 0 };
                return (
                  <li className={ROW} key={folder.id}>
                    <button type="button" className={`flex min-w-0 flex-1 items-center gap-3 rounded text-left ${FOCUS}`} onClick={() => { setQuery(""); setCurrentFolderId(folder.id); }}>
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-amber-400/30 bg-amber-400/10 text-amber-300"><Icon name="folder" size={19} /></span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink" title={folder.name}>{folder.name}</span>
                        <span className="mt-0.5 block text-[11px] text-ink-3">
                          {stats.files} file{stats.files === 1 ? "" : "s"}, {stats.folders} folder{stats.folders === 1 ? "" : "s"}
                          {searching && folder.parentId ? ` in ${pathOf(folder.parentId).map((item) => item.name).join(" / ")}` : ""}
                        </span>
                      </span>
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button className={ICON_BTN} type="button" title="Rename folder" aria-label={`Rename folder ${folder.name}`} onClick={() => openDialog("folder-rename", folder)}><Icon name="edit" size={15} /></button>
                      <button className={ICON_BTN_DANGER} type="button" title="Delete folder" aria-label={`Delete folder ${folder.name}`} onClick={() => openDialog("folder-delete", folder)}><Icon name="trash" size={15} /></button>
                    </div>
                  </li>
                );
              })}

              {visibleMaterials.map((material) => {
                const busy = busyId === material.id;
                const location = searching && material.folderId ? pathOf(material.folderId).map((item) => item.name).join(" / ") : "";
                return (
                  <li className={ROW} key={material.id}>
                    <span className={`grid size-10 shrink-0 place-items-center rounded-lg border font-mono text-[10px] font-bold ${fileTone(material.name)}`} aria-hidden="true">
                      {fileExtLabel(material.name)}
                    </span>
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="truncate text-sm font-semibold text-ink" title={material.name}>{material.name}</p>
                      <p className="mt-0.5 text-[11px] text-ink-3">
                        {material.category} · {formatSize(material.size)} · {formatDate(material.updatedAt)}{location ? ` · ${location}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {canPreview(material) ? (
                        <button className={`${BTN_GHOST} sm:w-[88px]`} type="button" disabled={busy} onClick={() => void handleOpen(material)}>
                          <Icon name="external" size={13} /> Open
                        </button>
                      ) : (
                        <span className="hidden w-[88px] sm:block" aria-hidden="true" />
                      )}
                      <button className={BTN_SECONDARY} type="button" disabled={busy} onClick={() => void handleDownload(material)}>
                        <Icon name="download" size={13} /> {busy ? "Working…" : "Download"}
                      </button>
                      <span className="mx-0.5 hidden h-5 w-px bg-white/10 sm:block" aria-hidden="true" />
                      <button className={ICON_BTN} type="button" title="Rename file" aria-label={`Rename ${material.name}`} onClick={() => openDialog("file-rename", material)}><Icon name="edit" size={15} /></button>
                      <button className={ICON_BTN} type="button" title="Move file" aria-label={`Move ${material.name}`} onClick={() => openDialog("file-move", material)}><Icon name="move" size={15} /></button>
                      <button className={ICON_BTN_DANGER} type="button" title="Delete file" aria-label={`Delete ${material.name}`} onClick={() => openDialog("file-delete", material)}><Icon name="trash" size={15} /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
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
              <label className={LABEL}>
                Folder name
                <input id="material-folder-name" name="folderName" className={INPUT} autoFocus maxLength={80} value={inputValue} onChange={(event) => setInputValue(event.target.value)} />
              </label>
            )}
            {dialogKind === "file-rename" && (
              <label className={LABEL}>
                File name{splitName(dialog.target.name).ext ? ` (${splitName(dialog.target.name).ext} is kept)` : ""}
                <input id="material-file-name" name="fileName" className={INPUT} autoFocus maxLength={140} value={inputValue} onChange={(event) => setInputValue(event.target.value)} />
              </label>
            )}
            {dialogKind === "file-move" && (
              <label className={LABEL}>
                Move “{dialog.target.name}” to
                <select id="material-move-target" name="moveTarget" className={INPUT} value={inputValue} onChange={(event) => setInputValue(event.target.value)}>
                  <option value="">Materials (main folder)</option>
                  {moveOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
            )}
            {dialogKind === "file-delete" && (
              <p className="text-sm leading-6 text-ink-2">Delete <span className="font-semibold text-ink">“{dialog.target.name}”</span>? This cannot be undone.</p>
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
                <p className="text-sm leading-6 text-ink-2">
                  Delete <span className="font-semibold text-ink">“{dialog.target.name}”</span>? This also deletes {ids.size - 1} subfolder{ids.size - 1 === 1 ? "" : "s"} and {fileCount} file{fileCount === 1 ? "" : "s"} inside it. This cannot be undone.
                </p>
              );
            })()}

            {dialogError && <p className={`rounded-lg border px-3 py-2.5 text-xs font-medium ${STATUS_TONES.error}`} role="alert">{dialogError}</p>}

            <div className="flex justify-end gap-2 border-t border-white/5 pt-4">
              <button type="button" className={`${BTN_GHOST} px-4 py-2.5`} onClick={closeDialog} disabled={dialogBusy}>Cancel</button>
              <button type="submit" disabled={dialogBusy} className={isDeleteDialog ? BTN_DANGER : BTN_PRIMARY}>
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
