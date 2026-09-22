import { useState } from "react";
import { gradePeriods } from "./actionUtils";
import { ModalShell } from "./ActionModalShell";

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

export function GradeSettings({ gradingPeriods, section, onSave, onClose }) {
  const [dateRanges, setDateRanges] = useState(() =>
    initialRanges(gradingPeriods),
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
    setSaving(true);
    setMessage({ status: "", text: "" });
    try {
      await onSave(dateRanges);
      setMessage({
        status: "success",
        text: "Period dates saved successfully.",
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
