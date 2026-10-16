import { useBranding } from "../../../lib/branding";

export default function StudentPortalAccess({
  accessKey,
  setAccessKey,
  studentNumber,
  setStudentNumber,
  accessAssessment,
  connectionStatus,
  submitting,
  message,
}) {
  const { branding } = useBranding();
  return (
    <div className="min-h-[100vh] bg-canvas text-ink-2">
      <header className="flex items-center justify-between h-[70px] [padding:0_7vw] border-b border-white/10 bg-surface-1 [backdrop-filter:blur(14px)] max-[760px]:py-0 max-[760px]:px-4.5">
        <a className="flex items-center gap-[9px] text-ink-2 font-bold text-[17px] font-display no-underline [&_.h-brand-mark]:w-[27px] [&_.h-brand-mark]:h-[27px] [&_.h-brand-logo]:w-[132px] [&_.h-brand-logo]:h-[58px] h-student-portal-brand" href="/">
          <img className="[.h-student-portal-brand_&]:block [.h-student-portal-brand_&]:w-[36px] [.h-student-portal-brand_&]:h-[36px] [.h-student-portal-brand_&]:[object-fit:contain]" src={branding.logo} alt={branding.appName} />
          <span>{branding.appName}</span>
        </a>
        <div className="flex items-center gap-[7px] text-ink-3 text-[10px] [&_span]:w-[7px] [&_span]:h-[7px] [&_span]:rounded-[50%] [&_span]:bg-surface-3 [&_span.h-live-dot]:bg-emerald-500 [&_span.h-live-dot]:[box-shadow:0_0_0_4px_#162032]">
          <span className={connectionStatus === "live" ? "h-live-dot" : ""} />
          {connectionStatus === "offline"
            ? "Offline"
            : connectionStatus === "live"
              ? "Online"
              : "Connecting..."}
        </div>
      </header>
      <main className="w-[min(940px,calc(100%_-_36px))] [margin:0_auto] pt-13 px-0 pb-17.5 max-[760px]:w-[calc(100%_-_24px)] max-[760px]:pt-7.5 max-[760px]:px-0 max-[760px]:pb-[45px] grid place-items-center min-h-[calc(100vh_-_190px)]">
        <section className="w-[min(450px,100%)] box-border p-8 border border-white/10 rounded-[20px] bg-surface-1 [box-shadow:0_18px_46px_rgba(0,240,255,0.04)] text-center [&_h1]:mt-[5px] [&_h1]:mx-0 [&_h1]:mb-2 [&_h1]:text-ink [&_h1]:text-[23px] [&>p:not(.h-eyebrow)]:[margin:0_auto] [&>p:not(.h-eyebrow)]:max-w-[330px] [&>p:not(.h-eyebrow)]:text-ink-3 [&>p:not(.h-eyebrow)]:text-[10px] [&>p:not(.h-eyebrow)]:leading-[1.6]">
          <div className="grid place-items-center w-[50px] h-[50px] [margin:0_auto_16px] rounded-[16px] bg-surface-2 text-accent text-[26px]">⌁</div>
          <p className="text-ink-3 tracking-[1.5px] text-[9px] font-bold mt-0 mx-0 mb-[7px] ml-3.5 h-eyebrow">STUDENT PORTAL</p>
          <h1>Enter your assessment key</h1>
          <p>
            Use the key provided by your teacher, then enter your student ID to
            open your assessment.
          </p>
          <form className="flex flex-col gap-[13px] mt-5.5 text-left [&_label]:flex [&_label]:flex-col [&_label]:gap-1.5 [&_label]:text-ink-2 [&_label]:text-[10px] [&_label]:font-bold [&_input]:box-border [&_input]:w-full [&_input]:border [&_input]:border-white/10 [&_input]:rounded-[9px] [&_input]:bg-surface-1 [&_input]:text-ink-2 [&_input]:p-[11px] [&_input]:text-[11px] [&_input]:outline-none [&_input:focus]:border-accent/30 [&_input:focus]:[box-shadow:0_0_0_3px_#162032] h-student-access-form" onSubmit={accessAssessment}>
            <label>
              Assessment Key ID
              <input
                name="assessmentAccessKey"
                autoFocus
                required
                value={accessKey}
                placeholder="e.g. ASM-4A91F2C8D0"
                onChange={(event) =>
                  setAccessKey(event.target.value.toUpperCase())
                }
              />
            </label>
            <label>
              Student ID number
              <input
                name="studentNumber"
                required
                value={studentNumber}
                placeholder="Enter your student ID"
                onChange={(event) => setStudentNumber(event.target.value)}
              />
            </label>
            <div className="max-w-xl overflow-hidden rounded-xl border border-rose-400/30 bg-surface-1 shadow-modal">
              {/* Header Accent Bar */}
              <div className="bg-rose-500 px-5 py-3 text-white">
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 fill-current" viewBox="0 0 20 20">
                    <path d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 10-2 0 1 1 0 002 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" />
                  </svg>
                  <h3 className="font-bold tracking-wide uppercase text-xs">
                    Important Notice
                  </h3>
                </div>
                <p className="mt-0.5 font-semibold text-lg">
                  Read Before Starting
                </p>
              </div>

              <div className="p-5">
                {/* Rules List */}
                <ul className="space-y-2.5 text-sm font-medium text-ink-2">
                  <li className="flex items-center gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-xs text-rose-300">
                      ✕
                    </span>
                    <span>No switching tabs or apps during the exam</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-xs text-rose-300">
                      ✕
                    </span>
                    <span>
                      No using the Back button or minimizing the browser
                    </span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-xs text-rose-300">
                      ✕
                    </span>
                    <span>No closing or refreshing this page</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-xs text-rose-300">
                      ✕
                    </span>
                    <span>No screenshots or screen recording</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-xs text-rose-300">
                      ✕
                    </span>
                    <span>No sharing answers or communicating with others</span>
                  </li>
                </ul>

                {/* Violation Warning Box */}
                <div className="mt-5 rounded-lg border border-rose-400/30 bg-rose-500/10 p-3.5 text-xs text-rose-300">
                  <p className="font-semibold leading-relaxed">
                    ⚠️ Violations are automatically detected and reported to
                    your teacher. Your exam will be immediately submitted.
                  </p>
                </div>
              </div>
            </div>
            {message.text && (
              <div
                role="alert"
                className={`flex items-start gap-3 rounded-xl border p-3.5 text-left shadow-[0_8px_24px_rgba(0,0,0,0.25)] ${
                  message.status === "h-success"
                    ? "border-emerald-400/30 bg-emerald-500/10"
                    : "border-rose-400/30 bg-rose-500/10"
                }`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                    message.status === "h-success"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-rose-500/20 text-rose-300"
                  }`}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {message.status === "h-success" ? (
                      <path d="M20 6 9 17l-5-5" />
                    ) : (
                      <>
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7.5v5.5M12 16.5h.01" />
                      </>
                    )}
                  </svg>
                </span>
                <div className="min-w-0">
                  <p
                    className={`text-[11px] font-bold uppercase tracking-wider ${
                      message.status === "h-success"
                        ? "text-emerald-300"
                        : "text-rose-300"
                    }`}
                  >
                    {message.status === "h-success"
                      ? "Success"
                      : "Couldn’t open assessment"}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-2">
                    {message.text}
                  </p>
                </div>
              </div>
            )}
            <button className="inline-flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-canvas transition hover:shadow-halo active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50" disabled={submitting}>
              {submitting ? "Opening assessment…" : "Open assessment"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
