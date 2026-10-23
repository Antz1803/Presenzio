import { useMemo, useState } from "react";
import { useAuth } from "../../auth/useAuth";
import { logoOptions, pickLogo, readLogoChoice, saveLogoChoice } from "../../lib/printLogos";

const PANEL = "rounded-xl border border-accent/20 bg-surface-1/85 p-5 backdrop-blur-xl shadow-xl shadow-black/40";
const LABEL = "mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-ink-3";
const INPUT = "w-full rounded-lg border border-white/10 bg-surface-2 px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

// Chooses which logos appear on every printed report.
export default function PrintLogoPicker() {
  const { user } = useAuth();
  const [choice, setChoice] = useState(readLogoChoice);
  const options = useMemo(() => logoOptions(user?.user_metadata?.instructor_profile || {}), [user]);

  const change = (side, value) => {
    const next = { ...choice, [side]: value };
    setChoice(next);
    saveLogoChoice(next);
  };

  return (
    <section className={PANEL} aria-label="Printing logos">
      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-accent">Printing</p>
      <h2 className="font-display text-base font-semibold text-ink">Logos on printed reports</h2>
      <div className="mt-3 grid max-w-xl gap-3 sm:grid-cols-2">
        {["left", "right"].map((side) => {
          const pick = pickLogo(side, options, choice);
          return (
            <label key={side} className="block">
              <span className={LABEL}>{side === "left" ? "Left logo" : "Right logo"}</span>
              <div className="flex items-center gap-2">
                <select className={INPUT} value={pick.value} onChange={(event) => change(side, event.target.value)}>
                  {options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/10 bg-white/90">
                  {pick.src ? <img src={pick.src} alt="" className="max-h-9 max-w-9 object-contain" /> : <span className="text-[9px] font-bold uppercase text-slate-400">None</span>}
                </span>
              </div>
            </label>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-ink-3">Applies to class records and semester reports. Upload your own under Profile → Printing logos.</p>
    </section>
  );
}
