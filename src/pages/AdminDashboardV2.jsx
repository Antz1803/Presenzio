import { useEffect, useMemo, useState } from "react";
import { onValue, ref, update } from "firebase/database";
import { auth, db } from "../lib/Firebase";
import { useAuth } from "../auth/useAuth";
import { DEFAULT_BRANDING, useBranding } from "../lib/branding";

function formatDate(value) {
  if (!value) return "Unknown date";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100";

function StatCard({ label, value, tone }) {
  return <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"><div className={`mb-4 h-2 w-10 rounded-full ${tone}`} /><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p><strong className="mt-1 block text-3xl font-extrabold tracking-tight text-slate-900">{value}</strong></div>;
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { branding, saveBranding, resetBranding, ensureBranding } = useBranding();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(Boolean(db));
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

  const pendingCount = useMemo(() => requests.filter((request) => request.status === "pending").length, [requests]);
  const approvedCount = useMemo(() => requests.filter((request) => request.status === "approved").length, [requests]);
  const rejectedCount = useMemo(() => requests.filter((request) => request.status === "rejected").length, [requests]);

  const decide = async (request, status) => {
    if (!db || !auth.currentUser) return;
    setSavingUid(request.uid);
    setError("");
    try {
      await update(ref(db, `registrationRequests/${request.uid}`), { status, active: status === "approved", reviewed_by: auth.currentUser.uid, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    } catch (decisionError) {
      setError(decisionError.message || "Could not update this request.");
    } finally {
      setSavingUid("");
    }
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
        <div className="relative flex flex-wrap items-center justify-between gap-5"><div className="flex min-w-0 items-center gap-4"><div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white p-2 shadow-lg shadow-black/20"><img src={branding.logo} alt={branding.appName} className="max-h-full max-w-full object-contain" /></div><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.24em] text-indigo-300">Administrator workspace</p><h1 className="mt-1 truncate text-2xl font-extrabold tracking-tight sm:text-3xl">Control center</h1><p className="mt-1 truncate text-sm text-slate-300">{user?.email} · full access</p></div></div><button type="button" onClick={logout} className="rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">Log out</button></div>
        <div className="relative mt-7 grid gap-3 text-sm text-slate-300 sm:grid-cols-[1fr_auto] sm:items-end"><div><p className="text-lg font-semibold text-white">Shape the experience your school sees.</p><p className="mt-1 max-w-2xl">Approve teachers, update your identity, and keep the entire workspace feeling like your own.</p></div><span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-200"><span className="h-2 w-2 rounded-full bg-emerald-300" /> Live settings</span></div>
      </header>
      {error && <p className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      <div className="mb-6 grid gap-4 sm:grid-cols-3"><StatCard label="Waiting for review" value={pendingCount} tone="bg-amber-400" /><StatCard label="Approved teachers" value={approvedCount} tone="bg-emerald-400" /><StatCard label="Rejected requests" value={rejectedCount} tone="bg-rose-400" /></div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"><div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 pb-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-500">People</p><h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">Teacher account approvals</h2><p className="mt-1 text-sm text-slate-500">Review who can enter the teaching workspace.</p></div><span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">{pendingCount} pending</span></div>
          {loading && <p className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">Loading registration requests…</p>}{!loading && !requests.length && <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-xl shadow-sm">✓</div><h3 className="mt-4 font-bold text-slate-800">You’re all caught up</h3><p className="mt-1 text-sm text-slate-500">New teacher registrations will appear here.</p></div>}
          <div className="grid gap-3">{requests.map((request) => <article key={request.uid} className="rounded-2xl border border-slate-200 p-4 transition hover:border-indigo-200 hover:shadow-md sm:p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h3 className="truncate font-bold text-slate-900">{request.name || "Unnamed teacher"}</h3><p className="mt-1 truncate text-sm text-slate-600">{request.email}</p><p className="mt-2 text-xs text-slate-400">Registered {formatDate(request.created_at)}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${request.status === "approved" ? "bg-emerald-50 text-emerald-700" : request.status === "rejected" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{request.status || "pending"}</span></div>{request.status === "pending" && <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4"><button type="button" disabled={savingUid === request.uid} onClick={() => decide(request, "approved")} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50">Approve</button><button type="button" disabled={savingUid === request.uid} onClick={() => decide(request, "rejected")} className="rounded-xl bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50">Reject</button></div>}</article>)}</div>
        </section>
        <aside className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"><div className="mb-5"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-500">Appearance</p><h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">Branding studio</h2><p className="mt-1 text-sm leading-6 text-slate-500">Change the logo, name, welcome copy, and color used across the app.</p></div>
          <form onSubmit={saveSettings} className="space-y-4"><div className="flex items-center gap-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3"><div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-white p-2 shadow-sm"><img src={draft.logoUrl || branding.logo} alt="Logo preview" className="max-h-full max-w-full object-contain" /></div><div className="min-w-0"><p className="text-xs font-bold text-slate-800">Logo preview</p><p className="mt-1 truncate text-[11px] text-slate-500">Shown on login, dashboard, admin, and student pages.</p></div></div>
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
              <div className="mt-3 overflow-auto rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex min-w-[500px] items-stretch overflow-hidden rounded-lg bg-[#f7f8fa]">
                  <div
                    className="w-[244px] shrink-0 border-r border-slate-200 bg-white"
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
                      className="px-3 text-[9px] font-bold tracking-[0.18em] text-slate-400"
                      style={{ marginTop: "20px" }}
                    >
                      WORKSPACE
                    </p>
                    <div className="mt-4 space-y-2">
                      <div className="h-8 rounded-lg bg-indigo-100" />
                      <div className="h-8 rounded-lg bg-slate-100" />
                      <div className="h-8 rounded-lg bg-slate-100" />
                    </div>
                  </div>
                  <div className="min-w-[256px] flex-1 p-4">
                    <div className="h-7 rounded-lg bg-white" />
                    <div className="mt-4 h-28 rounded-xl border border-white bg-white/70 p-4">
                      <div className="h-3 w-24 rounded-full bg-indigo-100" />
                      <div className="mt-3 h-5 w-36 rounded-full bg-slate-200" />
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
