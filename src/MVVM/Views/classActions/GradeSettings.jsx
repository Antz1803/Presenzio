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

const distributionPeriods = [
  gradePeriods[0],
  gradePeriods[2],
  gradePeriods[1],
  gradePeriods[3],
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
  return (
    <ModalShell
      title="Grade Sheet Settings"
      section={section}
      onClose={onClose}
      size="wide"
    >
      <div className="text-ink text-[12px]">
        <section className="grid grid-cols-[minmax(0,1.55fr)_minmax(105px,.55fr)_minmax(235px,1fr)] gap-0 -mt-0.5 mx-0 mb-5 border border-white/20 bg-surface-1 max-[820px]:grid-cols-[1fr] max-[560px]:text-[11px]" aria-label="Class details">
          <div className="min-w-0 [&+.grade-sheet-metadata-column]:border-l [&+.grade-sheet-metadata-column]:border-white/20 max-[820px]:[&+.grade-sheet-metadata-column]:border-t max-[820px]:[&+.grade-sheet-metadata-column]:border-white/20 max-[820px]:[&+.grade-sheet-metadata-column]:border-l-0 grade-sheet-metadata-column">
            <div className="grid grid-cols-[max-content_minmax(0,1fr)] min-h-[24px] border-b border-white/20 last:border-b-0 [&_strong]:py-1 [&_strong]:px-[7px] [&_strong]:bg-surface-1 [&_strong]:font-bold [&_strong]:whitespace-nowrap [&_span]:min-w-0 [&_span]:overflow-hidden [&_span]:py-1 [&_span]:px-[7px] [&_span]:whitespace-nowrap [&_span]:text-ellipsis [&.grade-sheet-spacer]:min-h-[18px] [&.grade-sheet-spacer]:border-b-0 [.grade-sheet-year-column_&]:border-b-0 [.grade-sheet-year-column_&_strong]:w-full [.grade-sheet-year-column_&_span]:flex [.grade-sheet-year-column_&_span]:items-center max-[820px]:[.grade-sheet-year-column_&]:border-b max-[820px]:[.grade-sheet-year-column_&]:border-white/20 max-[560px]:grid-cols-[115px_minmax(0,1fr)] max-[560px]:[&_strong]:[white-space:normal]">
              <strong>School Year:</strong>
              <span>{displayValue(section?.school_year?.label || section?.school_year_label)}</span>
            </div>
            <div className="grid grid-cols-[max-content_minmax(0,1fr)] min-h-[24px] border-b border-white/20 last:border-b-0 [&_strong]:py-1 [&_strong]:px-[7px] [&_strong]:bg-surface-1 [&_strong]:font-bold [&_strong]:whitespace-nowrap [&_span]:min-w-0 [&_span]:overflow-hidden [&_span]:py-1 [&_span]:px-[7px] [&_span]:whitespace-nowrap [&_span]:text-ellipsis [&.grade-sheet-spacer]:min-h-[18px] [&.grade-sheet-spacer]:border-b-0 [.grade-sheet-year-column_&]:border-b-0 [.grade-sheet-year-column_&_strong]:w-full [.grade-sheet-year-column_&_span]:flex [.grade-sheet-year-column_&_span]:items-center max-[820px]:[.grade-sheet-year-column_&]:border-b max-[820px]:[.grade-sheet-year-column_&]:border-white/20 max-[560px]:grid-cols-[115px_minmax(0,1fr)] max-[560px]:[&_strong]:[white-space:normal]">
              <strong>Semester:</strong>
              <span>{displayValue(section?.school_year?.semester || section?.semester)}</span>
            </div>
            <div className="grid grid-cols-[max-content_minmax(0,1fr)] min-h-[24px] border-b border-white/20 last:border-b-0 [&_strong]:py-1 [&_strong]:px-[7px] [&_strong]:bg-surface-1 [&_strong]:font-bold [&_strong]:whitespace-nowrap [&_span]:min-w-0 [&_span]:overflow-hidden [&_span]:py-1 [&_span]:px-[7px] [&_span]:whitespace-nowrap [&_span]:text-ellipsis [&.grade-sheet-spacer]:min-h-[18px] [&.grade-sheet-spacer]:border-b-0 [.grade-sheet-year-column_&]:border-b-0 [.grade-sheet-year-column_&_strong]:w-full [.grade-sheet-year-column_&_span]:flex [.grade-sheet-year-column_&_span]:items-center max-[820px]:[.grade-sheet-year-column_&]:border-b max-[820px]:[.grade-sheet-year-column_&]:border-white/20 max-[560px]:grid-cols-[115px_minmax(0,1fr)] max-[560px]:[&_strong]:[white-space:normal] grade-sheet-spacer" />
            <div className="grid grid-cols-[max-content_minmax(0,1fr)] min-h-[24px] border-b border-white/20 last:border-b-0 [&_strong]:py-1 [&_strong]:px-[7px] [&_strong]:bg-surface-1 [&_strong]:font-bold [&_strong]:whitespace-nowrap [&_span]:min-w-0 [&_span]:overflow-hidden [&_span]:py-1 [&_span]:px-[7px] [&_span]:whitespace-nowrap [&_span]:text-ellipsis [&.grade-sheet-spacer]:min-h-[18px] [&.grade-sheet-spacer]:border-b-0 [.grade-sheet-year-column_&]:border-b-0 [.grade-sheet-year-column_&_strong]:w-full [.grade-sheet-year-column_&_span]:flex [.grade-sheet-year-column_&_span]:items-center max-[820px]:[.grade-sheet-year-column_&]:border-b max-[820px]:[.grade-sheet-year-column_&]:border-white/20 max-[560px]:grid-cols-[115px_minmax(0,1fr)] max-[560px]:[&_strong]:[white-space:normal]">
              <strong>EDP Code:</strong>
              <span>{displayValue(section?.edp_code)}</span>
            </div>
            <div className="grid grid-cols-[max-content_minmax(0,1fr)] min-h-[24px] border-b border-white/20 last:border-b-0 [&_strong]:py-1 [&_strong]:px-[7px] [&_strong]:bg-surface-1 [&_strong]:font-bold [&_strong]:whitespace-nowrap [&_span]:min-w-0 [&_span]:overflow-hidden [&_span]:py-1 [&_span]:px-[7px] [&_span]:whitespace-nowrap [&_span]:text-ellipsis [&.grade-sheet-spacer]:min-h-[18px] [&.grade-sheet-spacer]:border-b-0 [.grade-sheet-year-column_&]:border-b-0 [.grade-sheet-year-column_&_strong]:w-full [.grade-sheet-year-column_&_span]:flex [.grade-sheet-year-column_&_span]:items-center max-[820px]:[.grade-sheet-year-column_&]:border-b max-[820px]:[.grade-sheet-year-column_&]:border-white/20 max-[560px]:grid-cols-[115px_minmax(0,1fr)] max-[560px]:[&_strong]:[white-space:normal]">
              <strong>Subject Code:</strong>
              <span>{displayValue(section?.subject_code)}</span>
            </div>
            <div className="grid grid-cols-[max-content_minmax(0,1fr)] min-h-[24px] border-b border-white/20 last:border-b-0 [&_strong]:py-1 [&_strong]:px-[7px] [&_strong]:bg-surface-1 [&_strong]:font-bold [&_strong]:whitespace-nowrap [&_span]:min-w-0 [&_span]:overflow-hidden [&_span]:py-1 [&_span]:px-[7px] [&_span]:whitespace-nowrap [&_span]:text-ellipsis [&.grade-sheet-spacer]:min-h-[18px] [&.grade-sheet-spacer]:border-b-0 [.grade-sheet-year-column_&]:border-b-0 [.grade-sheet-year-column_&_strong]:w-full [.grade-sheet-year-column_&_span]:flex [.grade-sheet-year-column_&_span]:items-center max-[820px]:[.grade-sheet-year-column_&]:border-b max-[820px]:[.grade-sheet-year-column_&]:border-white/20 max-[560px]:grid-cols-[115px_minmax(0,1fr)] max-[560px]:[&_strong]:[white-space:normal]">
              <strong>Teacher Name:</strong>
              <span>
                {displayValue(
                  section?.teacher_name ||
                    section?.teacher?.full_name ||
                    section?.instructor?.name ||
                    instructor?.name,
                )}
              </span>
            </div>
            <div className="grid grid-cols-[max-content_minmax(0,1fr)] min-h-[24px] border-b border-white/20 last:border-b-0 [&_strong]:py-1 [&_strong]:px-[7px] [&_strong]:bg-surface-1 [&_strong]:font-bold [&_strong]:whitespace-nowrap [&_span]:min-w-0 [&_span]:overflow-hidden [&_span]:py-1 [&_span]:px-[7px] [&_span]:whitespace-nowrap [&_span]:text-ellipsis [&.grade-sheet-spacer]:min-h-[18px] [&.grade-sheet-spacer]:border-b-0 [.grade-sheet-year-column_&]:border-b-0 [.grade-sheet-year-column_&_strong]:w-full [.grade-sheet-year-column_&_span]:flex [.grade-sheet-year-column_&_span]:items-center max-[820px]:[.grade-sheet-year-column_&]:border-b max-[820px]:[.grade-sheet-year-column_&]:border-white/20 max-[560px]:grid-cols-[115px_minmax(0,1fr)] max-[560px]:[&_strong]:[white-space:normal]">
              <strong>Subject Title:</strong>
              <span>{displayValue(section?.subject_title || section?.subject_code)}</span>
            </div>
            <div className="grid grid-cols-[max-content_minmax(0,1fr)] min-h-[24px] border-b border-white/20 last:border-b-0 [&_strong]:py-1 [&_strong]:px-[7px] [&_strong]:bg-surface-1 [&_strong]:font-bold [&_strong]:whitespace-nowrap [&_span]:min-w-0 [&_span]:overflow-hidden [&_span]:py-1 [&_span]:px-[7px] [&_span]:whitespace-nowrap [&_span]:text-ellipsis [&.grade-sheet-spacer]:min-h-[18px] [&.grade-sheet-spacer]:border-b-0 [.grade-sheet-year-column_&]:border-b-0 [.grade-sheet-year-column_&_strong]:w-full [.grade-sheet-year-column_&_span]:flex [.grade-sheet-year-column_&_span]:items-center max-[820px]:[.grade-sheet-year-column_&]:border-b max-[820px]:[.grade-sheet-year-column_&]:border-white/20 max-[560px]:grid-cols-[115px_minmax(0,1fr)] max-[560px]:[&_strong]:[white-space:normal]">
              <strong>Dean:</strong>
              <input
                className="min-w-0 w-full py-1 px-[7px] border-0 bg-surface-1 text-ink outline-none focus:bg-surface-2 focus:[box-shadow:inset_0_0_0_2px_#00F0FF]"
                value={dean}
                onChange={(event) => {
                  setDean(event.target.value);
                  setMessage({ status: "", text: "" });
                }}
                placeholder="Enter dean name"
                aria-label="Dean name"
              />
            </div>
          </div>
          <div className="min-w-0 [&+.grade-sheet-metadata-column]:border-l [&+.grade-sheet-metadata-column]:border-white/20 max-[820px]:[&+.grade-sheet-metadata-column]:border-t max-[820px]:[&+.grade-sheet-metadata-column]:border-white/20 max-[820px]:[&+.grade-sheet-metadata-column]:border-l-0 grade-sheet-metadata-column grade-sheet-year-column">
            <div className="grid grid-cols-[max-content_minmax(0,1fr)] min-h-[24px] border-b border-white/20 last:border-b-0 [&_strong]:py-1 [&_strong]:px-[7px] [&_strong]:bg-surface-1 [&_strong]:font-bold [&_strong]:whitespace-nowrap [&_span]:min-w-0 [&_span]:overflow-hidden [&_span]:py-1 [&_span]:px-[7px] [&_span]:whitespace-nowrap [&_span]:text-ellipsis [&.grade-sheet-spacer]:min-h-[18px] [&.grade-sheet-spacer]:border-b-0 [.grade-sheet-year-column_&]:border-b-0 [.grade-sheet-year-column_&_strong]:w-full [.grade-sheet-year-column_&_span]:flex [.grade-sheet-year-column_&_span]:items-center max-[820px]:[.grade-sheet-year-column_&]:border-b max-[820px]:[.grade-sheet-year-column_&]:border-white/20 max-[560px]:grid-cols-[115px_minmax(0,1fr)] max-[560px]:[&_strong]:[white-space:normal]">
              <strong>Year:</strong>
              <span>{displayValue(section?.year_level)}</span>
            </div>
          </div>
          <div className="min-w-0 [&+.grade-sheet-metadata-column]:border-l [&+.grade-sheet-metadata-column]:border-white/20 max-[820px]:[&+.grade-sheet-metadata-column]:border-t max-[820px]:[&+.grade-sheet-metadata-column]:border-white/20 max-[820px]:[&+.grade-sheet-metadata-column]:border-l-0 grade-sheet-metadata-column grade-sheet-schedule-column">
            <div className="grid grid-cols-[max-content_minmax(0,1fr)] min-h-[24px] border-b border-white/20 last:border-b-0 [&_strong]:py-1 [&_strong]:px-[7px] [&_strong]:bg-surface-1 [&_strong]:font-bold [&_strong]:whitespace-nowrap [&_span]:min-w-0 [&_span]:overflow-hidden [&_span]:py-1 [&_span]:px-[7px] [&_span]:whitespace-nowrap [&_span]:text-ellipsis [&.grade-sheet-spacer]:min-h-[18px] [&.grade-sheet-spacer]:border-b-0 [.grade-sheet-year-column_&]:border-b-0 [.grade-sheet-year-column_&_strong]:w-full [.grade-sheet-year-column_&_span]:flex [.grade-sheet-year-column_&_span]:items-center max-[820px]:[.grade-sheet-year-column_&]:border-b max-[820px]:[.grade-sheet-year-column_&]:border-white/20 max-[560px]:grid-cols-[115px_minmax(0,1fr)] max-[560px]:[&_strong]:[white-space:normal]">
              <strong>Room No:</strong>
              <span>{displayValue(section?.room)}</span>
            </div>
            <div className="grid grid-cols-[max-content_minmax(0,1fr)] min-h-[24px] border-b border-white/20 last:border-b-0 [&_strong]:py-1 [&_strong]:px-[7px] [&_strong]:bg-surface-1 [&_strong]:font-bold [&_strong]:whitespace-nowrap [&_span]:min-w-0 [&_span]:overflow-hidden [&_span]:py-1 [&_span]:px-[7px] [&_span]:whitespace-nowrap [&_span]:text-ellipsis [&.grade-sheet-spacer]:min-h-[18px] [&.grade-sheet-spacer]:border-b-0 [.grade-sheet-year-column_&]:border-b-0 [.grade-sheet-year-column_&_strong]:w-full [.grade-sheet-year-column_&_span]:flex [.grade-sheet-year-column_&_span]:items-center max-[820px]:[.grade-sheet-year-column_&]:border-b max-[820px]:[.grade-sheet-year-column_&]:border-white/20 max-[560px]:grid-cols-[115px_minmax(0,1fr)] max-[560px]:[&_strong]:[white-space:normal]">
              <strong>Time:</strong>
              <span>
                {displayValue(
                  section?.time_start || section?.time_end
                    ? `${displayTime(section.time_start)} - ${displayTime(section.time_end)}`
                    : "",
                )}
              </span>
            </div>
            <div className="grid grid-cols-[max-content_minmax(0,1fr)] min-h-[24px] border-b border-white/20 last:border-b-0 [&_strong]:py-1 [&_strong]:px-[7px] [&_strong]:bg-surface-1 [&_strong]:font-bold [&_strong]:whitespace-nowrap [&_span]:min-w-0 [&_span]:overflow-hidden [&_span]:py-1 [&_span]:px-[7px] [&_span]:whitespace-nowrap [&_span]:text-ellipsis [&.grade-sheet-spacer]:min-h-[18px] [&.grade-sheet-spacer]:border-b-0 [.grade-sheet-year-column_&]:border-b-0 [.grade-sheet-year-column_&_strong]:w-full [.grade-sheet-year-column_&_span]:flex [.grade-sheet-year-column_&_span]:items-center max-[820px]:[.grade-sheet-year-column_&]:border-b max-[820px]:[.grade-sheet-year-column_&]:border-white/20 max-[560px]:grid-cols-[115px_minmax(0,1fr)] max-[560px]:[&_strong]:[white-space:normal]">
              <strong>Days:</strong>
              <span>{displayValue(section?.days)}</span>
            </div>
            <div className="grid grid-cols-[max-content_minmax(0,1fr)] min-h-[24px] border-b border-white/20 last:border-b-0 [&_strong]:py-1 [&_strong]:px-[7px] [&_strong]:bg-surface-1 [&_strong]:font-bold [&_strong]:whitespace-nowrap [&_span]:min-w-0 [&_span]:overflow-hidden [&_span]:py-1 [&_span]:px-[7px] [&_span]:whitespace-nowrap [&_span]:text-ellipsis [&.grade-sheet-spacer]:min-h-[18px] [&.grade-sheet-spacer]:border-b-0 [.grade-sheet-year-column_&]:border-b-0 [.grade-sheet-year-column_&_strong]:w-full [.grade-sheet-year-column_&_span]:flex [.grade-sheet-year-column_&_span]:items-center max-[820px]:[.grade-sheet-year-column_&]:border-b max-[820px]:[.grade-sheet-year-column_&]:border-white/20 max-[560px]:grid-cols-[115px_minmax(0,1fr)] max-[560px]:[&_strong]:[white-space:normal]">
              <strong>Section:</strong>
              <span>{displayValue(section?.section_no)}</span>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-[minmax(0,1.05fr)_minmax(0,1.35fr)] gap-5.5 items-start max-[820px]:grid-cols-[1fr]">
          <section className="min-w-0">
            <p className="mt-0 mx-0 mb-1.5 text-ink text-[11px] font-bold uppercase tracking-[.55px]">Period dates</p>
            <p className="mt-0 mx-0 mb-2 text-ink-3 text-[10px] leading-[1.45]">
              Records and attendance are assigned to a period using these dates.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full [table-layout:fixed] border border-white/20 bg-surface-1 [&_th]:py-[5px] [&_th]:px-1.5 [&_th]:border [&_th]:border-white/20 [&_th]:bg-surface-3 [&_th]:text-ink [&_th]:text-[10px] [&_th]:font-normal [&_th]:text-left [&_td]:h-[30px] [&_td]:p-0 [&_td]:border [&_td]:border-white/20 [&_td]:text-ink [&_td]:text-[11px] [&_td:first-child]:py-0 [&_td:first-child]:px-1.5 [&_td_input]:block [&_td_input]:w-full [&_td_input]:h-full [&_td_input]:min-w-0 [&_td_input]:py-[5px] [&_td_input]:px-1.5 [&_td_input]:border-0 [&_td_input]:bg-surface-1 [&_td_input]:text-ink [&_td_input]:outline-none [&_td_input:focus]:bg-surface-2 [&_td_input:focus]:[box-shadow:inset_0_0_0_2px_#00F0FF] [&_th:first-child]:w-[34%]">
                <thead>
                  <tr>
                    <th>PERIOD</th>
                    <th>START DATE</th>
                    <th>END DATE</th>
                  </tr>
                </thead>
                <tbody>
                  {gradePeriods.map((item) => (
                    <tr key={item.key}>
                      <td>{item.label}</td>
                      <td>
                        <input
                          type="date"
                          value={dateRanges[item.key].start}
                          onChange={(e) => updateDate(item.key, "start", e.target.value)}
                          disabled={saving}
                          aria-label={`${item.label} start date`}
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          value={dateRanges[item.key].end}
                          onChange={(e) => updateDate(item.key, "end", e.target.value)}
                          disabled={saving}
                          aria-label={`${item.label} end date`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="min-w-0">
            <p className="mt-0 mx-0 mb-1.5 text-ink text-[11px] font-bold uppercase tracking-[.55px] mb-2 text-center">
              Percentage distribution per score entry
            </p>
            <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] [gap:20px_22px] max-[820px]:gap-3.5 max-[560px]:grid-cols-[1fr] max-[560px]:gap-3">
              {distributionPeriods.map((period) => (
                <div className="overflow-hidden border border-white/20 bg-surface-1" key={period.key}>
                  <div className="py-[5px] px-1.5 border-b border-white/20 bg-surface-3 text-ink text-[11px] uppercase">{period.label}</div>
                  {distributionRows.map(([label, key]) => (
                    <label className="grid grid-cols-[minmax(0,1fr)_58px] items-center min-h-[28px] border-b border-white/20 text-ink text-[11px] [&_span]:py-[5px] [&_span]:px-1.5 [&_input]:w-full [&_input]:h-full [&_input]:min-w-0 [&_input]:py-[5px] [&_input]:px-1 [&_input]:border-0 [&_input]:border-l [&_input]:border-white/20 [&_input]:bg-surface-1 [&_input]:text-ink [&_input]:text-center [&_input]:outline-none [&_input:focus]:bg-surface-2 [&_input:focus]:[box-shadow:inset_0_0_0_2px_#00F0FF]" key={label}>
                      <span>{label}</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={weightSettings[period.key][key]}
                        onChange={(event) => updateWeight(period.key, key, event.target.value)}
                        disabled={saving}
                        aria-label={`${period.label} ${label} percentage`}
                      />
                    </label>
                  ))}
                  <div className="grid grid-cols-[minmax(0,1fr)_58px] items-center min-h-[28px] border-b-0 text-ink text-[11px] bg-surface-3 font-bold [&_span]:py-[5px] [&_span]:px-1.5 [&_strong]:h-full [&_strong]:py-[5px] [&_strong]:px-1 [&_strong]:border-l [&_strong]:border-white/20 [&_strong]:font-bold [&_strong]:text-center">
                    <span>Total</span>
                    <strong>{weightTotal(weightSettings[period.key])}</strong>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
      <p className="mt-0 mx-0 mb-2 text-ink-3 text-[10px] leading-[1.45] mt-3">
        Changes are used immediately by grade calculation and are written to the Excel grade sheet during synchronization.
      </p>
      {message.text && (
        <p className={`mt-0 mx-0 mb-3 py-[9px] px-[11px] rounded-[7px] text-[10px] [&.error]:border [&.error]:border-white/10 [&.error]:bg-surface-2 [&.error]:text-rose-300 [&.success]:border [&.success]:border-white/10 [&.success]:bg-surface-2 [&.success]:text-emerald-400 ${message.status}`} role="status">
          {message.text}
        </p>
      )}
      <div className="flex justify-end gap-2 mt-5.5 pt-[17px] border-t border-white/10 max-[760px]:flex-wrap max-[760px]:[&_button]:flex-1 [.assessment-builder_&]:mt-0.5">
        <button className="inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="inline-flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-canvas transition hover:shadow-halo active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </ModalShell>
  );
}