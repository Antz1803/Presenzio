import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../auth/useAuth";
import { Icon } from "../DashboardShared";
import { resolvePrintLogos } from "../../../lib/printLogos";
import { getStoredDean } from "../../Models/deanStorage";
import {
  ENROLLMENT_STATUSES,
  LOW_ATTENDANCE,
  PASSING_GRADE,
  PERIOD_LABELS,
  buildAccomplishmentStats,
  buildMonitoring,
  compressImage,
  deleteAccomplishment,
  deleteActivity,
  listAccomplishments,
  listActivities,
  loadSemesterData,
  saveAccomplishment,
  saveActivity,
  setEnrollmentStatus,
  statusLabel,
} from "../../../lib/semesterReports";

const SemesterReportPrint = lazy(() => import("./SemesterReportPrint"));

const PANEL = "rounded-xl border border-accent/20 bg-surface-1/85 p-5 backdrop-blur-xl shadow-xl shadow-black/40";
const EYEBROW = "font-mono text-[10px] font-bold uppercase tracking-wider text-accent";
const LABEL = "mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-ink-3";
const INPUT = "w-full rounded-lg border border-white/10 bg-surface-2 px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";
const BTN_PRIMARY = "inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-3.5 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-canvas transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50";
const BTN_GHOST = "inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink-2 transition hover:bg-white/10";

const TABS = [
  ["monitoring", "Student monitoring"],
  ["accomplishment", "Accomplishments"],
  ["activities", "Activities"],
];

const PERIOD_NAMES = PERIOD_LABELS;

const RED = "font-semibold text-rose-400";

const failedText = (row) => row.failedPeriods.map((code) => `${PERIOD_LABELS[code]} ${row.grades[code].toFixed(2)}`).join(" · ");

const MAX_PHOTOS = 6;
const MAX_SHEETS = 2;

const pad = (value) => String(value).padStart(2, "0");
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

