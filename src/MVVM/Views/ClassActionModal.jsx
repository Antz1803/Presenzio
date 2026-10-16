import React, { useEffect as V, useRef as W, useState } from "react";
import { ModalShell as r } from "./classActions/ActionModalShell";
import {
  AttendanceForm as y,
  AttendanceMatrix as L,
} from "./classActions/AttendanceActions";
import { ScoreForm as T } from "./classActions/ScoreActions";
import {
  AssessmentBuilder as C,
  AssessmentManager as D,
  StudentViewer as P,
} from "./classActions/AssessmentActions";
import { AddStudentForm as Q } from "./classActions/StudentActions";
import {
  GradeSettings as U,
  RecordSummary as q,
} from "./classActions/SummaryActions";
import {
  titles as s,
  gradePeriods as B,
  getGradeRemark as S,
  buildPeriodCopyText,
} from "./classActions/actionUtils";
import { GroupActivities as H } from "./classActions/GroupActions";
import { calculateGradesFromRecords } from "../ViewModels/gradeCalculation";

const escapeHtml = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export default function K({
  type: e,
  section: i,
  students: n,
  assessmentScores: o,
  assessmentDefinitions: l,
  studentGroups: p,
  sessions: c,
  attendanceSessions: d,
  gradingPeriods: m,
  stats: g,
  loading: N,
  onClose: t,
  onSaveAttendance: A,
  onDeleteAttendance: J,
  onSaveAssessmentScores: h,
  onAutoSaveAssessmentScores: M,
  onSaveAssessment: w,
  onUpdateAssessment: k,
  onGrantAssessmentAttempt: x,
  onDeleteAssessment: E,
  onSubmitAssessment: G,
  onSaveGradingPeriods: F,
  onAddStudent: z,
  onRefreshGrades: u,
  onRefreshLiveData: refreshLiveData,
  onSaveStudentGroup: I,
  onUpdateStudentGroup: updateStudentGroup,
  onDeleteStudentGroup: R,
  instructor: instructorProfile,
}) {
  const b = W(null);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const visibleGradePeriods = B.filter((period) => {
    const configured = m?.find((item) => item.code === period.key);
    return Boolean(
      configured?.start_date &&
        configured?.end_date &&
        configured.start_date <= today,
    );
  });
  const showRemarks = visibleGradePeriods.some((period) => period.key === "final");
  const showGradeStudents = calculateGradesFromRecords({
    students: n,
    assessmentScores: o,
    attendanceSessions: d,
    gradingPeriods: m,
  });

  const [copiedPeriod, setCopiedPeriod] = useState("");

  const copyPeriod = async (periodKey) => {
    const text = buildPeriodCopyText(showGradeStudents, periodKey);
    if (!text) return;

    const html =
  "<table>" +
  text
    .split("\n")
    .map((line) => {
      const [name, grade = ""] = line.split("\t");
      return `<tr style="height:15pt;mso-height-source:userset"><td style="white-space:nowrap">${escapeHtml(name)}</td><td style="white-space:nowrap;mso-number-format:'0\\.0'">${escapeHtml(grade)}</td></tr>`;
    })
    .join("") +
  "</table>";

    try {
      if (window.ClipboardItem && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopiedPeriod(periodKey);
    } catch {
      setCopiedPeriod(`${periodKey}:failed`);
    }
    setTimeout(() => setCopiedPeriod(""), 1800);
  };

  const renderShowGrades = () =>
    React.createElement(
      r,
      { title: s[e], section: i, onClose: t, size: "wide" },
      React.createElement(
        "div",
        { className: "overflow-x-auto [&_table]:[border-collapse:collapse] [&_table]:w-full [&_table]:min-w-[660px] [&_table]:text-left [&_th]:text-ink-3 [&_th]:bg-surface-2 [&_th]:text-[9px] [&_th]:font-semibold [&_th]:tracking-[.6px] [&_th]:py-[11px] [&_th]:px-5 [&_th]:border-b [&_th]:border-white/10 [&_th]:border-b-white/10 [&_td]:text-ink-2 [&_td]:text-[10px] [&_td]:py-3.5 [&_td]:px-5 [&_td]:border-b [&_td]:border-white/10 [&_td]:whitespace-nowrap [&_td]:border-b-white/10 [&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:hover]:bg-surface-1 [.h-action-modal_&_th]:bg-surface-2 [.h-action-modal_&_th]:text-ink-3 [.h-action-modal_&_th]:border-b-white/10 [.h-action-modal_&_th]:text-[9px] [.h-action-modal_&_th]:tracking-[.8px] [.h-action-modal_&_td]:text-ink-2 [.h-action-modal_&_td]:border-b-white/10 [.h-action-modal_&_tbody_tr:nth-child(even)]:bg-surface-1 [.h-action-modal_&_tbody_tr:hover]:bg-surface-2 border border-white/10 rounded-[9px] [&_table]:min-w-[760px] [&_th]:bg-surface-1 [&_td]:[vertical-align:middle] [&_td:first-child]:min-w-[220px] [&_th:not(:first-child)]:text-center [.h-action-modal_&]:border-white/10 [.h-action-modal_&]:rounded-xl [.h-action-modal_&]:[box-shadow:0_5px_15px_rgba(0,240,255,0.02)] h-grades-table" },
        React.createElement(
          "table",
          null,
          React.createElement(
            "thead",
            null,
            React.createElement(
              "tr",
              null,
              React.createElement("th", null, "STUDENT"),
              visibleGradePeriods.map((period) =>
                React.createElement(
                  "th",
                  { key: period.key },
                  React.createElement(
                    "div",
                    {
                      style: {
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                      },
                    },
                    React.createElement("span", null, period.label.toUpperCase()),
                    React.createElement(
                      "button",
                      {
                        type: "button",
                        className: "inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50",
                        style: {
                          padding: "2px 8px",
                          fontSize: 10,
                          textTransform: "none",
                          letterSpacing: 0,
                        },
                        title: `Copy names + ${period.label} grades`,
                        onClick: () => copyPeriod(period.key),
                      },
                      copiedPeriod === period.key
                        ? "Copied!"
                        : copiedPeriod === `${period.key}:failed`
                          ? "Copy failed"
                          : "Copy",
                    ),
                  ),
                ),
              ),
              showRemarks && React.createElement("th", null, "REMARKS"),
            ),
          ),
          React.createElement(
            "tbody",
            null,
            showGradeStudents.map((a) =>
              React.createElement(
                "tr",
                { key: a.id },
                React.createElement(
                  "td",
                  null,
                  React.createElement(
                    "div",
                    { className: "flex items-center gap-[9px] text-ink-2 font-semibold [.h-record-score-table_&>span:nth-child(2)]:min-w-0 [.h-record-score-table_&>span:nth-child(2)]:overflow-hidden [.h-record-score-table_&>span:nth-child(2)]:text-ellipsis [.h-grades-table_&]:gap-[9px] [.h-grades-table_&>span:last-child]:flex [.h-grades-table_&>span:last-child]:flex-col [.h-grades-table_&>span:last-child]:gap-[3px] [.h-grades-table_&_b]:text-ink-2 [.h-grades-table_&_b]:text-[10px] [.h-grades-table_&_small]:text-ink-3 [.h-grades-table_&_small]:text-[9px] [.h-record-summary-table_&]:gap-[9px] [.h-record-summary-table_&>span:last-child]:flex [.h-record-summary-table_&>span:last-child]:flex-col [.h-record-summary-table_&>span:last-child]:gap-[3px] [.h-record-summary-table_&_b]:text-ink-2 [.h-record-summary-table_&_b]:text-[10px] [.h-record-summary-table_&_small]:text-ink-3 [.h-record-summary-table_&_small]:text-[9px]" },
                    React.createElement(
                      "span",
                      { className: "grid place-items-center w-[28px] h-[28px] rounded-[9px] bg-surface-2 text-accent text-[9px] font-bold [.h-action-modal_&]:[box-shadow:0_0_0_3px_#162032]" },
                      a.initials,
                    ),
                    React.createElement(
                      "span",
                      null,
                      React.createElement("b", null, a.name),
                      React.createElement("small", null, a.number),
                    ),
                  ),
                ),
                visibleGradePeriods.map((v) => {
                  const f = a.grades?.[v.key];
                  const hasGrade =
                    f !== null &&
                    f !== undefined &&
                    f !== "" &&
                    Number.isFinite(Number(f));
                  return React.createElement(
                    "td",
                    { className: "text-accent! font-bold text-center [.h-action-modal_&]:text-accent!", key: v.key },
                    hasGrade ? Number(f).toFixed(1) : "—",
                  );
                }),
                showRemarks &&
                  React.createElement(
                    "td",
                    { className: `font-bold! text-center [&.h-passed]:text-emerald-400! [&.h-failed]:text-rose-300! ${S(a).toLowerCase()}` },
                    S(a),
                  ),
              ),
            ),
          ),
        ),
        !n.length &&
          React.createElement(
            "div",
            { className: "py-8 text-center text-xs text-ink-3" },
            "No students are enrolled in this class.",
          ),
      ),
    );

  return (
    V(() => {
      const a = b.current;
      b.current = e;
      e === "show-grades" && a !== e && u
        ? u().catch(() => {})
        : e === "record-score" && a !== e && refreshLiveData
          ? refreshLiveData(i?.id).catch(() => {})
          : null;
    }, [refreshLiveData, u, e, i?.id]),
    N
      ? React.createElement(
          r,
          { title: s[e], section: i, onClose: t },
          React.createElement("div", { className: "py-8 text-center text-xs text-ink-3" }, "Loading class data…"),
        )
      : e === "attendance"
        ? React.createElement(
            r,
            { title: s[e], section: i, onClose: t },
            React.createElement(y, {
              section: i,
              students: n,
              attendanceSessions: d,
              onSave: A,
              onDelete: J,
              onClose: t,
            }),
          )
        : e === "record-score"
          ? React.createElement(
              r,
              { title: s[e], section: i, onClose: t, size: "wide" },
              React.createElement(T, {
                students: n,
                assessmentScores: o,
                assessmentDefinitions: l,
                gradingPeriods: m,
                onSave: h,
                onAutoSave: M,
                onClose: t,
              }),
            )
          : e === "group-activities"
            ? React.createElement(H, {
                section: i,
                students: n,
                assessmentScores: o,
                savedGroups: p,
                onSaveGroup: I,
                onDeleteGroup: R,
                onUpdateGroup: updateStudentGroup,
                onSave: (payload) => h(payload, { keepOpen: true }),
                onClose: t,
              })
            : e === "create-assessment"
              ? React.createElement(C, {
                  section: i,
                  assessments: l,
                  onSave: w,
                  onClose: t,
                })
              : e === "manage-assessments"
                ? React.createElement(D, {
                    section: i,
                    assessments: l,
                    students: n,
                    onUpdate: k,
                    onDelete: E,
                    onGrantAttempt: x,
                    onClose: t,
                  })
                : e === "student-viewer"
                  ? React.createElement(P, {
                      section: i,
                      students: n,
                      assessments: l,
                      onSubmit: G,
                      onClose: t,
                    })
                  : e === "add-student"
                    ? React.createElement(
                        r,
                        { title: s[e], section: i, onClose: t },
                        React.createElement(Q, { onSave: z, onClose: t }),
                      )
                    : e === "attendance-list"
                      ? React.createElement(
                          r,
                          { title: s[e], section: i, onClose: t, size: "wide" },
                          React.createElement(L, {
                            students: n,
                            attendanceSessions: d,
                            gradingPeriods: m,
                            onSave: A,
                          }),
                        )
                      : e === "attendance-list-legacy"
                        ? React.createElement(
                            r,
                            { title: s[e], section: i, onClose: t },
                            React.createElement(
                              "div",
                              { className: "grid grid-cols-[repeat(2,1fr)] gap-2.5 [&.h-four]:grid-cols-[repeat(4,1fr)] [&_strong]:py-3.5 [&_strong]:px-2.5 [&_strong]:border [&_strong]:border-white/10 [&_strong]:rounded-[10px] [&_strong]:bg-surface-1 [&_strong]:text-accent [&_strong]:text-center [&_strong]:font-bold [&_strong]:text-[18px] [&_strong]:font-display [&_small]:block [&_small]:mt-[5px] [&_small]:text-ink-3 [&_small]:text-[9px] [&_small]:font-medium max-[760px]:[&.h-four]:grid-cols-[repeat(2,1fr)]" },
                              React.createElement(
                                "strong",
                                null,
                                g.sessionsHeld,
                                React.createElement("small", null, "Sessions held"),
                              ),
                              React.createElement(
                                "strong",
                                null,
                                g.monthAttendance,
                                React.createElement("small", null, "Average attendance"),
                              ),
                            ),
                            React.createElement(
                              "div",
                              { className: "mt-3.5 border border-white/10 rounded-[9px] overflow-hidden [&>div]:flex [&>div]:items-center [&>div]:gap-3 [&>div]:p-3 [&>div]:border-b [&>div]:border-white/10 [&>div:last-child]:border-b-0 [&_b]:flex-1 [&_b]:text-ink-2 [&_b]:text-[11px] [&_span]:text-ink-3 [&_span]:text-[10px] [&_em]:min-w-[70px] [&_em]:text-accent [&_em]:text-[10px] [&_em]:[font-style:normal] [&_em]:text-right [.h-action-modal_&]:border-white/10 [.h-action-modal_&]:rounded-xl [.h-action-modal_&]:[box-shadow:0_5px_15px_rgba(0,240,255,0.02)] [.h-action-modal_&>div]:py-[13px] [.h-action-modal_&>div]:px-3.5 [.h-action-modal_&>div]:border-white/10 [.h-action-modal_&>div:hover]:bg-surface-1" },
                              c.map((a) =>
                                React.createElement(
                                  "div",
                                  { key: a[0] },
                                  React.createElement("b", null, a[0]),
                                  React.createElement(
                                    "span",
                                    null,
                                    a[2],
                                    " present · ",
                                    a[3],
                                    " absent · ",
                                    a[4],
                                    " late",
                                  ),
                                  React.createElement("em", null, a[5]),
                                ),
                              ),
                            ),
                            !c.length &&
                              React.createElement(
                                "div",
                                { className: "py-8 text-center text-xs text-ink-3" },
                                "No attendance sessions yet.",
                              ),
                          )
                        : e === "show-grades"
                          ? renderShowGrades()
                          : e === "grade-summary"
                            ? React.createElement(q, {
                                students: n,
                                assessmentScores: o,
                                attendanceSessions: d,
                                gradingPeriods: m,
                                section: i,
                                onClose: t,
                              })
                            : e === "grade-settings"
                              ? React.createElement(U, {
                                  gradingPeriods: m,
                                  section: i,
                                  instructor: instructorProfile,
                                  onSave: F,
                                  onClose: t,
                                })
                              : React.createElement(
                                  r,
                                  { title: s[e], section: i, onClose: t },
                                  React.createElement(
                                    "div",
                                    { className: "grid grid-cols-[repeat(2,1fr)] gap-3 [&.h-single]:grid-cols-[1fr] [&_label]:flex [&_label]:flex-col [&_label]:gap-1.5 [&_label]:text-ink-2 [&_label]:text-[10px] [&_label]:font-semibold [&_input]:w-full [&_input]:box-border [&_input]:border [&_input]:border-white/10 [&_input]:rounded-[7px] [&_input]:bg-surface-1 [&_input]:text-ink-2 [&_input]:p-[9px] [&_input]:text-[11px] [&_input]:outline-none [&_select]:w-full [&_select]:box-border [&_select]:border [&_select]:border-white/10 [&_select]:rounded-[7px] [&_select]:bg-surface-1 [&_select]:text-ink-2 [&_select]:p-[9px] [&_select]:text-[11px] [&_select]:outline-none [&_input:focus]:border-accent/30 [&_input:focus]:[box-shadow:0_0_0_3px_#162032] [&_select:focus]:border-accent/30 [&_select:focus]:[box-shadow:0_0_0_3px_#162032] max-[760px]:grid-cols-[repeat(2,1fr)] [.h-action-modal_&_label]:text-ink-2 [.h-action-modal_&_label]:text-[10px] [.h-action-modal_&_label]:tracking-[.1px] [.h-action-modal_&_input]:border-white/10 [.h-action-modal_&_input]:rounded-[9px] [.h-action-modal_&_input]:bg-surface-1 [.h-action-modal_&_input]:[box-shadow:0_2px_5px_rgba(0,240,255,0.01)] [.h-action-modal_&_input]:transition [.h-action-modal_&_select]:border-white/10 [.h-action-modal_&_select]:rounded-[9px] [.h-action-modal_&_select]:bg-surface-1 [.h-action-modal_&_select]:[box-shadow:0_2px_5px_rgba(0,240,255,0.01)] [.h-action-modal_&_select]:transition [.h-action-modal_&_input:hover]:border-accent/30 [.h-action-modal_&_select:hover]:border-accent/30 [.h-action-modal_&_input:focus]:border-accent/30 [.h-action-modal_&_input:focus]:[box-shadow:0_0_0_3px_#162032] [.h-action-modal_&_select:focus]:border-accent/30 [.h-action-modal_&_select:focus]:[box-shadow:0_0_0_3px_#162032]" },
                                    [
                                      ["Quiz weight", "quizWeight", "20"],
                                      ["Assignment weight", "assignmentWeight", "10"],
                                      ["Activity weight", "activityWeight", "30"],
                                      ["Attendance weight", "attendanceWeight", "5"],
                                      ["Exam weight", "examWeight", "35"],
                                    ].map(([label, name, def]) =>
                                      React.createElement(
                                        "label",
                                        { key: name },
                                        label,
                                        React.createElement("input", {
                                          name,
                                          type: "number",
                                          defaultValue: def,
                                          min: "0",
                                          max: "100",
                                        }),
                                      ),
                                    ),
                                  ),
                                  React.createElement(
                                    "p",
                                    { className: "mt-[15px] mx-0 mb-0 text-ink-3 text-[10px] leading-[1.5] [.h-period-settings-list>&]:mt-0 [.h-period-settings-list>&]:mx-0 [.h-period-settings-list>&]:mb-1 [.h-period-settings-list>&]:py-[11px] [.h-period-settings-list>&]:px-[13px] [.h-period-settings-list>&]:border [.h-period-settings-list>&]:border-white/10 [.h-period-settings-list>&]:rounded-[9px] [.h-period-settings-list>&]:bg-surface-1 [.h-action-modal_&]:text-ink-3 [.h-action-modal_&]:leading-[1.65]" },
                                    "Workbook grading: Quiz 20%, Assignment 10%, Activity 30%, Attendance 5%, Exam 35%, with transmutation from 1.00 to 5.00.",
                                  ),
                                  React.createElement(
                                    "div",
                                    { className: "flex justify-end gap-2 mt-5.5 pt-[17px] border-t border-white/10 max-[760px]:flex-wrap max-[760px]:[&_button]:flex-1 [.h-assessment-builder_&]:mt-0.5" },
                                    React.createElement(
                                      "button",
                                      { className: "inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50", onClick: t },
                                      "Cancel",
                                    ),
                                    React.createElement(
                                      "button",
                                      { className: "inline-flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-canvas transition hover:shadow-halo active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50", onClick: t },
                                      "Save settings",
                                    ),
                                  ),
                                )
  );
}