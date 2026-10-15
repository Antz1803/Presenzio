import { useEffect, useMemo, useState } from "react";
import {
  formatClassTime,
  getLiveClassInfo,
  getSectionMeta,
  parseDayCodes,
  parseTimeToMinutes,
} from "./overviewUtils";

/* ---------- shared class strings (design doc tokens) ---------- */
const INPUT =
  "w-full rounded border border-ink-3/30 bg-surface-1 px-3 py-2.5 text-sm text-ink placeholder:text-ink-3 transition focus:border-accent focus:shadow-focus focus:outline-none disabled:opacity-50";
const LABEL = "mb-1 block font-mono text-[11px] uppercase tracking-wider text-ink-3";
const BTN_PRIMARY =
  "rounded bg-accent px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-canvas transition hover:shadow-halo active:scale-[0.98] disabled:opacity-60";
const BTN_SECONDARY =
  "rounded border border-accent/40 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:opacity-50";

const BADGE_TONES = [
  "border-accent/40 bg-accent/10 text-accent",
  "border-accent-2/40 bg-accent-2/10 text-accent-2",
];

/* ---------- small inline icons ---------- */
const svgProps = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};
const MailIcon = () => (
  <svg {...svgProps}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);
const ClockIcon = () => (
  <svg {...svgProps} width={16} height={16}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
const FacebookIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
    <path d="M13.5 21v-7.5H16l.5-3h-3V8.7c0-.9.3-1.5 1.6-1.5H16.6V4.5c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.2H8v3h2.5V21h3Z" />
  </svg>
);
const SettingsIcon = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </svg>
);

/* ---------- helpers ---------- */
function getInitials(name) {
  return String(name || "Teacher")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Next upcoming class from "now", using the same helpers as the Today's Agenda.
function getNextClass(sections, now = new Date()) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let best = null;

  (sections || []).forEach((s) => {
    const start = parseTimeToMinutes(s?.time_start);
    if (start === null || start === undefined || Number.isNaN(start)) return;
    const days = parseDayCodes(s?.days) || [];
    if (!days.length) return;

    for (let offset = 0; offset <= 7; offset++) {
      const dayIdx = (now.getDay() + offset) % 7;
      if (!days.includes(dayIdx)) continue;
      if (offset === 0 && start <= nowMin) continue;
      const key = offset * 1440 + start;
      if (!best || key < best.key) best = { key, section: s };
      break;
    }
  });

  if (!best) return null;
  const meta = getSectionMeta(best.section);
  return {
    code: meta.code,
    sec: meta.sec,
    room: meta.room,
    timeStart: best.section.time_start,
  };
}

function InfoChip({ href, icon, children, external }) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="flex min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-surface-2 px-3 py-2 text-[11px] font-medium text-accent-4 transition hover:border-accent/40 hover:text-accent"
    >
      <span className="shrink-0 text-accent">{icon}</span>
      <span className="truncate">{children}</span>
    </a>
  );
}

