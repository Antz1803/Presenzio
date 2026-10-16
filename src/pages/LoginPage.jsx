
import { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { ACCESS_NOTICE_KEY } from "../auth/context";
import { useBranding } from "../lib/branding";

function safeRedirect(requestedPath) {
  if (requestedPath?.startsWith("/") && !requestedPath.startsWith("//")) {
    return requestedPath;
  }

  const value = new URLSearchParams(window.location.search).get("from");

  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";
}

function Icon({ children, className = "h-4 w-4" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export default function LoginPage({ redirectTo }) {
  const { configured, login, register } = useAuth();
  const { branding } = useBranding();

  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [error, setError] = useState(() => {
    try {
      return sessionStorage.getItem(ACCESS_NOTICE_KEY) || "";
    } catch {
      return "";
    }
  });

  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isRegistering = mode === "register";

  useEffect(() => {
    try {
      sessionStorage.removeItem(ACCESS_NOTICE_KEY);
    } catch {
      // Storage may be unavailable.
    }
  }, []);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const switchTo = (nextMode) => {
    if (nextMode === mode) return;

    setMode(nextMode);
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
        const result = await register(
          form.name,
          form.email,
          form.password,
        );

        if (result.pendingApproval) {
          setMode("login");
          setNotice(
            "Registration submitted. An administrator must approve your teacher account before you can log in.",
          );
          return;
        }
      } else {
        const authenticatedUser = await login(
          form.email,
          form.password,
        );

        if (authenticatedUser?.isAdmin) {
          window.location.assign("/admin");
          return;
        }
      }

      window.location.assign(safeRedirect(redirectTo));
    } catch (submitError) {
      setError(
        submitError?.message ||
          "Authentication failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass =
    "w-full rounded-xl border border-white/10 bg-slate-950/60 py-[13px] pl-[42px] pr-11 text-sm font-medium text-slate-100 outline-none transition duration-200 placeholder:text-slate-600 hover:border-cyan-300/25 focus:border-cyan-400 focus:bg-slate-950/85 focus:ring-4 focus:ring-cyan-400/10";

  const labelClass =
    "flex flex-col gap-[7px] text-[10px] font-bold uppercase leading-none tracking-[0.12em] text-slate-400";

  return (
    <main className="relative isolate grid min-h-screen place-items-center overflow-hidden bg-[#070b16] p-8 font-sans text-slate-200 max-[860px]:place-items-start max-[860px]:px-4 max-[860px]:py-4">
      {/* Small amount of CSS for custom keyframes and the tab indicator. */}
      <style>{`
        @keyframes lg-float {
          0%, 100% { transform: translate3d(0,0,0) scale(1); }
          50% { transform: translate3d(36px,-28px,0) scale(1.08); }
        }

        @keyframes lg-rise {
          from { opacity: 0; transform: translateY(18px) scale(.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes lg-ping {
          70% { box-shadow: 0 0 0 8px rgba(52,211,153,0); }
          100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); }
        }

        @keyframes lg-glow {
          0%, 100% { opacity: .6; transform: scale(.94); }
          50% { opacity: 1; transform: scale(1.06); }
        }

        @keyframes lg-turn {
          to { transform: rotate(360deg); }
        }

        @keyframes lg-shine {
          to { transform: translateX(120%); }
        }

        .lg-tab-indicator {
          position: absolute;
          top: 4px;
          bottom: 4px;
          left: 4px;
          width: calc(50% - 4px);
          border: 1px solid rgba(0,240,255,.35);
          border-radius: 9px;
          background: linear-gradient(135deg,rgba(0,240,255,.2),rgba(59,130,246,.2));
          box-shadow: 0 0 18px rgba(0,240,255,.12);
          transition: transform .3s cubic-bezier(.2,.8,.2,1);
          pointer-events: none;
        }

        .lg-tab-indicator.register {
          transform: translateX(100%);
        }

        .lg-reduced-motion *,
        .lg-reduced-motion *::before,
        .lg-reduced-motion *::after {
          animation-duration: .01ms !important;
          animation-iteration-count: 1 !important;
          scroll-behavior: auto !important;
          transition-duration: .01ms !important;
        }

        @media (prefers-reduced-motion: reduce) {
          .lg-motion {
            animation: none !important;
          }

          .lg-shine {
            display: none;
          }

          .lg-tab-indicator {
            transition: none;
          }
        }
      `}</style>

      {/* Animated background */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="absolute inset-0 bg-[linear-gradient(rgba(0,240,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,240,255,0.05)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_50%_40%,black_15%,transparent_72%)]"
        />

        <div
          className="lg-motion absolute -left-[120px] -top-[160px] h-[480px] w-[480px] rounded-full bg-[rgba(0,240,255,0.28)] opacity-55 blur-[90px] [animation:lg-float_16s_ease-in-out_infinite]"
        />

        <div
          className="lg-motion absolute -bottom-[200px] -right-[180px] h-[520px] w-[520px] rounded-full bg-[var(--presenzio-brand,#4d47d9)] opacity-40 blur-[90px] [animation:lg-float_16s_ease-in-out_-6s_infinite]"
        />

        <div
          className="lg-motion absolute left-[42%] top-[55%] h-[260px] w-[260px] rounded-full bg-[rgba(59,130,246,0.22)] opacity-55 blur-[90px] [animation:lg-float_16s_ease-in-out_-11s_infinite]"
        />
      </div>

      {/* Main glass panel */}
      <div className="lg-motion grid min-h-[640px] w-full max-w-[1060px] grid-cols-[minmax(320px,1.05fr)_minmax(380px,.95fr)] overflow-hidden rounded-[28px] border border-cyan-300/15 bg-[rgba(10,15,29,0.72)] shadow-[0_40px_100px_rgba(0,0,0,0.55),0_0_60px_rgba(0,240,255,0.06)] backdrop-blur-[22px] [animation:lg-rise_.7s_cubic-bezier(.2,.8,.2,1)_both] max-[860px]:block max-[860px]:min-h-0 max-[860px]:rounded-[22px]">

        {/* Left hero panel */}
        <aside className="relative flex flex-col justify-between gap-7 overflow-hidden border-r border-cyan-300/10 bg-[linear-gradient(160deg,rgba(0,240,255,0.1),rgba(15,23,42,0.2)_45%,rgba(59,130,246,0.12))] px-[42px] py-[38px] max-[860px]:gap-4 max-[860px]:border-r-0 max-[860px]:border-b max-[860px]:px-6 max-[860px]:pb-5 max-[860px]:pt-6">
          <div
            className="pointer-events-none absolute -bottom-[190px] -right-[170px] h-[420px] w-[420px] rounded-full border border-cyan-300/20 shadow-[0_0_0_34px_rgba(0,240,255,0.03),0_0_0_72px_rgba(0,240,255,0.02)]"
            aria-hidden="true"
          />

          <span className="relative z-10 inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/[0.07] px-3 py-[6px] font-mono text-[10px] font-bold uppercase leading-none tracking-[0.14em] text-cyan-300">
            <i className="h-[7px] w-[7px] rounded-full bg-emerald-400 shadow-[0_0_0_0_rgba(52,211,153,0.6)] [animation:lg-ping_2s_infinite]" />
            Secure teacher portal
          </span>

          <div className="relative z-10 grid place-items-center py-1.5">
            <div
              className="lg-motion absolute h-[260px] w-[260px] rounded-full bg-[radial-gradient(circle,rgba(0,240,255,0.22),transparent_68%)] [animation:lg-glow_5s_ease-in-out_infinite] max-[860px]:h-[150px] max-[860px]:w-[150px]"
              aria-hidden="true"
            />

            <img
              src={branding.logo}
              alt={branding.appName}
              className="relative h-auto w-full max-w-[290px] object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.45)] max-[860px]:w-[150px]"
            />
          </div>

          <div className="relative z-10">
            <p className="m-0 font-mono text-[10px] font-bold uppercase leading-none tracking-[0.2em] text-cyan-400">
              {branding.tagline}
            </p>

            <h2 className="mb-3 mt-3 text-[34px] font-bold leading-[1.08] tracking-[-0.03em] text-slate-50 max-[860px]:text-2xl">
              {branding.loginTitle}
            </h2>

            <p className="m-0 max-w-[380px] text-[13px] leading-[1.7] text-slate-400 max-[860px]:hidden">
              {branding.loginDescription}
            </p>
          </div>

          <ul className="relative z-10 m-0 grid list-none grid-cols-3 gap-2.5 p-0 max-[860px]:hidden">
            <li className="group flex flex-col gap-2 rounded-[14px] border border-white/[0.08] bg-white/[0.035] p-3 text-[11px] font-semibold text-slate-300 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-cyan-300/[0.07]">
              <Icon className="h-[18px] w-[18px] text-cyan-400">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4" />
              </Icon>
              Smart attendance
            </li>

            <li className="group flex flex-col gap-2 rounded-[14px] border border-white/[0.08] bg-white/[0.035] p-3 text-[11px] font-semibold text-slate-300 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-cyan-300/[0.07]">
              <Icon className="h-[18px] w-[18px] text-cyan-400">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </Icon>
              Online assessments
            </li>

            <li className="group flex flex-col gap-2 rounded-[14px] border border-white/[0.08] bg-white/[0.035] p-3 text-[11px] font-semibold text-slate-300 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-cyan-300/[0.07]">
              <Icon className="h-[18px] w-[18px] text-cyan-400">
                <path d="M3 3v18h18" />
                <path d="M7 15l4-4 3 3 5-6" />
              </Icon>
              Instant grades
            </li>
          </ul>
        </aside>

        {/* Login / registration card */}
        <section
          className="flex flex-col justify-center bg-[linear-gradient(180deg,rgba(15,23,42,0.65),rgba(10,15,29,0.85))] px-12 py-[46px] max-[860px]:px-[22px] max-[860px]:py-[26px]"
          aria-labelledby="auth-title"
        >
          {/* Tabs */}
          <div
            className="relative mb-[26px] grid grid-cols-2 rounded-xl border border-white/[0.08] bg-slate-950/55 p-1"
            role="tablist"
            aria-label="Account"
          >
            <div
              className={`lg-tab-indicator ${isRegistering ? "register" : ""}`}
              aria-hidden="true"
            />

            <button
              type="button"
              role="tab"
              aria-selected={!isRegistering}
              className={`relative z-10 rounded-lg border-0 bg-transparent py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.1em] transition-colors ${
                !isRegistering ? "text-cyan-300" : "text-slate-500"
              }`}
              onClick={() => switchTo("login")}
            >
              Log in
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={isRegistering}
              className={`relative z-10 rounded-lg border-0 bg-transparent py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.1em] transition-colors ${
                isRegistering ? "text-cyan-300" : "text-slate-500"
              }`}
              onClick={() => switchTo("register")}
            >
              Register
            </button>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h1
              id="auth-title"
              className="mb-1.5 text-[27px] font-bold leading-[1.15] tracking-[-0.03em] text-slate-50"
            >
              {isRegistering
                ? "Create your account"
                : `Welcome to ${branding.appName}`}
            </h1>

            <p className="m-0 text-[13px] text-[#7c8aa3]">
              {isRegistering
                ? "Register to manage your classes and grades."
                : "Log in to open your classes and records."}
            </p>
          </div>

          {/* Firebase configuration warning */}
          {!configured && (
            <p
              className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-400/35 bg-amber-500/10 px-[13px] py-[11px] text-xs leading-relaxed text-amber-200"
              role="alert"
            >
              <Icon className="mt-px h-4 w-4 shrink-0">
                <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                <path d="M12 9v4M12 17h.01" />
              </Icon>
              Firebase authentication is not configured for this environment.
            </p>
          )}

          {/* Error message */}
          {error && (
            <p
              className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-400/35 bg-rose-500/10 px-[13px] py-[11px] text-xs leading-relaxed text-rose-300"
              role="alert"
            >
              <Icon className="mt-px h-4 w-4 shrink-0">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5M12 16.5h.01" />
              </Icon>
              <span>{error}</span>
            </p>
          )}

          {/* Registration notice */}
          {notice && (
            <p
              className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-[13px] py-[11px] text-xs leading-relaxed text-emerald-300"
              role="status"
            >
              <Icon className="mt-px h-4 w-4 shrink-0">
                <path d="M20 6 9 17l-5-5" />
              </Icon>
              <span>{notice}</span>
            </p>
          )}

          {/* Form */}
          <form className="flex flex-col gap-4" onSubmit={submit}>
            {isRegistering && (
              <label className={labelClass}>
                Full name

                <span className="group relative flex items-center">
                  <Icon className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-600 transition-colors group-focus-within:text-cyan-400">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21a8 8 0 0 1 16 0" />
                  </Icon>

                  <input
                    className={fieldClass}
                    name="name"
                    value={form.name}
                    onChange={updateField}
                    placeholder="Juan Dela Cruz"
                    autoComplete="name"
                    required
                  />
                </span>
              </label>
            )}

            <label className={labelClass}>
              Email

              <span className="group relative flex items-center">
                <Icon className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-600 transition-colors group-focus-within:text-cyan-400">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-10 6L2 7" />
                </Icon>

                <input
                  className={fieldClass}
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={updateField}
                  placeholder="you@school.edu"
                  autoComplete="email"
                  required
                />
              </span>
            </label>

            <label className={labelClass}>
              Password

              <span className="group relative flex items-center">
                <Icon className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-600 transition-colors group-focus-within:text-cyan-400">
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </Icon>

                <input
                  className={fieldClass}
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={form.password}
                  onChange={updateField}
                  placeholder="At least 8 characters"
                  autoComplete={
                    isRegistering ? "new-password" : "current-password"
                  }
                  minLength={8}
                  required
                />

                <button
                  type="button"
                  className="absolute right-1.5 grid h-[34px] w-[34px] place-items-center rounded-lg border-0 bg-transparent text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-cyan-300"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <Icon className="h-[17px] w-[17px]">
                      <path d="M17.9 17.9A10.9 10.9 0 0 1 12 20C5 20 1 12 1 12a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A10.7 10.7 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2M1 1l22 22" />
                      <path d="M14.1 14.1a3 3 0 1 1-4.2-4.2" />
                    </Icon>
                  ) : (
                    <Icon className="h-[17px] w-[17px]">
                      <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </Icon>
                  )}
                </button>
              </span>
            </label>

            {/* Submit button */}
            <button
              className="group relative mt-1.5 flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl border-0 bg-[linear-gradient(135deg,#00f0ff,#3b82f6)] px-4 py-3.5 font-mono text-xs font-extrabold uppercase tracking-[0.14em] text-[#04101f] shadow-[0_10px_30px_rgba(0,240,255,0.25)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_38px_rgba(0,240,255,0.38)] active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
              type="submit"
              disabled={!configured || submitting}
            >
              <span
                aria-hidden="true"
                className="lg-shine pointer-events-none absolute inset-0 -translate-x-[120%] bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,0.45)_50%,transparent_70%)] transition-transform duration-500 group-hover:translate-x-[120%]"
              />

              {submitting ? (
                <>
                  <span className="h-[15px] w-[15px] animate-spin rounded-full border-2 border-[#04101f]/30 border-t-[#04101f]" />
                  Please wait
                </>
              ) : (
                <>
                  {isRegistering ? "Create account" : "Log in"}

                  <Icon className="relative h-4 w-4">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </Icon>
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-[22px] flex items-center justify-center gap-2 text-center text-[11px] text-slate-500">
            <Icon className="h-3.5 w-3.5 shrink-0 text-cyan-400">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </Icon>

            <span>
              {isRegistering
                ? "New teacher accounts need administrator approval."
                : "Your records are protected and visible only to you."}
            </span>
          </p>
        </section>
      </div>
    </main>
  );
}
