import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../auth/useAuth";
import { Icon } from "./DashboardShared";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";
const BTN_PRIMARY = `inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-canvas transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
const BTN_SECONDARY = `inline-flex items-center justify-center gap-2 rounded-lg border border-accent/40 bg-accent/5 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-accent transition-all duration-150 hover:border-accent hover:bg-accent/15 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
const BTN_GHOST = `inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-ink-2 transition-all duration-150 hover:border-white/20 hover:bg-white/10 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;

const LABEL = "block font-mono text-[11px] uppercase tracking-wider text-ink-3 mb-2";
const PANEL = "rounded-xl border border-accent/20 bg-surface-1/85 p-5 backdrop-blur-xl shadow-xl shadow-black/40";
const EYEBROW = "font-mono text-[10px] font-bold uppercase tracking-wider text-accent";

const MAX_RECENT = 8;

const REPORT_LABELS = {
  prelim: "Prelim class record",
  midterm: "Midterm class record",
  semifinal: "Semi-final class record",
  final: "Final class record",
  summary: "Grade summary",
  "monthly-attendance": "Monthly attendance",
};

const PERIODS = [
  ["prelim", "Prelim"],
  ["midterm", "Midterm"],
  ["semifinal", "Semi-final"],
  ["final", "Final"],
];

function sectionLabelParts(section) {
  if (!section) return { code: "", number: "", title: "" };
  const code = section.subject_code || "Class";
  const number = section.section_no ? `Sec ${section.section_no}` : "";
  const title = section.subject_title || "";
  return { code, number, title };
}

function sectionLabel(section) {
  if (!section) return "";
  const code = section.subject_code || "Class";
  const number = section.section_no ? ` · Section ${section.section_no}` : "";
  const title = section.subject_title ? ` — ${section.subject_title}` : "";
  return `${code}${number}${title}`;
}

function readRecent(key) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function writeRecent(key, list) {
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Ignore storage errors
  }
}

function makeEntry(type, sectionId, label) {
  const at = Date.now();
  return { id: `${at}-${type}`, type, sectionId, sectionLabel: label, at };
}

function formatWhen(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

// Custom Select Component to replace native HTML select
function CustomSelect({ options, value, onChange, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selectedOption = options.find((opt) => opt.id === value) || options[0];

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-surface-1 px-3.5 py-2.5 text-left transition-all ${
          isOpen ? "border-accent ring-2 ring-accent/20" : "hover:border-white/20"
        } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${FOCUS}`}
      >
        {selectedOption ? (
          <div className="flex items-center gap-2 truncate">
            <span className="font-mono text-xs font-semibold text-accent">
              {selectedOption.code}
            </span>
            {selectedOption.number && (
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-ink-3">
                {selectedOption.number}
              </span>
            )}
            {selectedOption.title && (
              <span className="truncate text-xs text-ink-2">— {selectedOption.title}</span>
            )}
          </div>
        ) : (
          <span className="text-xs text-ink-3">Select a class...</span>
        )}
        <Icon
          name="chevron-down"
          size={16}
          className={`shrink-0 text-ink-3 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-accent" : ""
          }`}
        />
      </button>

      {/* DROPDOWN OVERLAY */}
      {isOpen && options.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-2 max-h-56 w-full overflow-y-auto rounded-xl border border-white/15 bg-surface-1 p-1.5 shadow-2xl backdrop-blur-2xl">
          {options.map((opt) => {
            const isSelected = opt.id === value;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onChange(opt.id);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${
                  isSelected
                    ? "bg-accent/15 text-accent font-medium"
                    : "text-ink hover:bg-white/10"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className={`font-mono text-xs ${isSelected ? "font-bold text-accent" : "text-ink-2"}`}>
                    {opt.code}
                  </span>
                  {opt.number && (
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-ink-3">
                      {opt.number}
                    </span>
                  )}
                  {opt.title && (
                    <span className="truncate text-xs text-ink-3">— {opt.title}</span>
                  )}
                </div>
                {isSelected && <Icon name="check" size={14} className="shrink-0 text-accent" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReportCard({ icon, tone, title, description, children }) {
  return (
    <article className={`${PANEL} flex flex-col`}>
      <span className={`grid size-10 place-items-center rounded-lg border ${tone}`}>
        <Icon name={icon} size={20} />
      </span>
      <h2 className="mt-4 font-display text-base font-semibold tracking-tight text-ink">
        {title}
      </h2>
      <p className="mt-1 text-xs leading-5 text-ink-2">{description}</p>
      <div className="mt-5 flex-1 content-end">{children}</div>
    </article>
  );
}

export default function ReportsView({
  sections = [],
  section = null,
  onOpenPrint,
}) {
  const { user } = useAuth();
  const storageKey = `presenzio.recent-reports.${user?.id || "guest"}`;

  const [selectedId, setSelectedId] = useState(section?.id || "");
  const [recent, setRecent] = useState(() => readRecent(storageKey));

  const activeId = sections.some((item) => item.id === selectedId)
    ? selectedId
    : sections[0]?.id || "";
  const activeSection = sections.find((item) => item.id === activeId);
  const canGenerate = Boolean(activeSection && onOpenPrint);

  const formattedSections = sections.map((item) => ({
    id: item.id,
    ...sectionLabelParts(item),
  }));

  const generate = (type, sectionId = activeId) => {
    const target = sections.find((item) => item.id === sectionId);
    if (!target || !onOpenPrint) return;
    const entry = makeEntry(type, sectionId, sectionLabel(target));
    const next = [
      entry,
      ...recent.filter(
        (item) => !(item.type === type && item.sectionId === sectionId)
      ),
    ].slice(0, MAX_RECENT);
    setRecent(next);
    writeRecent(storageKey, next);
    onOpenPrint(type, sectionId);
  };

  const clearRecent = () => {
    setRecent([]);
    writeRecent(storageKey, []);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4">
      {/* Page header */}
      <header className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-xl border border-accent/20 bg-surface-1 p-6 shadow-xl shadow-black/40 md:flex-row md:items-center">
        <div className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full bg-accent/5 blur-3xl" />
        <div className="relative z-10 flex items-start gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-linear-to-br from-accent via-sky-600 to-[#0D82FF] text-canvas shadow-lg shadow-accent/30">
            <Icon name="file" size={24} />
          </div>
          <div>
            <span className={EYEBROW}>Document center</span>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
              Reports
            </h1>
            <p className="mt-0.5 text-xs text-ink-2">
              Generate official class records and monthly attendance reports.
            </p>
          </div>
        </div>
      </header>

      {/* Class Selector Panel — relative z-30 prevents clipping behind cards below */}
      <section className={`${PANEL} relative z-30`}>
        <label className={LABEL}>Select Class</label>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <CustomSelect
            options={formattedSections}
            value={activeId}
            onChange={setSelectedId}
            disabled={!sections.length}
          />
          <p className="text-xs leading-5 text-ink-3 md:max-w-xs">
            {sections.length
              ? "Reports are generated for the class selected here."
              : "Add a class in Classes to start generating reports."}
          </p>
        </div>
      </section>

      {/* Cards Section */}
      <section className="relative z-10 grid gap-4 md:grid-cols-2">
        <ReportCard
          icon="file"
          tone="border-accent/30 bg-accent/10 text-accent"
          title="Class record"
          description="Official period grade sheet with student scores, transmuted grades, and signatures."
        >
          <div className="grid grid-cols-2 gap-2">
            {PERIODS.map(([type, label]) => (
              <button
                key={type}
                type="button"
                className={BTN_SECONDARY}
                disabled={!canGenerate}
                onClick={() => generate(type)}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              className={`${BTN_GHOST} col-span-2 py-2.5`}
              disabled={!canGenerate}
              onClick={() => generate("summary")}
            >
              <Icon name="chart" size={14} /> Grade summary
            </button>
          </div>
        </ReportCard>

        <ReportCard
          icon="calendar"
          tone="border-accent-2/30 bg-accent-2/15 text-accent-4"
          title="Monthly attendance"
          description="AM/PM daily attendance by gender, enrollment totals, and monthly percentages."
        >
          <button
            type="button"
            className={`${BTN_PRIMARY} w-full`}
            disabled={!canGenerate}
            onClick={() => generate("monthly-attendance")}
          >
            <Icon name="printer" size={15} /> Generate report
          </button>
        </ReportCard>
      </section>

      {/* History Section */}
      <section className={`${PANEL} relative z-10`} aria-labelledby="recent-reports-title">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className={EYEBROW}>History</p>
            <h2
              id="recent-reports-title"
              className="font-display text-base font-semibold tracking-tight text-ink"
            >
              Recent reports
            </h2>
          </div>
          {recent.length > 0 && (
            <button type="button" className={BTN_GHOST} onClick={clearRecent}>
              Clear
            </button>
          )}
        </div>

        {recent.length === 0 ? (
          <div className="grid place-items-center gap-3 rounded-lg border border-dashed border-white/10 px-6 py-10 text-center text-xs text-ink-2">
            <span className="grid size-12 place-items-center rounded-xl border border-accent/20 bg-accent/5 text-accent">
              <Icon name="file" size={24} />
            </span>
            <p className="max-w-xs leading-5">
              No reports generated yet. Reports you open here are listed so you
              can reopen them in one click.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {recent.map((item) => {
              const stillExists = sections.some(
                (candidate) => candidate.id === item.sectionId
              );
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-white/5 bg-surface-2/70 p-3 transition hover:border-accent/30"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
                    <Icon
                      name={item.type === "monthly-attendance" ? "calendar" : "file"}
                      size={18}
                    />
                  </span>
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="truncate text-sm font-semibold text-ink">
                      {REPORT_LABELS[item.type] || item.type}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-ink-3">
                      {item.sectionLabel} · {formatWhen(item.at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={BTN_SECONDARY}
                    disabled={!stillExists || !onOpenPrint}
                    title={stillExists ? undefined : "This class no longer exists"}
                    onClick={() => generate(item.type, item.sectionId)}
                  >
                    Open again
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}