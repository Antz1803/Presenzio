import { useBranding } from "../../../lib/branding";

export default function StudentPortalResult({
  accessState,
  submittedResult,
  startNextAttempt,
}) {
  const { branding } = useBranding();
  const attemptsRemaining = Number(
    submittedResult.attemptsRemaining ?? accessState.attemptsRemaining ?? 0,
  );
  return (
    <div className="min-h-[100vh] bg-canvas text-ink-2 student-assessment-locked">
      <header className="flex items-center justify-between h-[70px] [padding:0_7vw] border-b border-white/10 bg-surface-1 [backdrop-filter:blur(14px)] max-[760px]:py-0 max-[760px]:px-4.5">
        <a className="flex items-center gap-[9px] text-ink-2 font-bold text-[17px] font-display no-underline [&_.h-brand-mark]:w-[27px] [&_.h-brand-mark]:h-[27px] [&_.h-brand-logo]:w-[132px] [&_.h-brand-logo]:h-[58px] h-student-portal-brand" href="/">
          <img className="[.h-student-portal-brand_&]:block [.h-student-portal-brand_&]:w-[36px] [.h-student-portal-brand_&]:h-[36px] [.h-student-portal-brand_&]:[object-fit:contain]" src={branding.logo} alt={branding.appName} />
          <span>{branding.appName}</span>
        </a>
        <span className="py-2 px-[11px] border border-white/10 rounded-lg bg-surface-1 text-accent text-[9px] font-extrabold whitespace-nowrap">Assessment submitted</span>
      </header>
      <main className="w-[min(940px,calc(100%_-_36px))] [margin:0_auto] pt-13 px-0 pb-17.5 max-[760px]:w-[calc(100%_-_24px)] max-[760px]:pt-7.5 max-[760px]:px-0 max-[760px]:pb-[45px] grid place-items-center min-h-[calc(100vh_-_190px)]">
        <section className="w-[min(450px,100%)] box-border p-8 border border-white/10 rounded-[20px] bg-surface-1 [box-shadow:0_18px_46px_rgba(0,240,255,0.04)] text-center [&_h1]:mt-[5px] [&_h1]:mx-0 [&_h1]:mb-2 [&_h1]:text-ink [&_h1]:text-[23px] [&>p:not(.h-eyebrow)]:[margin:0_auto] [&>p:not(.h-eyebrow)]:max-w-[330px] [&>p:not(.h-eyebrow)]:text-ink-3 [&>p:not(.h-eyebrow)]:text-[10px] [&>p:not(.h-eyebrow)]:leading-[1.6] grid [justify-items:center] [&>p:not(.h-eyebrow)]:max-w-[350px] [&>p:not(.h-eyebrow)]:leading-[1.6]">
          <div className="grid place-items-center w-[50px] h-[50px] [margin:0_auto_16px] rounded-[16px] bg-surface-2 text-accent text-[26px]">✓</div>
          <p className="text-ink-3 tracking-[1.5px] text-[9px] font-bold mt-0 mx-0 mb-[7px] ml-3.5 h-eyebrow">ASSESSMENT COMPLETE</p>
          <h1>Thank you for answering.</h1>
          <div className="grid [justify-items:center] gap-1 my-5 mx-0 py-4 px-7 border border-white/10 rounded-[14px] bg-surface-2 [&_small]:text-emerald-300 [&_small]:text-[9px] [&_small]:font-extrabold [&_small]:uppercase [&_small]:tracking-[1px] [&_strong]:text-emerald-400 [&_strong]:text-[30px]">
            <small>Your score</small>
            <strong>
              {submittedResult.score}/{submittedResult.maxScore}
            </strong>
          </div>
          <p>
            Your submission has been recorded. You cannot submit again unless
            your teacher allows another attempt.
          </p>
          {submittedResult.autoSubmitted && (
            <p className="text-rose-300!">
              Time ended, so your answers were submitted automatically.
            </p>
          )}
          {attemptsRemaining > 0 && (
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-canvas transition hover:shadow-halo active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 mt-[15px] border-0 rounded-[10px] bg-accent"
              onClick={startNextAttempt}
            >
              Start attempt {Number(accessState.attemptNumber || 1)}
            </button>
          )}
        </section>
      </main>
    </div>
  );
}
