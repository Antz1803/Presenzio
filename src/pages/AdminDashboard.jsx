import { useEffect, useMemo, useState } from "react";
import { onValue, ref, update } from "firebase/database";
import logo from "../assets/Logo.png";
import { auth, db } from "../lib/Firebase";
import { useAuth } from "../auth/useAuth";

function formatDate(value) {
  if (!value) return "Unknown date";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(Boolean(db));
  const [savingUid, setSavingUid] = useState("");
  const [error, setError] = useState(() =>
    db ? "" : "Firebase Realtime Database is not configured.",
  );

  useEffect(() => {
    if (!db) {
      return undefined;
    }
    return onValue(
      ref(db, "registrationRequests"),
      (snapshot) => {
        const values = snapshot.val() ?? {};
        setRequests(
          Object.entries(values)
            .map(([uid, request]) => ({ uid, ...request }))
            .sort((first, second) => {
              const statusOrder = { pending: 0, rejected: 1, approved: 2 };
              return (
                (statusOrder[first.status] ?? 9) - (statusOrder[second.status] ?? 9) ||
                String(second.created_at ?? "").localeCompare(String(first.created_at ?? ""))
              );
            }),
        );
        setLoading(false);
      },
      (databaseError) => {
        setError(databaseError.message || "Could not load registration requests.");
        setLoading(false);
      },
    );
  }, []);

  const pendingCount = useMemo(
    () => requests.filter((request) => request.status === "pending").length,
    [requests],
  );

  const decide = async (request, status) => {
    if (!db || !auth.currentUser) return;
    setSavingUid(request.uid);
    setError("");
    try {
      await update(ref(db, `registrationRequests/${request.uid}`), {
        status,
        active: status === "approved",
        reviewed_by: auth.currentUser.uid,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (decisionError) {
      setError(decisionError.message || "Could not update this request.");
    } finally {
      setSavingUid("");
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-slate-950 p-5 text-white shadow-xl">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Presenzio" className="h-12 w-12 rounded-xl bg-white object-contain p-1" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-300">Administrator</p>
              <h1 className="text-xl font-bold">Teacher account approvals</h1>
            <p className="text-xs text-slate-400">{user?.email} · Approval access only</p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
          >
            Log out
          </button>
        </header>

        <section className="mb-5 flex items-center justify-between rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
          <div>
            <h2 className="font-bold text-slate-900">Registration requests</h2>
            <p className="mt-1 text-sm text-slate-500">Approve or reject teacher registrations. Approved teachers become active.</p>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
            {pendingCount} pending
          </span>
        </section>

        {error && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {loading && <p className="rounded-2xl bg-white p-6 text-sm text-slate-500">Loading requests...</p>}
        {!loading && !requests.length && (
          <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
            No teacher registration requests yet.
          </div>
        )}
        <div className="grid gap-4">
          {requests.map((request) => (
            <article key={request.uid} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-900">{request.name || "Unnamed teacher"}</h3>
                  <p className="mt-1 text-sm text-slate-600">{request.email}</p>
                  <p className="mt-2 text-xs text-slate-400">Registered {formatDate(request.created_at)}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${request.status === "approved" ? "bg-emerald-50 text-emerald-700" : request.status === "rejected" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>
                  {request.status || "pending"}
                </span>
              </div>
              <p className="mt-3 break-all text-[11px] text-slate-400">UID: {request.uid}</p>
              {request.status === "pending" && (
                <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    disabled={savingUid === request.uid}
                    onClick={() => decide(request, "approved")}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={savingUid === request.uid}
                    onClick={() => decide(request, "rejected")}
                    className="rounded-xl bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
