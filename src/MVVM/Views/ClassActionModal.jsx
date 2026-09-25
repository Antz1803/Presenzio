import React, { useEffect as V, useRef as W } from "react";
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
} from "./classActions/actionUtils";
import { GroupActivities as H } from "./classActions/GroupActions";
export {
  gradePeriods,
  recordSummaryGroups,
  formatDisplayDate,
  getAssessmentItem,
  getAttendanceTotal,
  getGradeRemark,
} from "./classActions/actionUtils";
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
  onDeleteStudentGroup: R,
}) {
  const b = W(null);
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
          React.createElement(
            "div",
            { className: "empty-state" },
            "Loading class data…",
          ),
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
                onSave: h,
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
                          }),
                        )
                      : e === "attendance-list-legacy"
                        ? React.createElement(
                            r,
                            { title: s[e], section: i, onClose: t },
                            React.createElement(
                              "div",
                              { className: "action-summary-grid" },
                              React.createElement(
                                "strong",
                                null,
                                g.sessionsHeld,
                                React.createElement(
                                  "small",
                                  null,
                                  "Sessions held",
                                ),
                              ),
                              React.createElement(
                                "strong",
                                null,
                                g.monthAttendance,
                                React.createElement(
                                  "small",
                                  null,
                                  "Average attendance",
                                ),
                              ),
                            ),
                            React.createElement(
                              "div",
                              { className: "action-list" },
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
                                { className: "empty-state" },
                                "No attendance sessions yet.",
                              ),
                          )
                        : e === "show-grades"
                          ? React.createElement(
                              r,
                              {
                                title: s[e],
                                section: i,
                                onClose: t,
                                size: "wide",
                              },
                              React.createElement(
                                "div",
                                { className: "table-wrap grades-table" },
                                React.createElement(
                                  "table",
                                  null,
                                  React.createElement(
                                    "thead",
                                    null,
                                    React.createElement(
                                      "tr",
                                      null,
                                      React.createElement(
                                        "th",
                                        null,
                                        "STUDENT",
                                      ),
                                      React.createElement("th", null, "PRELIM"),
                                      React.createElement(
                                        "th",
                                        null,
                                        "MIDTERM",
                                      ),
                                      React.createElement(
                                        "th",
                                        null,
                                        "SEMI-FINAL",
                                      ),
                                      React.createElement("th", null, "FINAL"),
                                      React.createElement(
                                        "th",
                                        null,
                                        "REMARKS",
                                      ),
                                    ),
                                  ),
                                  React.createElement(
                                    "tbody",
                                    null,
                                    n.map((a) =>
                                      React.createElement(
                                        "tr",
                                        { key: a.id },
                                        React.createElement(
                                          "td",
                                          null,
                                          React.createElement(
                                            "div",
                                            { className: "table-student" },
                                            React.createElement(
                                              "span",
                                              { className: "record-avatar" },
                                              a.initials,
                                            ),
                                            React.createElement(
                                              "span",
                                              null,
                                              React.createElement(
                                                "b",
                                                null,
                                                a.name,
                                              ),
                                              React.createElement(
                                                "small",
                                                null,
                                                a.number,
                                              ),
                                            ),
                                          ),
                                        ),
                                        B.map((v) => {
                                          const f = a.grades?.[v.key];
                                          return React.createElement(
                                            "td",
                                            {
                                              className: "grade-period-cell",
                                              key: v.key,
                                            },
                                            Number.isFinite(Number(f))
                                              ? Number(f).toFixed(1)
                                              : "—",
                                          );
                                        }),
                                        React.createElement(
                                          "td",
                                          {
                                            className: `grade-remark ${S(a).toLowerCase()}`,
                                          },
                                          S(a),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                                !n.length &&
                                  React.createElement(
                                    "div",
                                    { className: "empty-state" },
                                    "No students are enrolled in this class.",
                                  ),
                              ),
                            )
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
                                  onSave: F,
                                  onClose: t,
                                })
                              : React.createElement(
                                  r,
                                  { title: s[e], section: i, onClose: t },
                                  React.createElement(
                                    "div",
                                    { className: "action-form-grid" },
                                    React.createElement(
                                      "label",
                                      null,
                                      "Quiz weight",
                                      React.createElement("input", {
                                        name: "quizWeight",
                                        type: "number",
                                        defaultValue: "20",
                                        min: "0",
                                        max: "100",
                                      }),
                                    ),
                                    React.createElement(
                                      "label",
                                      null,
                                      "Assignment weight",
                                      React.createElement("input", {
                                        name: "assignmentWeight",
                                        type: "number",
                                        defaultValue: "10",
                                        min: "0",
                                        max: "100",
                                      }),
                                    ),
                                    React.createElement(
                                      "label",
                                      null,
                                      "Activity weight",
                                      React.createElement("input", {
                                        name: "activityWeight",
                                        type: "number",
                                        defaultValue: "30",
                                        min: "0",
                                        max: "100",
                                      }),
                                    ),
                                    React.createElement(
                                      "label",
                                      null,
                                      "Attendance weight",
                                      React.createElement("input", {
                                        name: "attendanceWeight",
                                        type: "number",
                                        defaultValue: "5",
                                        min: "0",
                                        max: "100",
                                      }),
                                    ),
                                    React.createElement(
                                      "label",
                                      null,
                                      "Exam weight",
                                      React.createElement("input", {
                                        name: "examWeight",
                                        type: "number",
                                        defaultValue: "35",
                                        min: "0",
                                        max: "100",
                                      }),
                                    ),
                                  ),
                                  React.createElement(
                                    "p",
                                    { className: "action-help" },
                                    "Workbook grading: Quiz 20%, Assignment 10%, Activity 30%, Attendance 5%, Exam 35%, with transmutation from 1.00 to 5.00.",
                                  ),
                                  React.createElement(
                                    "div",
                                    { className: "action-modal-footer" },
                                    React.createElement(
                                      "button",
                                      {
                                        className: "outline-button",
                                        onClick: t,
                                      },
                                      "Cancel",
                                    ),
                                    React.createElement(
                                      "button",
                                      {
                                        className: "primary-button",
                                        onClick: t,
                                      },
                                      "Save settings",
                                    ),
                                  ),
                                )
  );
}