export default function InstructorProfileCard({
  instructor,
  onUpdateInstructor,
  sections,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [, setTick] = useState(0);

  // Re-render every minute so the live/next class status stays current.
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const liveClass = getLiveClassInfo(sections);
  const nextClass = liveClass || getNextClass(sections);

  const saved = useMemo(
    () => ({
      name: instructor?.name || "Teacher",
      position: instructor?.position || "Instructor",
      gmail: instructor?.gmail || "",
      facebook: instructor?.facebook || "",
      courses: Array.isArray(instructor?.courses) ? instructor.courses : [],
      initials: instructor?.initials || getInitials(instructor?.name),
      color: instructor?.color || "bg-linear-to-br from-accent-2 to-accent-3",
      avatarUrl: instructor?.avatarUrl || "",
      printLogoLeftUrl: instructor?.printLogoLeftUrl || "",
      printLogoRightUrl: instructor?.printLogoRightUrl || "",
    }),
    [instructor],
  );

  const [draft, setDraft] = useState(saved);
  const [coursesText, setCoursesText] = useState("");

  const view = isEditing ? draft : saved;

  // Course rows: group real sections by course code. If there are no sections,
  // fall back to the typed course list ("CODE - Name").
  const courseRows = useMemo(() => {
    const map = new Map();
    (sections || []).forEach((s) => {
      const meta = getSectionMeta(s);
      if (!meta?.code) return;
      const row = map.get(meta.code) || {
        code: meta.code,
        name: meta.name || "",
        count: 0,
      };
      row.count += 1;
      map.set(meta.code, row);
    });
    if (map.size) return [...map.values()];

    return (view.courses || []).map((c) => {
      const [code, ...rest] = String(c).split(/\s+-\s+/);
      return { code: code.trim(), name: rest.join(" - ").trim(), count: null };
    });
  }, [sections, view.courses]);

  const facebookHandle = view.facebook
    ? view.facebook
        .replace(/^https?:\/\/(www\.)?facebook\.com\//i, "@")
        .replace(/\/$/, "")
    : "";

  const openEditor = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDraft(saved);
    setError("");
    setCoursesText(
      Array.isArray(saved.courses) ? saved.courses.join(", ") : saved.courses || "",
    );
    setIsEditing(true);
  };

  const handleChange = (e) =>
    setDraft((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 512 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        setDraft((prev) => ({
          ...prev,
          avatarUrl: canvas.toDataURL("image/jpeg", 0.82),
        }));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setError("");

    const courses = coursesText
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    const next = {
      ...draft,
      name: draft.name.trim(),
      position: draft.position.trim(),
      gmail: draft.gmail.trim(),
      facebook: draft.facebook.trim(),
      courses,
      initials: getInitials(draft.name),
    };

    if (!next.name) {
      setError("Full name is required.");
      return;
    }

    setIsSaving(true);
    try {
      await onUpdateInstructor?.(next);
      setDraft(next);
      setIsEditing(false);
    } catch (err) {
      setError(err?.message || "Could not save the profile details.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="flex w-full flex-col rounded-lg border border-accent/20 bg-surface-1/85 p-4 backdrop-blur-xl">
        {/* header: label + status pill */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-accent">
            Faculty profile &amp; status
          </span>
          <span
            className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] tracking-wide ${
              liveClass
                ? "border-accent/50 bg-surface-2 text-accent"
                : "border-white/10 bg-surface-2 text-ink-3"
            }`}
          >
            <span className="relative flex size-2">
              {liveClass && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-70" />
              )}
              <span
                className={`relative inline-flex size-2 rounded-full ${
                  liveClass ? "bg-accent" : "bg-ink-3"
                }`}
              />
            </span>
            {liveClass ? "Session live" : "No Class in Session"}
          </span>
        </div>

        {/* avatar: frame hugs the photo, same size as before, no side space */}
        <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-2xl border border-accent/30 bg-surface-2 shadow-glow">
          {view.avatarUrl ? (
            <img
              src={view.avatarUrl}
              alt={view.name}
              className="block max-h-[300px] w-auto max-w-full"
            />
          ) : (
            <div
              className={`flex h-[300px] w-[240px] max-w-full items-center justify-center font-display text-5xl font-bold text-canvas ${view.color}`}
            >
              {view.initials}
            </div>
          )}
          <button
            type="button"
            onClick={openEditor}
            title="Edit profile settings"
            aria-label="Edit profile settings"
            className="absolute right-3 top-3 z-10 rounded-full border border-white/10 bg-surface-2/80 p-2 text-ink-2 backdrop-blur-md transition hover:border-accent hover:text-accent hover:shadow-glow"
          >
            <SettingsIcon />
          </button>
        </div>

        {/* name + position */}
        <div className="mt-3 text-center">
          <h2 className="font-display text-lg font-bold leading-tight tracking-tight text-ink">
            {view.name}
          </h2>
          <p className="mt-1 font-display text-sm font-semibold text-accent-2">
            {view.position}
          </p>
        </div>

        {/* contact chips */}
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {view.gmail && (
            <InfoChip href={`mailto:${view.gmail}`} icon={<MailIcon />}>
              {view.gmail}
            </InfoChip>
          )}
          {view.facebook && (
            <InfoChip
              external
              href={
                view.facebook.startsWith("http")
                  ? view.facebook
                  : `https://${view.facebook}`
              }
              icon={<FacebookIcon />}
            >
              {facebookHandle}
            </InfoChip>
          )}
        </div>

        {/* next scheduled class */}
        <div className="mt-3 rounded-xl border border-white/5 bg-surface-2/60 p-3">
          {nextClass ? (
            <div className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-accent">
                <ClockIcon />
              </span>
              <div className="min-w-0 flex-1">
                <span className="block font-mono text-[9px] uppercase tracking-widest text-accent">
                  {liveClass ? "Happening now" : "Next scheduled class"}
                </span>
                <span className="block truncate text-sm font-bold text-ink">
                  {nextClass.code}
                  {nextClass.sec ? ` • Sec. ${nextClass.sec}` : ""}
                </span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="rounded border border-accent/40 bg-accent/10 px-2 py-1 font-mono text-[11px] font-bold uppercase text-accent">
                  {formatClassTime(nextClass.timeStart)}
                </span>
                {nextClass.room && (
                  <span className="font-mono text-[10px] text-ink-3">
                    Room: {nextClass.room}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-surface-2 text-ink-3">
                <ClockIcon />
              </span>
              <span className="text-sm font-medium text-ink-3">
                No upcoming classes
              </span>
            </div>
          )}
        </div>

        {/* assigned courses */}
        <div className="mt-auto pt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-ink-3">
              Assigned courses handled
            </span>
            <span className="font-mono text-[10px] text-ink-3">
              {courseRows.length} Active
            </span>
          </div>

          <div className="space-y-1.5">
            {courseRows.length === 0 && (
              <p className="rounded-lg border border-white/5 bg-surface-2/60 px-3 py-3 text-xs text-ink-3">
                No courses assigned yet.
              </p>
            )}
            {courseRows.map((c, i) => (
              <div
                key={`${c.code}-${i}`}
                className="flex items-center gap-3 rounded-lg border border-white/5 bg-surface-2/60 px-3 py-2"
              >
                <span
                  className={`shrink-0 rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                    BADGE_TONES[i % BADGE_TONES.length]
                  }`}
                >
                  {c.code}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">
                  {c.name}
                </span>
                {c.count !== null && (
                  <span className="shrink-0 rounded-md border border-white/10 bg-surface-1 px-2 py-0.5 font-mono text-[10px] text-ink-2">
                    {c.count} {c.count === 1 ? "Section" : "Sections"}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* edit modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/70 p-4 backdrop-blur-xl">
          <div className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-xl border border-accent/35 border-b-accent-2/20 bg-surface-3 p-6 shadow-modal">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="font-display text-base font-semibold text-ink">
                Edit profile details
              </h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                aria-label="Close"
                className="rounded px-2 text-lg leading-none text-ink-3 transition hover:text-accent"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className={LABEL}>Upload profile photo</label>
                <input
                  name="profilePhoto"
                  type="file"
                  accept="image/*"
                  onChange={handlePhoto}
                  disabled={isSaving}
                  className="w-full cursor-pointer text-xs text-ink-2 file:mr-3 file:cursor-pointer file:rounded file:border file:border-accent/40 file:bg-transparent file:px-4 file:py-2 file:font-mono file:text-xs file:font-bold file:uppercase file:text-accent hover:file:bg-accent/10 disabled:opacity-50"
                />
              </div>

              <div>
                <label className={LABEL}>Full name</label>
                <input
                  type="text"
                  name="name"
                  value={draft.name}
                  onChange={handleChange}
                  required
                  disabled={isSaving}
                  className={INPUT}
                />
              </div>

              <div>
                <label className={LABEL}>Position / title</label>
                <input
                  type="text"
                  name="position"
                  value={draft.position}
                  onChange={handleChange}
                  disabled={isSaving}
                  className={INPUT}
                />
              </div>

              <div>
                <label className={LABEL}>Courses handled (comma-separated)</label>
                <input
                  type="text"
                  name="courses"
                  value={coursesText}
                  onChange={(e) => setCoursesText(e.target.value)}
                  placeholder="e.g. BSIT 3A - Web Dev, BSCS 2B - OOP"
                  disabled={isSaving}
                  className={INPUT}
                />
              </div>

              <div>
                <label className={LABEL}>Gmail address</label>
                <input
                  type="email"
                  name="gmail"
                  value={draft.gmail}
                  onChange={handleChange}
                  disabled={isSaving}
                  className={INPUT}
                />
              </div>

              <div>
                <label className={LABEL}>Facebook URL</label>
                <input
                  type="text"
                  name="facebook"
                  value={draft.facebook}
                  onChange={handleChange}
                  disabled={isSaving}
                  className={INPUT}
                />
              </div>

              {error && (
                <p className="rounded border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-300">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2 border-t border-white/5 pt-4">
                <button
                  type="button"
                  onClick={() => !isSaving && setIsEditing(false)}
                  disabled={isSaving}
                  className={BTN_SECONDARY}
                >
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className={BTN_PRIMARY}>
                  {isSaving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}