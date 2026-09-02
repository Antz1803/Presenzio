import { useMemo, useState } from "react";
import { Icon } from "./DashboardShared";

function formatClassTime(value) {
  if (!value) return "—";
  const [hour, minute] = String(value).split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function classDraft(item) {
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

function EditClassModal({ item, onClose, onSave }) {
  const [draft, setDraft] = useState(() => classDraft(item));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(item.id, draft);
    } catch (saveError) {
      setError(saveError?.message || "This class could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  const field = (key, label, type = "text", wide = false) => (
    <label className={(wide ? "col-span-2 " : "") + "flex flex-col gap-1.5 text-xs font-semibold text-slate-700"}>
      {label}
      <input className="w-full rounded-xl border border-white/60 bg-white/50 px-3.5 py-2.5 text-sm font-normal text-slate-800 outline-none backdrop-blur-md shadow-inner transition duration-200 placeholder:text-slate-400 hover:bg-white/80 focus:border-indigo-500/50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10" type={type} value={draft[key]} onChange={(event) => update(key, event.target.value)} />
    </label>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-md transition-all" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
      <section className="relative max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/60 bg-white/70 p-7 shadow-[0_20px_50px_rgba(0,0,0,0.1)] backdrop-blur-2xl ring-1 ring-white/80" role="dialog" aria-modal="true" aria-labelledby="edit-class-title">
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-slate-200/50 pb-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/50 bg-indigo-50/50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" /> Class Management
            </span>
            <h2 id="edit-class-title" className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Edit Class Schedule</h2>
            <p className="mt-1 text-xs text-slate-500">Update course metadata, room assignments, and meeting times.</p>
          </div>
          <button className="flex h-8 w-8 items-center justify-center rounded-full border border-white/80 bg-white/60 text-slate-400 backdrop-blur-sm transition hover:bg-white hover:text-slate-700" type="button" aria-label="Close edit dialog" onClick={onClose} disabled={saving}>✕</button>
        </div>
        <form onSubmit={save}>
          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">{field("days", "Days")}{field("room", "Room")}{field("time_start", "Start time", "time")}{field("time_end", "End time", "time")}{field("edp_code", "EDP code")}{field("subject_code", "Subject code")}{field("subject_title", "Subject name", "text", true)}{field("year_level", "Year level")}{field("section_no", "Section number")}</div>
          {error && <p className="mt-4 rounded-xl border border-rose-200/60 bg-rose-50/60 p-3 text-xs font-medium text-rose-600 backdrop-blur-md" role="alert">{error}</p>}
          <div className="mt-8 flex justify-end gap-3 border-t border-slate-200/50 pt-5"><button className="rounded-xl border border-white/80 bg-white/60 px-5 py-2.5 text-xs font-semibold text-slate-600 backdrop-blur-sm transition hover:bg-white active:scale-95" type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-700 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:shadow-indigo-500/40 active:scale-95 disabled:opacity-60" type="submit" disabled={saving}>{saving ? "Saving changes..." : "Save details"}</button></div>
        </form>
      </section>
    </div>
  );
}

    export default function ClassesView({
      sections = [],
      section,
      importMasterList,
      importGradeSheet,
      importState,
      gradeSheetImportState,
      connectionStatus = "connecting",
      pendingSyncCount = 0,
      onOpenStudents,
      onOpenClassOptions,
      onDeleteClass,
      onUpdateClass,
    }) {

  const [searchTerm, setSearchTerm] = useState("");
  const [editingClass, setEditingClass] = useState(null);
  const filteredSections = useMemo(
    () => sections.filter((item) => `${item.subject_code} ${item.subject_title} ${item.room} ${item.edp_code} ${item.section_no} ${item.year_level}`.toLowerCase().includes(searchTerm.toLowerCase())),
    [sections, searchTerm],
  );
  const isOffline = connectionStatus === "offline";
  const isOnline = connectionStatus === "live" || connectionStatus === "online";
  const upload = (event, handler) => { const file = event.target.files?.[0]; if (file) handler(file); event.target.value = ""; };
  const saveEdit = async (sectionId, draft) => {
    if (!onUpdateClass) throw new Error("Editing is not available.");
    await onUpdateClass(sectionId, draft);
    setEditingClass(null);
  };

  return (
    <div className="relative flex min-h-full flex-col gap-8 bg-gradient-to-br from-slate-100/80 via-indigo-50/20 to-slate-100/60 p-8 text-slate-900 [font-family:system-ui,-apple-system,sans-serif] max-md:p-4">
      {editingClass && <EditClassModal item={editingClass} onClose={() => setEditingClass(null)} onSave={saveEdit} />}

      {/* Glossy Header Container */}
      <header className="relative overflow-hidden rounded-3xl border border-white/80 bg-white/40 p-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] backdrop-blur-xl">
        {/* Decorative Background Glows */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl" />

        <div className="relative z-10 flex items-center justify-between gap-6 max-md:flex-col max-md:items-start">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/80 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg shadow-indigo-500/20 backdrop-blur-md">
              <Icon name="users" size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">Academic Management</span>
              </div>
              <h1 className="mt-0.5 text-3xl font-extrabold tracking-tight text-slate-900">Classes</h1>
              <p className="mt-0.5 text-xs font-medium text-slate-500">Manage course sections, enrollment lists, score synchronization, and attendance.</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold max-md:w-full max-md:flex-wrap">
            <div className={`flex items-center gap-2 rounded-full border px-4 py-2 shadow-sm backdrop-blur-md ${isOnline ? "border-emerald-200/80 bg-emerald-50/60 text-emerald-700" : isOffline ? "border-rose-200/80 bg-rose-50/60 text-rose-700" : "border-amber-200/80 bg-amber-50/60 text-amber-700"}`}>
              <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : isOffline ? "bg-rose-500" : "bg-amber-500"}`} />
              {isOnline ? "Live Connected" : isOffline ? "Offline Mode" : "Syncing Status..."}
            </div>
            {pendingSyncCount > 0 && (
              <div className="flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/60 px-4 py-2 text-sky-700 shadow-sm backdrop-blur-md">
                <Icon name="arrow" size={14} />
                {pendingSyncCount} pending syncs
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-8 max-lg:grid-cols-1">
        <section>
          {/* Search bar with glass styling */}
          <div className="mb-6 flex gap-4">
            <label className="flex flex-1 items-center gap-3 rounded-2xl border border-white/80 bg-white/50 px-4 py-3 text-slate-400 shadow-[0_4px_20px_0_rgba(0,0,0,0.03)] backdrop-blur-md transition hover:border-white hover:bg-white/70 focus-within:border-indigo-500/50 focus-within:bg-white/90 focus-within:ring-4 focus-within:ring-indigo-500/10">
              <Icon name="search" size={18} />
              <input className="w-full border-0 bg-transparent text-sm font-normal text-slate-800 outline-none placeholder:text-slate-400" placeholder="Search by course code, title, room, EDP, section..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
            </label>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-5">
            {filteredSections.length ? (
              filteredSections.map((item) => (
                <article className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-white/60 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-white/80 hover:shadow-[0_15px_35px_rgba(79,70,229,0.1)] ${item.id === section?.id ? "border-indigo-500/80 ring-2 ring-indigo-500/20" : "border-white/80"}`} key={item.id}>
                  {/* Subtle top card glow line */}
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent opacity-0 transition group-hover:opacity-100" />
                  
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-lg border border-indigo-200/50 bg-indigo-50/70 px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase text-indigo-600 backdrop-blur-sm">{item.subject_code || "No code"}</span>
                          {item.edp_code && <span className="rounded-lg border border-slate-200/60 bg-slate-100/60 px-2 py-1 text-[11px] font-semibold text-slate-600 backdrop-blur-sm">EDP {item.edp_code}</span>}
                        </div>
                        <h2 className="mt-2.5 text-base font-bold text-slate-800 transition group-hover:text-indigo-600">{item.subject_title || "Untitled class"}</h2>
                      </div>
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        <button className="rounded-lg p-1.5 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600" title="Edit class" aria-label="Edit class" type="button" onClick={() => setEditingClass(item)}>
                          <Icon name="edit" size={15} />
                        </button>
                        <button className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500" title="Delete class" type="button" onClick={() => onDeleteClass(item)}>
                          <Icon name="trash" size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="mb-5 mt-4 flex flex-col gap-2 text-xs font-medium text-slate-500">
                      {(item.year_level || item.section_no) && (
                        <div className="flex items-center gap-2 font-semibold text-slate-700">
                          {item.year_level && <span>{item.year_level} Year</span>}
                          {item.year_level && item.section_no && <span className="text-slate-300">•</span>}
                          {item.section_no && <span>Section {item.section_no}</span>}
                        </div>
                      )}
                      <div className="flex items-center gap-2"><Icon name="calendar" size={14} /><span className="text-slate-700">{item.days || "Schedule unset"}</span></div>
                      <div className="flex items-center gap-2"><Icon name="clock" size={14} /><span className="text-slate-700">{formatClassTime(item.time_start)} – {formatClassTime(item.time_end)}</span></div>
                      {item.room && <div className="flex items-center gap-2"><Icon name="location" size={14} /><span className="text-slate-700">Room {item.room}</span></div>}
                    </div>
                  </div>
                      
                  <div className="grid grid-cols-3 gap-2 border-t border-slate-200/50 pt-3.5">
                    <button
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/80 bg-white/50 px-3 py-2 text-xs font-semibold text-slate-700 backdrop-blur-sm transition hover:bg-white active:scale-95"
                      type="button"
                      onClick={() => onOpenStudents(item.id)}
                    >
                      <Icon name="users" size={15} />
                      Students
                    </button>

                    <button
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200/60 bg-indigo-50/40 px-3 py-2 text-xs font-semibold text-indigo-600 backdrop-blur-sm transition hover:bg-indigo-100/60 active:scale-95"
                      type="button"
                      onClick={() => onOpenClassOptions(item.id)}
                    >
                      <Icon name="settings" size={15} />
                      Manage
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="col-span-full flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300/80 bg-white/40 p-8 text-center text-xs text-slate-500 backdrop-blur-md">
                <Icon name="file" size={32} />
                <p className="mt-3 font-medium">{searchTerm ? "No class sections match your search." : "Import a master list to create your first class."}</p>
              </div>
            )}
          </div>
        </section>

        {/* Glossy Aside Panel */}
        <aside className="rounded-3xl border border-white/80 bg-white/50 p-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] backdrop-blur-xl">
          <div className="mb-5 flex gap-3 text-slate-900">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 backdrop-blur-sm">
              <Icon name="arrow" size={18} />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">Import Center</h2>
              <p className="mt-0.5 text-xs leading-5 text-slate-500">Upload Excel or CSV files to batch update class rosters and test records.</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-dashed border-slate-200/80 bg-white/40 p-4 text-center backdrop-blur-sm transition hover:border-indigo-200 hover:bg-white/60">
              <h3 className="text-xs font-bold text-slate-700">Master Student List</h3>
              <p className="mb-3.5 mt-1 text-[11px] text-slate-500">Batch create student IDs &amp; profiles.</p>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 transition hover:from-indigo-500 hover:to-indigo-600 active:scale-95">
                <Icon name="file" size={15} />Choose Master File
                <input className="hidden" type="file" accept=".xlsx,.xls,.csv" onChange={(event) => upload(event, importMasterList)} />
              </label>
            </div>

            <div className="rounded-2xl border border-dashed border-slate-200/80 bg-white/40 p-4 text-center backdrop-blur-sm transition hover:border-indigo-200 hover:bg-white/60">
              <h3 className="text-xs font-bold text-slate-700">Grade Sheets</h3>
              <p className="mb-3.5 mt-1 text-[11px] text-slate-500">Upload computed assessment files.</p>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 transition hover:from-indigo-500 hover:to-indigo-600 active:scale-95">
                <Icon name="chart" size={15} />Choose Grade File
                <input className="hidden" type="file" accept=".xlsx,.xls,.xlsm,.csv" disabled={gradeSheetImportState?.status === "working"} onChange={(event) => upload(event, importGradeSheet)} />
              </label>
            </div>

            {importState?.message && <p className="rounded-xl border border-slate-200/60 bg-slate-100/50 p-2.5 text-center text-xs text-slate-600 backdrop-blur-sm" role="status">{importState.message}</p>}
            {gradeSheetImportState?.message && <p className="rounded-xl border border-slate-200/60 bg-slate-100/50 p-2.5 text-center text-xs text-slate-600 backdrop-blur-sm" role="status">{gradeSheetImportState.message}</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}