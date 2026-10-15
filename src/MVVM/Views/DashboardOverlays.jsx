import React, { useMemo as G, useState as d } from "react";
import { Icon as be } from "./DashboardShared";
import { StudentPhotoPicker } from "./classActions/StudentPhotoPicker";
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
    [pendingDeleteStudent, setPendingDeleteStudent] = d(null),
    [isDeletingStudent, setIsDeletingStudent] = d(!1),
    [deleteStudentError, setDeleteStudentError] = d(""),
    [copyStatus, setCopyStatus] = d(""),
    Q = G(
      () =>
        [...s].sort((e, a) =>
          (e.name || "").localeCompare(a.name || "", void 0, {
            sensitivity: "base",
          }),
        ),
      [s],
    ),
    copyCurrentStudentData = async () => {
      const text = Q.map((student) =>
        `${student.name || ""}\t${student.number ?? ""}`.trimEnd(),
      ).join("\n");

      if (!text) {
        setCopyStatus("No students");
        return;
      }

      try {
        await navigator.clipboard.writeText(text);
        setCopyStatus("Copied!");
      } catch {
        setCopyStatus("Copy failed");
      }
      setTimeout(() => setCopyStatus(""), 1800);
    },
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
    confirmDeleteStudent = (student) => {
      (setDeleteStudentError(""), setPendingDeleteStudent(student));
    },
    cancelDeleteStudent = () => {
      if (isDeletingStudent) return;
      (setPendingDeleteStudent(null), setDeleteStudentError(""));
    },
    performDeleteStudent = async () => {
      if (!deleteStudentFn || !pendingDeleteStudent) return;
      (setIsDeletingStudent(!0), setDeleteStudentError(""));
      try {
        (await deleteStudentFn({
          enrollmentId: pendingDeleteStudent.id,
          sectionId: t?.id,
        }),
          setPendingDeleteStudent(null));
      } catch (err) {
        setDeleteStudentError(
          err?.message || "The student could not be removed.",
        );
      } finally {
        setIsDeletingStudent(!1);
      }
    };
  return React.createElement(
    "div",
    {
      className:
        "fixed inset-0 z-50 flex items-center justify-center bg-canvas/70 p-4 backdrop-blur-sm print:hidden",
      onMouseDown: (e) => e.target === e.currentTarget && r(),
    },
    React.createElement(
      "section",
      {
        className:
          "max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-xl border border-accent/35 border-b-accent-2/20 bg-surface-3 p-6 shadow-modal",
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "student-modal-title",
      },
      React.createElement(
        "div",
        {
          className:
            "mb-5 flex items-start justify-between border-b border-white/5 pb-4",
        },
        React.createElement(
          "div",
          null,
          React.createElement(
            "p",
            {
              className:
                "text-[10px] font-bold uppercase tracking-wider text-accent",
            },
            "Class Students",
          ),
          React.createElement(
            "h2",
            {
              id: "student-modal-title",
              className: "mt-1 text-lg font-bold text-ink",
            },
            t?.subject_code || "Students",
          ),
          React.createElement(
            "p",
            { className: "mt-0.5 text-xs text-ink-2" },
            t?.subject_title || "Students enrolled in this class",
          ),
        ),
        React.createElement(
          "button",
          {
            className:
              "flex h-8 w-8 items-center justify-center rounded-full text-ink-3 transition hover:bg-surface-3 hover:text-ink",
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
            "mb-5 rounded-2xl border border-white/10 bg-surface-2/60 p-4",
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
                  "text-[10px] font-bold uppercase tracking-wider text-ink-2",
              },
              "Bulk update",
            ),
            React.createElement(
              "h3",
              { className: "mt-0.5 text-sm font-bold text-ink" },
              "Update Student IDs by pasting a list",
            ),
            React.createElement(
              "p",
              { className: "mt-0.5 text-xs text-ink-2" },
              "Paste rows of a name and a Student ID (straight from Excel/Sheets works) \u2014 each row is matched to a student here by name, so nothing saves until you review the matches below.",
            ),
          ),
          React.createElement(
            "div",
            { className: "flex shrink-0 items-center gap-2" },
            React.createElement(
              "button",
              {
                type: "button",
                className:
                  "rounded-lg border border-accent/40 bg-surface-2 px-3 py-1.5 text-[11px] font-semibold text-accent hover:bg-accent/10 disabled:opacity-50",
                onClick: copyCurrentStudentData,
                disabled: !Q.length,
                title: "Copy current names and Student IDs",
              },
              copyStatus || "Copy Name + ID",
            ),
            React.createElement(
              "button",
              {
                type: "button",
                className:
                  "rounded-lg border border-white/10 bg-surface-2 px-3 py-1.5 text-[11px] font-semibold text-ink-2 hover:bg-surface-3",
                onClick: () => ne((e) => !e),
              },
              Y ? "Hide" : "Open",
            ),
          ),
        ),
        Y &&
          React.createElement(
            "div",
            { className: "mt-3" },
            React.createElement("textarea", {
              rows: "6",
              className:
                "w-full rounded-xl border border-white/10 bg-surface-1 px-3 py-2 text-xs font-mono text-ink outline-none focus:border-accent focus:shadow-focus",
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
                    "mt-3 overflow-x-auto rounded-xl border border-white/10",
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
                          "border-b border-white/10 bg-surface-2 text-left text-[10px] font-bold uppercase tracking-wide text-ink-2",
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
                    { className: "divide-y divide-white/5" },
                    S.map((e, a) =>
                      React.createElement(
                        "tr",
                        { key: a },
                        React.createElement(
                          "td",
                          { className: "py-1.5 px-3 text-ink" },
                          e.name ||
                            React.createElement(
                              "span",
                              { className: "text-rose-400" },
                              "Couldn't parse this line",
                            ),
                        ),
                        React.createElement(
                          "td",
                          { className: "py-1.5 px-3 text-ink" },
                          e.studentId || "\u2014",
                        ),
                        React.createElement(
                          "td",
                          { className: "py-1.5 px-3 text-ink" },
                          e.status === "matched"
                            ? e.student.name
                            : e.status === "ambiguous"
                              ? `${e.candidates.length} possible matches`
                              : "\u2014",
                        ),
                        React.createElement(
                          "td",
                          { className: "py-1.5 px-3 text-ink-2" },
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
                                className: `font-semibold ${e.fuzzy ? "text-amber-300" : "text-emerald-400"}`,
                              },
                              e.fuzzy ? "Matched (verify)" : "Matched",
                            ),
                          e.status === "ambiguous" &&
                            React.createElement(
                              "span",
                              { className: "font-semibold text-amber-300" },
                              "Ambiguous",
                            ),
                          e.status === "unmatched" &&
                            React.createElement(
                              "span",
                              { className: "font-semibold text-rose-400" },
                              "No match",
                            ),
                          e.status === "unparsed" &&
                            React.createElement(
                              "span",
                              { className: "font-semibold text-rose-400" },
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
                  className: `mt-3 rounded-xl px-3 py-2 text-xs ${$.status === "error" ? "bg-rose-500/10 text-rose-300" : "bg-emerald-500/10 text-emerald-300"}`,
                  role: "status",
                },
                $.text,
              ),
            React.createElement(
              "div",
              { className: "mt-3 flex items-center justify-between" },
              React.createElement(
                "p",
                { className: "text-[11px] text-ink-2" },
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
                    "rounded-xl bg-accent px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-canvas hover:shadow-halo disabled:opacity-60",
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
              "mb-5 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4",
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
                    "text-[10px] font-bold uppercase tracking-wider text-amber-300",
                },
                "Transfer student",
              ),
              React.createElement(
                "p",
                { className: "mt-0.5 text-xs text-ink-2" },
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
                  "text-xs font-semibold text-ink-2 hover:text-ink",
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
                        "w-full rounded-xl border border-white/10 bg-surface-1 px-3 py-2 text-sm text-ink outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 sm:flex-1",
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
                        "shrink-0 rounded-xl bg-amber-400 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-canvas hover:bg-amber-300 disabled:opacity-60",
                      disabled: !k || P,
                      onClick: oe,
                    },
                    P ? "Loading class sessions\u2026" : "Continue",
                  ),
                )
              : React.createElement(
                  "p",
                  { className: "text-xs text-ink-2" },
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
                      "mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-[11px] font-semibold text-rose-300",
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
                    { className: "text-xs text-ink-2" },
                    "The new class has no recorded sessions yet \u2014 nothing to mark. You can still confirm the transfer; attendance can be taken normally once sessions exist there.",
                  )
                : React.createElement(
                    "div",
                    {
                      className:
                        "max-h-72 overflow-y-auto rounded-xl border border-white/10",
                    },
                    React.createElement(
                      "table",
                      { className: "w-full border-collapse text-xs" },
                      React.createElement(
                        "thead",
                        { className: "sticky top-0 bg-surface-2" },
                        React.createElement(
                          "tr",
                          {
                            className:
                              "border-b border-white/10 text-left text-[10px] font-bold uppercase tracking-wide text-ink-2",
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
                        { className: "divide-y divide-white/5" },
                        W.map((e) =>
                          React.createElement(
                            "tr",
                            { key: e.id },
                            React.createElement(
                              "td",
                              { className: "py-1.5 px-3 text-ink" },
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
                                    "rounded-lg border border-white/10 bg-surface-2 px-2 py-1 text-xs",
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
                      "text-xs font-semibold text-ink-2 hover:text-ink",
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
                      "shrink-0 rounded-xl bg-amber-400 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-canvas hover:bg-amber-300 disabled:opacity-60",
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
                className: `mt-3 rounded-xl px-3 py-2 text-xs ${R.status === "error" ? "bg-rose-500/10 text-rose-300" : "bg-emerald-500/10 text-emerald-300"}`,
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
              "mb-5 rounded-2xl border border-accent/20 bg-accent/5 p-4",
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
                    "text-[10px] font-bold uppercase tracking-wider text-accent",
                },
                "Edit student profile",
              ),
              React.createElement(
                "p",
                { className: "mt-0.5 text-xs text-ink-2" },
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
                  "text-xs font-semibold text-ink-2 hover:text-ink",
                onClick: () => {
                  (b(null), v(null));
                },
              },
              "Cancel",
            ),
          ),
          React.createElement(
            "div",
            { className: "mb-4" },
            React.createElement("p", { className: "mb-2 text-xs font-semibold text-ink-2" }, "Profile photo"),
            React.createElement(StudentPhotoPicker, {
              value: g.photo_url,
              onChange: (photo) => B("photo_url", photo),
              disabled: f,
            }),
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
                { className: "text-xs font-semibold text-ink-2", key: e },
                a,
                React.createElement("input", {
                  name: e,
                  type: e === "email" ? "email" : "text",
                  value: g[e],
                  onChange: (o) => B(e, o.target.value),
                  disabled: f,
                  required: e === "full_name",
                  className:
                    "mt-1 w-full rounded-xl border border-white/10 bg-surface-1 px-3 py-2 text-sm font-normal text-ink outline-none focus:border-accent focus:shadow-focus",
                }),
              ),
            ),
            React.createElement(
              "label",
              { className: "text-xs font-semibold text-ink-2" },
              "Gender",
              React.createElement(
                "select",
                {
                  name: "gender",
                  value: g.gender,
                  onChange: (e) => B("gender", e.target.value),
                  disabled: f,
                  className:
                    "mt-1 w-full rounded-xl border border-white/10 bg-surface-1 px-3 py-2 text-sm font-normal text-ink outline-none focus:border-accent focus:shadow-focus",
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
                className: `mt-3 rounded-xl px-3 py-2 text-xs ${N.status === "error" ? "bg-rose-500/10 text-rose-300" : "bg-emerald-500/10 text-emerald-300"}`,
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
                  "rounded-xl bg-accent px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-canvas hover:shadow-halo disabled:opacity-60",
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
                  "border-b border-white/10 text-left text-[10px] font-bold uppercase tracking-wide text-ink-2",
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
            { className: "divide-y divide-white/5" },
            Q.map((e, a) =>
              React.createElement(
                "tr",
                { key: e.id },
                React.createElement(
                  "td",
                  { className: "py-2 pr-3 text-ink-2" },
                  a + 1,
                ),
                React.createElement(
                  "td",
                  { className: "py-2 pr-3 text-ink" },
                  e.number,
                ),
                React.createElement(
                  "td",
                  { className: "py-2 pr-3 font-medium text-ink" },
                  e.name,
                ),
                React.createElement(
                  "td",
                  { className: "py-2 pr-3 text-ink-2" },
                  e.gender === "F"
                    ? "Female"
                    : e.gender === "M"
                      ? "Male"
                      : "\u2014",
                ),
                React.createElement(
                  "td",
                  { className: "py-2 pr-3 text-ink-2" },
                  e.attendance,
                  "%",
                ),
                React.createElement(
                  "td",
                  { className: "py-2 pr-3 text-ink-2" },
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
                          "rounded-lg border border-accent/40 px-2.5 py-1 text-[11px] font-semibold text-accent hover:bg-accent/10",
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
                            "rounded-lg border border-amber-400/30 px-2.5 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-400/10",
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
                            "rounded-lg border border-rose-400/30 px-2.5 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/10",
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
            { className: "py-10 text-center text-sm text-ink-2" },
            "No students have been imported for this class.",
          ),
      ),
    ),
    pendingDeleteStudent &&
      React.createElement(
        "div",
        {
          className:
            "fixed inset-0 z-[60] flex items-center justify-center bg-canvas/70 p-4 backdrop-blur-sm print:hidden",
          onMouseDown: (e) =>
            e.target === e.currentTarget && cancelDeleteStudent(),
        },
        React.createElement(
          "section",
          {
            className:
              "w-full max-w-sm rounded-xl border border-accent/35 border-b-accent-2/20 bg-surface-3 p-6 text-center shadow-modal",
            role: "alertdialog",
            "aria-modal": "true",
            "aria-labelledby": "remove-student-title",
          },
          React.createElement(
            "div",
            {
              className:
                "mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400",
            },
            React.createElement(be, { name: "trash", size: 22 }),
          ),
          React.createElement(
            "p",
            {
              className:
                "text-[10px] font-bold uppercase tracking-wider text-rose-400",
            },
            "Permanent Action",
          ),
          React.createElement(
            "h2",
            {
              id: "remove-student-title",
              className: "mt-1 text-lg font-bold text-ink",
            },
            "Remove this student?",
          ),
          React.createElement(
            "p",
            { className: "mt-2 text-sm text-ink-2" },
            "Remove ",
            React.createElement(
              "strong",
              null,
              pendingDeleteStudent.name,
            ),
            " from this class? Their scores, grades, and attendance in this class will be deleted.",
          ),
          React.createElement(
            "p",
            { className: "mt-1 text-xs font-medium text-ink-3" },
            "This cannot be undone.",
          ),
          deleteStudentError &&
            React.createElement(
              "p",
              { className: "mt-3 text-xs font-medium text-rose-300" },
              deleteStudentError,
            ),
          React.createElement(
            "div",
            { className: "mt-6 flex justify-center gap-3" },
            React.createElement(
              "button",
              {
                type: "button",
                className:
                  "rounded-xl border border-white/10 bg-surface-2 px-4 py-2 text-xs font-semibold text-ink-2 transition hover:bg-surface-3",
                onClick: cancelDeleteStudent,
                disabled: isDeletingStudent,
              },
              "Cancel",
            ),
            React.createElement(
              "button",
              {
                type: "button",
                className:
                  "rounded-xl bg-rose-500 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white transition hover:bg-rose-400 disabled:opacity-60",
                onClick: performDeleteStudent,
                disabled: isDeletingStudent,
              },
              isDeletingStudent ? "Removing\u2026" : "Remove student",
            ),
          ),
        ),
      ),
  );
}
export { we as StudentModal };