function monthRange(month) {
  const [year, number] = month.split("-").map(Number);
  const last = new Date(year, number, 0).getDate();
  return {
    start: `${month}-01`,
    end: `${month}-${pad(last)}`,
    label: new Date(year, number - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  };
}

function prettyDate(value) {
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const inRange = (date, range) => {
  const value = String(date ?? "").slice(0, 10);
  return Boolean(value) && value >= range.start && value <= range.end;
};

function Field({ label, children }) {
  return <label className="block"><span className={LABEL}>{label}</span>{children}</label>;
}

function StatusEditor({ row, busy, onSave, onCancel }) {
  const [status, setStatus] = useState(ENROLLMENT_STATUSES.some((item) => item.value === row.status) ? row.status : "withdrawn");
  const [remark, setRemark] = useState(row.statusRemark || "");
  return (
    <div className="mt-2 grid gap-2 rounded-lg border border-white/10 bg-surface-2/70 p-3 md:grid-cols-[180px_minmax(0,1fr)_auto_auto] md:items-end">
      <Field label="Status">
        <select className={INPUT} value={status} onChange={(event) => setStatus(event.target.value)}>
          {ENROLLMENT_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </Field>
      <Field label="Remarks (optional)">
        <input className={INPUT} value={remark} maxLength={200} onChange={(event) => setRemark(event.target.value)} placeholder="e.g. transferred to another school" />
      </Field>
      <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => onSave(status, remark)}>Save</button>
      <button type="button" className={BTN_GHOST} onClick={onCancel}>Cancel</button>
    </div>
  );
}

function StudentList({ title, note, list, empty, extra, editing, setEditing, busy, onStatus }) {
  return (
    <section className={PANEL}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold text-ink">{title} <span className="text-accent">({list.length})</span></h3>
          <p className="text-xs text-ink-3">{note}</p>
        </div>
      </div>
      {list.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center text-xs text-ink-3">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((row) => (
            <li key={row.key} className="rounded-lg border border-white/5 bg-surface-2/70 p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1 basis-52">
                  <p className="truncate text-sm font-semibold text-ink">{row.name}</p>
                  <p className="truncate text-[11px] text-ink-3">{row.sectionLabel}{row.studentNo ? ` · ${row.studentNo}` : ""}</p>
                </div>
                <p className="text-xs text-ink-2">{extra(row)}</p>
                <button type="button" className={BTN_GHOST} onClick={() => setEditing(editing === row.key ? "" : row.key)}>
                  {row.status === "active" ? "Mark as…" : "Edit status"}
                </button>
                {row.status !== "active" && (
                  <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => onStatus(row, "active", "")}>Reinstate</button>
                )}
              </div>
              {editing === row.key && (
                <StatusEditor key={row.key} row={row} busy={busy} onCancel={() => setEditing("")} onSave={(status, remark) => onStatus(row, status, remark)} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Monitoring({ records, reload, uid, onPrint }) {
  const monitoring = useMemo(() => buildMonitoring(records), [records]);
  const [editing, setEditing] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const changeStatus = async (row, status, remark) => {
    setBusy(true);
    setError("");
    try {
      await setEnrollmentStatus(uid, row.sectionId, row.enrollmentId, { status, remark });
      setEditing("");
      await reload();
    } catch (saveError) {
      setError(saveError?.message || "Could not save the status.");
    } finally {
      setBusy(false);
    }
  };
  const shared = { editing, setEditing, busy, onStatus: changeStatus };
  const total = monitoring.failing.length + monitoring.stopped.length + monitoring.lowAttendance.length + monitoring.left.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-xs leading-5 text-ink-2">
          Built from all your classes. Use <strong>Mark as…</strong> to record students who withdrew, are not continuing, or stopped attending. They are kept in your records instead of being deleted, and <strong>Reinstate</strong> puts them back.
        </p>
        <button type="button" className={BTN_PRIMARY} disabled={!records.length} onClick={() => onPrint("monitoring", monitoring, "All classes")}>
          <Icon name="printer" size={14} /> Print report
        </button>
      </div>
      {error && <p className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-300" role="alert">{error}</p>}
      {!records.length && <p className={`${PANEL} text-center text-xs text-ink-3`}>No students found yet. Add classes and students first.</p>}
      {records.length > 0 && total === 0 && <p className={`${PANEL} text-center text-xs text-ink-2`}>No students need attention right now.</p>}
      <StudentList {...shared} title="Failing grades" note={`Any period grade above ${PASSING_GRADE.toFixed(2)} (Prelim, Midterm, Semi-final or Final). The Final grade is the official pass or fail.`} list={monitoring.failing} empty="No failing students." extra={(row) => <span className={RED}>Failed: {failedText(row)}</span>} />
      <StudentList {...shared} title="Stopped attending" note="No present or late mark in the last 3 recorded sessions." list={monitoring.stopped} empty="No students flagged." extra={(row) => `Attendance ${row.attendanceRate}%`} />
      <StudentList {...shared} title="Low attendance" note={`Attendance below ${LOW_ATTENDANCE}%.`} list={monitoring.lowAttendance} empty="No students below the threshold." extra={(row) => `${row.sessionsAttended}/${row.sessionsHeld} · ${row.attendanceRate}%`} />
      <StudentList {...shared} title="Withdrawn, not continuing, or stopped attending" note="Students you have marked as no longer enrolled." list={monitoring.left} empty="No students marked yet." extra={(row) => `${statusLabel(row.status)}${row.statusDate ? ` · ${prettyDate(row.statusDate)}` : ""} · ${row.statusRemark ? `Remarks: ${row.statusRemark}` : "No remarks yet"}`} />
    </div>
  );
}

function Accomplishments({ classes, range, uid, onPrint }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ id: "", title: "", date: today(), description: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setItems(await listAccomplishments(uid));
    } catch (loadError) {
      setError(loadError?.message || "Could not load accomplishments.");
    }
  }, [uid]);
  useEffect(() => {
    // Loads once per signed-in teacher.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const visible = items.filter((item) => inRange(item.date, range));
  const stats = useMemo(() => buildAccomplishmentStats(classes, range.start, range.end), [classes, range]);

  const save = async () => {
    if (!form.title.trim()) return setError("Add a title for the accomplishment.");
    setBusy(true);
    setError("");
    try {
      await saveAccomplishment(uid, { id: form.id, title: form.title.trim(), date: form.date, description: form.description.trim() });
      setForm({ id: "", title: "", date: today(), description: "" });
      await refresh();
    } catch (saveError) {
      setError(saveError?.message || "Could not save.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (item) => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    await deleteAccomplishment(uid, item.id);
    await refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-xs leading-5 text-ink-2">Class figures for <strong>{range.label}</strong> are calculated automatically. Add your own accomplishments and deliverables below.</p>
        <button type="button" className={BTN_PRIMARY} onClick={() => onPrint("accomplishment", { stats, items: [...visible].sort((a, b) => a.date.localeCompare(b.date)) }, range.label)}>
          <Icon name="printer" size={14} /> Print report
        </button>
      </div>
      <section className={PANEL}>
        <h3 className="mb-3 font-display text-base font-semibold text-ink">Class summary</h3>
        {stats.length === 0 ? <p className="text-xs text-ink-3">No classes yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs text-ink-2">
              <thead className="font-mono text-[10px] uppercase tracking-wider text-ink-3">
                <tr><th className="py-2 pr-3">Class</th><th className="pr-3">Enrolled</th><th className="pr-3">Left</th><th className="pr-3">Sessions</th><th className="pr-3">Attendance</th><th className="pr-3">Passed</th><th className="pr-3">Failed (Final)</th><th className="pr-3">Failing (any period)</th><th>Avg.</th></tr>
              </thead>
              <tbody>
                {stats.map((item) => (
                  <tr key={item.label} className="border-t border-white/5">
                    <td className="py-2 pr-3 font-semibold text-ink">{item.label}</td>
                    <td className="pr-3">{item.enrolled}</td><td className="pr-3">{item.left}</td><td className="pr-3">{item.sessions}</td>
                    <td className="pr-3">{item.attendance == null ? "—" : `${item.attendance}%`}</td>
                    <td className="pr-3">{item.passed}</td><td className={`pr-3 ${item.failed ? RED : ""}`}>{item.failed}</td><td className={`pr-3 ${item.failingAny ? RED : ""}`}>{item.failingAny}</td><td>{item.average ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className={PANEL}>
        <h3 className="mb-1 font-display text-base font-semibold text-ink">Who left and who is failing</h3>
        <p className="mb-3 text-xs text-ink-3">By class. These names are included in the printed report.</p>
        {stats.every((item) => !item.leftList.length && !item.failingList.length) ? (
          <p className="text-xs text-ink-3">No students have left and none are failing.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {stats.filter((item) => item.leftList.length || item.failingList.length).map((item) => (
              <div key={item.label} className="rounded-lg border border-white/5 bg-surface-2/70 p-3">
                <p className="text-sm font-semibold text-ink">{item.label}</p>
                <div className="mt-2 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-ink-3">Left ({item.leftList.length})</p>
                    {item.leftList.length === 0 ? <p className="mt-1 text-xs text-ink-3">None</p> : (
                      <ul className="mt-1 flex flex-col gap-1 text-xs text-ink-2">
                        {item.leftList.map((row) => <li key={row.key}>{row.name} <span className="text-ink-3">· {statusLabel(row.status)}</span></li>)}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-ink-3">Failing ({item.failingList.length})</p>
                    {item.failingList.length === 0 ? <p className="mt-1 text-xs text-ink-3">None</p> : (
                      <ul className="mt-1 flex flex-col gap-1 text-xs text-ink-2">
                        {item.failingList.map((row) => <li key={row.key}>{row.name} <span className={RED}>· {failedText(row)}</span></li>)}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className={PANEL}>
        <h3 className="mb-3 font-display text-base font-semibold text-ink">{form.id ? "Edit accomplishment" : "Add accomplishment"}</h3>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
          <Field label="Title"><input className={INPUT} value={form.title} maxLength={120} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Submitted midterm grades" /></Field>
          <Field label="Date"><input type="date" className={INPUT} value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></Field>
        </div>
        <div className="mt-3"><Field label="Details"><textarea className={`${INPUT} min-h-20`} value={form.description} maxLength={600} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field></div>
        {error && <p className="mt-3 text-xs text-rose-300" role="alert">{error}</p>}
        <div className="mt-3 flex gap-2">
          <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={save}>{form.id ? "Update" : "Add"}</button>
          {form.id && <button type="button" className={BTN_GHOST} onClick={() => setForm({ id: "", title: "", date: today(), description: "" })}>Cancel</button>}
        </div>
      </section>
      <section className={PANEL}>
        <h3 className="mb-3 font-display text-base font-semibold text-ink">Accomplishments in {range.label} <span className="text-accent">({visible.length})</span></h3>
        {visible.length === 0 ? <p className="text-xs text-ink-3">Nothing recorded for this period yet.</p> : (
          <ul className="flex flex-col gap-2">
            {visible.map((item) => (
              <li key={item.id} className="flex flex-wrap items-start gap-3 rounded-lg border border-white/5 bg-surface-2/70 p-3">
                <div className="min-w-0 flex-1 basis-60">
                  <p className="text-sm font-semibold text-ink">{item.title}</p>
                  <p className="text-[11px] text-ink-3">{prettyDate(item.date)}</p>
                  {item.description && <p className="mt-1 whitespace-pre-wrap text-xs text-ink-2">{item.description}</p>}
                </div>
                <button type="button" className={BTN_GHOST} onClick={() => setForm({ id: item.id, title: item.title, date: item.date, description: item.description || "" })}>Edit</button>
                <button type="button" className={BTN_GHOST} onClick={() => remove(item)}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const EMPTY_ACTIVITY = { id: "", title: "", date: today(), venue: "", participants: "", description: "", photos: [], sheets: [] };

function Activities({ range, uid, onPrint }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY_ACTIVITY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setItems(await listActivities(uid));
    } catch (loadError) {
      setError(loadError?.message || "Could not load activities.");
    }
  }, [uid]);
  useEffect(() => {
    // Loads once per signed-in teacher.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const visible = items.filter((item) => inRange(item.date, range));

  const addImages = async (field, limit, files) => {
    setError("");
    const room = limit - form[field].length;
    if (room <= 0) return setError(`You can attach up to ${limit} images here.`);
    try {
      const added = await Promise.all(Array.from(files).slice(0, room).map((file) => compressImage(file)));
      setForm((current) => ({ ...current, [field]: [...current[field], ...added] }));
    } catch (imageError) {
      setError(imageError?.message || "Could not add the image.");
    }
  };
  const removeImage = (field, index) => setForm((current) => ({ ...current, [field]: current[field].filter((_, position) => position !== index) }));

  const save = async () => {
    if (!form.title.trim()) return setError("Add a title for the activity.");
    setBusy(true);
    setError("");
    try {
      await saveActivity(uid, {
        id: form.id,
        title: form.title.trim(),
        date: form.date,
        venue: form.venue.trim(),
        participants: form.participants === "" ? "" : Number(form.participants) || 0,
        description: form.description.trim(),
        photos: form.photos,
        sheets: form.sheets,
      });
      setForm(EMPTY_ACTIVITY);
      await refresh();
    } catch (saveError) {
      setError(saveError?.message || "Could not save the activity.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (item) => {
    if (!window.confirm(`Delete "${item.title}" and its photos?`)) return;
    await deleteActivity(uid, item.id);
    await refresh();
  };

  const thumbs = (field) => form[field].length > 0 && (
    <div className="mt-2 flex flex-wrap gap-2">
      {form[field].map((src, index) => (
        <div key={index} className="relative">
          <img src={src} alt="" className="h-16 w-20 rounded-lg border border-white/10 object-cover" />
          <button type="button" aria-label="Remove image" className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-rose-500 text-[10px] font-bold text-white" onClick={() => removeImage(field, index)}>×</button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-xs leading-5 text-ink-2">Record completed activities with photos and attendance sheets. The printed report includes them for <strong>{range.label}</strong>.</p>
        <button type="button" className={BTN_PRIMARY} disabled={!visible.length} onClick={() => onPrint("activities", { items: [...visible].sort((a, b) => a.date.localeCompare(b.date)) }, range.label)}>
          <Icon name="printer" size={14} /> Print report
        </button>
      </div>
      <section className={PANEL}>
        <h3 className="mb-3 font-display text-base font-semibold text-ink">{form.id ? "Edit activity" : "Add activity"}</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Activity title"><input className={INPUT} value={form.title} maxLength={120} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
          <Field label="Date"><input type="date" className={INPUT} value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></Field>
          <Field label="Venue"><input className={INPUT} value={form.venue} maxLength={120} onChange={(event) => setForm({ ...form, venue: event.target.value })} /></Field>
          <Field label="Number of participants"><input type="number" min="0" className={INPUT} value={form.participants} onChange={(event) => setForm({ ...form, participants: event.target.value })} /></Field>
        </div>
        <div className="mt-3"><Field label="Description"><textarea className={`${INPUT} min-h-24`} value={form.description} maxLength={1200} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field></div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <span className={LABEL}>Photos (up to {MAX_PHOTOS})</span>
            <input type="file" accept="image/*" multiple className="text-xs text-ink-2" onChange={(event) => { void addImages("photos", MAX_PHOTOS, event.target.files); event.target.value = ""; }} />
            {thumbs("photos")}
          </div>
          <div>
            <span className={LABEL}>Attendance sheet (up to {MAX_SHEETS})</span>
            <input type="file" accept="image/*" multiple className="text-xs text-ink-2" onChange={(event) => { void addImages("sheets", MAX_SHEETS, event.target.files); event.target.value = ""; }} />
            {thumbs("sheets")}
          </div>
        </div>
        {error && <p className="mt-3 text-xs text-rose-300" role="alert">{error}</p>}
        <div className="mt-3 flex gap-2">
          <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={save}>{busy ? "Saving…" : form.id ? "Update" : "Add activity"}</button>
          {form.id && <button type="button" className={BTN_GHOST} onClick={() => setForm(EMPTY_ACTIVITY)}>Cancel</button>}
        </div>
      </section>
      <section className={PANEL}>
        <h3 className="mb-3 font-display text-base font-semibold text-ink">Activities in {range.label} <span className="text-accent">({visible.length})</span></h3>
        {visible.length === 0 ? <p className="text-xs text-ink-3">No activities recorded for this period.</p> : (
          <ul className="flex flex-col gap-2">
            {visible.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-white/5 bg-surface-2/70 p-3">
                <div className="min-w-0 flex-1 basis-60">
                  <p className="text-sm font-semibold text-ink">{item.title}</p>
                  <p className="text-[11px] text-ink-3">{prettyDate(item.date)}{item.venue ? ` · ${item.venue}` : ""} · {(item.photos?.length ?? 0)} photo(s), {(item.sheets?.length ?? 0)} sheet(s)</p>
                </div>
                <button type="button" className={BTN_GHOST} onClick={() => setForm({ ...EMPTY_ACTIVITY, ...item, participants: item.participants ?? "", photos: item.photos ?? [], sheets: item.sheets ?? [] })}>Edit</button>
                <button type="button" className={BTN_GHOST} onClick={() => remove(item)}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function SemesterReports() {
  const { user } = useAuth();
  const uid = user?.id;
  const [tab, setTab] = useState("monitoring");
  const [data, setData] = useState({ classes: [], records: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [printing, setPrinting] = useState(null);
  const year = new Date().getFullYear();
  const [mode, setMode] = useState("semester");
  const [monthChoice, setMonthChoice] = useState("");
  const [semesterOverride, setSemesterOverride] = useState(null);

  // Same sources the class records use: the profile for the instructor, and
  // the Dean saved in each class's grade settings.
  const instructor = useMemo(() => {
    const profile = user?.user_metadata?.instructor_profile || {};
    return {
      name: profile.name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "",
      position: profile.position || "Instructor",
    };
  }, [user]);

  const reload = useCallback(async () => {
    if (!uid) return;
    try {
      setData(await loadSemesterData(uid));
      setLoadError("");
    } catch (error) {
      setLoadError(error?.message || "Could not load your class data.");
    } finally {
      setLoading(false);
    }
  }, [uid]);
  useEffect(() => {
    // Loads once per signed-in teacher.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const detectedDean = useMemo(() => {
    for (const entry of data.classes) {
      const found = entry.section?.dean || entry.section?.dean_name || getStoredDean(entry.section?.id);
      if (found) return found;
    }
    return "";
  }, [data.classes]);
  const dean = detectedDean;

  // The semester runs from the first grading period's start to the last
  // period's end, exactly as set in Grade Settings.
  const dated = useMemo(() => (data.periods ?? []).filter((item) => item.start_date && item.end_date), [data.periods]);
  const bounds = useMemo(() => {
    if (!dated.length) return { start: `${year}-08-01`, end: `${year}-12-31`, fromPeriods: false };
    const starts = dated.map((item) => item.start_date).sort();
    const ends = dated.map((item) => item.end_date).sort();
    return { start: starts[0], end: ends[ends.length - 1], fromPeriods: true };
  }, [dated, year]);
  const semester = semesterOverride ?? bounds;
  const month = useMemo(() => {
    if (monthChoice) return monthChoice;
    const current = today().slice(0, 7);
    const low = bounds.start.slice(0, 7);
    const high = bounds.end.slice(0, 7);
    return current < low ? low : current > high ? high : current;
  }, [monthChoice, bounds]);

  const range = useMemo(() => {
    if (mode.startsWith("period:")) {
      const period = dated.find((item) => item.code === mode.slice(7));
      if (period) {
        return {
          start: period.start_date,
          end: period.end_date,
          label: `${PERIOD_NAMES[period.code] ?? period.code}: ${prettyDate(period.start_date)} – ${prettyDate(period.end_date)}`,
        };
      }
    }
    if (mode === "month" && month) return monthRange(month);
    return { ...semester, label: `${prettyDate(semester.start)} – ${prettyDate(semester.end)}` };
  }, [mode, month, semester, dated]);

  // Logos are read when printing so the choice made on this page always applies.
  const openPrint = (kind, payload, periodLabel) =>
    setPrinting({ kind, payload, periodLabel, logos: resolvePrintLogos(user?.user_metadata?.instructor_profile || {}) });
  const closePrint = useCallback(() => setPrinting(null), []);

  return (
    <section className="flex flex-col gap-4" aria-labelledby="semester-reports-title">
      <header className={PANEL}>
        <span className={EYEBROW}>Semester-end</span>
        <h2 id="semester-reports-title" className="font-display text-xl font-bold tracking-tight text-ink">Required reports</h2>
        <p className="mt-0.5 text-xs text-ink-2">Student monitoring, accomplishment, and activity reports with documentation.</p>
        <div role="tablist" className="mt-4 flex flex-wrap gap-2">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={`rounded-lg border px-3.5 py-2 font-mono text-[11px] font-bold uppercase tracking-wider transition ${tab === id ? "border-accent bg-accent/15 text-accent" : "border-white/10 bg-white/5 text-ink-2 hover:bg-white/10"}`}>
              {label}
            </button>
          ))}
        </div>
        {tab !== "monitoring" && (
          <div className="mt-4 grid gap-3 md:grid-cols-[160px_minmax(0,1fr)] md:items-end">
            <Field label="Report period">
              <select className={INPUT} value={mode} onChange={(event) => setMode(event.target.value)}>
                <option value="semester">Whole semester</option>
                {dated.map((item) => <option key={item.code} value={`period:${item.code}`}>{PERIOD_NAMES[item.code] ?? item.code}</option>)}
                <option value="month">Month</option>
              </select>
            </Field>
            {mode === "month" ? (
              <Field label="Month"><input type="month" className={INPUT} value={month} min={bounds.start.slice(0, 7)} max={bounds.end.slice(0, 7)} onChange={(event) => setMonthChoice(event.target.value)} /></Field>
            ) : mode.startsWith("period:") ? (
              <p className="text-xs leading-5 text-ink-2">Dates come from your Grade Settings: <strong>{range.label}</strong>.</p>
            ) : (
              <div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="From"><input type="date" className={INPUT} value={semester.start} onChange={(event) => setSemesterOverride({ ...semester, start: event.target.value })} /></Field>
                  <Field label="To"><input type="date" className={INPUT} value={semester.end} onChange={(event) => setSemesterOverride({ ...semester, end: event.target.value })} /></Field>
                </div>
                <p className="mt-1 text-[11px] text-ink-3">
                  {semesterOverride ? "Custom dates. " : bounds.fromPeriods ? "Taken from your grading periods (Prelim start to Final end). " : "Set your period dates in Grade Settings to fill this automatically. "}
                  {semesterOverride && <button type="button" className="underline" onClick={() => setSemesterOverride(null)}>Reset</button>}
                </p>
              </div>
            )}
          </div>
        )}
      </header>

      {loading && <p className={`${PANEL} text-center text-xs text-ink-3`}>Loading your classes…</p>}
      {loadError && <p className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-300" role="alert">{loadError}</p>}
      {!loading && tab === "monitoring" && <Monitoring records={data.records} reload={reload} uid={uid} onPrint={openPrint} />}
      {!loading && tab === "accomplishment" && <Accomplishments classes={data.classes} range={range} uid={uid} onPrint={openPrint} />}
      {!loading && tab === "activities" && <Activities range={range} uid={uid} onPrint={openPrint} />}

      {printing && (
        <Suspense fallback={null}>
          <SemesterReportPrint kind={printing.kind} data={printing.payload} periodLabel={printing.periodLabel} instructorName={instructor.name} instructorPosition={instructor.position} deanName={dean} leftLogo={printing.logos.left} rightLogo={printing.logos.right} onClose={closePrint} />
        </Suspense>
      )}
    </section>
  );
}
