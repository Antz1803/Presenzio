import { useState } from "react";
import { gradePeriods } from "./actionUtils";
import { ModalShell } from "./ActionModalShell";
import { getStoredDean, setStoredDean } from "../../Models/deanStorage";
import {
  gradingWeightKeys,
  gradingWeights,
} from "../../ViewModels/dashboardConstants";

const distributionRows = [
  ["Quiz", "quiz"],
  ["Assignment", "assignment"],
  ["Graded Activity", "activity"],
  ["Attendance", "attendance"],
  ["Exam", "exam"],
];

function displayTime(value) {
  return String(value || "").slice(0, 5);
}

function displayValue(value) {
  return value || "—";
}

// Avoids floating-point noise such as 30.000000000000004 in totals.
const roundTo2 = (value) => Math.round(value * 100) / 100;

const weightTotal = (values) =>
  roundTo2(
    distributionRows.reduce((sum, [, key]) => sum + Number(values?.[key] || 0), 0),
  );

const initialRanges = (saved) =>
  Object.fromEntries(
    gradePeriods.map((item) => {
      const row = saved.find((period) => period.code === item.key);
      return [
        item.key,
        { start: row?.start_date ?? "", end: row?.end_date ?? "" },
      ];
    }),
  );

const initialWeights = (saved) =>
  Object.fromEntries(
    gradePeriods.map((item) => {
      const period = saved.find((row) => row.code === item.key);
      return [
        item.key,
        Object.fromEntries(
          gradingWeightKeys.map((key) => [
            key,
            Number.isFinite(Number(period?.weights?.[key]))
              ? Number(period.weights[key])
              : Number(gradingWeights[key]) * 100,
          ]),
        ),
      ];
    }),
  );

// Inputs return strings; the grade calculation needs real numbers.
const toNumericWeights = (weightSettings) =>
  Object.fromEntries(
    Object.entries(weightSettings).map(([period, values]) => [
      period,
      Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, Number(value)]),
      ),
    ]),
  );

const INPUT =
  "w-full rounded-lg border border-ink-3/30 bg-surface-1 px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-3 transition hover:border-accent/30 focus:border-accent focus:shadow-focus focus:outline-none disabled:opacity-50";
const MINI_LABEL =
  "flex flex-col gap-1 font-mono text-[9px] uppercase tracking-wider text-ink-3";
const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-canvas transition hover:shadow-halo active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
const BTN_OUTLINE =
  "inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50";

function SectionTitle({ title, hint }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-3">
        <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
          {title}
        </h3>
        <span className="h-px flex-1 bg-white/5" />
      </div>
      {hint && <p className="mt-1.5 text-[11px] text-ink-3">{hint}</p>}
    </div>
  );
}

function Tile({ label, children }) {
  return (
    <div className="rounded-lg border border-white/5 bg-surface-1/80 px-3 py-2.5">
      <p className="font-mono text-[9px] uppercase tracking-wider text-ink-3">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-medium text-ink">{children}</p>
    </div>
  );
}

