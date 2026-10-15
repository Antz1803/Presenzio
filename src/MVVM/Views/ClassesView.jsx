import { useMemo, useState } from "react";
import { Icon } from "./DashboardShared";

/* ---------- shared class strings (design doc tokens) ---------- */
const INPUT =
  "w-full rounded border border-ink-3/30 bg-surface-1 px-3 py-2.5 text-sm text-ink placeholder:text-ink-3 transition focus:border-accent focus:shadow-focus focus:outline-none disabled:opacity-50";
const LABEL = "flex flex-col gap-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-3";
const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-canvas transition hover:shadow-halo active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
const BTN_SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded border border-accent/40 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:opacity-50";

function formatSectionTime(value) {
  if (!value) return "—";
  const [hour, minute] = String(value).split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function toFormState(item) {
  return {
    days: item.days || "",
    time_start: String(item.time_start || "").slice(0, 5),
    time_end: String(item.time_end || "").slice(0, 5),
    edp_code: item.edp_code || "",
    subject_code: item.subject_code || "",
    subject_title: item.subject_title || "",
    room: item.room || "",
    year_level: item.year_level || "",
    section_no: item.section_no || "",
  };
}

function compareSections(first, second) {
  const firstSection = String(first.section_no ?? "").trim();
  const secondSection = String(second.section_no ?? "").trim();
  if (!firstSection && secondSection) return 1;
  if (firstSection && !secondSection) return -1;
  return (
    firstSection.localeCompare(secondSection, undefined, {
      numeric: true,
      sensitivity: "base",
    }) ||
    String(first.subject_code ?? "").localeCompare(
      String(second.subject_code ?? ""),
      undefined,
      { numeric: true, sensitivity: "base" },
    ) ||
    String(first.subject_title ?? "").localeCompare(
      String(second.subject_title ?? ""),
      undefined,
      { sensitivity: "base" },
    )
  );
}

/* ---------------------------------------------------------------- */
/* Edit modal                                                        */
/* ---------------------------------------------------------------- */
function EditClassModal({ item, onClose, onSave }) {
  const [form, setForm] = useState(() => toFormState(item));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = (name, value) =>
    setForm((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(item.id, form);
    } catch (err) {
      setError(err?.message || "This class could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const field = (name, label, type = "text", wide = false) => (
    <label className={`${wide ? "col-span-2 max-sm:col-span-1 " : ""}${LABEL}`}>
      {label}
      <input
        name={name}
        type={type}
        value={form[name]}
        onChange={(e) => setField(name, e.target.value)}
        className={INPUT}
      />
    </label>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/70 p-4 backdrop-blur-xl"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <section
        className="relative max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-accent/35 border-b-accent-2/20 bg-surface-3 p-7 shadow-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-class-title"
      >
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-surface-2 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-accent">
              <span className="size-1.5 rounded-full bg-accent" />
              Class management
            </span>
            <h2
              id="edit-class-title"
              className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink"
            >
              Edit class schedule
            </h2>
            <p className="mt-1 text-xs text-ink-2">
              Update course metadata, room assignments, and meeting times.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close edit dialog"
            onClick={onClose}
            disabled={saving}
            className="grid size-8 place-items-center rounded-full border border-white/10 bg-surface-2 text-ink-3 transition hover:border-accent/40 hover:text-accent"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            {field("days", "Days")}
            {field("room", "Room")}
            {field("time_start", "Start time", "time")}
            {field("time_end", "End time", "time")}
            {field("edp_code", "EDP code")}
            {field("subject_code", "Subject code")}
            {field("subject_title", "Subject name", "text", true)}
            {field("year_level", "Year level")}
            {field("section_no", "Section number")}
          </div>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded border border-rose-400/30 bg-rose-500/10 p-3 text-xs font-medium text-rose-300"
            >
              {error}
            </p>
          )}

          <div className="mt-8 flex justify-end gap-3 border-t border-white/5 pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className={BTN_SECONDARY}
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className={BTN_PRIMARY}>
              {saving ? "Saving changes..." : "Save details"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Connection badge                                                  */
/* ---------------------------------------------------------------- */
function ConnectionBadge({ status, message }) {
  const live = status === "live" || status === "online";
  const bad = status === "offline" || status === "error";
  const label = live
    ? "Live connected"
    : status === "offline"
      ? "Offline mode"
      : status === "error"
        ? "Connection error"
        : "Syncing status...";
  const tone = live
    ? "border-emerald-500/40 bg-emerald-950/60 text-emerald-400 shadow-emerald-500/20"
    : bad
      ? "border-rose-500/40 bg-rose-950/60 text-rose-300 shadow-rose-500/20"
      : "border-amber-500/40 bg-amber-950/50 text-amber-300 shadow-amber-500/10";
  const dot = live ? "bg-emerald-500" : bad ? "bg-rose-500" : "bg-amber-400";

  return (
    <div
      title={message}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11px] font-semibold shadow-sm ${tone}`}
    >
      <span className="relative flex size-2">
        {live && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        <span className={`relative inline-flex size-2 rounded-full ${dot}`} />
      </span>
      {label}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Class card                                                        */
/* ---------------------------------------------------------------- */
function ClassCard({
  item,
  selected,
  onEdit,
  onDelete,
  onOpenStudents,
  onOpenClassOptions,
}) {
  const detail = "flex items-center gap-2";
  return (
    <article
      className={`group relative flex flex-col justify-between rounded-xl border p-5 transition ${
        selected
          ? "border-2 border-accent/80 bg-surface-2 shadow-glow ring-2 ring-accent/30"
          : "border-accent/15 bg-surface-1/85 hover:border-accent/40 hover:bg-surface-2/70 hover:shadow-glow"
      }`}
    >
      {selected && (
        <span className="absolute -top-2.5 right-4 rounded-full bg-linear-to-r from-accent to-accent-3 px-2.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider text-canvas shadow-md shadow-accent/30">
          Selected
        </span>
      )}

      <div>
        <div
          className={`mb-3 flex items-center justify-between gap-2 border-b pb-3 ${
            selected ? "border-accent/20" : "border-slate-800"
          }`}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                selected
                  ? "border-accent bg-accent text-canvas"
                  : "border-accent/30 bg-surface-2 text-accent"
              }`}
            >
              {item.subject_code || "No code"}
            </span>
            {item.edp_code && (
              <span className="font-mono text-[11px] text-ink-2">
                EDP: {item.edp_code}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1 text-ink-3">
            <button
              type="button"
              title="Edit class"
              aria-label="Edit class"
              onClick={() => onEdit(item)}
              className="rounded p-1.5 transition-colors hover:text-accent"
            >
              <Icon name="edit" size={15} />
            </button>
            <button
              type="button"
              title="Delete class"
              aria-label="Delete class"
              onClick={() => onDelete(item)}
              className="rounded p-1.5 transition-colors hover:text-rose-400"
            >
              <Icon name="trash" size={15} />
            </button>
          </div>
        </div>

        <h2 className="mb-1 flex items-center gap-2 font-display text-sm font-semibold uppercase leading-snug tracking-tight text-ink">
          {item.subject_title || "Untitled class"}
          {selected && (
            <span className="size-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_6px_#00F0FF]" />
          )}
        </h2>

        {(item.year_level || item.section_no) && (
          <p className="mb-3 text-xs font-medium text-ink-2">
            {item.year_level && `${item.year_level} Year`}
            {item.year_level && item.section_no && " • "}
            {item.section_no && `Section ${item.section_no}`}
          </p>
        )}

        <div className="mb-4 space-y-1.5 rounded-lg border border-slate-800 bg-surface-2/80 p-2.5 text-xs">
          <div className={detail}>
            <span className="w-4 text-accent">
              <Icon name="calendar" size={14} />
            </span>
            <span className="text-slate-300">{item.days || "Schedule unset"}</span>
          </div>
          <div className={detail}>
            <span className="w-4 text-accent">
              <Icon name="clock" size={14} />
            </span>
            <span className="font-mono text-slate-300">
              {formatSectionTime(item.time_start)} –{" "}
              {formatSectionTime(item.time_end)}
            </span>
          </div>
          {item.room && (
            <div className={detail}>
              <span className="w-4 text-accent">
                <Icon name="location" size={14} />
              </span>
              <span className="text-slate-300">Room {item.room}</span>
            </div>
          )}
        </div>
      </div>

      <div
        className={`flex items-center gap-2 border-t pt-3 ${
          selected ? "border-accent/20" : "border-slate-800"
        }`}
      >
        <button
          type="button"
          onClick={() => onOpenStudents(item.id)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700/80 bg-surface-2 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-accent/40 hover:text-ink"
        >
          <span className="text-accent">
            <Icon name="users" size={14} />
          </span>
          Students
        </button>
        <button
          type="button"
          onClick={() => onOpenClassOptions(item.id)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
            selected
              ? "border-accent bg-linear-to-r from-accent to-accent-3 font-bold text-canvas shadow-md shadow-accent/30 hover:brightness-110"
              : "border-accent/30 bg-cyan-950/60 text-accent hover:bg-cyan-900/60"
          }`}
        >
          <Icon name="settings" size={14} />
          Manage
        </button>
      </div>
    </article>
  );
}

/* ---------------------------------------------------------------- */
/* Page                                                              */
/* ---------------------------------------------------------------- */
export default function ClassesView({
  sections = [],
  importMasterList,
  importGradeSheet,
  onSyncAllToExcel,
  importState,
  gradeSheetImportState,
  connectionStatus = "connecting",
  connectionMessage = "Connecting to Firebase…",
  pendingSyncCount = 0,
  onOpenStudents,
  onOpenClassOptions,
  onDeleteClass,
  onUpdateClass,
}) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [pickedId, setPickedId] = useState(null);
  const [syncAllState, setSyncAllState] = useState(null);

  const visibleSections = useMemo(
    () =>
      sections
        .filter((item) => {
          const searchText = [
            item.edp_code,
            item.edpCode,
            item.student_names,
            item.studentNames,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return searchText.includes(search.trim().toLowerCase());
        })
        .sort(compareSections),
    [sections, search],
  );

  // Highlight the card you last used; until then, the first card on screen.
  // (The dashboard's own active section is the first one in database order,
  // which is not the first card once the list is sorted by section number.)
  const selectedId = visibleSections.some((item) => item.id === pickedId)
    ? pickedId
    : visibleSections[0]?.id;

  const pickFile = (event, handler) => {
    const file = event.target.files?.[0];
    if (file) handler(file);
    event.target.value = "";
  };

  const syncAll = async () => {
    if (!onSyncAllToExcel || syncAllState?.working || !visibleSections.length)
      return;
    setSyncAllState({
      completed: 0,
      total: visibleSections.length,
      working: true,
      error: false,
      message: "",
    });
    try {
      const result = await onSyncAllToExcel({
        onProgress: ({ completed, total }) =>
          setSyncAllState({
            completed,
            total,
            working: true,
            error: false,
            cancelled: false,
            message: "",
          }),
      });
      if (result.cancelled) {
        setSyncAllState({
          completed: 0,
          total: 0,
          working: false,
          error: false,
          cancelled: true,
          message: "Sync cancelled.",
        });
        return;
      }
      setSyncAllState({
        completed: result.total,
        total: result.total,
        working: false,
        error: false,
        cancelled: false,
        message: `${result.total} Excel file${result.total === 1 ? "" : "s"} synced.`,
      });
    } catch (error) {
      setSyncAllState((current) => ({
        ...(current || {}),
        working: false,
        error: true,
        cancelled: false,
        message: error?.message || "Excel synchronization failed.",
      }));
    }
  };

  return (
    <div className="relative flex min-h-full flex-col gap-6">
      {editing && (
        <EditClassModal
          item={editing}
          onClose={() => setEditing(null)}
          onSave={async (id, values) => {
            if (!onUpdateClass) throw new Error("Editing is not available.");
            await onUpdateClass(id, values);
            setEditing(null);
          }}
        />
      )}

      {/* Page header */}
      <header className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-xl border border-accent/20 bg-surface-1 p-6 shadow-xl shadow-black/40 md:flex-row md:items-center">
        <div className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full bg-accent/5 blur-3xl" />
        <div className="relative z-10 flex items-start gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-linear-to-br from-accent via-sky-600 to-[#0D82FF] text-canvas shadow-lg shadow-accent/30">
            <Icon name="users" size={24} />
          </div>
          <div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-accent">
              Academic management
            </span>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
              Classes
            </h1>
            <p className="mt-0.5 text-xs text-ink-2">
              Manage course sections, enrollment lists, score synchronization,
              and attendance.
            </p>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3 self-start md:self-auto">
          <ConnectionBadge
            status={connectionStatus}
            message={connectionMessage}
          />
          {pendingSyncCount > 0 && (
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/40 bg-sky-950/50 px-3 py-1.5 font-mono text-[11px] font-semibold text-sky-300">
              <Icon name="arrow" size={13} />
              {pendingSyncCount} pending syncs
            </div>
          )}
        </div>
      </header>

      {/* Search + sync */}
      <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <label className="relative block w-full sm:max-w-md">
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-ink-3">
            <Icon name="search" size={15} />
          </span>
          <input
            name="classSearch"
            type="text"
            placeholder="Search by EDP Code or Student Name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full rounded-lg border border-accent/20 bg-surface-1 py-2.5 pl-10 pr-4 text-xs text-ink shadow-md outline-none transition placeholder:text-ink-3 focus:border-accent focus:shadow-focus"
          />
        </label>
        <button
          type="button"
          className={`${BTN_PRIMARY} w-full sm:w-auto`}
          disabled={!visibleSections.length || syncAllState?.working}
          title="Sync every class to its own Excel file"
          onClick={syncAll}
        >
          <Icon name="file" size={15} />
          {syncAllState?.working
            ? `Syncing ${syncAllState.completed}/${syncAllState.total}...`
            : "Sync all Excel"}
        </button>
      </div>

      {syncAllState?.message && (
        <p
          role="status"
          className={`-mt-2 font-mono text-xs ${
            syncAllState.error
              ? "text-rose-400"
              : syncAllState.cancelled
                ? "text-amber-300"
                : "text-emerald-400"
          }`}
        >
          {syncAllState.message}
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-4">
        {/* Class cards */}
        <section
          aria-label="Classes list"
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:col-span-3"
        >
          {visibleSections.length ? (
            visibleSections.map((item) => (
              <ClassCard
                key={item.id}
                item={item}
                selected={selectedId === item.id}
                onEdit={(target) => {
                  setPickedId(target.id);
                  setEditing(target);
                }}
                onDelete={onDeleteClass}
                onOpenStudents={(id) => {
                  setPickedId(id);
                  onOpenStudents(id);
                }}
                onOpenClassOptions={(id) => {
                  setPickedId(id);
                  onOpenClassOptions(id);
                }}
              />
            ))
          ) : (
            <div className="col-span-full flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-surface-1/60 p-8 text-center text-xs text-ink-2">
              <span className="text-ink-3">
                <Icon name="file" size={32} />
              </span>
              <p className="mt-3 font-medium">
                {search
                  ? "No class sections match your search."
                  : "Import a master list to create your first class."}
              </p>
            </div>
          )}
        </section>

        {/* Import center */}
        <aside className="rounded-xl border border-accent/20 bg-surface-1/85 p-6 backdrop-blur-xl">
          <div className="mb-5 flex gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded border border-accent/30 bg-surface-2 text-accent">
              <Icon name="arrow" size={17} />
            </div>
            <div>
              <h2 className="font-display font-semibold text-ink">
                Import center
              </h2>
              <p className="mt-0.5 text-xs leading-5 text-ink-2">
                Upload Excel or CSV files to batch update class rosters and test
                records.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-dashed border-white/10 bg-surface-2/50 p-4 text-center transition hover:border-accent/40">
              <h3 className="text-xs font-bold text-ink">Master student list</h3>
              <p className="mb-3.5 mt-1 text-[11px] text-ink-2">
                Batch create student IDs &amp; profiles.
              </p>
              <label className={`${BTN_PRIMARY} cursor-pointer`}>
                <Icon name="file" size={14} />
                Choose master file
                <input
                  name="masterListFile"
                  className="hidden"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => pickFile(e, importMasterList)}
                />
              </label>
            </div>

            <div className="rounded-lg border border-dashed border-white/10 bg-surface-2/50 p-4 text-center transition hover:border-accent/40">
              <h3 className="text-xs font-bold text-ink">Grade sheets</h3>
              <p className="mb-3.5 mt-1 text-[11px] text-ink-2">
                Upload computed assessment files.
              </p>
              <label className={`${BTN_PRIMARY} cursor-pointer`}>
                <Icon name="chart" size={14} />
                Choose grade file
                <input
                  name="gradeSheetFile"
                  className="hidden"
                  type="file"
                  accept=".xlsx,.xls,.xlsm,.csv"
                  disabled={gradeSheetImportState?.status === "working"}
                  onChange={(e) => pickFile(e, importGradeSheet)}
                />
              </label>
            </div>

            {[importState?.message, gradeSheetImportState?.message]
              .filter(Boolean)
              .map((message) => (
                <p
                  key={message}
                  role="status"
                  className="rounded border border-white/10 bg-surface-2 p-2.5 text-center font-mono text-xs text-ink-2"
                >
                  {message}
                </p>
              ))}
          </div>
        </aside>
      </div>
    </div>
  );
}