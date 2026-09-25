import { useState } from "react";
import { gradePeriods } from "./actionUtils";
import { ModalShell } from "./ActionModalShell";
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

export function GradeSettings({ gradingPeriods, section, onSave, onClose }) {
  const [dateRanges, setDateRanges] = useState(() =>
    initialRanges(gradingPeriods),
  );
  const [weightSettings, setWeightSettings] = useState(() =>
    initialWeights(gradingPeriods),
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
    const invalidWeights = gradePeriods.find((period) => {
      const values = weightSettings[period.key];
      const total = distributionRows.reduce(
        (sum, [, key]) => sum + Number(values?.[key]),
        0,
      );
      return (
        distributionRows.some(([, key]) => {
          const value = Number(values?.[key]);
          return !Number.isFinite(value) || value < 0 || value > 100;
        }) || Math.abs(total - 100) > 0.0001
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
      await onSave({ dateRanges, weightSettings });
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
    >
      <div className="period-settings-list">
        <p className="action-help">
          Set the date range for each grading period. Record Summary only
          includes records within the selected range.
        </p>
        {gradePeriods.map((item) => (
          <div className="period-settings-row" key={item.key}>
            <strong>{item.label}</strong>
            <label>
              Start date
              <input
                type="date"
                value={dateRanges[item.key].start}
                onChange={(e) => updateDate(item.key, "start", e.target.value)}
                disabled={saving}
              />
            </label>
            <label>
              End date
              <input
                type="date"
                value={dateRanges[item.key].end}
                onChange={(e) => updateDate(item.key, "end", e.target.value)}
                disabled={saving}
              />
            </label>
          </div>
        ))}
      </div>
      <section className="grade-distribution-settings">
        <h3>Percentage Distribution per Score Entry</h3>
        <div className="grade-distribution-grid">
          {gradePeriods.map((period) => (
            <div className="grade-distribution-card" key={period.key}>
              <div className="grade-distribution-title">{period.label}</div>
              {distributionRows.map(([label, key]) => (
                <div className="grade-distribution-row" key={label}>
                  <span>{label}</span>
                  <input
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
                </div>
              ))}
              <div className="grade-distribution-total">
                <span>Total</span>
                <strong>
                  {distributionRows.reduce(
                    (total, [, key]) =>
                      total + Number(weightSettings[period.key][key] || 0),
                    0,
                  )}
                </strong>
              </div>
            </div>
          ))}
        </div>
        <p className="action-help">
          These percentages are used by the system and are also written to the
          Excel grade sheet during synchronization.
        </p>
      </section>
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
