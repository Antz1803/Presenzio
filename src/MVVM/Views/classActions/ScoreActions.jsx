import React, { useEffect as ee, useState as y } from "react";
import { formatDisplayDate as D } from "./actionUtils";
const C = [
    { key: "quiz", label: "Quiz", prefix: "Q", count: 4 },
    { key: "assignment", label: "Assignment", prefix: "A", count: 4 },
    { key: "activity", label: "Graded activity", prefix: "G", count: 4 },
    { key: "exam", label: "Exam", prefix: "E", count: 1 },
  ],
  Y = [
    [0, 5],
    [1, 4],
    [6, 3.9],
    [12, 3.8],
    [18, 3.7],
    [24, 3.6],
    [30, 3.5],
    [36, 3.4],
    [42, 3.3],
    [48, 3.2],
    [54, 3.1],
    [60, 3],
    [62, 2.9],
    [64, 2.8],
    [66, 2.7],
    [68, 2.6],
    [70, 2.5],
    [72, 2.4],
    [74, 2.3],
    [76, 2.2],
    [78, 2.1],
    [80, 2],
    [82, 1.9],
    [84, 1.8],
    [86, 1.7],
    [88, 1.6],
    [90, 1.5],
    [92, 1.4],
    [94, 1.3],
    [96, 1.2],
    [98, 1.1],
    [100, 1],
  ];
