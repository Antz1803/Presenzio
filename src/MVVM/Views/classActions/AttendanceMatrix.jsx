import { useState } from "react";
import {
  isDateInPeriodRange,
  formatDisplayDate,
  gradePeriods,
} from "./actionUtils";

const symbols = { present: "1", absent: "A" };
const statusLabels = {
  present: "Present",
  absent: "Absent",
};

const copyStatuses = (sessions) =>
  Object.fromEntries(
    sessions.map((session) => [session.id, { ...(session.statuses ?? {}) }]),
  );

const statusesMatch = (first = {}, second = {}) => {
  const keys = new Set([...Object.keys(first), ...Object.keys(second)]);
  return [...keys].every((key) => first[key] === second[key]);
};
export function AttendanceMatrix({
  students,
  attendanceSessions,
  gradingPeriods,
  onSave,
}) {
  const [period, setPeriod] = useState("prelim");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [draftStatuses, setDraftStatuses] = useState(() =>
    copyStatuses(attendanceSessions),
  );
  const selected = gradingPeriods.find((item) => item.code === period);
  const dates = {
    start: selected?.start_date ?? "",
    end: selected?.end_date ?? "",
  };
  const sessions = attendanceSessions.filter((session) =>
    isDateInPeriodRange(session.sessionDate, dates),
  );
  const copy = (value) => navigator.clipboard?.writeText(value);

  const toggleEditing = async () => {
    if (!editing) {
      setDraftStatuses(copyStatuses(attendanceSessions));
      setSaveError("");
      setEditing(true);
      return;
    }

    setSaving(true);
    setSaveError("");
    try {
      const changedSessions = attendanceSessions.filter(
        (session) =>
          !statusesMatch(session.statuses, draftStatuses[session.id]),
      );
      for (const session of changedSessions) {
        await onSave?.(
          {
            date: session.sessionDate || session.date,
            sessionTime: session.sessionTime,
            statuses: draftStatuses[session.id],
          },
          { keepOpen: true },
        );
      }
      setEditing(false);
    } catch (error) {
      setSaveError(
        error?.message || "The attendance changes could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = (sessionId, studentId, status) => {
    setDraftStatuses((current) => ({
      ...current,
      [sessionId]: {
        ...(current[sessionId] ?? {}),
        [studentId]: status,
      },
    }));
  };
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3 mb-4 py-[7px] px-[9px] border border-white/10 rounded-xl bg-surface-2 max-[760px]:items-stretch max-[760px]:flex-col max-[760px]:[&_.h-saved-indicator]:self-end h-record-summary-toolbar mb-4">
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
        <div className="flex items-center gap-3 h-attendance-list-actions">
          <span className="text-accent text-[9px] font-semibold whitespace-nowrap py-[7px] px-2.5 border border-white/10 rounded-lg bg-surface-1 max-[760px]:self-end">
            {dates.start && dates.end
              ? `${formatDisplayDate(dates.start)} – ${formatDisplayDate(dates.end)}`
              : "No date range set"}
          </span>
          <button
            className={editing ? "inline-flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-canvas transition hover:shadow-halo active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50" : "inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"}
            type="button"
            onClick={toggleEditing}
            disabled={saving}
          >
            {saving ? "Saving…" : editing ? "Read-only" : "Edit"}
          </button>
        </div>
      </div>
      {saveError && <p className="mt-[-5px] mx-0 mb-3 text-rose-300 text-[10px]">{saveError}</p>}
      {dates.start && dates.end ? (
        <div className="overflow-x-auto [&_table]:[border-collapse:collapse] [&_table]:w-full [&_table]:min-w-[660px] [&_table]:text-left [&_th]:text-ink-3 [&_th]:bg-surface-2 [&_th]:text-[9px] [&_th]:font-semibold [&_th]:tracking-[.6px] [&_th]:py-[11px] [&_th]:px-5 [&_th]:border-b [&_th]:border-white/10 [&_th]:border-b-white/10 [&_td]:text-ink-2 [&_td]:text-[10px] [&_td]:py-3.5 [&_td]:px-5 [&_td]:border-b [&_td]:border-white/10 [&_td]:whitespace-nowrap [&_td]:border-b-white/10 [&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:hover]:bg-surface-1 [.h-action-modal_&_th]:bg-surface-2 [.h-action-modal_&_th]:text-ink-3 [.h-action-modal_&_th]:border-b-white/10 [.h-action-modal_&_th]:text-[9px] [.h-action-modal_&_th]:tracking-[.8px] [.h-action-modal_&_td]:text-ink-2 [.h-action-modal_&_td]:border-b-white/10 [.h-action-modal_&_tbody_tr:nth-child(even)]:bg-surface-1 [.h-action-modal_&_tbody_tr:hover]:bg-surface-2 max-h-[none] overflow-x-auto [overflow-y:hidden] border border-white/10 rounded-[9px] [box-shadow:0_6px_18px_rgba(0,240,255,0.03)] [&_table]:min-w-[760px] [&_th]:py-3.5 [&_th]:px-3 [&_th]:bg-surface-2 [&_th]:text-ink-2 [&_th]:text-center [&_th]:[vertical-align:middle] [&_th]:border-b [&_th]:border-white/10 [&_th:first-child]:bg-surface-2 [&_th:first-child]:text-left [&_th:first-child]:text-ink-2 [&_th:first-child]:border-b [&_th:first-child]:border-white/10 [&_th>span]:block [&_th>span]:text-ink-3 [&_th>span]:text-[11px] [&_th>span]:tracking-[.3px] [&_td]:py-3.5 [&_td]:px-3 [&_td]:border-white/10 [&_td]:text-ink-2 [&_td]:text-center [&_td]:text-[12px] [&_td]:font-bold [&_td]:bg-surface-1 [&_tbody_tr:nth-child(even)]:bg-surface-1 [&_tbody_tr:hover]:bg-surface-2 max-[760px]:[&_table]:min-w-[680px] max-[760px]:[&_th]:py-[11px] max-[760px]:[&_th]:px-[9px] max-[760px]:[&_td]:py-[11px] max-[760px]:[&_td]:px-[9px] [&_tbody_tr:nth-child(even)_td]:bg-surface-1 h-attendance-matrix-table">
          <table>
            <thead>
              <tr>
                <th className="min-w-[235px] max-[760px]:min-w-[190px]">
                  <span>STUDENT NAME</span>
                  <button
                    className="inline-flex items-center justify-center rounded border border-accent-2/40 bg-accent-2/20 text-accent-4 py-[9px] px-[11px] text-[10px] font-bold cursor-pointer hover:bg-accent-2/30 [.h-attendance-matrix-table_td_&]:py-[5px] [.h-attendance-matrix-table_td_&]:px-[7px] [.h-attendance-matrix-table_td_&]:text-[8px] [.h-attendance-matrix-table_td_&]:transition [.h-attendance-matrix-table_td_&]:[box-shadow:0_4px_9px_rgba(0,0,0,0.29)] [.h-attendance-matrix-table_th_&]:transition [.h-attendance-matrix-table_th_&]:[box-shadow:0_4px_9px_rgba(0,0,0,0.29)] [.h-attendance-matrix-table_td_&:hover]:[transform:translateY(-1px)] [.h-attendance-matrix-table_td_&:hover]:[box-shadow:0_6px_13px_rgba(0,0,0,0.45)] [.h-attendance-matrix-table_th_&:hover]:[transform:translateY(-1px)] [.h-attendance-matrix-table_th_&:hover]:[box-shadow:0_6px_13px_rgba(0,0,0,0.45)]"
                    onClick={() =>
                      copy(students.map((student) => student.name).join("\n"))
                    }
                  >
                    Copy
                  </button>
                </th>
                {sessions.map((session) => (
                  <th key={session.id}>
                    <span>
                      {formatDisplayDate(session.sessionDate || session.date)}
                    </span>
                    <button
                      className="inline-flex items-center justify-center rounded border border-accent-2/40 bg-accent-2/20 text-accent-4 py-[9px] px-[11px] text-[10px] font-bold cursor-pointer hover:bg-accent-2/30 [.h-attendance-matrix-table_td_&]:py-[5px] [.h-attendance-matrix-table_td_&]:px-[7px] [.h-attendance-matrix-table_td_&]:text-[8px] [.h-attendance-matrix-table_td_&]:transition [.h-attendance-matrix-table_td_&]:[box-shadow:0_4px_9px_rgba(0,0,0,0.29)] [.h-attendance-matrix-table_th_&]:transition [.h-attendance-matrix-table_th_&]:[box-shadow:0_4px_9px_rgba(0,0,0,0.29)] [.h-attendance-matrix-table_td_&:hover]:[transform:translateY(-1px)] [.h-attendance-matrix-table_td_&:hover]:[box-shadow:0_6px_13px_rgba(0,0,0,0.45)] [.h-attendance-matrix-table_th_&:hover]:[transform:translateY(-1px)] [.h-attendance-matrix-table_th_&:hover]:[box-shadow:0_6px_13px_rgba(0,0,0,0.45)]"
                      onClick={() =>
                        copy(
                          students
                            .map(
                              (student) =>
                                symbols[session.statuses[student.id]] ?? "—",
                            )
                            .join("\n"),
                        )
                      }
                    >
                      Copy
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td className="flex items-center justify-between gap-2.5 text-left! text-ink-2! whitespace-nowrap">
                    <span>{student.name}</span>
                    <button
                      className="inline-flex items-center justify-center rounded border border-accent-2/40 bg-accent-2/20 text-accent-4 py-[9px] px-[11px] text-[10px] font-bold cursor-pointer hover:bg-accent-2/30 [.h-attendance-matrix-table_td_&]:py-[5px] [.h-attendance-matrix-table_td_&]:px-[7px] [.h-attendance-matrix-table_td_&]:text-[8px] [.h-attendance-matrix-table_td_&]:transition [.h-attendance-matrix-table_td_&]:[box-shadow:0_4px_9px_rgba(0,0,0,0.29)] [.h-attendance-matrix-table_th_&]:transition [.h-attendance-matrix-table_th_&]:[box-shadow:0_4px_9px_rgba(0,0,0,0.29)] [.h-attendance-matrix-table_td_&:hover]:[transform:translateY(-1px)] [.h-attendance-matrix-table_td_&:hover]:[box-shadow:0_6px_13px_rgba(0,0,0,0.45)] [.h-attendance-matrix-table_th_&:hover]:[transform:translateY(-1px)] [.h-attendance-matrix-table_th_&:hover]:[box-shadow:0_6px_13px_rgba(0,0,0,0.45)]"
                      onClick={() => copy(student.name)}
                    >
                      Copy
                    </button>
                  </td>
                  {sessions.map((session) => (
                    <td key={session.id}>
                      {editing ? (
                        <select
                          className="min-w-[68px] border border-white/10 rounded-[5px] bg-surface-1 text-ink-2 py-[5px] px-1 text-[10px] outline-none focus:border-accent/30 focus:[box-shadow:0_0_0_2px_#162032]"
                          aria-label={`${student.name} attendance on ${formatDisplayDate(session.sessionDate || session.date)}`}
                          value={draftStatuses[session.id]?.[student.id] ?? "present"}
                          onChange={(event) =>
                            updateStatus(
                              session.id,
                              student.id,
                              event.target.value,
                            )
                          }
                        >
                          {Object.entries(statusLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        symbols[session.statuses[student.id]] ?? "—"
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!students.length && (
            <div className="py-8 text-center text-xs text-ink-3">
              No students are enrolled in this class.
            </div>
          )}
          {!sessions.length && students.length > 0 && (
            <div className="py-8 text-center text-xs text-ink-3">
              No attendance dates in this period.
            </div>
          )}
        </div>
      ) : (
        <div className="py-8 text-center text-xs text-ink-3 py-10.5 px-5 border border-dashed border-accent/30 rounded-[13px] bg-surface-2 text-accent text-[11px]">
          Please set dates for{" "}
          {gradePeriods.find((item) => item.key === period)?.label} in Grade
          Sheet Settings.
        </div>
      )}
    </div>
  );
}
