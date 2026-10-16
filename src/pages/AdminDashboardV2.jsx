import { useEffect, useMemo, useState } from "react";
import { onValue, ref, update } from "firebase/database";
import { auth, db } from "../lib/Firebase";
import { useAuth } from "../auth/useAuth";
import { DEFAULT_BRANDING, useBranding } from "../lib/branding";
import logoDark from "../assets/LogoDark.png";

function formatDate(value) {
  if (!value) return "Unknown date";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function timeAgo(value) {
  if (!value) return "Never";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const units = [["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [label, size] of units) {
    if (seconds >= size) {
      const amount = Math.floor(seconds / size);
      return `${amount} ${label}${amount === 1 ? "" : "s"} ago`;
    }
  }
  return "Just now";
}

// pending | active | inactive (approved but switched off) | rejected
function accessState(request) {
  if (request.status === "approved") return request.active === false ? "inactive" : "active";
  return request.status === "rejected" ? "rejected" : "pending";
}

const STATE_META = {
  pending: { label: "Pending", badge: "bg-amber-50 text-amber-700", dot: "bg-amber-400" },
  active: { label: "Active", badge: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-400" },
  inactive: { label: "Deactivated", badge: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  rejected: { label: "Rejected", badge: "bg-rose-50 text-rose-700", dot: "bg-rose-400" },
};

const ACTIONS = {
  approve: { patch: { status: "approved", active: true }, label: "Approve" },
  reject: { patch: { status: "rejected", active: false }, label: "Reject" },
  deactivate: { patch: { status: "approved", active: false }, label: "Deactivate" },
  reactivate: { patch: { status: "approved", active: true }, label: "Reactivate" },
};

const CONFIRM_COPY = {
  reject: "They will not be able to sign in. You can approve them again later.",
  deactivate: "They are signed out right away and cannot sign in until you reactivate them. Their classes and data are kept.",
};

const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100";

function StatCard({ label, value, tone }) {
  return <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"><div className={`mb-4 h-2 w-10 rounded-full ${tone}`} /><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p><strong className="mt-1 block text-3xl font-extrabold tracking-tight text-slate-900">{value}</strong></div>;
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { branding, saveBranding, resetBranding, ensureBranding } = useBranding();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(Boolean(db));
  const [summaries, setSummaries] = useState({});
  const [summaryNotice, setSummaryNotice] = useState("");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const [savingUid, setSavingUid] = useState("");
  const [savingBranding, setSavingBranding] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [brandingMessage, setBrandingMessage] = useState("");
  const [error, setError] = useState(() => db ? "" : "Firebase Realtime Database is not configured.");
  const [draft, setDraft] = useState({ ...DEFAULT_BRANDING });

  useEffect(() => {
    // Branding is loaded asynchronously from the public settings node.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft({ appName: branding.appName, tagline: branding.tagline, loginTitle: branding.loginTitle, loginDescription: branding.loginDescription, accentColor: branding.accentColor, logoUrl: branding.logoUrl, logoWidth: branding.logoWidth, logoHeight: branding.logoHeight, logoMarginTop: branding.logoMarginTop, logoMarginRight: branding.logoMarginRight, logoMarginBottom: branding.logoMarginBottom, logoMarginLeft: branding.logoMarginLeft });
  }, [branding]);

  useEffect(() => {
    if (user?.isAdmin) void ensureBranding(true);
  }, [ensureBranding, user?.isAdmin]);

  useEffect(() => {
    if (!db) return undefined;
    return onValue(ref(db, "registrationRequests"), (snapshot) => {
      const values = snapshot.val() ?? {};
      setRequests(Object.entries(values).map(([uid, request]) => ({ uid, ...request })).sort((first, second) => {
        const statusOrder = { pending: 0, rejected: 1, approved: 2 };
        return (statusOrder[first.status] ?? 9) - (statusOrder[second.status] ?? 9) || String(second.created_at ?? "").localeCompare(String(first.created_at ?? ""));
      }));
      setLoading(false);
    }, (databaseError) => {
      setError(databaseError.message || "Could not load registration requests.");
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!db) return undefined;
    return onValue(ref(db, "instructorSummary"), (snapshot) => {
      console.info("[Presenzio] instructorSummary received, uids:", Object.keys(snapshot.val() ?? {}));
      setSummaries(snapshot.val() ?? {});
      setSummaryNotice("");
    }, (summaryError) => {
      setSummaryNotice(summaryError?.code === "PERMISSION_DENIED"
        ? "Teacher activity is hidden until the updated database rules are published in Firebase."
        : summaryError?.message || "Could not load teacher activity.");
    });
  }, []);

  const teachers = useMemo(() => requests.map((request) => ({
    ...request,
    state: accessState(request),
    summary: summaries[request.uid] ?? null,
  })), [requests, summaries]);

  const counts = useMemo(() => {
    const result = { all: teachers.length, pending: 0, active: 0, inactive: 0, rejected: 0, sections: 0, students: 0 };
    teachers.forEach((teacher) => {
      result[teacher.state] += 1;
      if (teacher.state === "active") {
        result.sections += Number(teacher.summary?.sections) || 0;
        result.students += Number(teacher.summary?.students) || 0;
      }
    });
    return result;
  }, [teachers]);

  const visibleTeachers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return teachers.filter((teacher) => {
      if (filter !== "all" && teacher.state !== filter) return false;
      if (!term) return true;
      return [teacher.name, teacher.email, teacher.summary?.position, ...(teacher.summary?.courses ?? [])]
        .some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [teachers, filter, query]);

  const decide = async (request, action) => {
    if (!db || !auth.currentUser) return;
    const now = new Date().toISOString();
    setSavingUid(request.uid);
    setError("");
    try {
      await update(ref(db, `registrationRequests/${request.uid}`), {
        ...ACTIONS[action].patch,
        reviewed_by: auth.currentUser.uid,
        reviewed_at: now,
        updated_at: now,
      });
    } catch (decisionError) {
      setError(decisionError.message || "Could not update this request.");
    } finally {
      setSavingUid("");
      setPendingAction(null);
    }
  };

  // Approving is safe to do directly; removing access asks for confirmation first.
  const requestAction = (request, action) => {
    if (action === "approve" || action === "reactivate") void decide(request, action);
    else setPendingAction({ request, action });
  };

  const updateDraft = (event) => {
    const { name, value } = event.target;
    setDraft((current) => ({ ...current, [name]: value }));
    setBrandingMessage("");
  };

  const handleLogoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return setBrandingMessage("Please choose an image file.");
    if (file.size > 1_500_000) return setBrandingMessage("Please keep the logo below 1.5 MB for fast loading.");
    const reader = new FileReader();
    reader.onload = () => {
      setDraft((current) => ({ ...current, logoUrl: String(reader.result || "") }));
      setBrandingMessage("Logo ready to save.");
    };
    reader.readAsDataURL(file);
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    setSavingBranding(true);
    setBrandingMessage("");
    try {
      await saveBranding(draft);
      setBrandingMessage("Branding saved. The public pages update automatically.");
    } catch (saveError) {
      setBrandingMessage(saveError.message || "Could not save branding settings.");
    } finally {
      setSavingBranding(false);
    }
  };

  const restoreDefaults = () => {
    setBrandingMessage("");
    setConfirmResetOpen(true);
  };

  const confirmRestoreDefaults = async () => {
    setConfirmResetOpen(false);
    setSavingBranding(true);
    try {
      await resetBranding();
      setBrandingMessage("Default branding restored.");
    } catch (resetError) {
      setBrandingMessage(resetError.message || "Could not restore the defaults.");
    } finally {
      setSavingBranding(false);
    }
  };

  const previewLogoWidth = Number(draft.logoWidth) || DEFAULT_BRANDING.logoWidth;
  const previewLogoHeight = Number(draft.logoHeight) || DEFAULT_BRANDING.logoHeight;
  const previewLogoMarginTop = Number(draft.logoMarginTop) || 0;
  const previewLogoMarginBottom = Number(draft.logoMarginBottom) || 0;
  const previewBrandHeight = Math.max(
    72,
    previewLogoHeight + previewLogoMarginTop + previewLogoMarginBottom,
  );
  const previewLogoStyle = {
    width: `${previewLogoWidth}px`,
    height: `${previewLogoHeight}px`,
    marginTop: `${previewLogoMarginTop}px`,
    marginRight: `${Number(draft.logoMarginRight) || 0}px`,
    marginBottom: `${previewLogoMarginBottom}px`,
    marginLeft: `${Number(draft.logoMarginLeft) || 0}px`,
  };

  return <main className="min-h-screen bg-[#f5f7fb] px-4 py-5 text-slate-900 sm:px-8 sm:py-8">
    <div className="mx-auto max-w-7xl">
      <header className="relative mb-7 overflow-hidden rounded-[28px] bg-[#0b1735] px-6 py-6 text-white shadow-2xl shadow-indigo-950/15 sm:px-8">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-indigo-500/25 blur-3xl" /><div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-5"><div className="flex min-w-0 items-center gap-4"><div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-white p-1.5 shadow-lg shadow-black/20 ring-1 ring-white/20"><img src={branding.logoUrl || logoDark} alt={branding.appName} className="max-h-full max-w-full object-contain" /></div><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.24em] text-indigo-300">Administrator workspace</p><h1 className="mt-1 truncate text-2xl font-extrabold tracking-tight sm:text-3xl">Control center</h1><p className="mt-1 truncate text-sm text-slate-300">{user?.email} · full access</p></div></div><button type="button" onClick={logout} className="rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">Log out</button></div>
        <div className="relative mt-7 grid gap-3 text-sm text-slate-300 sm:grid-cols-[1fr_auto] sm:items-end"><div><p className="text-lg font-semibold text-white">Shape the experience your school sees.</p><p className="mt-1 max-w-2xl">Approve teachers, see how they are using the workspace, and keep it feeling like your own.</p></div><span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-200"><span className="h-2 w-2 rounded-full bg-emerald-300" /> Live settings</span></div>
      </header>
      {error && <p className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><StatCard label="Waiting for review" value={counts.pending} tone="bg-amber-400" /><StatCard label="Active teachers" value={counts.active} tone="bg-emerald-400" /><StatCard label="Deactivated" value={counts.inactive} tone="bg-slate-400" /><StatCard label="Rejected" value={counts.rejected} tone="bg-rose-400" /></div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 pb-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-500">People</p><h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">Teacher accounts</h2><p className="mt-1 text-sm text-slate-500">Approve, deactivate and monitor everyone who can enter the teaching workspace.</p></div><div className="flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">{counts.pending} pending</span><span className="rounded-full bg-indigo-50 px-3 py-1.5 text-indigo-700">{counts.sections} classes · {counts.students} students</span></div></div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email or course" className={`${inputClass.replace("w-full ", "")} w-full sm:w-64`} aria-label="Search teachers" />
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter teachers">
              {[["all", "All"], ["pending", "Pending"], ["active", "Active"], ["inactive", "Deactivated"], ["rejected", "Rejected"]].map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={filter === key} onClick={() => setFilter(key)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${filter === key ? "bg-indigo-600 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{label} <span className="opacity-70">{counts[key]}</span></button>)}
            </div>
          </div>
          {summaryNotice && <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800" role="status">{summaryNotice}</p>}
          {loading && <p className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">Loading teacher accounts…</p>}
          {!loading && !teachers.length && <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-xl shadow-sm">✓</div><h3 className="mt-4 font-bold text-slate-800">You’re all caught up</h3><p className="mt-1 text-sm text-slate-500">New teacher registrations will appear here.</p></div>}
          {!loading && teachers.length > 0 && !visibleTeachers.length && <p className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">No teachers match this filter.</p>}
          <div className="grid gap-3">{visibleTeachers.map((teacher) => {
            const meta = STATE_META[teacher.state];
            const busy = savingUid === teacher.uid;
            const summary = teacher.summary;
            const actionButton = (action, tone) => <button type="button" disabled={busy} onClick={() => requestAction(teacher, action)} className={`rounded-xl px-4 py-2 text-xs font-bold transition disabled:opacity-50 ${tone}`}>{busy ? "Saving…" : ACTIONS[action].label}</button>;
            return <article key={teacher.uid} className="rounded-2xl border border-slate-200 p-4 transition hover:border-indigo-200 hover:shadow-md sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0"><h3 className="truncate font-bold text-slate-900">{teacher.name || "Unnamed teacher"}</h3><p className="mt-1 truncate text-sm text-slate-600">{teacher.email}</p>{summary?.position && <p className="mt-1 text-xs font-semibold text-indigo-600">{summary.position}</p>}</div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${meta.badge}`}><span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />{meta.label}</span>
              </div>
              {summary?.courses?.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{summary.courses.map((course) => <span key={course} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">{course}</span>)}</div>}
              {teacher.state === "active" || teacher.state === "inactive" ? <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-slate-50 px-2 py-2.5"><strong className="block text-lg font-extrabold text-slate-900">{summary ? summary.sections : "—"}</strong><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Classes</span></div>
                <div className="rounded-xl bg-slate-50 px-2 py-2.5"><strong className="block text-lg font-extrabold text-slate-900">{summary ? summary.students : "—"}</strong><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Students</span></div>
                <div className="rounded-xl bg-slate-50 px-2 py-2.5"><strong className="block text-sm font-extrabold leading-7 text-slate-900">{summary ? timeAgo(summary.last_active_at) : "Not synced"}</strong><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Last active</span></div>
              </div> : null}
              {!summary && teacher.state === "active" && !summaryNotice && <p className="mt-2 text-[11px] font-semibold text-amber-700" role="status">No activity report from this teacher yet. If they have already signed in, the latest database rules may not be published in Firebase.</p>}
              <p className="mt-3 text-xs text-slate-400">Registered {formatDate(teacher.created_at)}{teacher.reviewed_at ? ` · Reviewed ${formatDate(teacher.reviewed_at)}` : ""}</p>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                {teacher.state === "pending" && <>{actionButton("approve", "bg-emerald-600 text-white hover:bg-emerald-500")}{actionButton("reject", "bg-rose-50 text-rose-700 hover:bg-rose-100")}</>}
                {teacher.state === "active" && actionButton("deactivate", "border border-slate-200 text-slate-600 hover:bg-slate-50")}
                {teacher.state === "inactive" && <>{actionButton("reactivate", "bg-emerald-600 text-white hover:bg-emerald-500")}{actionButton("reject", "bg-rose-50 text-rose-700 hover:bg-rose-100")}</>}
                {teacher.state === "rejected" && actionButton("approve", "bg-emerald-600 text-white hover:bg-emerald-500")}
              </div>
            </article>;
          })}</div>
        </section>
        <aside className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"><div className="mb-5"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-500">Appearance</p><h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">Branding studio</h2><p className="mt-1 text-sm leading-6 text-slate-500">Change the logo, name, welcome copy, and color used across the app.</p></div>
          <form onSubmit={saveSettings} className="space-y-4"><div className="flex items-center gap-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3"><div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-white p-2 shadow-sm"><img src={draft.logoUrl || logoDark} alt="Logo preview" className="max-h-full max-w-full object-contain" /></div><div className="min-w-0"><p className="text-xs font-bold text-slate-800">Logo preview</p><p className="mt-1 truncate text-[11px] text-slate-500">Shown on login, dashboard, admin, and student pages.</p></div></div>
            <label className="block text-xs font-bold text-slate-700">Upload a logo<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoUpload} className="mt-2 block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-100 file:px-3 file:py-2 file:font-bold file:text-indigo-700 hover:file:bg-indigo-200" /></label>
            <label className="block text-xs font-bold text-slate-700">Or use a logo URL<input name="logoUrl" value={draft.logoUrl} onChange={updateDraft} className={`${inputClass} mt-2`} placeholder="https://example.com/logo.png" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-bold text-slate-700">Teacher logo width (px)<input name="logoWidth" type="number" min="24" max="320" step="1" value={draft.logoWidth} onChange={updateDraft} className={`${inputClass} mt-2`} /></label>
              <label className="block text-xs font-bold text-slate-700">Teacher logo height (px)<input name="logoHeight" type="number" min="24" max="320" step="1" value={draft.logoHeight} onChange={updateDraft} className={`${inputClass} mt-2`} /></label>
            </div>
            <p className="-mt-2 text-[11px] text-slate-400">These dimensions control the logo in the teacher dashboard sidebar.</p>
            <div>
              <p className="text-xs font-bold text-slate-700">Teacher logo margins (px)</p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <label className="block text-[11px] font-semibold text-slate-600">Top<input name="logoMarginTop" type="number" min="0" max="200" step="1" value={draft.logoMarginTop} onChange={updateDraft} className={`${inputClass} mt-1`} /></label>
                <label className="block text-[11px] font-semibold text-slate-600">Right<input name="logoMarginRight" type="number" min="0" max="200" step="1" value={draft.logoMarginRight} onChange={updateDraft} className={`${inputClass} mt-1`} /></label>
                <label className="block text-[11px] font-semibold text-slate-600">Bottom<input name="logoMarginBottom" type="number" min="0" max="200" step="1" value={draft.logoMarginBottom} onChange={updateDraft} className={`${inputClass} mt-1`} /></label>
                <label className="block text-[11px] font-semibold text-slate-600">Left<input name="logoMarginLeft" type="number" min="0" max="200" step="1" value={draft.logoMarginLeft} onChange={updateDraft} className={`${inputClass} mt-1`} /></label>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-slate-800">Teacher dashboard preview</p>
                  <p className="mt-1 text-[11px] text-slate-500">Live preview: {previewLogoWidth} × {previewLogoHeight} px</p>
                </div>
                <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-indigo-600 shadow-sm">Live</span>
              </div>
              <div className="mt-3 overflow-auto rounded-xl border border-slate-200 bg-slate-100 p-3">
                <div className="flex min-w-[500px] items-stretch overflow-hidden rounded-lg bg-[#0a0f1d]">
                  <div
                    className="w-[244px] shrink-0 border-r border-cyan-400/20 bg-[#0f172a]"
                    style={{ padding: "28px 16px 18px", minHeight: "360px" }}
                  >
                    <div
                      className="flex items-center gap-[10px] px-3"
                      style={{
                        height: `${previewBrandHeight}px`,
                        minHeight: `${previewBrandHeight}px`,
                      }}
                    >
                      <img
                        src={draft.logoUrl || branding.logo}
                        alt="Teacher dashboard logo preview"
                        style={previewLogoStyle}
                        className="block shrink-0 object-fill"
                      />
                    </div>
                    <p
                      className="px-3 text-[9px] font-bold tracking-[0.18em] text-slate-500"
                      style={{ marginTop: "20px" }}
                    >
                      WORKSPACE
                    </p>
                    <div className="mt-4 space-y-2">
                      <div className="h-8 rounded-lg border border-cyan-400/30 bg-cyan-400/15" />
                      <div className="h-8 rounded-lg bg-white/5" />
                      <div className="h-8 rounded-lg bg-white/5" />
                    </div>
                  </div>
                  <div className="min-w-[256px] flex-1 p-4">
                    <div className="h-7 rounded-lg bg-white/5" />
                    <div className="mt-4 h-28 rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="h-3 w-24 rounded-full bg-cyan-400/30" />
                      <div className="mt-3 h-5 w-36 rounded-full bg-white/10" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <label className="block text-xs font-bold text-slate-700">App name<input name="appName" value={draft.appName} onChange={updateDraft} maxLength={60} className={`${inputClass} mt-2`} /></label><label className="block text-xs font-bold text-slate-700">Short tagline<input name="tagline" value={draft.tagline} onChange={updateDraft} maxLength={80} className={`${inputClass} mt-2`} /></label><label className="block text-xs font-bold text-slate-700">Login headline<input name="loginTitle" value={draft.loginTitle} onChange={updateDraft} maxLength={120} className={`${inputClass} mt-2`} /></label><label className="block text-xs font-bold text-slate-700">Login description<textarea name="loginDescription" value={draft.loginDescription} onChange={updateDraft} maxLength={240} rows={3} className={`${inputClass} mt-2 resize-none`} /></label>
            <label className="block text-xs font-bold text-slate-700">Accent color<span className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2"><input type="color" name="accentColor" value={draft.accentColor} onChange={updateDraft} className="h-9 w-12 cursor-pointer rounded-lg border-0 bg-transparent p-0" /><input name="accentColor" value={draft.accentColor} onChange={updateDraft} className="min-w-0 flex-1 bg-transparent px-1 text-sm font-semibold text-slate-700 outline-none" pattern="^#[0-9a-fA-F]{6}$" /></span></label>
            {brandingMessage && <p className="rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-600" role="status">{brandingMessage}</p>}<div className="flex flex-wrap gap-2 pt-1"><button type="submit" disabled={savingBranding} className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-500 disabled:opacity-50">{savingBranding ? "Saving…" : "Save branding"}</button><button type="button" disabled={savingBranding} onClick={restoreDefaults} className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">Reset</button></div>
          </form>
        </aside>
      </div>
    </div>
    {pendingAction && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !savingUid && setPendingAction(null)}>
      <section className="w-full max-w-md rounded-3xl border border-white/70 bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="confirm-access-title">
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-100 text-xl text-rose-700">!</div>
          <div>
            <h2 id="confirm-access-title" className="text-lg font-extrabold text-slate-900">{ACTIONS[pendingAction.action].label} {pendingAction.request.name || "this teacher"}?</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">{CONFIRM_COPY[pendingAction.action]}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => setPendingAction(null)} disabled={Boolean(savingUid)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={() => decide(pendingAction.request, pendingAction.action)} disabled={Boolean(savingUid)} className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-200 transition hover:bg-rose-500 disabled:opacity-50">{savingUid ? "Saving…" : ACTIONS[pendingAction.action].label}</button>
        </div>
      </section>
    </div>}
    {confirmResetOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !savingBranding && setConfirmResetOpen(false)}>
      <section className="w-full max-w-md rounded-3xl border border-white/70 bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="reset-branding-title">
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-xl text-amber-700">!</div>
          <div>
            <h2 id="reset-branding-title" className="text-lg font-extrabold text-slate-900">Restore default branding?</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">This will reset the logo, dimensions, margins, colors, and branding text to the Presenzio defaults.</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => setConfirmResetOpen(false)} disabled={savingBranding} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={confirmRestoreDefaults} disabled={savingBranding} className="rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-amber-200 transition hover:bg-amber-500 disabled:opacity-50">Restore defaults</button>
        </div>
      </section>
    </div>}
  </main>;
}