export function GradeSettings({ gradingPeriods, section, instructor, onSave, onClose }) {
  const [dateRanges, setDateRanges] = useState(() =>
    initialRanges(gradingPeriods),
  );
  const [weightSettings, setWeightSettings] = useState(() =>
    initialWeights(gradingPeriods),
  );
  const [dean, setDean] = useState(
    () => section?.dean || section?.dean_name || getStoredDean(section?.id),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ status: "", text: "" });
  const updateDate = (period, field, value) => {
    setDateRanges((current) => ({
      ...current,
      [period]: { ...current[period], [field]: value },
    }));
    setMessage({ status: "", text: "" });
  };
  const updateWeight = (period, key, value) => {
    setWeightSettings((current) => ({
      ...current,
      [period]: { ...current[period], [key]: value },
    }));
    setMessage({ status: "", text: "" });
  };
  const save = async () => {
    const invalid = gradePeriods.find(({ key }) => {
      const dates = dateRanges[key];
      return (
        Boolean(dates.start) !== Boolean(dates.end) ||
        (dates.start && dates.end && dates.start > dates.end)
      );
    });
    if (invalid)
      return setMessage({
        status: "error",
        text: `${invalid.label} needs a valid start and end date.`,
      });

    // Periods must not overlap, otherwise one record can be counted twice.
    const dated = gradePeriods
      .filter(({ key }) => dateRanges[key].start && dateRanges[key].end)
      .sort((a, b) => dateRanges[a.key].start.localeCompare(dateRanges[b.key].start));
    const overlap = dated.find(
      (item, index) =>
        index > 0 &&
        dateRanges[dated[index - 1].key].end >= dateRanges[item.key].start,
    );
    if (overlap)
      return setMessage({
        status: "error",
        text: `${overlap.label} starts before the previous period ends.`,
      });

    const invalidWeights = gradePeriods.find((period) => {
      const values = weightSettings[period.key];
      return (
        distributionRows.some(([, key]) => {
          const value = Number(values?.[key]);
          return !Number.isFinite(value) || value < 0 || value > 100;
        }) || Math.abs(weightTotal(values) - 100) > 0.0001
      );
    });
    if (invalidWeights)
      return setMessage({
        status: "error",
        text: `${invalidWeights.label} percentages must be between 0 and 100 and total exactly 100.`,
      });
    setSaving(true);
    setMessage({ status: "", text: "" });
    try {
      const savedDean = dean.trim();
      setStoredDean(section?.id, savedDean);
      await onSave({
        dateRanges,
        weightSettings: toNumericWeights(weightSettings),
      });
      setMessage({
        status: "success",
        text: "Grade settings saved successfully.",
      });
    } catch (error) {
      setMessage({
        status: "error",
        text: error.message ?? "Period dates could not be saved.",
      });
    } finally {
      setSaving(false);
    }
  };
  const teacherName = displayValue(
    section?.teacher_name ||
      section?.teacher?.full_name ||
      section?.instructor?.name ||
      instructor?.name,
  );
  const timeText = displayValue(
    section?.time_start || section?.time_end
      ? `${displayTime(section.time_start)} - ${displayTime(section.time_end)}`
      : "",
  );

  return (
    <ModalShell
      title="Grade Sheet Settings"
      section={section}
      onClose={onClose}
      size="wide"
    >
      {/* h-grade-sheet-preview widens the modal (see ActionModalShell) */}
      <div className="h-grade-sheet-preview space-y-6 text-xs text-ink-2">
        {/* ---------- Class summary ---------- */}
        <section aria-label="Class details">
          <div className="overflow-hidden rounded-xl border border-accent/20 bg-surface-2/50">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-surface-2/70 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="rounded border border-accent bg-accent px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-canvas">
                  {displayValue(section?.subject_code)}
                </span>
                <h3 className="truncate font-display text-base font-semibold tracking-tight text-ink">
                  {displayValue(section?.subject_title || section?.subject_code)}
                </h3>
              </div>
              <p className="text-xs text-ink-2">
                <span className="font-mono text-[9px] uppercase tracking-wider text-ink-3">
                  Teacher{" "}
                </span>
                <span className="font-medium text-ink">{teacherName}</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3 lg:grid-cols-4">
              <Tile label="School year">
                {displayValue(section?.school_year?.label || section?.school_year_label)}
              </Tile>
              <Tile label="Semester">
                {displayValue(section?.school_year?.semester || section?.semester)}
              </Tile>
              <Tile label="EDP code">{displayValue(section?.edp_code)}</Tile>
              <Tile label="Year level">{displayValue(section?.year_level)}</Tile>
              <Tile label="Section">{displayValue(section?.section_no)}</Tile>
              <Tile label="Room">{displayValue(section?.room)}</Tile>
              <Tile label="Days">{displayValue(section?.days)}</Tile>
              <Tile label="Time">{timeText}</Tile>
            </div>

            <label className="flex flex-col gap-1.5 border-t border-white/5 px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-3 sm:flex-row sm:items-center sm:gap-4">
              <span className="shrink-0 sm:w-20">Dean</span>
              <input
                className={INPUT}
                value={dean}
                onChange={(event) => {
                  setDean(event.target.value);
                  setMessage({ status: "", text: "" });
                }}
                placeholder="Enter dean name"
                aria-label="Dean name"
              />
            </label>
          </div>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          {/* ---------- Period dates ---------- */}
          <section className="min-w-0">
            <SectionTitle
              title="Period dates"
              hint="Records and attendance are assigned to a period using these dates."
            />
            <div className="space-y-2.5">
              {gradePeriods.map((item) => (
                <div
                  key={item.key}
                  className="rounded-lg border border-white/5 bg-surface-2/50 p-3 transition hover:border-accent/30"
                >
                  <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider text-ink">
                    {item.label}
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <label className={MINI_LABEL}>
                      Start
                      <input
                        className={INPUT}
                        type="date"
                        value={dateRanges[item.key].start}
                        onChange={(e) => updateDate(item.key, "start", e.target.value)}
                        disabled={saving}
                        aria-label={`${item.label} start date`}
                      />
                    </label>
                    <label className={MINI_LABEL}>
                      End
                      <input
                        className={INPUT}
                        type="date"
                        value={dateRanges[item.key].end}
                        onChange={(e) => updateDate(item.key, "end", e.target.value)}
                        disabled={saving}
                        aria-label={`${item.label} end date`}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ---------- Percentage distribution ---------- */}
          <section className="min-w-0">
            <SectionTitle
              title="Percentage distribution per score entry"
              hint="Each period must total exactly 100."
            />
            <div className="grid gap-3.5 sm:grid-cols-2">
              {gradePeriods.map((period) => {
                const total = weightTotal(weightSettings[period.key]);
                const ok = Math.abs(total - 100) <= 0.0001;
                return (
                  <div
                    className={`overflow-hidden rounded-lg border bg-surface-2/50 ${
                      ok ? "border-white/5" : "border-rose-400/40"
                    }`}
                    key={period.key}
                  >
                    <div className="flex items-center justify-between border-b border-white/5 px-3 py-2.5">
                      <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink">
                        {period.label}
                      </span>
                      <span
                        className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${
                          ok
                            ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                            : "border-rose-400/40 bg-rose-500/10 text-rose-300"
                        }`}
                      >
                        {total} / 100
                      </span>
                    </div>
                    <div className="space-y-1.5 p-3">
                      {distributionRows.map(([label, key]) => (
                        <label
                          className="flex items-center justify-between gap-3 text-xs text-ink-2"
                          key={label}
                        >
                          <span>{label}</span>
                          <span className="relative">
                            <input
                              className={`${INPUT} w-24 py-1.5 pr-7 text-right font-mono`}
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={weightSettings[period.key][key]}
                              onChange={(event) =>
                                updateWeight(period.key, key, event.target.value)
                              }
                              disabled={saving}
                              aria-label={`${period.label} ${label} percentage`}
                            />
                            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-ink-3">
                              %
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="h-1 bg-surface-1">
                      <div
                        className={`h-full transition-all ${ok ? "bg-emerald-400" : "bg-rose-400"}`}
                        style={{ width: `${Math.min(100, Math.max(0, total))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <p className="mt-5 text-[11px] text-ink-3">
        Changes are used immediately by grade calculation and are written to the
        Excel grade sheet during synchronization.
      </p>
      {message.text && (
        <p
          role="status"
          className={`mt-3 rounded border p-3 text-xs font-medium ${
            message.status === "error"
              ? "border-rose-400/30 bg-rose-500/10 text-rose-300"
              : "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
          }`}
        >
          {message.text}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2 border-t border-white/10 pt-4 max-sm:[&_button]:flex-1">
        <button className={BTN_OUTLINE} onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className={BTN_PRIMARY} onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </ModalShell>
  );
}
