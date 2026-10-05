import { useState } from "react";
import {
  getAssessmentItem,
  getAttendanceTotal,
  formatDisplayDate,
  gradePeriods,
  recordSummaryGroups,
} from "./actionUtils";
import { ModalShell } from "./ActionModalShell";

export function RecordSummary({
  students,
  assessmentScores,
  attendanceSessions,
  gradingPeriods,
  section,
  onClose,
}) {
  const [period, setPeriod] = useState("prelim");
  const selected = gradingPeriods.find((item) => item.code === period);
  const dates = {
    start: selected?.start_date ?? "",
    end: selected?.end_date ?? "",
  };
  const visibleSummaryGroups = recordSummaryGroups
    .map((group) => ({
      ...group,
      items: Array.from({ length: group.count }, (_, index) => index + 1).filter(
        (itemNo) =>
          assessmentScores.some(
            (record) =>
              record.period?.code === period &&
              record.category === group.key &&
              Number(record.item_no) === itemNo &&
              record.score !== null &&
              record.score !== undefined &&
              record.score !== "",
          ),
      ),
    }))
    .filter((group) => group.items.length > 0);
  return (
    <ModalShell
      title="Record Summary"
      section={section}
      onClose={onClose}
      size="wide"
    >
      <div className="record-summary-toolbar">
        <div className="period-pills" role="tablist">
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
          {dates.start && dates.end
            ? `${formatDisplayDate(dates.start)} – ${formatDisplayDate(dates.end)}`
            : "No date range set"}
        </span>
      </div>
      {dates.start && dates.end ? (
        <div className="table-wrap record-summary-table">
          <table>
            <thead>
              <tr>
                <th rowSpan="2">STUDENT NAME</th>
                {visibleSummaryGroups.map((group) => (
                  <th colSpan={group.items.length} key={group.key}>
                    {group.label}
                  </th>
                ))}
                <th rowSpan="2">TOTAL ATTENDANCE</th>
              </tr>
              <tr>
                {visibleSummaryGroups.flatMap((group) =>
                  group.items.map((itemNo) => (
                    <th key={`${group.key}-${itemNo}`}>
                      {group.prefix}
                      {itemNo}
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
                  {visibleSummaryGroups.flatMap((group) =>
                    group.items.map((itemNo) => (
                      <td key={`${group.key}-${itemNo}`}>
                        {getAssessmentItem(
                          student.id,
                          group.key,
                          itemNo,
                          period,
                          assessmentScores,
                        )}
                      </td>
                    )),
                  )}
                  <td>
                    {getAttendanceTotal(
                      student.id,
                      period,
                      attendanceSessions,
                      dates,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!students.length && (
            <div className="empty-state">
              No students are enrolled in this class.
            </div>
          )}
        </div>
      ) : (
        <div className="empty-state record-summary-date-empty">
          Please set a start date and end date for{" "}
          {gradePeriods.find((item) => item.key === period)?.label} in Grade
          Sheet Settings.
        </div>
      )}
    </ModalShell>
  );
}
