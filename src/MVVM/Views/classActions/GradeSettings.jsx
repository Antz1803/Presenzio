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
      <div className="grade-sheet-preview">
        <section className="grade-sheet-metadata" aria-label="Class details">
          <div className="grade-sheet-metadata-column">
            <div className="grade-sheet-field">
              <strong>School Year:</strong>
              <span>{displayValue(section?.school_year?.label || section?.school_year_label)}</span>
            </div>
            <div className="grade-sheet-field">
              <strong>Semester:</strong>
              <span>{displayValue(section?.school_year?.semester || section?.semester)}</span>
            </div>
            <div className="grade-sheet-field grade-sheet-spacer" />
            <div className="grade-sheet-field">
              <strong>EDP Code:</strong>
              <span>{displayValue(section?.edp_code)}</span>
            </div>
            <div className="grade-sheet-field">
              <strong>Subject Code:</strong>
              <span>{displayValue(section?.subject_code)}</span>
            </div>
            <div className="grade-sheet-field">
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
            <div className="grade-sheet-field">
              <strong>Subject Title:</strong>
              <span>{displayValue(section?.subject_title || section?.subject_code)}</span>
            </div>
            <div className="grade-sheet-field">
              <strong>Dean:</strong>
              <input
                className="grade-sheet-metadata-input"
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
          <div className="grade-sheet-metadata-column grade-sheet-year-column">
            <div className="grade-sheet-field">
              <strong>Year:</strong>
              <span>{displayValue(section?.year_level)}</span>
            </div>
          </div>
          <div className="grade-sheet-metadata-column grade-sheet-schedule-column">
            <div className="grade-sheet-field">
              <strong>Room No:</strong>
              <span>{displayValue(section?.room)}</span>
            </div>
            <div className="grade-sheet-field">
              <strong>Time:</strong>
              <span>
                {displayValue(
                  section?.time_start || section?.time_end
                    ? `${displayTime(section.time_start)} - ${displayTime(section.time_end)}`
                    : "",
                )}
              </span>
            </div>
            <div className="grade-sheet-field">
              <strong>Days:</strong>
              <span>{displayValue(section?.days)}</span>
            </div>
            <div className="grade-sheet-field">
              <strong>Section:</strong>
              <span>{displayValue(section?.section_no)}</span>
            </div>
          </div>
        </section>

        <div className="grade-sheet-workspace">
          <section className="grade-sheet-periods">
            <p className="grade-sheet-section-label">Period dates</p>
            <p className="grade-sheet-help">
              Records and attendance are assigned to a period using these dates.
            </p>
            <div className="grade-sheet-table-scroll">
              <table className="grade-sheet-table grade-sheet-period-table">
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

          <section className="grade-sheet-distribution">
            <p className="grade-sheet-section-label grade-sheet-distribution-heading">
              Percentage distribution per score entry
            </p>
            <div className="grade-sheet-distribution-grid">
              {distributionPeriods.map((period) => (
                <div className="grade-sheet-distribution-card" key={period.key}>
                  <div className="grade-sheet-distribution-title">{period.label}</div>
                  {distributionRows.map(([label, key]) => (
                    <label className="grade-sheet-distribution-row" key={label}>
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
                  <div className="grade-sheet-distribution-total">
                    <span>Total</span>
                    <strong>{weightTotal(weightSettings[period.key])}</strong>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
      <p className="grade-sheet-footer-help">
        Changes are used immediately by grade calculation and are written to the Excel grade sheet during synchronization.
      </p>
      {message.text && (
        <p className={`record-save-message ${message.status}`} role="status">
          {message.text}
        </p>
      )}
      <div className="action-modal-footer">
        <button className="outline-button" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="primary-button" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </ModalShell>
  );
}