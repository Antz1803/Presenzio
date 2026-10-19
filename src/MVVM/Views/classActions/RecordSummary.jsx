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
      size="extraWide"
    >
      <div className="flex items-center justify-between gap-3 mb-4 py-[7px] px-[9px] border border-white/10 rounded-xl bg-surface-2 max-[760px]:items-stretch max-[760px]:flex-col max-[760px]:[&_.h-saved-indicator]:self-end h-record-summary-toolbar">
        <div className="flex gap-1 bg-surface-2 rounded-[7px] p-[3px] [&_button]:border-0 [&_button]:py-[7px] [&_button]:px-3 [&_button]:[background:none] [&_button]:rounded-[5px] [&_button]:text-ink-3 [&_button]:text-[10px] [&_button.h-active]:bg-surface-1 [&_button.h-active]:text-accent [&_button.h-active]:[box-shadow:0_2px_5px_rgba(0,0,0,0.13)] [&_button.h-active]:font-semibold [.h-record-summary-toolbar_&]:overflow-x-auto [.h-record-summary-toolbar_&]:bg-transparent [.h-record-summary-toolbar_&_button]:rounded-lg [.h-record-summary-toolbar_&_button]:transition [.h-record-summary-toolbar_&_button:hover]:text-accent [.h-record-summary-toolbar_&_button:hover]:bg-surface-2 [.h-record-summary-toolbar_&_button.h-active]:bg-surface-1 [.h-record-summary-toolbar_&_button.h-active]:[box-shadow:0_3px_9px_rgba(0,240,255,0.05)] [.h-record-summary-toolbar_&_button.h-active]:text-accent" role="tablist">
          {gradePeriods.map((item) => (
            <button
              key={item.key}
              className={period === item.key ? "h-active" : ""}
              onClick={() => setPeriod(item.key)}
              role="tab"
              aria-selected={period === item.key}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="text-accent text-[9px] font-semibold whitespace-nowrap py-[7px] px-2.5 border border-white/10 rounded-lg bg-surface-1 max-[760px]:self-end">
          {dates.start && dates.end
            ? `${formatDisplayDate(dates.start)} – ${formatDisplayDate(dates.end)}`
            : "No date range set"}
        </span>
      </div>
      {dates.start && dates.end ? (
        <div className="overflow-x-auto [&_table]:[border-collapse:collapse] [&_table]:w-full [&_table]:min-w-[660px] [&_table]:text-left [&_th]:text-ink-3 [&_th]:bg-surface-2 [&_th]:text-[9px] [&_th]:font-semibold [&_th]:tracking-[.6px] [&_th]:py-[11px] [&_th]:px-5 [&_th]:border-b [&_th]:border-white/10 [&_th]:border-b-white/10 [&_td]:text-ink-2 [&_td]:text-[10px] [&_td]:py-3.5 [&_td]:px-5 [&_td]:border-b [&_td]:border-white/10 [&_td]:whitespace-nowrap [&_td]:border-b-white/10 [&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:hover]:bg-surface-1 [.h-action-modal_&_th]:bg-surface-2 [.h-action-modal_&_th]:text-ink-3 [.h-action-modal_&_th]:border-b-white/10 [.h-action-modal_&_th]:text-[9px] [.h-action-modal_&_th]:tracking-[.8px] [.h-action-modal_&_td]:text-ink-2 [.h-action-modal_&_td]:border-b-white/10 [.h-action-modal_&_tbody_tr:nth-child(even)]:bg-surface-1 [.h-action-modal_&_tbody_tr:hover]:bg-surface-2 border border-white/10 rounded-[9px] [&_table]:min-w-[1160px] [&_th:not(:first-child)]:text-center [&_td:not(:first-child)]:text-center [&_td:not(:first-child)]:text-accent [&_td:not(:first-child)]:font-bold [&_td]:font-semibold [&_td]:text-ink-2 [&_td:first-child]:min-w-[220px] [&_td:first-child]:text-left [.h-action-modal_&]:border-white/10 [.h-action-modal_&]:rounded-xl [.h-action-modal_&]:[box-shadow:0_5px_15px_rgba(0,240,255,0.02)] [.h-action-modal_&_td:not(:first-child)]:text-accent! [&_thead_tr:first-child_th]:bg-surface-2 [&_thead_tr:first-child_th]:text-ink-2 [&_thead_tr:first-child_th]:text-[8px] [&_thead_tr:first-child_th]:tracking-[1px] [&_thead_tr:nth-child(2)_th]:text-ink-3 [&_thead_tr:nth-child(2)_th]:text-[8px] [&_th[rowspan='2']]:[vertical-align:middle] h-record-summary-table">
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
                    <div className="flex items-center gap-[9px] text-ink-2 font-semibold [.h-record-score-table_&>span:nth-child(2)]:min-w-0 [.h-record-score-table_&>span:nth-child(2)]:overflow-hidden [.h-record-score-table_&>span:nth-child(2)]:text-ellipsis [.h-grades-table_&]:gap-[9px] [.h-grades-table_&>span:last-child]:flex [.h-grades-table_&>span:last-child]:flex-col [.h-grades-table_&>span:last-child]:gap-[3px] [.h-grades-table_&_b]:text-ink-2 [.h-grades-table_&_b]:text-[10px] [.h-grades-table_&_small]:text-ink-3 [.h-grades-table_&_small]:text-[9px] [.h-record-summary-table_&]:gap-[9px] [.h-record-summary-table_&>span:last-child]:flex [.h-record-summary-table_&>span:last-child]:flex-col [.h-record-summary-table_&>span:last-child]:gap-[3px] [.h-record-summary-table_&_b]:text-ink-2 [.h-record-summary-table_&_b]:text-[10px] [.h-record-summary-table_&_small]:text-ink-3 [.h-record-summary-table_&_small]:text-[9px]">
                      <span className="grid place-items-center w-[28px] h-[28px] rounded-[9px] bg-surface-2 text-accent text-[9px] font-bold [.h-action-modal_&]:[box-shadow:0_0_0_3px_#162032]">{student.initials}</span>
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
            <div className="py-8 text-center text-xs text-ink-3">
              No students are enrolled in this class.
            </div>
          )}
        </div>
      ) : (
        <div className="py-8 text-center text-xs text-ink-3 py-10.5 px-5 border border-dashed border-accent/30 rounded-[13px] bg-surface-2 text-accent text-[11px]">
          Please set a start date and end date for{" "}
          {gradePeriods.find((item) => item.key === period)?.label} in Grade
          Sheet Settings.
        </div>
      )}
    </ModalShell>
  );
}
