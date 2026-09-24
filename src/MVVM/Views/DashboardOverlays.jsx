import React, { useEffect as xe, useMemo as G, useState as d } from "react";
import { Icon as be } from "./DashboardShared";
const fe = [
  ["prelim", "Print Prelim"],
  ["midterm", "Print Midterm"],
  ["semifinal", "Print Semi-Final"],
  ["final", "Print Final"],
  ["summary", "Print Summary"],
  ["monthly-attendance", "Print Monthly Attendance"],
];
function ge({
  section: t,
  onClose: s,
  onOpenAction: i,
  onOpenPrint: r,
  onOpenStudentView: c,
  onSyncToExcel: n,
  syncReady: m,
}) {
  const [l, b] = d(!1),
    g = async () => {
      b(!0);
      try {
        (await n(), s());
      } catch (u) {
        (console.error("Excel sync failed:", u),
          window.alert(u?.message || "Excel synchronization failed."));
      } finally {
        b(!1);
      }
    },
    v = [
      ["attendance", "Take Attendance"],
      ["attendance-list", "Attendance List"],
      ["create-assessment", "Create Assessment"],
      ["manage-assessments", "Manage Assessments"],
      ["record-score", "Record Score"],
      ["group-activities", "Group Activities"],
      ["show-grades", "Show Grades"],
      ["grade-summary", "Record Summary"],
      ["grade-settings", "Grade Sheet Settings"],
    ],
    f =
      "block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50";
  return React.createElement(
    "div",
    {
      className:
        "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm print:hidden",
      onMouseDown: (u) => u.target === u.currentTarget && !l && s(),
    },
    React.createElement(
      "section",
      {
        className:
          "max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl",
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "class-options-title",
      },
      React.createElement(
        "div",
        {
          className:
            "mb-5 flex items-center justify-between border-b border-slate-100 pb-4",
        },
        React.createElement(
          "h2",
          {
            id: "class-options-title",
            className:
              "text-sm font-extrabold uppercase tracking-wide text-slate-800",
          },
          "Class Options",
        ),
        React.createElement(
          "button",
          {
            className:
              "flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700",
            onClick: s,
            disabled: l,
            "aria-label": "Close class options",
          },
          "\xD7",
        ),
      ),
      React.createElement(
        "div",
        { className: "flex flex-col gap-2.5" },
        React.createElement(
          "div",
          { className: "mb-1 rounded-2xl bg-slate-50 p-3.5" },
          React.createElement(
            "h3",
            { className: "text-sm font-bold text-slate-800" },
            t?.subject_code || "Class",
            " - ",
            t?.subject_title || "Class subject",
          ),
          React.createElement(
            "p",
            { className: "mt-0.5 text-xs text-slate-500" },
            t?.days || "Schedule not set",
            " \xB7 ",
            t?.room || "Room not set",
          ),
        ),
        v.map(([u, N]) =>
          React.createElement(
            "button",
            { className: f, key: u, disabled: l, onClick: () => i(u, t.id) },
            N,
          ),
        ),
        React.createElement(
          "p",
          {
            className:
              "mb-0.5 mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400",
          },
          "Print Records",
        ),
        fe.map(([u, N]) =>
          React.createElement(
            "button",
            { className: f, key: u, disabled: l, onClick: () => r(u, t.id) },
            N,
          ),
        ),
        React.createElement(
          "button",
          {
            className: `${f} mt-1`,
            disabled: l,
            onClick: () => {
              (s(), c(t.id));
            },
          },
          "Open Student View",
        ),
        React.createElement(
          "button",
          {
            className:
              "block w-full rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-2.5 text-left text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition hover:from-indigo-500 hover:to-indigo-600 disabled:cursor-not-allowed disabled:opacity-60",
            disabled: !m || l,
            onClick: g,
          },
          l
            ? "Syncing to Excel\u2026"
            : m
              ? "Sync to Excel"
              : "Loading class data...",
        ),
        React.createElement(
          "button",
          { className: f, disabled: l, onClick: () => i("add-student", t.id) },
          "Add Student",
        ),
      ),
    ),
  );
}
function he(t) {
  const s = Number(t);
  return Number.isFinite(s)
    ? (Math.ceil((s - Number.EPSILON) * 10) / 10).toFixed(1)
    : "\u2014";
}
function se(t) {
  return {
    ctrlNo: String(t.ctrlNo ?? ""),
    student_no: t.number?.startsWith("CTRL-") ? "" : (t.number ?? ""),
    full_name: t.name ?? "",
    gender: ["M", "F"].includes(t.gender) ? t.gender : "",
    course: t.course ?? "",
    year_level: t.yearLevel ?? "",
    contact_no: t.contactNo ?? "",
    email: t.email ?? "",
    photo_url: t.photoUrl ?? "",
  };
}
function ye(t) {
  return String(t ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function U(t) {
  return ye(t).split(" ").filter(Boolean);
}
function ve(t, s) {
  if (!t.length || t.length !== s.length) return !1;
  const i = [...t].sort(),
    r = [...s].sort();
  return i.every((c, n) => c === r[n]);
}
function ae(t, s) {
  if (!t.length || t.length >= s.length) return !1;
  const i = [...s];
  return t.every((r) => {
    const c = i.indexOf(r);
    return c === -1 ? !1 : (i.splice(c, 1), !0);
  });
}
function C(t) {
  return /\d/.test(t) && /^[A-Za-z0-9-]+$/.test(t);
}
function Ne(t) {
  return String(t ?? "")
    .replace(/\r/g, "")
    .split(
      `
`,
    )
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const i = s
        .split("	")
        .map((n) => n.trim())
        .filter(Boolean);
      if (i.length >= 2) {
        const [n, m] = i,
          [l, b] = C(n) && !C(m) ? [m, n] : [n, m];
        return { raw: s, name: l, studentId: b };
      }
      const r = s.split(/\s+/).filter(Boolean);
      if (r.length >= 2) {
        const n = r[r.length - 1],
          m = r[0].replace(/,$/, "");
        if (C(n)) {
          const l = s.slice(0, s.lastIndexOf(n)).trim().replace(/,\s*$/, "");
          return { raw: s, name: l, studentId: n };
        }
        if (C(m)) {
          const l = s
            .slice(s.indexOf(r[0]) + r[0].length)
            .trim()
            .replace(/^,\s*/, "");
          return { raw: s, name: l, studentId: m };
        }
      }
      const c = s
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);
      if (c.length >= 2) {
        const [n, m] = c,
          [l, b] = C(n) && !C(m) ? [m, n] : [n, m];
        return { raw: s, name: l, studentId: b };
      }
      return { raw: s, name: "", studentId: "" };
    });
}
function we({
  section: t,
  students: s,
  sections: i = [],
  onClose: r,
  onUpdateStudent: c,
  onDeleteStudent: deleteStudentFn,
  onTransferStudent: n,
  onLoadTransferPreview: m,
}) {
  const [l, b] = d(null),
    [g, v] = d(null),
    [f, u] = d(!1),
    [N, I] = d({ status: "", text: "" }),
    [Y, ne] = d(!1),
    [M, q] = d(""),
    [_, J] = d(!1),
    [$, H] = d({ status: "", text: "" }),
    [h, A] = d(null),
    [E, j] = d("pick"),
    [k, z] = d(""),
    [T, K] = d(!1),
    [R, y] = d({ status: "", text: "" }),
    [P, V] = d(!1),
    [L, F] = d(0),
    [W, O] = d([]),
    [Z, D] = d({}),
    Q = G(
      () =>
        [...s].sort((e, a) =>
          (e.name || "").localeCompare(a.name || "", void 0, {
            sensitivity: "base",
          }),
        ),
      [s],
    ),
    X = G(() => i.filter((e) => e.id !== t?.id), [i, t]),
    le = (e) => {
      (b(null),
        v(null),
        A(e),
        j("pick"),
        z(""),
        O([]),
        D({}),
        F(0),
        y({ status: "", text: "" }));
    },
    ee = () => {
      (A(null),
        j("pick"),
        z(""),
        O([]),
        D({}),
        F(0),
        y({ status: "", text: "" }));
    },
    oe = async () => {
      if (!(!h || !k || !m)) {
        (V(!0), y({ status: "", text: "" }));
        try {
          const e = await m({
            enrollmentId: h.id,
            fromSectionId: t?.id,
            toSectionId: k,
          });
          (O(e.targetSessions), F(e.oldRecordCount), D({}), j("review"));
        } catch (e) {
          y({
            status: "error",
            text: e?.message || "Could not load the target class's sessions.",
          });
        } finally {
          V(!1);
        }
      }
    },
    re = () => {
      (j("pick"), y({ status: "", text: "" }));
    },
    de = (e, a) => {
      D((o) => ({ ...o, [e]: a }));
    },
    ie = async () => {
      if (!(!h || !k || !n)) {
        (K(!0), y({ status: "", text: "" }));
        try {
          const e = Object.entries(Z)
              .filter(([, p]) => p)
              .map(([p, x]) => ({ sessionId: p, status: x })),
            a = await n({
              enrollmentId: h.id,
              studentId: h.studentId,
              fromSectionId: t?.id,
              toSectionId: k,
              attendanceEntries: e,
            }),
            o = a?.offline
              ? " Attendance for the new class can be recorded once back online."
              : ` ${a?.attendanceRecorded ?? 0} attendance entr${a?.attendanceRecorded === 1 ? "y" : "ies"} recorded in the new class; the old class's attendance for this student was removed.`;
          (y({ status: "success", text: `${h.name} was transferred.${o}` }),
            setTimeout(() => ee(), 1800));
        } catch (e) {
          y({ status: "error", text: e?.message || "Transfer failed." });
        } finally {
          K(!1);
        }
      }
    },
    S = G(
      () =>
        M.trim()
          ? Ne(M).map((e) => {
              if (!e.name || !e.studentId) return { ...e, status: "unparsed" };
              const a = U(e.name),
                o = s.filter((x) => ve(a, U(x.name)));
              if (o.length === 1)
                return { ...e, status: "matched", student: o[0], fuzzy: !1 };
              if (o.length > 1)
                return { ...e, status: "ambiguous", candidates: o };
              const p = s.filter((x) => {
                const te = U(x.name);
                return ae(a, te) || ae(te, a);
              });
              return p.length === 1
                ? { ...e, status: "matched", student: p[0], fuzzy: !0 }
                : p.length > 1
                  ? { ...e, status: "ambiguous", candidates: p }
                  : { ...e, status: "unmatched" };
            })
          : [],
      [M, s],
    ),
    w = S.filter((e) => e.status === "matched"),
    ce = async () => {
      if (!c || !w.length) return;
      (J(!0), H({ status: "", text: "" }));
      const e = await Promise.allSettled(
          w.map((x) =>
            c({
              studentId: x.student.studentId,
              enrollmentId: x.student.id,
              sectionId: t?.id,
              ...se(x.student),
              student_no: x.studentId,
            }),
          ),
        ),
        a = e.filter((x) => x.status === "fulfilled").length,
        o = e.length - a;
      J(!1);
      const p = S.length - w.length;
      (H({
        status: o ? "error" : "success",
        text:
          `${a} student ID${a === 1 ? "" : "s"} updated.` +
          (o ? ` ${o} failed to save \u2014 try those again.` : "") +
          (p
            ? ` ${p} row(s) weren't matched or were ambiguous \u2014 review them below.`
            : ""),
      }),
        !o && !p && q(""));
    },
    me = (e) => {
      (A(null), b(e), v(se(e)), I({ status: "", text: "" }));
    },
    B = (e, a) => v((o) => ({ ...o, [e]: a })),
    ue = (e) => {
      const a = e.target.files?.[0];
      if (!a) return;
      if (a.size > 2 * 1024 * 1024) {
        I({ status: "error", text: "Profile photos must be 2 MB or smaller." });
        return;
      }
      const o = new FileReader();
      ((o.onload = () => B("photo_url", String(o.result || ""))),
        o.readAsDataURL(a));
    },
    pe = async (e) => {
      if ((e.preventDefault(), !(!l || !g || !c))) {
        (u(!0), I({ status: "", text: "" }));
        try {
          (await c({
            studentId: l.studentId,
            enrollmentId: l.id,
            sectionId: t?.id,
            ...g,
          }),
            I({ status: "success", text: "Student profile updated." }),
            b(null),
            v(null));
        } catch (a) {
          I({
            status: "error",
            text: a?.message || "Student profile could not be updated.",
          });
        } finally {
          u(!1);
        }
      }
    },
    confirmDeleteStudent = async (student) => {
      if (!deleteStudentFn) return;
      const confirmed = window.confirm(
        `Remove ${student.name} from this class? Their scores, grades, and attendance in this class will be deleted. This cannot be undone.`,
      );
      if (!confirmed) return;
      try {
        await deleteStudentFn({
          enrollmentId: student.id,
          sectionId: t?.id,
        });
      } catch (err) {
        window.alert(err?.message || "The student could not be removed.");
      }
    };
  return React.createElement(
    "div",
    {
      className:
        "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm print:hidden",
      onMouseDown: (e) => e.target === e.currentTarget && r(),
    },
    React.createElement(
      "section",
      {
        className:
          "max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl",
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "student-modal-title",
      },
      React.createElement(
        "div",
        {
          className:
            "mb-5 flex items-start justify-between border-b border-slate-100 pb-4",
        },
        React.createElement(
          "div",
          null,
          React.createElement(
            "p",
            {
              className:
                "text-[10px] font-bold uppercase tracking-wider text-indigo-600",
            },
            "Class Students",
          ),
          React.createElement(
            "h2",
            {
              id: "student-modal-title",
              className: "mt-1 text-lg font-bold text-slate-900",
            },
            t?.subject_code || "Students",
          ),
          React.createElement(
            "p",
            { className: "mt-0.5 text-xs text-slate-500" },
            t?.subject_title || "Students enrolled in this class",
          ),
        ),
        React.createElement(
          "button",
          {
            className:
              "flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700",
            onClick: r,
            "aria-label": "Close students",
          },
          "\xD7",
        ),
      ),
      React.createElement(
        "div",
        {
          className:
            "mb-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-4",
        },
        React.createElement(
          "div",
          { className: "flex items-center justify-between gap-3" },
          React.createElement(
            "div",
            null,
            React.createElement(
              "p",
              {
                className:
                  "text-[10px] font-bold uppercase tracking-wider text-slate-500",
              },
              "Bulk update",
            ),
            React.createElement(
              "h3",
              { className: "mt-0.5 text-sm font-bold text-slate-800" },
              "Update Student IDs by pasting a list",
            ),
            React.createElement(
              "p",
              { className: "mt-0.5 text-xs text-slate-500" },
              "Paste rows of a name and a Student ID (straight from Excel/Sheets works) \u2014 each row is matched to a student here by name, so nothing saves until you review the matches below.",
            ),
          ),
          React.createElement(
            "button",
            {
              type: "button",
              className:
                "shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100",
              onClick: () => ne((e) => !e),
            },
            Y ? "Hide" : "Open",
          ),
        ),
        Y &&
          React.createElement(
            "div",
            { className: "mt-3" },
            React.createElement("textarea", {
              rows: "6",
              className:
                "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100",
              placeholder: `ANTIPASO, JEORGE REY M.        2414456
MANCILLA, JEORGE REY        2414456
(also works with tabs or a plain comma, with or without a middle initial)`,
              value: M,
              onChange: (e) => q(e.target.value),
              disabled: _,
            }),
            S.length > 0 &&
              React.createElement(
                "div",
                {
                  className:
                    "mt-3 overflow-x-auto rounded-xl border border-slate-200",
                },
                React.createElement(
                  "table",
                  { className: "w-full border-collapse text-xs" },
                  React.createElement(
                    "thead",
                    null,
                    React.createElement(
                      "tr",
                      {
                        className:
                          "border-b border-slate-200 bg-slate-50 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500",
                      },
                      React.createElement(
                        "th",
                        { className: "py-2 px-3" },
                        "Pasted name",
                      ),
                      React.createElement(
                        "th",
                        { className: "py-2 px-3" },
                        "New ID",
                      ),
                      React.createElement(
                        "th",
                        { className: "py-2 px-3" },
                        "Matched student",
                      ),
                      React.createElement(
                        "th",
                        { className: "py-2 px-3" },
                        "Current ID",
                      ),
                      React.createElement(
                        "th",
                        { className: "py-2 px-3" },
                        "Status",
                      ),
                    ),
                  ),
                  React.createElement(
                    "tbody",
                    { className: "divide-y divide-slate-100" },
                    S.map((e, a) =>
                      React.createElement(
                        "tr",
                        { key: a },
                        React.createElement(
                          "td",
                          { className: "py-1.5 px-3 text-slate-700" },
                          e.name ||
                            React.createElement(
                              "span",
                              { className: "text-rose-500" },
                              "Couldn't parse this line",
                            ),
                        ),
                        React.createElement(
                          "td",
                          { className: "py-1.5 px-3 text-slate-700" },
                          e.studentId || "\u2014",
                        ),
                        React.createElement(
                          "td",
                          { className: "py-1.5 px-3 text-slate-700" },
                          e.status === "matched"
                            ? e.student.name
                            : e.status === "ambiguous"
                              ? `${e.candidates.length} possible matches`
                              : "\u2014",
                        ),
                        React.createElement(
                          "td",
                          { className: "py-1.5 px-3 text-slate-500" },
                          (e.status === "matched" && e.student.number) ||
                            "\u2014",
                        ),
                        React.createElement(
                          "td",
                          { className: "py-1.5 px-3" },
                          e.status === "matched" &&
                            React.createElement(
                              "span",
                              {
                                className: `font-semibold ${e.fuzzy ? "text-amber-600" : "text-emerald-600"}`,
                              },
                              e.fuzzy ? "Matched (verify)" : "Matched",
                            ),
                          e.status === "ambiguous" &&
                            React.createElement(
                              "span",
                              { className: "font-semibold text-amber-600" },
                              "Ambiguous",
                            ),
                          e.status === "unmatched" &&
                            React.createElement(
                              "span",
                              { className: "font-semibold text-rose-500" },
                              "No match",
                            ),
                          e.status === "unparsed" &&
                            React.createElement(
                              "span",
                              { className: "font-semibold text-rose-500" },
                              "Unparsed row",
                            ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            $.text &&
              React.createElement(
                "p",
                {
                  className: `mt-3 rounded-xl px-3 py-2 text-xs ${$.status === "error" ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700"}`,
                  role: "status",
                },
                $.text,
              ),
            React.createElement(
              "div",
              { className: "mt-3 flex items-center justify-between" },
              React.createElement(
                "p",
                { className: "text-[11px] text-slate-500" },
                w.length,
                " of ",
                S.length,
                " row",
                S.length === 1 ? "" : "s",
                " matched and ready to update.",
              ),
              React.createElement(
                "button",
                {
                  type: "button",
                  className:
                    "rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60",
                  disabled: !w.length || _,
                  onClick: ce,
                },
                _
                  ? "Updating\u2026"
                  : `Update ${w.length || ""} matched student ID${w.length === 1 ? "" : "s"}`,
              ),
            ),
          ),
      ),
      h &&
        React.createElement(
          "div",
          {
            className:
              "mb-5 rounded-2xl border border-amber-100 bg-amber-50/40 p-4",
          },
          React.createElement(
            "div",
            { className: "mb-3 flex items-center justify-between" },
            React.createElement(
              "div",
              null,
              React.createElement(
                "p",
                {
                  className:
                    "text-[10px] font-bold uppercase tracking-wider text-amber-600",
                },
                "Transfer student",
              ),
              React.createElement(
                "p",
                { className: "mt-0.5 text-xs text-slate-500" },
                E === "pick"
                  ? `Move ${h.name} to a different class. Scores and grades transfer automatically.`
                  : `Mark ${h.name}'s attendance for the new class's own session dates. Confirming will also permanently remove their attendance from the current class.`,
              ),
            ),
            React.createElement(
              "button",
              {
                type: "button",
                className:
                  "text-xs font-semibold text-slate-500 hover:text-slate-800",
                onClick: ee,
                disabled: T || P,
              },
              "Cancel",
            ),
          ),
          E === "pick" &&
            (X.length
              ? React.createElement(
                  "div",
                  {
                    className:
                      "flex flex-col gap-3 sm:flex-row sm:items-center",
                  },
                  React.createElement(
                    "select",
                    {
                      className:
                        "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 sm:flex-1",
                      value: k,
                      onChange: (e) => z(e.target.value),
                      disabled: P,
                    },
                    React.createElement(
                      "option",
                      { value: "" },
                      "Select a class\u2026",
                    ),
                    X.map((e) =>
                      React.createElement(
                        "option",
                        { value: e.id, key: e.id },
                        e.subject_code,
                        " \xB7 ",
                        e.subject_title || "Untitled",
                        e.section_no ? ` \xB7 Sec ${e.section_no}` : "",
                      ),
                    ),
                  ),
                  React.createElement(
                    "button",
                    {
                      type: "button",
                      className:
                        "shrink-0 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-500 disabled:opacity-60",
                      disabled: !k || P,
                      onClick: oe,
                    },
                    P ? "Loading class sessions\u2026" : "Continue",
                  ),
                )
              : React.createElement(
                  "p",
                  { className: "text-xs text-slate-500" },
                  "No other classes are available to transfer this student to.",
                )),
          E === "review" &&
            React.createElement(
              "div",
              null,
              L > 0 &&
                React.createElement(
                  "p",
                  {
                    className:
                      "mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-600",
                  },
                  "This student has ",
                  L,
                  " attendance record",
                  L === 1 ? "" : "s",
                  " in the current class. Confirming this transfer will permanently delete them.",
                ),
              W.length === 0
                ? React.createElement(
                    "p",
                    { className: "text-xs text-slate-500" },
                    "The new class has no recorded sessions yet \u2014 nothing to mark. You can still confirm the transfer; attendance can be taken normally once sessions exist there.",
                  )
                : React.createElement(
                    "div",
                    {
                      className:
                        "max-h-72 overflow-y-auto rounded-xl border border-slate-200",
                    },
                    React.createElement(
                      "table",
                      { className: "w-full border-collapse text-xs" },
                      React.createElement(
                        "thead",
                        { className: "sticky top-0 bg-slate-50" },
                        React.createElement(
                          "tr",
                          {
                            className:
                              "border-b border-slate-200 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500",
                          },
                          React.createElement(
                            "th",
                            { className: "py-2 px-3" },
                            "Session date (new class)",
                          ),
                          React.createElement(
                            "th",
                            { className: "py-2 px-3" },
                            "Status",
                          ),
                        ),
                      ),
                      React.createElement(
                        "tbody",
                        { className: "divide-y divide-slate-100" },
                        W.map((e) =>
                          React.createElement(
                            "tr",
                            { key: e.id },
                            React.createElement(
                              "td",
                              { className: "py-1.5 px-3 text-slate-700" },
                              e.date,
                              e.time ? ` \xB7 ${e.time}` : "",
                            ),
                            React.createElement(
                              "td",
                              { className: "py-1.5 px-3" },
                              React.createElement(
                                "select",
                                {
                                  className:
                                    "rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs",
                                  value: Z[e.id] ?? "",
                                  disabled: T,
                                  onChange: (a) => de(e.id, a.target.value),
                                },
                                React.createElement(
                                  "option",
                                  { value: "" },
                                  "Leave unmarked",
                                ),
                                React.createElement(
                                  "option",
                                  { value: "present" },
                                  "Present",
                                ),
                                React.createElement(
                                  "option",
                                  { value: "absent" },
                                  "Absent",
                                ),
                                React.createElement(
                                  "option",
                                  { value: "late" },
                                  "Late",
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
              React.createElement(
                "div",
                { className: "mt-3 flex items-center justify-between" },
                React.createElement(
                  "button",
                  {
                    type: "button",
                    className:
                      "text-xs font-semibold text-slate-500 hover:text-slate-800",
                    onClick: re,
                    disabled: T,
                  },
                  "\u2190 Back",
                ),
                React.createElement(
                  "button",
                  {
                    type: "button",
                    className:
                      "shrink-0 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-500 disabled:opacity-60",
                    disabled: T,
                    onClick: ie,
                  },
                  T ? "Transferring\u2026" : "Confirm transfer",
                ),
              ),
            ),
          R.text &&
            React.createElement(
              "p",
              {
                className: `mt-3 rounded-xl px-3 py-2 text-xs ${R.status === "error" ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700"}`,
                role: "status",
              },
              R.text,
            ),
        ),
      g &&
        l &&
        React.createElement(
          "form",
          {
            className:
              "mb-5 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4",
            onSubmit: pe,
          },
          React.createElement(
            "div",
            { className: "mb-3 flex items-center justify-between" },
            React.createElement(
              "div",
              null,
              React.createElement(
                "p",
                {
                  className:
                    "text-[10px] font-bold uppercase tracking-wider text-indigo-600",
                },
                "Edit student profile",
              ),
              React.createElement(
                "p",
                { className: "mt-0.5 text-xs text-slate-500" },
                "Update the complete record for ",
                l.name,
                ".",
              ),
            ),
            React.createElement(
              "button",
              {
                type: "button",
                className:
                  "text-xs font-semibold text-slate-500 hover:text-slate-800",
                onClick: () => {
                  (b(null), v(null));
                },
              },
              "Cancel",
            ),
          ),
          React.createElement(
            "div",
            { className: "mb-4 flex items-center gap-3" },
            g.photo_url
              ? React.createElement("img", {
                  src: g.photo_url,
                  alt: "",
                  className:
                    "h-16 w-16 rounded-2xl object-cover ring-2 ring-white",
                })
              : React.createElement(
                  "div",
                  {
                    className:
                      "flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-lg font-bold text-indigo-600",
                  },
                  l.name?.slice(0, 1) || "?",
                ),
            React.createElement(
              "label",
              { className: "text-xs font-semibold text-slate-600" },
              "Profile photo",
              React.createElement("input", {
                type: "file",
                accept: "image/*",
                onChange: ue,
                disabled: f,
                className:
                  "mt-1 block w-full text-[11px] text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-white file:px-2.5 file:py-1.5 file:text-[11px] file:font-semibold file:text-indigo-600",
              }),
            ),
          ),
          React.createElement(
            "div",
            { className: "grid gap-3 sm:grid-cols-2" },
            [
              ["student_no", "Student ID"],
              ["full_name", "Full name"],
              ["course", "Course"],
              ["year_level", "Year level"],
              ["contact_no", "Contact number"],
              ["email", "Email"],
            ].map(([e, a]) =>
              React.createElement(
                "label",
                { className: "text-xs font-semibold text-slate-600", key: e },
                a,
                React.createElement("input", {
                  name: e,
                  type: e === "email" ? "email" : "text",
                  value: g[e],
                  onChange: (o) => B(e, o.target.value),
                  disabled: f,
                  required: e === "full_name",
                  className:
                    "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100",
                }),
              ),
            ),
            React.createElement(
              "label",
              { className: "text-xs font-semibold text-slate-600" },
              "Gender",
              React.createElement(
                "select",
                {
                  name: "gender",
                  value: g.gender,
                  onChange: (e) => B("gender", e.target.value),
                  disabled: f,
                  className:
                    "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100",
                },
                React.createElement("option", { value: "" }, "Select"),
                React.createElement("option", { value: "M" }, "Male"),
                React.createElement("option", { value: "F" }, "Female"),
              ),
            ),
          ),
          N.text &&
            React.createElement(
              "p",
              {
                className: `mt-3 rounded-xl px-3 py-2 text-xs ${N.status === "error" ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700"}`,
                role: "status",
              },
              N.text,
            ),
          React.createElement(
            "div",
            { className: "mt-4 flex justify-end" },
            React.createElement(
              "button",
              {
                type: "submit",
                disabled: f,
                className:
                  "rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60",
              },
              f ? "Saving..." : "Save student",
            ),
          ),
        ),
      React.createElement(
        "div",
        { className: "overflow-x-auto" },
        React.createElement(
          "table",
          { className: "w-full border-collapse text-sm" },
          React.createElement(
            "thead",
            null,
            React.createElement(
              "tr",
              {
                className:
                  "border-b border-slate-200 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500",
              },
              React.createElement("th", { className: "py-2 pr-3" }, "#"),
              React.createElement(
                "th",
                { className: "py-2 pr-3" },
                "Student ID",
              ),
              React.createElement("th", { className: "py-2 pr-3" }, "Name"),
              React.createElement("th", { className: "py-2 pr-3" }, "Gender"),
              React.createElement(
                "th",
                { className: "py-2 pr-3" },
                "Attendance",
              ),
              React.createElement("th", { className: "py-2 pr-3" }, "Grade"),
              React.createElement(
                "th",
                { className: "py-2 text-right" },
                "Action",
              ),
            ),
          ),
          React.createElement(
            "tbody",
            { className: "divide-y divide-slate-100" },
            Q.map((e, a) =>
              React.createElement(
                "tr",
                { key: e.id },
                React.createElement(
                  "td",
                  { className: "py-2 pr-3 text-slate-500" },
                  a + 1,
                ),
                React.createElement(
                  "td",
                  { className: "py-2 pr-3 text-slate-700" },
                  e.number,
                ),
                React.createElement(
                  "td",
                  { className: "py-2 pr-3 font-medium text-slate-800" },
                  e.name,
                ),
                React.createElement(
                  "td",
                  { className: "py-2 pr-3 text-slate-600" },
                  e.gender === "F"
                    ? "Female"
                    : e.gender === "M"
                      ? "Male"
                      : "\u2014",
                ),
                React.createElement(
                  "td",
                  { className: "py-2 pr-3 text-slate-600" },
                  e.attendance,
                  "%",
                ),
                React.createElement(
                  "td",
                  { className: "py-2 pr-3 text-slate-600" },
                  he(e.grade),
                ),
                React.createElement(
                  "td",
                  { className: "py-2 text-right" },
                  React.createElement(
                    "div",
                    { className: "flex justify-end gap-2" },
                    React.createElement(
                      "button",
                      {
                        type: "button",
                        className:
                          "rounded-lg border border-indigo-200 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50",
                        onClick: () => me(e),
                      },
                      "Edit",
                    ),
                    n &&
                      React.createElement(
                        "button",
                        {
                          type: "button",
                          className:
                            "rounded-lg border border-amber-200 px-2.5 py-1 text-[11px] font-semibold text-amber-600 hover:bg-amber-50",
                          onClick: () => le(e),
                        },
                        "Transfer",
                      ),
                    deleteStudentFn &&
                      React.createElement(
                        "button",
                        {
                          type: "button",
                          className:
                            "rounded-lg border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50",
                          onClick: () => confirmDeleteStudent(e),
                        },
                        "Remove",
                      ),
                  ),
                ),
              ),
            ),
          ),
        ),
        !Q.length &&
          React.createElement(
            "div",
            { className: "py-10 text-center text-sm text-slate-500" },
            "No students have been imported for this class.",
          ),
      ),
    ),
  );
}
function ke({ section: t, deleting: s, error: i, onClose: r, onConfirm: c }) {
  return React.createElement(
    "div",
    {
      className:
        "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm print:hidden",
      onMouseDown: (n) => n.target === n.currentTarget && !s && r(),
    },
    React.createElement(
      "section",
      {
        className:
          "w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-2xl",
        role: "alertdialog",
        "aria-modal": "true",
      },
      React.createElement(
        "div",
        {
          className:
            "mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-500",
        },
        React.createElement(be, { name: "trash", size: 22 }),
      ),
      React.createElement(
        "p",
        {
          className:
            "text-[10px] font-bold uppercase tracking-wider text-rose-500",
        },
        "Permanent Action",
      ),
      React.createElement(
        "h2",
        { className: "mt-1 text-lg font-bold text-slate-900" },
        "Delete this class?",
      ),
      React.createElement(
        "p",
        { className: "mt-2 text-sm text-slate-500" },
        "This will delete ",
        React.createElement("strong", null, t?.subject_code || "this class"),
        ", including its students, scores, grades, and attendance records.",
      ),
      i &&
        React.createElement(
          "p",
          { className: "mt-3 text-xs font-medium text-rose-600" },
          i,
        ),
      React.createElement(
        "div",
        { className: "mt-6 flex justify-center gap-3" },
        React.createElement(
          "button",
          {
            className:
              "rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50",
            onClick: r,
            disabled: s,
          },
          "Cancel",
        ),
        React.createElement(
          "button",
          {
            className:
              "rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:opacity-60",
            onClick: c,
            disabled: s,
          },
          s ? "Deleting\u2026" : "Delete class",
        ),
      ),
    ),
  );
}
function Se() {
  const [t, s] = d(() => new Date());
  xe(() => {
    const c = setInterval(() => s(new Date()), 1e3);
    return () => clearInterval(c);
  }, []);
  const i = t.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    r = t.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  return React.createElement(
    "div",
    {
      className:
        "hidden sm:flex items-center gap-2.5 pl-3 pr-4 py-1.5 rounded-full bg-slate-900 text-white",
    },
    React.createElement(
      "span",
      { className: "relative flex h-2 w-2" },
      React.createElement("span", {
        className:
          "animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75",
      }),
      React.createElement("span", {
        className: "relative inline-flex rounded-full h-2 w-2 bg-emerald-400",
      }),
    ),
    React.createElement(
      "span",
      {
        className: "text-xs font-mono font-semibold tracking-wide tabular-nums",
      },
      i,
    ),
    React.createElement("span", { className: "w-px h-3 bg-white/20" }),
    React.createElement(
      "span",
      { className: "text-[11px] font-medium text-slate-300" },
      r,
    ),
  );
}
export {
  ge as ClassOptionsModal,
  ke as DeleteClassModal,
  Se as LiveClock,
  we as StudentModal,
};