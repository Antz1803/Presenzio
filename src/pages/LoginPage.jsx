import { useState } from "react";
import { useAuth } from "../auth/useAuth";
import { useBranding } from "../lib/branding";

function safeRedirect(requestedPath) {
  if (requestedPath?.startsWith("/") && !requestedPath.startsWith("//"))
    return requestedPath;
  const value = new URLSearchParams(window.location.search).get("from");
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";
}

export default function LoginPage({ redirectTo }) {
  const { configured, login, register } = useAuth();
  const { branding } = useBranding();
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
    setMode((current) => (current === "login" ? "register" : "login"));
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
        if (result.pendingApproval) {
          setMode("login");
          setNotice(
            "Registration submitted. An administrator must approve your teacher account before you can log in.",
          );
          return;
        }
      } else {
        const authenticatedUser = await login(form.email, form.password);
        if (authenticatedUser?.isAdmin) {
          window.location.assign("/admin");
          return;
        }
      }
      window.location.assign(safeRedirect(redirectTo));
    } catch (submitError) {
      setError(
        submitError?.message || "Authentication failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-orbit auth-orbit-one" />
      <div className="auth-orbit auth-orbit-two" />
      <section className="auth-layout" aria-labelledby="auth-title">
        <aside className="auth-story">
          <div className="auth-brand">
            <img src={branding.logo} alt={branding.appName} />
            <span>{branding.appName}</span>
          </div>
          <div className="auth-story-copy">
            <p className="auth-kicker">{branding.tagline}</p>
            <h2>{branding.loginTitle}</h2>
            <p>{branding.loginDescription}</p>
          </div>
          <div className="auth-quote">
            <span>“</span>
            <p>Spend less time sorting records. Spend more time with students.</p>
          </div>
        </aside>

        <section className="auth-card" aria-labelledby="auth-title">
          <div className="auth-card-heading">
            <p className="auth-kicker">Teacher workspace</p>
            <h1 id="auth-title">
              {isRegistering ? "Create your account" : `Welcome to ${branding.appName}`}
            </h1>
            <p>
              {isRegistering
                ? "Register to manage your classes and grades."
                : "Log in to open your classes and records."}
            </p>
          </div>

        {!configured && (
          <p
            className="auth-message auth-message-warning"
            role="alert"
          >
            Firebase authentication is not configured for this environment.
          </p>
        )}
        {error && (
          <p
            className="auth-message auth-message-error"
            role="alert"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            className="auth-message auth-message-success"
            role="status"
          >
            {notice}
          </p>
        )}

        <form className="auth-form" onSubmit={submit}>
          {isRegistering && (
            <label className="auth-field">
              Full name
              <input
                className="auth-input"
                name="name"
                value={form.name}
                onChange={updateField}
                autoComplete="name"
                required
              />
            </label>
          )}
          <label className="auth-field">
            Email
            <input
              className="auth-input"
              type="email"
              name="email"
              value={form.email}
              onChange={updateField}
              autoComplete="email"
              required
            />
          </label>
          <label className="auth-field">
            Password
            <input
              className="auth-input"
              type="password"
              name="password"
              value={form.password}
              onChange={updateField}
              autoComplete={isRegistering ? "new-password" : "current-password"}
              minLength={8}
              required
            />
          </label>
          <button
            className="auth-submit"
            type="submit"
            disabled={!configured || submitting}
          >
            {submitting
              ? "Please wait..."
              : isRegistering
                ? "Create account"
                : "Log in"}
          </button>
        </form>

        <p className="auth-switch">
          {isRegistering
            ? "Already have an account?"
            : "Don't have an account?"}{" "}
          <button
            className="auth-switch-button"
            type="button"
            onClick={toggleMode}
          >
            {isRegistering ? "Log in" : "Register"}
          </button>
        </p>
        </section>
      </section>
    </main>
  );
}