function Z(i) {
  if (!Number.isFinite(Number(i))) return null;
  const u = Math.max(0, Math.min(100, Number(i)));
  let g = 5;
  return (
    Y.forEach(([s, t]) => {
      u >= s && (g = t);
    }),
    g
  );
}
function G(i, u, g) {
  const s = Object.fromEntries(
    C.map((t) => [
      t.key,
      Object.fromEntries(
        i.flatMap((b) =>
          Array.from({ length: t.count }, (h, m) => [b.id + ":" + (m + 1), ""]),
        ),
      ),
    ]),
  );
  return (
    u
      .filter((t) => t.period?.code === g)
      .forEach((t) => {
        const b = t.enrollment_id + ":" + t.item_no;
        s[t.category] &&
          (s[t.category][b] = t.score === 0 ? "" : String(t.score ?? ""));
      }),
    s
  );
}
function L(i, u, g = []) {
  const s = Object.fromEntries(
    C.map((t) => [
      t.key,
      Object.fromEntries(
        Array.from({ length: t.count }, (b, h) => [String(h + 1), ""]),
      ),
    ]),
  );
  return (
    i
      .filter((t) => t.period?.code === u)
      .forEach((t) => {
        s[t.category] &&
          t.max_score != null &&
          (s[t.category][String(t.item_no)] = String(t.max_score));
      }),
    g
      .filter((t) => t.period?.code === u)
      .forEach((t) => {
        if (!s[t.category] || !t.item_no) return;
        const b = (t.questions ?? []).reduce(
          (h, m) => h + Number(m.points || 0),
          0,
        );
        b > 0 && (s[t.category][String(t.item_no)] = String(b));
      }),
    s
  );
}
function w({
  students: i,
  assessmentScores: u,
  assessmentDefinitions: g,
  gradingPeriods: s,
  onSave: t,
  onAutoSave: b,
  onClose: h,
}) {
  const [m, Q] = y("prelim"),
    [n, V] = y("quiz"),
    [E, M] = y(() => L(u, m, g)),
    [d, _] = y(() => G(i, u, m)),
    [N, $] = y(!1),
    [F, O] = y(!1),
    [A, p] = y({ status: "", text: "" }),
    [P, T] = y(""),
    [copiedStudentId, setCopiedStudentId] = y(""),
    [copyingMissing, setCopyingMissing] = y(!1),
    j = s.find((e) => e.code === m),
    x = { start: j?.start_date ?? "", end: j?.end_date ?? "" },
    c = C.find((e) => e.key === n),
    v = E[n],
    q = i.filter((e) => {
      const r = P.trim().toLowerCase();
      return (
        !r ||
        e.name.toLowerCase().includes(r) ||
        String(e.number).toLowerCase().includes(r)
      );
    }),
    k = Array.from({ length: c.count }, (e, r) => r + 1)
      .filter((e) =>
        Object.entries(d[n]).some(
          ([r, a]) =>
            r.endsWith(`:${e}`) && a !== "" && Number.isFinite(Number(a)),
        ),
      )
      .every((e) => Number(v[String(e)]) > 0),
    I = Object.values(v).some((e) => Number(e) > 0),
    z = async () => {
      if (!k)
        return (
          p({
            status: "error",
            text: "Enter a maximum score for every column that has a score before switching.",
          }),
          !1
        );
      (O(!0), p({ status: "", text: `Saving ${c.label} scores...` }));
      try {
        return (
          await b({ period: m, category: n, scores: d[n], maxScores: v }),
          p({ status: "success", text: `${c.label} scores auto-saved.` }),
          !0
        );
      } catch (e) {
        return (
          p({
            status: "error",
            text: e?.message || `${c.label} scores could not be saved.`,
          }),
          !1
        );
      } finally {
        O(!1);
      }
    },
    R = (e) => {
      e === n || N || (V(e), z());
    },
    B = (e) => {
      e === m || N || (z(), Q(e), M(L(u, e, g)), _(G(i, u, e)));
    },
    U = (e, r, a) => {
      if (a === "") {
        _({ ...d, [n]: { ...d[n], [e + ":" + r]: "" } });
        return;
      }
      const o = Number(a),
        l = Number.isFinite(o) ? Math.max(0, o) : "";
      _({ ...d, [n]: { ...d[n], [e + ":" + r]: l } });
    },
    W = (e, r) => M({ ...E, [n]: { ...E[n], [String(e)]: r } }),
    H = (e) => {
      const r = Array.from(
        { length: c.count },
        (a, o) => d[n][e.id + ":" + (o + 1)],
      )
        .filter((a) => a !== "")
        .map(Number)
        .filter(Number.isFinite);
      return r.length ? r.reduce((a, o) => a + o, 0) / r.length : 0;
    },
    J = async () => {
      if (!k) {
        p({
          status: "error",
          text: "Enter a maximum score for every column that has a score.",
        });
        return;
      }
      ($(!0), p({ status: "", text: "" }));
      try {
        (await t({ period: m, category: n, scores: d[n], maxScores: v }),
          p({ status: "success", text: "Scores saved successfully." }));
      } catch (e) {
        p({
          status: "error",
          text: e?.message || "Scores could not be saved to Firebase.",
        });
      } finally {
        $(!1);
      }
    },
    K = (e) => {
      if (!k) return 0;
      const r = Array.from({ length: c.count }, (a, o) => {
        const f = d[n][e.id + ":" + (o + 1)],
          l = Number(v[String(o + 1)]);
        if (!Number.isFinite(l) || l <= 0 || f === "") return null;
        const S = Number(f);
        return Number.isFinite(S) ? Z((S / l) * 100) : null;
      }).filter((a) => a !== null);
      return r.length ? r.reduce((a, o) => a + o, 0) / r.length : 0;
    },
    copyStudentName = async (student) => {
      try {
        await navigator.clipboard.writeText(student.name);
        setCopiedStudentId(student.id);
        window.setTimeout(() => setCopiedStudentId(""), 1400);
      } catch {
        // Clipboard access can be unavailable outside a secure browser context.
      }
    },
    copyMissingStudents = async () => {
      const expectedItems = Array.from({ length: c.count }, (e, r) => r + 1).filter(
        (item) => Number(v[String(item)]) > 0,
      );
      const missingStudents = i.filter((student) =>
        expectedItems.some((item) => {
          const score = d[n][student.id + ":" + item];
          return score === "" || !Number.isFinite(Number(score));
        }),
      );

      if (!missingStudents.length) {
        p({ status: "success", text: "No students have missing scores." });
        return;
      }

      try {
        setCopyingMissing(!0);
        await navigator.clipboard.writeText(
          missingStudents.map((student) => student.name).join("\n"),
        );
        p({
          status: "success",
          text: `${missingStudents.length} student${missingStudents.length === 1 ? "" : "s"} with missing scores copied.`,
        });
      } catch {
        p({
          status: "error",
          text: "Could not copy students with missing scores. Check browser clipboard permissions.",
        });
      } finally {
        setCopyingMissing(!1);
      }
    };
  ee(() => {
    M(L(u, m, g));
    _((currentScores) => {
      const nextScores = G(i, u, m);
      return JSON.stringify(currentScores) === JSON.stringify(nextScores)
        ? currentScores
        : nextScores;
    });
  }, [i, u, g, m]);
  return React.createElement(
    "div",
    { className: "min-w-0" },
    React.createElement(
      "div",
      { className: "flex items-center justify-between gap-3 mt-[-3px] mx-0 mb-4 py-[7px] px-[9px] border border-white/10 rounded-xl bg-surface-2 max-[760px]:items-stretch max-[760px]:flex-col record-score-toolbar" },
      React.createElement(
        "label",
        { className: "flex items-center gap-1.5 shrink-0 text-ink-3 text-[9px] font-bold whitespace-nowrap [&_input]:box-border [&_input]:w-[145px] [&_input]:border [&_input]:border-white/10 [&_input]:rounded-[7px] [&_input]:bg-surface-1 [&_input]:text-ink-2 [&_input]:py-2 [&_input]:px-[9px] [&_input]:text-[10px] [&_input]:outline-none [&_input:focus]:border-accent/30 [&_input:focus]:[box-shadow:0_0_0_3px_#162032] max-[760px]:w-full max-[760px]:[&_input]:flex-1 max-[760px]:[&_input]:w-[auto]" },
        React.createElement("span", null, "Search student"),
        React.createElement("input", {
          name: "studentSearch",
          type: "search",
          value: P,
          placeholder: "Search name...",
          "aria-label": "Search student name",
          onChange: (e) => T(e.target.value),
        }),
      ),
      React.createElement(
        "div",
        { className: "flex gap-6.5 py-0 px-5 border-b border-white/10 [&_button]:border-0 [&_button]:border-b-2 [&_button]:border-transparent [&_button]:[background:none] [&_button]:text-ink-3 [&_button]:py-3 [&_button]:px-0 [&_button]:text-[10px] [&_button.active]:text-accent [&_button.active]:border-b-accent [&_button.active]:font-semibold [&_span]:text-ink-3 [&_span]:bg-surface-2 [&_span]:rounded-[10px] [&_span]:py-0.5 [&_span]:px-[5px] [&_span]:ml-[5px] [&_span]:text-[8px] max-[760px]:gap-4.5 max-[760px]:overflow-x-auto [.record-score-toolbar_&]:p-0 [.record-score-toolbar_&]:border-b-0 [.record-score-toolbar_&]:gap-4.5 [.record-score-toolbar_&]:overflow-x-auto [.record-score-toolbar_&]:bg-transparent [.record-score-toolbar_&_button]:py-2 [.record-score-toolbar_&_button]:px-0 [.record-score-toolbar_&_button]:text-[10px] [.record-score-toolbar_&_button]:whitespace-nowrap [.record-score-toolbar_&_button]:rounded-lg [.record-score-toolbar_&_button]:transition [.record-score-toolbar_&_button:hover]:text-accent [.record-score-toolbar_&_button:hover]:bg-surface-2 [.record-score-toolbar_&_button.active]:bg-surface-1 [.record-score-toolbar_&_button.active]:[box-shadow:0_3px_9px_rgba(0,240,255,0.05)] [.record-score-toolbar_&_button.active]:text-accent" },
        C.map((e) =>
          React.createElement(
            "button",
            {
              key: e.key,
              className: n === e.key ? "active" : "",
              onClick: () => R(e.key),
              disabled: N,
            },
            e.label,
            React.createElement("span", null, e.count),
          ),
        ),
      ),
      React.createElement(
        "select",
        {
          name: "gradingPeriod",
          className: "border border-white/10 rounded-[7px] bg-surface-1 text-ink-2 py-2 px-2.5 text-[10px]",
          value: m,
          disabled: N,
          onChange: (e) => B(e.target.value),
        },
        React.createElement("option", { value: "prelim" }, "Prelim"),
        React.createElement("option", { value: "midterm" }, "Midterm"),
        React.createElement("option", { value: "semifinal" }, "Semi-final"),
        React.createElement("option", { value: "final" }, "Final"),
      ),
      React.createElement(
        "span",
        { className: "text-accent text-[9px] font-semibold whitespace-nowrap py-[7px] px-2.5 border border-white/10 rounded-lg bg-surface-1 max-[760px]:self-end" },
        x.start && x.end
          ? `${D(x.start)} \u2013 ${D(x.end)}`
          : "No date range set",
      ),
    ),
    A.text &&
      React.createElement(
        "p",
        { className: `mt-0 mx-0 mb-3 py-[9px] px-[11px] rounded-[7px] text-[10px] [&.error]:border [&.error]:border-white/10 [&.error]:bg-surface-2 [&.error]:text-rose-300 [&.success]:border [&.success]:border-white/10 [&.success]:bg-surface-2 [&.success]:text-emerald-400 ${A.status}`, role: "status" },
        A.text,
      ),
    React.createElement(
      "div",
      { className: "overflow-x-auto [&_table]:[border-collapse:collapse] [&_table]:w-full [&_table]:min-w-[660px] [&_table]:text-left [&_th]:text-ink-3 [&_th]:bg-surface-2 [&_th]:text-[9px] [&_th]:font-semibold [&_th]:tracking-[.6px] [&_th]:py-[11px] [&_th]:px-5 [&_th]:border-b [&_th]:border-white/10 [&_th]:border-b-white/10 [&_td]:text-ink-2 [&_td]:text-[10px] [&_td]:py-3.5 [&_td]:px-5 [&_td]:border-b [&_td]:border-white/10 [&_td]:whitespace-nowrap [&_td]:border-b-white/10 [&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:hover]:bg-surface-1 [.action-modal_&_th]:bg-surface-2 [.action-modal_&_th]:text-ink-3 [.action-modal_&_th]:border-b-white/10 [.action-modal_&_th]:text-[9px] [.action-modal_&_th]:tracking-[.8px] [.action-modal_&_td]:text-ink-2 [.action-modal_&_td]:border-b-white/10 [.action-modal_&_tbody_tr:nth-child(even)]:bg-surface-1 [.action-modal_&_tbody_tr:hover]:bg-surface-2 max-h-[390px] border border-white/10 rounded-lg [&_table]:min-w-[700px] [&_th]:bg-surface-1 [&_td]:py-[11px] [&_td]:px-3 [&_input]:w-[45px] [&_input]:border [&_input]:border-white/10 [&_input]:rounded-[6px] [&_input]:py-[7px] [&_input]:px-1 [&_input]:text-center [&_input]:text-ink-2 [&_input]:text-[10px] [&_input:focus]:border-accent/30 [&_input:focus]:outline-none [&_input:focus]:[box-shadow:0_0_0_3px_#162032] [&_th>span]:block [&_th>label]:block [&_th>label]:mt-1 [&_th>label]:text-ink-3 [&_th>label]:text-[9px] [&_th>label]:font-medium [&_th:not(.record-student-col)]:min-w-[72px] [&_th:not(.record-student-col)]:text-center [.action-modal-wide_&]:max-h-[none] [.action-modal-wide_&]:overflow-x-auto [.action-modal-wide_&]:[overflow-y:hidden] max-[760px]:[.action-modal-wide_&]:max-h-[calc(100vh_-_245px)] [.action-modal-wide_&_table]:h-[auto] [.action-modal_&]:border-white/10 [.action-modal_&]:rounded-xl [.action-modal_&]:[box-shadow:0_5px_15px_rgba(0,240,255,0.02)] record-score-table" },
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
              { className: "min-w-[180px] record-student-col" },
              React.createElement(
                "div",
                { className: "flex items-center justify-between gap-2" },
                React.createElement("span", null, "STUDENT"),
                React.createElement(
                  "button",
                  {
                    type: "button",
                    className: "[flex:0_0_auto] border border-white/10 rounded-[5px] bg-surface-1 text-accent py-[5px] px-[7px] text-[8px] font-bold cursor-pointer transition hover:border-accent/30 hover:bg-surface-2 hover:text-accent hover:outline-none focus-visible:border-accent/30 focus-visible:bg-surface-2 focus-visible:text-accent focus-visible:outline-none active:[transform:translateY(1px)] [margin-left:auto] whitespace-nowrap",
                    title: "Copy students with missing scores",
                    "aria-label": "Copy students with missing scores",
                    onClick: () => void copyMissingStudents(),
                    disabled: N || F || copyingMissing,
                  },
                  copyingMissing ? "Copying..." : "Copy missing",
                ),
              ),
            ),
            Array.from({ length: c.count }, (e, r) => {
              const a = r + 1,
                o = c.key === "exam" ? c.prefix : `${c.prefix}${a}`;
              return React.createElement(
                "th",
                { key: a },
                React.createElement(
                  "div",
                  { className: "flex items-center justify-center gap-[3px] min-w-[62px] whitespace-nowrap [&_span]:text-ink-3 [&_span]:text-[9px] [&_span]:font-semibold" },
                  React.createElement("span", null, o, " /"),
                  React.createElement("input", {
                    name: `max-score-${c.key}-${a}`,
                    className: "[.record-score-table_&]:w-[34px] [.record-score-table_&]:py-[3px] [.record-score-table_&]:px-0.5 [.record-score-table_&]:border [.record-score-table_&]:border-white/10 [.record-score-table_&]:bg-surface-1 [.record-score-table_&]:text-accent [.record-score-table_&]:text-[9px] [.record-score-table_&]:font-bold [.record-score-table_&]:box-border [.record-score-table_&]:m-0 [.record-score-table_&]:rounded [.record-score-table_&]:text-center [.record-score-table_&:focus]:border-accent/30 [.record-score-table_&:focus]:[box-shadow:0_0_0_2px_#162032]",
                    "aria-label": c.label + " " + a + " maximum score",
                    type: "number",
                    min: "1",
                    step: "0.01",
                    value: v[String(a)],
                    onChange: (f) => W(a, f.target.value),
                  }),
                ),
              );
            }),
            React.createElement("th", null, "AVERAGE"),
            React.createElement("th", null, "GRADE POINT"),
          ),
        ),
        React.createElement(
          "tbody",
          null,
          q.map((e) => {
            const r = H(e),
              a = I && k && Number.isFinite(r) ? K(e).toFixed(2) : "\u2014";
            return React.createElement(
              "tr",
              { key: e.id },
              React.createElement(
                "td",
                null,
                React.createElement(
                  "div",
                  { className: "flex items-center gap-[9px] text-ink-2 font-semibold [.record-score-table_&>span:nth-child(2)]:min-w-0 [.record-score-table_&>span:nth-child(2)]:overflow-hidden [.record-score-table_&>span:nth-child(2)]:text-ellipsis [.grades-table_&]:gap-[9px] [.grades-table_&>span:last-child]:flex [.grades-table_&>span:last-child]:flex-col [.grades-table_&>span:last-child]:gap-[3px] [.grades-table_&_b]:text-ink-2 [.grades-table_&_b]:text-[10px] [.grades-table_&_small]:text-ink-3 [.grades-table_&_small]:text-[9px] [.record-summary-table_&]:gap-[9px] [.record-summary-table_&>span:last-child]:flex [.record-summary-table_&>span:last-child]:flex-col [.record-summary-table_&>span:last-child]:gap-[3px] [.record-summary-table_&_b]:text-ink-2 [.record-summary-table_&_b]:text-[10px] [.record-summary-table_&_small]:text-ink-3 [.record-summary-table_&_small]:text-[9px]" },
                  React.createElement(
                    "span",
                    { className: "grid place-items-center w-[28px] h-[28px] rounded-[9px] bg-surface-2 text-accent text-[9px] font-bold [.action-modal_&]:[box-shadow:0_0_0_3px_#162032]" },
                    e.initials,
                  ),
                  React.createElement("span", null, e.name),
                  React.createElement(
                    "button",
                    {
                      type: "button",
                      className: "[flex:0_0_auto] border border-white/10 rounded-[5px] bg-surface-1 text-accent py-[5px] px-[7px] text-[8px] font-bold cursor-pointer transition hover:border-accent/30 hover:bg-surface-2 hover:text-accent hover:outline-none focus-visible:border-accent/30 focus-visible:bg-surface-2 focus-visible:text-accent focus-visible:outline-none active:[transform:translateY(1px)]",
                      title: `Copy ${e.name}`,
                      "aria-label": `Copy ${e.name}`,
                      onClick: () => copyStudentName(e),
                    },
                    copiedStudentId === e.id ? "Copied" : "Copy",
                  ),
                ),
              ),
              Array.from({ length: c.count }, (o, f) => {
                const l = f + 1,
                  S = Number(v[String(l)]);
                return React.createElement(
                  "td",
                  { key: l },
                  React.createElement("input", {
                    name: `score-${n}-${e.id}-${l}`,
                    "aria-label": e.name + " item " + l,
                    type: "number",
                    min: "0",
                    step: "0.01",
                    value: d[n][e.id + ":" + l],
                    disabled: !S,
                    onChange: (X) => U(e.id, l, X.target.value),
                  }),
                );
              }),
              React.createElement(
                "td",
                { className: "text-ink-2! font-bold" },
                r.toFixed(1),
              ),
              React.createElement(
                "td",
                null,
                React.createElement(
                  "span",
                  { className: "inline-block min-w-[38px] py-1.5 px-[7px] rounded-[6px] bg-surface-2 text-emerald-400 text-[10px] font-bold text-center" },
                  a,
                ),
              ),
            );
          }),
        ),
      ),
      !i.length &&
        React.createElement(
          "div",
          { className: "py-8 text-center text-xs text-ink-3" },
          "No students are enrolled in this class.",
        ),
      i.length > 0 &&
        !q.length &&
        React.createElement(
          "div",
          { className: "py-8 text-center text-xs text-ink-3" },
          "No students match your search.",
        ),
    ),
    React.createElement(
      "div",
      { className: "flex justify-end gap-2 mt-5.5 pt-[17px] border-t border-white/10 max-[760px]:flex-wrap max-[760px]:[&_button]:flex-1 [.assessment-builder_&]:mt-0.5" },
      React.createElement(
        "button",
        { className: "inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50", onClick: h },
        "Cancel",
      ),
      React.createElement(
        "button",
        { className: "inline-flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-canvas transition hover:shadow-halo active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50", onClick: J, disabled: N || F },
        N || F ? "Saving\u2026" : "Save scores",
      ),
    ),
  );
}
export { w as ScoreForm };
