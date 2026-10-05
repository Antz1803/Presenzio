import React, { useEffect as w, useMemo as k } from "react";
import { createPortal as S } from "react-dom";
import {
  gradePeriods as u,
  recordSummaryGroups as h,
  formatDisplayDate as f,
  getAssessmentItem as v,
  getAttendanceTotal as A,
  getGradeRemark as E,
} from "./ClassActionModal";
import M from "../../assets/Logo.png";
if (typeof document < "u" && !document.getElementById("print-page-style")) {
  const e = document.createElement("style");
  ((e.id = "print-page-style"),
    (e.textContent = `
    @page { margin: 10mm; }
    @media print {
      body > *:not(#print-report-portal) {
        display: none !important;
      }
    }
  `),
    document.head.appendChild(e));
}
const n =
    "border border-slate-300 bg-slate-100 px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-slate-600",
  b = "border border-slate-300 px-2 py-1.5 text-center text-xs text-slate-700",
  x =
    "border border-slate-300 px-2 py-1.5 text-left text-xs font-semibold text-slate-800";
function y(e) {
  return String(e ?? "").slice(0, 7);
}
function T(e) {
  const [a, r] = e.split("-").map(Number);
  return !a || !r
    ? e
    : new Date(a, r - 1, 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
}
function R(e, a, r) {
  const s = r.filter((i) => y(i.sessionDate) === a);
  return `${
    s.filter((i) => {
      const o = i.statuses[e];
      return o === "present" || o === "late";
    }).length
  }/${s.length}`;
}
function D({
  period: e,
  students: a,
  assessmentScores: r,
  attendanceSessions: s,
  gradingPeriods: m,
}) {
  const i = m.find((t) => t.code === e),
    o = { start: i?.start_date ?? "", end: i?.end_date ?? "" },
    c = u.find((t) => t.key === e)?.label ?? e;
  return !o.start || !o.end
    ? React.createElement(
        "p",
        { className: "py-12 text-center text-sm text-slate-500" },
        "No date range has been set for ",
        c,
        ". Set it in Grade Sheet Settings first.",
      )
    : React.createElement(
        "table",
        { className: "w-full border-collapse" },
        React.createElement(
          "thead",
          null,
          React.createElement(
            "tr",
            null,
            React.createElement(
              "th",
              { className: n, rowSpan: "2" },
              "STUDENT NAME",
            ),
            h.map((t) =>
              React.createElement(
                "th",
                { className: n, colSpan: t.count, key: t.key },
                t.label,
              ),
            ),
            React.createElement(
              "th",
              { className: n, rowSpan: "2" },
              "ATTENDANCE",
            ),
            React.createElement("th", { className: n, rowSpan: "2" }, "GRADE"),
          ),
          React.createElement(
            "tr",
            null,
            h.flatMap((t) =>
              Array.from({ length: t.count }, (d, l) =>
                React.createElement(
                  "th",
                  { className: n, key: `${t.key}-${l + 1}` },
                  t.prefix,
                  l + 1,
                ),
              ),
            ),
          ),
        ),
        React.createElement(
          "tbody",
          null,
          a.map((t) =>
            React.createElement(
              "tr",
              { className: "break-inside-avoid", key: t.id },
              React.createElement(
                "td",
                { className: x },
                t.name,
                React.createElement(
                  "span",
                  {
                    className:
                      "mt-0.5 block text-[10px] font-normal text-slate-500",
                  },
                  t.number,
                ),
              ),
              h.flatMap((d) =>
                Array.from({ length: d.count }, (l, p) =>
                  React.createElement(
                    "td",
                    { className: b, key: `${d.key}-${p + 1}` },
                    v(t.id, d.key, p + 1, e, r),
                  ),
                ),
              ),
              React.createElement("td", { className: b }, A(t.id, e, s, o)),
              React.createElement(
                "td",
                { className: b },
                Number.isFinite(Number(t.grades?.[e]))
                  ? Number(t.grades[e]).toFixed(1)
                  : "—",
              ),
            ),
          ),
        ),
      );
}
function P({ students: e }) {
  return React.createElement(
    "table",
    { className: "w-full border-collapse" },
    React.createElement(
      "thead",
      null,
      React.createElement(
        "tr",
        null,
        React.createElement("th", { className: n }, "STUDENT NAME"),
        React.createElement("th", { className: n }, "PRELIM"),
        React.createElement("th", { className: n }, "MIDTERM"),
        React.createElement("th", { className: n }, "SEMI-FINAL"),
        React.createElement("th", { className: n }, "FINAL"),
        React.createElement("th", { className: n }, "REMARKS"),
      ),
    ),
    React.createElement(
      "tbody",
      null,
      e.map((a) =>
        React.createElement(
          "tr",
          { className: "break-inside-avoid", key: a.id },
          React.createElement(
            "td",
            { className: x },
            a.name,
            React.createElement(
              "span",
              {
                className:
                  "mt-0.5 block text-[10px] font-normal text-slate-500",
              },
              a.number,
            ),
          ),
          u.map((r) => {
            const s = a.grades?.[r.key];
            return React.createElement(
              "td",
              { className: b, key: r.key },
              Number.isFinite(Number(s)) ? Number(s).toFixed(1) : "—",
            );
          }),
          React.createElement("td", { className: b }, E(a)),
        ),
      ),
    ),
  );
}
function G({ students: e, attendanceSessions: a }) {
  const r = [...new Set(a.map((s) => y(s.sessionDate)))].filter(Boolean).sort();
  return r.length
    ? React.createElement(
        "table",
        { className: "w-full border-collapse" },
        React.createElement(
          "thead",
          null,
          React.createElement(
            "tr",
            null,
            React.createElement("th", { className: n }, "STUDENT NAME"),
            r.map((s) =>
              React.createElement("th", { className: n, key: s }, T(s)),
            ),
          ),
        ),
        React.createElement(
          "tbody",
          null,
          e.map((s) =>
            React.createElement(
              "tr",
              { className: "break-inside-avoid", key: s.id },
              React.createElement(
                "td",
                { className: x },
                s.name,
                React.createElement(
                  "span",
                  {
                    className:
                      "mt-0.5 block text-[10px] font-normal text-slate-500",
                  },
                  s.number,
                ),
              ),
              r.map((m) =>
                React.createElement(
                  "td",
                  { className: b, key: m },
                  R(s.id, m, a),
                ),
              ),
            ),
          ),
        ),
      )
    : React.createElement(
        "p",
        { className: "py-12 text-center text-sm text-slate-500" },
        "No attendance sessions have been recorded yet.",
      );
}
const g = {
  prelim: "Prelim Grade Sheet",
  midterm: "Midterm Grade Sheet",
  semifinal: "Semi-Final Grade Sheet",
  final: "Final Grade Sheet",
  summary: "Grade Summary",
  "monthly-attendance": "Monthly Attendance Report",
};
export default function _({
  type: e,
  section: a,
  students: r,
  assessmentScores: s,
  attendanceSessions: m,
  gradingPeriods: i,
  onClose: o,
}) {
  const c = k(
    () =>
      [...r].sort((l, p) =>
        (l.name || "").localeCompare(p.name || "", void 0, {
          sensitivity: "base",
        }),
      ),
    [r],
  );
  w(() => {
    const l = document.title;
    document.title = "Smart Student Attendance Monitoring System";
    const p = setTimeout(() => window.print(), 200),
      N = () => {
        ((document.title = l), o());
      };
    return (
      window.addEventListener("afterprint", N),
      () => {
        (clearTimeout(p),
          (document.title = l),
          window.removeEventListener("afterprint", N));
      }
    );
  }, [o]);
  const t = ["prelim", "midterm", "semifinal", "final"].includes(e),
    d = t ? i.find((l) => l.code === e) : null;
  return S(
    React.createElement(
      "div",
      {
        id: "print-report-portal",
        className:
          "fixed inset-0 z-[999] overflow-y-auto bg-slate-50 print:static print:inset-auto print:z-auto print:overflow-visible print:bg-white",
      },
      React.createElement(
        "div",
        {
          className:
            "print:hidden sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4 shadow-sm",
        },
        React.createElement(
          "p",
          {
            className:
              "text-xs font-semibold uppercase tracking-wide text-slate-500",
          },
          g[e] ?? "Report",
          " preview",
        ),
        React.createElement(
          "div",
          { className: "flex gap-3" },
          React.createElement(
            "button",
            {
              className:
                "rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50",
              onClick: o,
            },
            "Close",
          ),
          React.createElement(
            "button",
            {
              className:
                "rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500",
              onClick: () => window.print(),
            },
            "Print",
          ),
        ),
      ),
      React.createElement(
        "div",
        {
          className:
            "mx-auto max-w-5xl bg-white p-8 print:max-w-none print:p-4",
        },
        React.createElement(
          "header",
          {
            className:
              "mb-6 flex items-center gap-4 border-b border-slate-200 pb-4 break-after-avoid",
          },
          React.createElement("img", {
            src: M,
            alt: "Presenzio",
            className: "h-25 w-25 shrink-0 object-contain",
          }),
          React.createElement(
            "div",
            { className: "flex-1 text-center" },
            React.createElement(
              "h1",
              { className: "text-lg font-extrabold text-slate-900" },
              a?.subject_code,
              " - ",
              a?.subject_title,
            ),
            React.createElement(
              "h2",
              { className: "mt-1 text-sm font-semibold text-indigo-600" },
              g[e] ?? "Report",
            ),
            React.createElement(
              "p",
              { className: "mt-1 text-xs text-slate-500" },
              a?.days || "—",
              " · ",
              a?.room ? `Room ${a.room}` : "Room not set",
            ),
            t &&
              d?.start_date &&
              d?.end_date &&
              React.createElement(
                "p",
                { className: "mt-0.5 text-xs text-slate-500" },
                f(d.start_date),
                " – ",
                f(d.end_date),
              ),
          ),
          React.createElement("div", {
            className: "h-14 w-14 shrink-0",
            "aria-hidden": "true",
          }),
        ),
        t &&
          React.createElement(D, {
            period: e,
            students: c,
            assessmentScores: s,
            attendanceSessions: m,
            gradingPeriods: i,
          }),
        e === "summary" && React.createElement(P, { students: c }),
        e === "monthly-attendance" &&
          React.createElement(G, { students: c, attendanceSessions: m }),
        !c.length &&
          React.createElement(
            "p",
            { className: "py-12 text-center text-sm text-slate-500" },
            "No students are enrolled in this class.",
          ),
      ),
    ),
    document.body,
  );
}
