import { Icon } from "../DashboardShared";

const VALUE_TONES = {
  default: "text-ink",
  good: "text-emerald-300",
  warn: "text-amber-300",
};

const BADGE_TONES = {
  live: "border-accent/40 bg-accent/10 text-accent",
  review: "border-amber-400/40 bg-amber-400/10 text-amber-300",
};

export default function StatCard({
  label,
  value,
  note,
  icon,
  trend,
  tone = "default",
}) {
  const isReview = String(trend).toLowerCase() === "review";
  return (
    <article className="flex flex-col justify-between gap-2 rounded-lg border border-accent/15 bg-surface-2/90 p-3 transition hover:border-accent/40 hover:shadow-glow">
      <div className="flex items-center justify-between">
        <span
          className={`grid size-7 place-items-center rounded border ${
            isReview
              ? "border-amber-400/40 text-amber-300"
              : "border-accent/30 text-accent"
          }`}
        >
          <Icon name={icon} size={14} />
        </span>
        <span
          className={`rounded border px-1.5 py-px font-mono text-[9px] font-bold uppercase tracking-wider ${
            isReview ? BADGE_TONES.review : BADGE_TONES.live
          }`}
        >
          {trend}
        </span>
      </div>
      <div>
        <p className="truncate font-mono text-[10px] font-medium uppercase tracking-wider text-ink-2">
          {label}
        </p>
        <strong
          className={`block font-display text-xl font-bold tracking-tight ${VALUE_TONES[tone] || VALUE_TONES.default}`}
        >
          {value}
        </strong>
      </div>
      <p className="text-[11px] text-ink-3">{note}</p>
    </article>
  );
}