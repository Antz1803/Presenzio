import { useState } from "react";
import { getAssessmentItem, getAttendanceTotal, formatDisplayDate, gradePeriods, recordSummaryGroups } from "./actionUtils";
import { ModalShell } from "./ActionModalShell";

function RecordSummary({
  students,
  assessmentScores,
  attendanceSessions,
  gradingPeriods,
  section,
  onClose,
}) {
  const [period, setPeriod] = useState("prelim");
  const selectedPeriod = gradingPeriods.find((item) => item.code === period);
  const periodDates = {
    start: selectedPeriod?.start_date ?? "",
    end: selectedPeriod?.end_date ?? "",
  };

  return (
    <ModalShell
      title="Record Summary"
      section={section}
      onClose={onClose}
      size="wide"
    >
      <div className="record-summary-toolbar">
        <div className="period-pills" role="tablist" aria-label="Grading period">
          {gradePeriods.map((item) => (
            <button
              key={item.key}
              className={period === item.key ? "active" : ""}
              onClick={() => setPeriod(item.key)}
              role="tab"
              aria-selected={period === item.key}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="record-period-range">
          {periodDates.start && periodDates.end
            ? `${formatDisplayDate(periodDates.start)} – ${formatDisplayDate(periodDates.end)}`
            : "No date range set"}
        </span>
      </div>
      {periodDates.start && periodDates.end ? (
        <div className="table-wrap record-summary-table">
          <table>
            <thead>
              <tr>
                <th rowSpan="2">STUDENT NAME</th>
                {recordSummaryGroups.map((group) => (
                  <th colSpan={group.count} key={group.key}>
                    {group.label}
                  </th>
                ))}
                <th rowSpan="2">TOTAL ATTENDANCE</th>
              </tr>
              <tr>
                {recordSummaryGroups.flatMap((group) =>
                  Array.from({ length: group.count }, (_, index) => (
                    <th key={`${group.key}-${index + 1}`}>
                      {group.prefix}{index + 1}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
            {students.map((student) => (
              <tr key={student.id}>
                <td>
                  <div className="table-student">
                    <span className="record-avatar">{student.initials}</span>
                    <span>
                      <b>{student.name}</b>
                      <small>{student.number}</small>
                    </span>
                  </div>
                </td>
                {recordSummaryGroups.flatMap((group) =>
                  Array.from({ length: group.count }, (_, index) => (
                    <td key={`${group.key}-${index + 1}`}>
                      {getAssessmentItem(
                        student.id,
                        group.key,
                        index + 1,
                        period,
                        assessmentScores,
                      )}
                    </td>
                  )),
                )}
                <td>{getAttendanceTotal(student.id, period, attendanceSessions, periodDates)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!students.length && (
          <div className="empty-state">No students are enrolled in this class.</div>
        )}
        </div>
      ) : (
        <div className="empty-state record-summary-date-empty">
          Please set a start date and end date for {gradePeriods.find((item) => item.key === period)?.label}
          in Grade Sheet Settings.
        </div>
      )}
    </ModalShell>
  );
}

function createDateRangeState(savedPeriods) {
  return Object.fromEntries(
    gradePeriods.map((item) => {
      const saved = savedPeriods.find((period) => period.code === item.key);
      return [
        item.key,
        {
          start: saved?.start_date ?? "",
          end: saved?.end_date ?? "",
        },
      ];
    }),
  );
}

function GradeSettings({ gradingPeriods, section, onSave, onClose }) {
  const [dateRanges, setDateRanges] = useState(() =>
    createDateRangeState(gradingPeriods),
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
    const invalidPeriod = gradePeriods.find(({ key }) => {
      const dates = dateRanges[key];
      return (
        Boolean(dates.start) !== Boolean(dates.end) ||
        (dates.start && dates.end && dates.start > dates.end)
      );
    });
    if (invalidPeriod) {
      setMessage({
        status: "error",
        text: `${invalidPeriod.label} needs a valid start and end date.`,
      });
      return;
    }

    setSaving(true);
    setMessage({ status: "", text: "" });
    try {
      await onSave(dateRanges);
      setMessage({ status: "success", text: "Period dates saved successfully." });
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
    <ModalShell title="Grade Sheet Settings" section={section} onClose={onClose}>
      <div className="period-settings-list">
        <p className="action-help">
          Set the date range for each grading period. Record Summary will only
          include scores and attendance recorded within the selected range.
        </p>
        {gradePeriods.map((item) => (
          <div className="period-settings-row" key={item.key}>
            <strong>{item.label}</strong>
            <label>
              Start date
              <input
                name={`${item.key}-startDate`}
                type="date"
                value={dateRanges[item.key].start}
                onChange={(event) => updateDate(item.key, "start", event.target.value)}
                disabled={saving}
              />
            </label>
            <label>
              End date
              <input
                name={`${item.key}-endDate`}
                type="date"
                value={dateRanges[item.key].end}
                onChange={(event) => updateDate(item.key, "end", event.target.value)}
                disabled={saving}
              />
            </label>
          </div>
        ))}
        <div className="action-form-grid period-weight-grid">
          <label>
            Quiz weight
            <input name="quizWeight" type="number" defaultValue="20" min="0" max="100" />
          </label>
          <label>
            Assignment weight
            <input name="assignmentWeight" type="number" defaultValue="10" min="0" max="100" />
          </label>
          <label>
            Activity weight
            <input name="activityWeight" type="number" defaultValue="30" min="0" max="100" />
          </label>
          <label>
            Attendance weight
            <input name="attendanceWeight" type="number" defaultValue="5" min="0" max="100" />
          </label>
          <label>
            Exam weight
            <input name="examWeight" type="number" defaultValue="35" min="0" max="100" />
          </label>
        </div>
        <p className="action-help">
          Workbook grading: Quiz 20%, Assignment 10%, Activity 30%, Attendance
          5%, Exam 35%, with transmutation from 1.00 to 5.00.
        </p>
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

export { RecordSummary, GradeSettings };
