import React, { lazy, Suspense } from "react";
import { useState as a, useMemo as B } from "react";
import { useDashboardViewModel as F } from "../ViewModels/useDashboardViewModel";
import { navItems as J } from "../Models/dashboardModel";
const Q = lazy(() => import("./ClassActionModal"));
const X = lazy(() => import("./ClassesView"));
const Y = lazy(() => import("./OverviewView"));
const Z = lazy(() => import("./ReportsView"));
const ee = lazy(() => import("./PrintReportModal"));
import { Avatar as D, Icon as G } from "./DashboardShared";
import {
  ClassOptionsModal as se,
  DeleteClassModal as te,
  LiveClock as ne,
  StudentModal as oe,
} from "./DashboardOverlays";
import ae from "../../assets/Logo.png";
import "../../App.css";
import { useAuth as ie } from "../../auth/useAuth";
import re from "../../auth/ProfileDetailsModal";
import { getStoredInstructorAvatar as le } from "../../auth/profileStorage";
export default function ce() {
  const e = F(),
    { user: n, logout: T, updateInstructorProfile: I } = ie(),
    k = B(() => {
      const s = n?.user_metadata?.instructor_profile || {},
        t =
          s.name ||
          n?.user_metadata?.full_name ||
          n?.email?.split("@")[0] ||
          "Teacher";
      return {
        name: t,
        position: s.position || "Instructor",
        gmail: s.gmail || n?.email || "",
        facebook: s.facebook || "",
        courses: Array.isArray(s.courses) ? s.courses : [],
        initials:
          s.initials ||
          t
            .split(/\s+/)
            .map((q) => q[0])
            .join("")
            .slice(0, 2)
            .toUpperCase(),
        color: s.color || "bg-gradient-to-br from-indigo-500 to-violet-600",
        avatarUrl: le(n?.id),
      };
    }, [n]),
    [R, f] = a(null),
    [p, g] = a(null),
    [l, b] = a(null),
    [r, A] = a(null),
    [d, u] = a(null),
    [U, v] = a(""),
    [C, y] = a(!1),
    [L, h] = a(!1),
    i = e.sections.find((s) => s.id === e.section?.id) ?? e.section,
    S = e.sections.find((s) => s.id === R),
    _ = e.sections.find((s) => s.id === p),
    w = e.sections.find((s) => s.id === l?.sectionId),
    o = i?.id === l?.sectionId,
    N = e.sections.find((s) => s.id === r?.sectionId),
    V = i?.id === r?.sectionId,
    m = (s) => e.selectSection(s),
    M = (s) => {
      (m(s), f(s));
    },
    P = (s, t = i?.id) => {
      (t && m(t), b({ type: s, sectionId: t }));
    },
    E = (s, t = i?.id) => {
      (t && m(t), A({ type: s, sectionId: t }));
    },
    z = (s) =>
      window.open(
        `${window.location.origin}/?view=student&section=${encodeURIComponent(s)}`,
        "_blank",
        "noopener,noreferrer",
      ),
    $ = async () => {
      if (d) {
        (y(!0), v(""));
        try {
          (await e.deleteSection(d.id), u(null));
        } catch (s) {
          v(s.message || "The class could not be deleted.");
        } finally {
          y(!1);
        }
      }
    },
    c = () => b(null),
    j = () => A(null),
    O = n?.user_metadata?.full_name || n?.email?.split("@")[0] || "Teacher",
    x = O.split(/\s+/)
      .map((s) => s[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    W = async () => {
      try {
        await T();
      } catch (s) {
        window.alert(s?.message || "Could not log out.");
      }
    },
    H =
      e.active === "classes"
        ? React.createElement(X, {
            sections: e.sections,
            section: i,
            importMasterList: e.importMasterList,
            importGradeSheet: e.importGradeSheet,
            importState: e.importState,
            gradeSheetImportState: e.gradeSheetImportState,
            connectionStatus: e.connectionStatus,
            connectionMessage: e.connectionMessage,
            pendingSyncCount: e.pendingSyncCount,
            onOpenStudents: (s) => {
              (g(s), m(s));
            },
            onOpenClassOptions: M,
            onDeleteClass: (s) => {
              (v(""), u(s));
            },
            onUpdateClass: e.updateSection,
          })
        : e.active === "reports"
          ? React.createElement(Z, null)
          : React.createElement(Y, {
              setActive: e.setActive,
              instructor: k,
              onUpdateInstructor: I,
              students: e.students,
              stats: e.stats,
              sections: e.sections,
              onOpenClassOptions: M,
              onOpenAction: P,
            }),
    K = {
      type: l?.type,
      section: w,
      students: o ? e.students : [],
      assessmentScores: o ? e.assessmentScores : [],
      assessmentDefinitions: o ? e.assessmentDefinitions : [],
      studentGroups: o ? e.studentGroups : [],
      sessions: o ? e.sessions : [],
      attendanceSessions: o ? e.attendanceSessions : [],
      gradingPeriods: o ? e.gradingPeriods : [],
      stats: o
        ? e.stats
        : {
            sessionsHeld: 0,
            monthAttendance: "\u2014",
            classAverage: "\u2014",
            passingRate: "\u2014",
            excellentCount: 0,
            needsReviewCount: 0,
          },
      loading: !o,
      onClose: c,
      onSaveAttendance: async (s) => {
        (await e.saveAttendance(s), c());
      },
      onDeleteAttendance: async (s) => {
        await e.deleteAttendance(s);
      },
      onSaveAssessmentScores: async (s) => {
        (await e.saveAssessmentScores(s), c());
      },
      onAutoSaveAssessmentScores: e.saveAssessmentScores,
      onSaveAssessment: e.saveAssessment,
      onUpdateAssessment: e.updateAssessment,
      onGrantAssessmentAttempt: e.grantAssessmentAttempt,
      onDeleteAssessment: e.deleteAssessment,
      onSubmitAssessment: e.submitAssessment,
      onSaveGradingPeriods: async (s) => {
        (await e.saveGradingPeriods(s), c());
      },
      onAddStudent: async (s) => {
        (await e.addStudent(s), c());
      },
      onRefreshGrades: e.refreshGrades,
      onSaveStudentGroup: e.saveStudentGroup,
      onDeleteStudentGroup: e.deleteStudentGroup,
    };
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "div",
      { className: "app-shell" },
      React.createElement(
        "aside",
        {
          className: `sidebar print:hidden ${e.mobileNav ? "sidebar-open" : ""}`,
        },
        React.createElement(
          "div",
          { className: "brand" },
          React.createElement("img", {
            className: "brand-logo",
            src: ae,
            alt: "Presenzio",
          }),
        ),
        React.createElement(
          "div",
          { className: "sidebar-section" },
          React.createElement("p", { className: "nav-label" }, "WORKSPACE"),
          React.createElement(
            "nav",
            { "aria-label": "Workspace navigation" },
            J.map((s) =>
              React.createElement(
                "button",
                {
                  className: `nav-item ${e.active === s.id ? "active" : ""}`,
                  key: s.id,
                  onClick: () => {
                    (e.setActive(s.id), e.setMobileNav(!1));
                  },
                },
                React.createElement(G, { name: s.icon, size: 18 }),
                React.createElement("span", null, s.label),
              ),
            ),
          ),
        ),
        React.createElement(
          "div",
          { className: "sidebar-bottom" },
          React.createElement(
            "button",
            { className: "nav-item", type: "button", onClick: () => h(!0) },
            React.createElement(G, { name: "settings", size: 18 }),
            React.createElement("span", null, "Settings"),
          ),
          React.createElement(
            "div",
            { className: "profile" },
            React.createElement(D, {
              initials: x || "T",
              color: "blue",
              small: !0,
            }),
            React.createElement(
              "span",
              null,
              React.createElement("b", null, O),
              React.createElement("small", null, n?.email || "Teacher account"),
            ),
            React.createElement(
              "button",
              {
                className:
                  "ml-auto text-xs font-semibold text-slate-400 transition hover:text-rose-500",
                type: "button",
                onClick: W,
              },
              "Log out",
            ),
          ),
        ),
      ),
      React.createElement(
        "main",
        { className: "main-content print:hidden" },
        React.createElement(
          "header",
          { className: "topbar" },
          React.createElement(
            "button",
            {
              className: "mobile-menu",
              onClick: () => e.setMobileNav(!e.mobileNav),
              "aria-label": "Toggle navigation",
            },
            React.createElement("span", null),
            React.createElement("span", null),
            React.createElement("span", null),
          ),
          React.createElement("div", { className: "space" }),
          React.createElement(
            "div",
            { className: "topbar-actions flex items-center gap-3" },
            React.createElement(ne, null),
            React.createElement(D, {
              initials: x || "T",
              color: "blue",
              small: !0,
            }),
          ),
        ),
        React.createElement(
          "div",
          { className: "content-wrap" },
          React.createElement(
            Suspense,
            {
              fallback: React.createElement(
                "div",
                { className: "p-6 text-sm text-slate-400" },
                "Loading\u2026",
              ),
            },
            H,
          ),
        ),
      ),
      S &&
        !l &&
        !r &&
        React.createElement(se, {
          section: S,
          onClose: () => f(null),
          onOpenAction: P,
          onOpenPrint: E,
          onOpenStudentView: z,
          onSyncToExcel: e.syncToExcel,
          syncReady: i?.id === S.id,
        }),
      p &&
        React.createElement(oe, {
          section: _,
          sections: e.sections,
          students: i?.id === p ? e.students : [],
          onUpdateStudent: e.updateStudent,
          onTransferStudent: e.transferStudent,
          onLoadTransferPreview: e.loadTransferPreview,
          onClose: () => g(null),
        }),
      d &&
        React.createElement(te, {
          section: d,
          deleting: C,
          error: U,
          onClose: () => !C && u(null),
          onConfirm: $,
        }),
      l &&
        w &&
        !r &&
        React.createElement(
          Suspense,
          {
            fallback: React.createElement(
              "div",
              {
                className:
                  "fixed inset-0 z-50 flex items-center justify-center bg-slate-50 print:hidden",
              },
              React.createElement(
                "p",
                { className: "text-sm text-slate-500" },
                "Loading\u2026",
              ),
            ),
          },
          React.createElement(Q, { ...K }),
        ),
      r &&
        N &&
        (V
          ? React.createElement(
              Suspense,
              {
                fallback: React.createElement(
                  "div",
                  {
                    className:
                      "fixed inset-0 z-50 flex items-center justify-center bg-slate-50 print:hidden",
                  },
                  React.createElement(
                    "p",
                    { className: "text-sm text-slate-500" },
                    "Loading\u2026",
                  ),
                ),
              },
              React.createElement(ee, {
                type: r.type,
                section: N,
                students: e.students,
                assessmentScores: e.assessmentScores,
                attendanceSessions: e.attendanceSessions,
                gradingPeriods: e.gradingPeriods,
                onClose: j,
              }),
            )
          : React.createElement(
              "div",
              {
                className:
                  "fixed inset-0 z-50 flex items-center justify-center bg-slate-50 print:hidden",
              },
              React.createElement(
                "p",
                { className: "text-sm text-slate-500" },
                "Loading class data\u2026",
              ),
            )),
      L && React.createElement(re, { onClose: () => h(!1) }),
    ),
  );
}