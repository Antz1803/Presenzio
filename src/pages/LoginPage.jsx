import { useState } from "react";
import { useAuth } from "../auth/useAuth";
import logo from "../assets/Logo.png";

function safeRedirect(requestedPath) {
  if (requestedPath?.startsWith("/") && !requestedPath.startsWith("//")) return requestedPath;
  const value = new URLSearchParams(window.location.search).get("from");
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default function LoginPage({ redirectTo }) {
  const { configured, login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isRegistering = mode === "register";
  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const toggleMode = () => {
    setMode((current) => current === "login" ? "register" : "login");
    setError("");
    setNotice("");
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      if (isRegistering) {
        const result = await register(form.name, form.email, form.password);
        if (!result.session) {
          setMode("login");
          setNotice("Account created. Check your email if confirmation is enabled, then log in.");
          return;
        }
      } else {
        await login(form.email, form.password);
      }
      window.location.assign(safeRedirect(redirectTo));
    } catch (submitError) {
      setError(submitError?.message || "Authentication failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white p-8 shadow-2xl sm:p-10" aria-labelledby="auth-title">
        <div className="mb-8 text-center">
          <img className="mx-auto mb-5 h-14 w-auto object-contain" src={logo} alt="Presenzio" />
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-600">Teacher workspace</p>
          <h1 id="auth-title" className="mt-2 text-2xl font-extrabold text-slate-900">
            {isRegistering ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {isRegistering ? "Register to manage your classes and grades." : "Log in to open your classes and records."}
          </p>
        </div>

        {!configured && (
          <p className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="alert">
            Supabase authentication is not configured for this environment.
          </p>
        )}
        {error && <p className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}</p>}
        {notice && <p className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{notice}</p>}

        <form className="space-y-4" onSubmit={submit}>
          {isRegistering && (
            <label className="block text-sm font-semibold text-slate-700">
              Full name
              <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10" name="name" value={form.name} onChange={updateField} autoComplete="name" required />
            </label>
          )}
          <label className="block text-sm font-semibold text-slate-700">
            Email
            <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10" type="email" name="email" value={form.email} onChange={updateField} autoComplete="email" required />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Password
            <input className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10" type="password" name="password" value={form.password} onChange={updateField} autoComplete={isRegistering ? "new-password" : "current-password"} minLength={8} required />
          </label>
          <button className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={!configured || submitting}>
            {submitting ? "Please wait..." : isRegistering ? "Create account" : "Log in"}
          </button>
        </form>

        <p className="mt-7 text-center text-sm text-slate-500">
          {isRegistering ? "Already have an account?" : "Don't have an account?"}{" "}
          <button className="font-bold text-indigo-600 hover:text-indigo-500" type="button" onClick={toggleMode}>
            {isRegistering ? "Log in" : "Register"}
          </button>
        </p>
      </section>
    </main>
  );
}
