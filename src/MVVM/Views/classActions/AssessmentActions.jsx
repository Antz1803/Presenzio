import React, { useState as v } from "react";
import { localDateTimeInputValue as ee } from "./actionUtils";
import { ModalShell as V } from "./ActionModalShell";
import { RichTextEditor as te } from "./Richtexteditor";
import {
  assessmentCategories as z,
  assessmentPeriods as J,
  assessmentItemLimits as se,
  itemNoOptions as G,
} from "./assessmentConfig";
const K = [
    { key: "sql", label: "SQL" },
    { key: "c", label: "C" },
    { key: "cpp", label: "C++" },
    { key: "csharp", label: "C#" },
    { key: "javascript", label: "JavaScript" },
  ],
  L = ["A", "B", "C", "D"];
function Q(g = "multiple_choice") {
  return {
    type: g,
    prompt: "",
    points: "1",
    choices: ["", "", "", ""],
    correctAnswer: "A",
    language: "sql",
    starterCode: "",
    expectedOutput: "",
    nearMatchScorePercent: "50",
    incorrectScorePercent: "0",
  };
}
function ie(g) {
  const u = String(g ?? "").replace(/\r/g, "").split(`
`),
    w = [];
  let p = null,
    n = !1;
  const S = () => {
    (p?.prompt.trim() && w.push(p), (p = null));
  };
  return (
    u.forEach((d) => {
      const m = d.trim();
      if (!m) {
        n = !!p;
        return;
      }
      const E = m.match(/^(?:question\s*|q\s*)?(\d+)\s*[.):-]\s*(.+)$/i);
      if (E) {
        (S(),
          (p = { prompt: E[2].trim(), choices: {}, correctAnswer: "A" }),
          (n = !1));
        return;
      }
      const i = m.match(
          /^(?:correct\s*)?(?:answer|ans|choice)\s*[:-]?\s*([a-d1-4])\b/i,
        ),
        h = m.match(/^([a-d1-4])\s*[.):-]\s*(.+)$/i);
      if (i) {
        if (p) {
          const y = i[1].toUpperCase();
          p.correctAnswer = /[1-4]/.test(y)
            ? String.fromCharCode(64 + Number(y))
            : y;
        }
        n = !1;
        return;
      }
      if (h) {
        p || (p = { prompt: "", choices: {}, correctAnswer: "A" });
        const y = h[1].toUpperCase(),
          D = /[1-4]/.test(y) ? String.fromCharCode(64 + Number(y)) : y;
        ((p.choices[D] = h[2].trim()), (n = !1));
        return;
      }
      (p
        ? n && Object.keys(p.choices).length >= 2
          ? (S(), (p = { prompt: m, choices: {}, correctAnswer: "A" }))
          : (p.prompt = `${p.prompt} ${m}`.trim())
        : (p = { prompt: m, choices: {}, correctAnswer: "A" }),
        (n = !1));
    }),
    S(),
    w.map((d) => ({
      ...Q(),
      prompt: d.prompt,
      choices: L.map((m) => d.choices[m] ?? ""),
      correctAnswer: d.correctAnswer,
    }))
  );
}
function oe(g, { language: u } = {}) {
  const w = String(g ?? "").replace(/\r/g, "").split(`
`),
    p = [];
  let n = null;
  const S = () => {
    if (!n) return;
    const d = n.promptLines
        .join(
          `
`,
        )
        .trim(),
      m = n.answerLines
        .join(
          `
`,
        )
        .trim();
    (d && p.push({ prompt: d, expectedOutput: m }), (n = null));
  };
  return (
    w.forEach((d) => {
      const m = d.trim(),
        E = m.match(/^(?:question\s*|q\s*)?(\d+)\s*[.):-]\s*(.+)$/i);
      if (E) {
        (S(),
          (n = { promptLines: [E[2].trim()], answerLines: [], inAnswer: !1 }));
        return;
      }
      if (n) {
        if (!n.inAnswer) {
          const i = m.match(/^answer\s*:?\s*(.*)$/i);
          if (i) {
            ((n.inAnswer = !0), i[1] && n.answerLines.push(i[1]));
            return;
          }
          m && n.promptLines.push(m);
          return;
        }
        n.answerLines.push(d.trimEnd());
      }
    }),
    S(),
    p.map(({ prompt: d, expectedOutput: m }) => ({
      ...Q("coding"),
      prompt: d,
      language: u || "sql",
      expectedOutput: m,
    }))
  );
}
function re({ section: g, assessments: u = [], onSave: w, onClose: p }) {
  const [n, S] = v({
      title: "",
      category: "quiz",
      itemNo: "1",
      period: "prelim",
      instructions: "",
      timeLimitMinutes: "",
      availableFrom: "",
      availableUntil: "",
    }),
    [d, m] = v(() => [Q()]),
    [E, i] = v(""),
    [h, y] = v("multiple_choice"),
    [D, R] = v("sql"),
    [C, M] = v(!1),
    [$, O] = v({ status: "", text: "" }),
    [F, U] = v({ status: "", text: "" }),
    [N, r] = v(null),
    [A, k] = v(!1),
    P = d.reduce((t, o) => t + Number(o.points || 0), 0),
    b = u.find(
      (t) =>
        t.category === n.category &&
        t.period?.code === n.period &&
        Number(t.item_no) === Number(n.itemNo),
    ),
    _ = (t, o) =>
      S((l) => {
        if (t === "category") {
          const e = se[o] ?? 4,
            s = Math.min(Math.max(Number(l.itemNo || 1), 1), e);
          return { ...l, category: o, itemNo: String(s) };
        }
        return { ...l, [t]: o };
      }),
    T = (t, o, l) => {
      m((e) => e.map((s, a) => (a === t ? { ...s, [o]: l } : s)));
    },
    q = (t, o, l) => {
      m((e) =>
        e.map((s, a) =>
          a === t
            ? { ...s, choices: s.choices.map((c, f) => (f === o ? l : c)) }
            : s,
        ),
      );
    },
    I = (t, o) => {
      m((l) =>
        l.map((e, s) =>
          s === t ? { ...Q(o), prompt: e.prompt, points: e.points } : e,
        ),
      );
    },
    Y = () => {
      const t = h === "coding" ? oe(E, { language: D }) : ie(E);
      if (!t.length) {
        U({
          status: "error",
          text:
            h === "coding"
              ? 'No questions found. Number each question and add an "Answer:" line with the code or query.'
              : "No questions found. Number each question and add choices such as A. Choice text.",
        });
        return;
      }
      (m(t),
        U({
          status: "success",
          text: `${t.length} question${t.length === 1 ? "" : "s"} generated. Review them below before saving.`,
        }));
    },
    W = () => {
      if (!n.title.trim()) return "Enter an assessment title.";
      if (!d.length) return "Add at least one question.";
      if (
        n.timeLimitMinutes &&
        (!Number.isInteger(Number(n.timeLimitMinutes)) ||
          Number(n.timeLimitMinutes) < 1)
      )
        return "Time limit must be a whole number of minutes.";
      if (
        n.availableFrom &&
        n.availableUntil &&
        n.availableFrom >= n.availableUntil
      )
        return "The answer window end must be after the start.";
      for (const [t, o] of d.entries()) {
        if (!o.prompt.trim()) return `Enter the prompt for question ${t + 1}.`;
        if (!Number.isFinite(Number(o.points)) || Number(o.points) <= 0)
          return `Enter valid points for question ${t + 1}.`;
        if (o.type === "multiple_choice") {
          if (o.choices.some((l) => !l.trim()))
            return `Complete all choices for question ${t + 1}.`;
          if (!o.correctAnswer)
            return `Select the correct answer for question ${t + 1}.`;
        } else {
          const l = Number(o.nearMatchScorePercent);
          if (!Number.isFinite(l) || l < 0 || l > 100)
            return `Enter a near-match score between 0 and 100 for question ${t + 1}.`;
          const e = Number(o.incorrectScorePercent);
          if (!Number.isFinite(e) || e < 0 || e > 100)
            return `Enter an incorrect score between 0 and 100 for question ${t + 1}.`;
        }
      }
      return "";
    },
    B = async (t, o) => {
      (M(!0), O({ status: "", text: "" }));
      try {
        const l = await w({
          ...n,
          title: n.title.trim(),
          itemNo: Number(n.itemNo),
          instructions: n.instructions.trim(),
          timeLimitMinutes: n.timeLimitMinutes
            ? Number(n.timeLimitMinutes)
            : null,
          availableFrom: n.availableFrom,
          availableUntil: n.availableUntil,
          replaceAssessmentId: t,
          overwriteScores: o,
          questions: d.map((e) => ({
            type: e.type,
            prompt: e.prompt.trim(),
            points: Number(e.points),
            choices: e.type === "multiple_choice" ? e.choices : [],
            correctAnswer:
              e.type === "multiple_choice" ? e.correctAnswer : null,
            language: e.type === "coding" ? e.language : null,
            starterCode: e.type === "coding" ? e.starterCode : null,
            expectedOutput: e.type === "coding" ? e.expectedOutput : null,
            nearMatchScorePercent:
              e.type === "coding" ? Number(e.nearMatchScorePercent) : null,
            incorrectScorePercent:
              e.type === "coding" ? Number(e.incorrectScorePercent) : null,
          })),
        });
        (O({
          status: "success",
          text: `Assessment saved. Key ID: ${l?.access_key ?? "available in Firebase"}`,
        }),
          S((e) => ({
            ...e,
            title: "",
            instructions: "",
            timeLimitMinutes: "",
            itemNo: "1",
          })),
          m([Q()]));
      } catch (l) {
        l?.conflict
          ? r(l.conflict)
          : l?.scoreConflict
            ? k(!0)
            : O({
                status: "error",
                text: l?.message || "Assessment could not be saved.",
              });
      } finally {
        M(!1);
      }
    },
    j = async (t) => {
      t.preventDefault();
      const o = W();
      if (o) {
        O({ status: "error", text: o });
        return;
      }
      if (b) {
        r(b);
        return;
      }
      await B();
    },
    H = async () => {
      if (!N) return;
      const t = N.id;
      (r(null), await B(t));
    },
    X = async () => {
      (k(!1), await B(void 0, !0));
    };
  return React.createElement(
    V,
    { title: "Create Assessment", section: g, onClose: p, size: "wide" },
    React.createElement(
      "form",
      { className: "flex flex-col gap-4 [&_textarea]:box-border [&_textarea]:w-full [&_textarea]:[resize:vertical] [&_textarea]:border [&_textarea]:border-white/10 [&_textarea]:rounded-[9px] [&_textarea]:bg-surface-1 [&_textarea]:text-ink-2 [&_textarea]:p-2.5 [&_textarea]:font-medium [&_textarea]:text-[11px] [&_textarea]:font-display [&_textarea]:outline-none [&_textarea:focus]:border-accent/30 [&_textarea:focus]:[box-shadow:0_0_0_3px_#162032] assessment-builder", onSubmit: j },
      React.createElement(
        "div",
        { className: "flex items-center justify-between gap-3 py-[15px] px-4 border border-white/10 rounded-[14px] bg-surface-2 [&>div]:flex [&>div]:items-center [&>div]:gap-[11px] [&_h3]:m-0 [&_h3]:text-ink-2 [&_h3]:text-[13px] [&_p]:mt-1 [&_p]:mx-0 [&_p]:mb-0 [&_p]:text-ink-3 [&_p]:text-[10px] max-[760px]:items-start max-[760px]:flex-col" },
        React.createElement(
          "div",
          null,
          React.createElement(
            "span",
            { className: "[.student-viewer-empty_&]:mb-2.5 grid place-items-center w-[34px] h-[34px] rounded-[11px] bg-surface-2 text-accent text-[18px]" },
            "\u{1F4DD}",
          ),
          React.createElement(
            "div",
            null,
            React.createElement("h3", null, "Build an assessment"),
            React.createElement(
              "p",
              null,
              "Create questions for your class and grading period.",
            ),
          ),
        ),
        React.createElement(
          "div",
          { className: "flex items-center gap-2 assessment-builder-summary" },
          React.createElement(
            "span",
            { className: "py-1.5 px-[9px] rounded-[7px] bg-surface-1 text-accent text-[9px] font-extrabold whitespace-nowrap max-[760px]:self-end [.assessment-builder-summary_&]:bg-surface-1" },
            d.length,
            " ",
            d.length === 1 ? "question" : "questions",
          ),
          React.createElement(
            "span",
            { className: "flex items-center gap-[7px] py-1.5 px-[9px] border border-white/10 rounded-[7px] bg-surface-2 [&_small]:text-emerald-300 [&_small]:text-[7px] [&_small]:font-extrabold [&_small]:tracking-[.8px] [&_strong]:text-emerald-400 [&_strong]:text-[10px]" },
            React.createElement("small", null, "MAXIMUM SCORE"),
            React.createElement("strong", null, P.toFixed(2)),
          ),
        ),
      ),
      React.createElement(
        "div",
        { className: "grid grid-cols-[repeat(2,1fr)] gap-3 [&.single]:grid-cols-[1fr] [&_label]:flex [&_label]:flex-col [&_label]:gap-1.5 [&_label]:text-ink-2 [&_label]:text-[10px] [&_label]:font-semibold [&_input]:w-full [&_input]:box-border [&_input]:border [&_input]:border-white/10 [&_input]:rounded-[7px] [&_input]:bg-surface-1 [&_input]:text-ink-2 [&_input]:p-[9px] [&_input]:text-[11px] [&_input]:outline-none [&_select]:w-full [&_select]:box-border [&_select]:border [&_select]:border-white/10 [&_select]:rounded-[7px] [&_select]:bg-surface-1 [&_select]:text-ink-2 [&_select]:p-[9px] [&_select]:text-[11px] [&_select]:outline-none [&_input:focus]:border-accent/30 [&_input:focus]:[box-shadow:0_0_0_3px_#162032] [&_select:focus]:border-accent/30 [&_select:focus]:[box-shadow:0_0_0_3px_#162032] max-[760px]:grid-cols-[repeat(2,1fr)] [.action-modal_&_label]:text-ink-2 [.action-modal_&_label]:text-[10px] [.action-modal_&_label]:tracking-[.1px] [.action-modal_&_input]:border-white/10 [.action-modal_&_input]:rounded-[9px] [.action-modal_&_input]:bg-surface-1 [.action-modal_&_input]:[box-shadow:0_2px_5px_rgba(0,240,255,0.01)] [.action-modal_&_input]:transition [.action-modal_&_select]:border-white/10 [.action-modal_&_select]:rounded-[9px] [.action-modal_&_select]:bg-surface-1 [.action-modal_&_select]:[box-shadow:0_2px_5px_rgba(0,240,255,0.01)] [.action-modal_&_select]:transition [.action-modal_&_input:hover]:border-accent/30 [.action-modal_&_select:hover]:border-accent/30 [.action-modal_&_input:focus]:border-accent/30 [.action-modal_&_input:focus]:[box-shadow:0_0_0_3px_#162032] [.action-modal_&_select:focus]:border-accent/30 [.action-modal_&_select:focus]:[box-shadow:0_0_0_3px_#162032] grid-cols-[minmax(0,2fr)_minmax(130px,1fr)_minmax(130px,1fr)] max-[760px]:grid-cols-[1fr]" },
        React.createElement(
          "label",
          null,
          "Assessment title",
          React.createElement("input", {
            name: "assessmentTitle",
            required: !0,
            value: n.title,
            placeholder: "e.g. Introduction to SQL",
            onChange: (t) => _("title", t.target.value),
          }),
        ),
        React.createElement(
          "label",
          null,
          "Type",
          React.createElement(
            "select",
            {
              name: "assessmentCategory",
              value: n.category,
              onChange: (t) => _("category", t.target.value),
            },
            z.map((t) =>
              React.createElement(
                "option",
                { value: t.key, key: t.key },
                t.label,
              ),
            ),
          ),
        ),
        React.createElement(
          "label",
          null,
          "Item number",
          React.createElement(
            "select",
            {
              name: "assessmentItemNo",
              value: n.itemNo,
              onChange: (t) => _("itemNo", t.target.value),
            },
            G(n.category).map((t) => {
              const o = u.find(
                (l) =>
                  l.category === n.category &&
                  l.period?.code === n.period &&
                  Number(l.item_no) === Number(t.value),
              );
              return React.createElement(
                "option",
                { value: t.value, key: t.value },
                t.label,
                o ? ` \u2014 in use: ${o.title}` : "",
              );
            }),
          ),
        ),
        React.createElement(
          "label",
          null,
          "Grading period",
          React.createElement(
            "select",
            {
              name: "assessmentPeriod",
              value: n.period,
              onChange: (t) => _("period", t.target.value),
            },
            J.map((t) =>
              React.createElement(
                "option",
                { value: t.key, key: t.key },
                t.label,
              ),
            ),
          ),
        ),
        React.createElement(
          "label",
          null,
          "Available from ",
          React.createElement("span", null, "(optional)"),
          React.createElement("input", {
            name: "assessmentAvailableFrom",
            type: "datetime-local",
            value: n.availableFrom,
            onChange: (t) => _("availableFrom", t.target.value),
          }),
        ),
        React.createElement(
          "label",
          null,
          "Available until ",
          React.createElement("span", null, "(optional)"),
          React.createElement("input", {
            name: "assessmentAvailableUntil",
            type: "datetime-local",
            value: n.availableUntil,
            onChange: (t) => _("availableUntil", t.target.value),
          }),
        ),
        React.createElement(
          "label",
          null,
          "Time limit ",
          React.createElement("span", null, "(minutes, optional)"),
          React.createElement("input", {
            name: "assessmentTimeLimit",
            type: "number",
            min: "1",
            step: "1",
            value: n.timeLimitMinutes,
            placeholder: "e.g. 30",
            onChange: (t) => _("timeLimitMinutes", t.target.value),
          }),
        ),
      ),
      b &&
        React.createElement(
          "p",
          {
            className: "[grid-column:1/-1] m-0 text-ink-3 text-[9px] font-medium assessment-slot-conflict",
            role: "status",
          },
          G(n.category).find((t) => t.value === n.itemNo)?.label,
          " is currently assigned to \u201C",
          b.title,
          "\u201D. Saving will ask you to confirm replacing it.",
        ),
      React.createElement(
        "p",
        { className: "mt-[15px] mx-0 mb-0 text-ink-3 text-[10px] leading-[1.5] [.period-settings-list>&]:mt-0 [.period-settings-list>&]:mx-0 [.period-settings-list>&]:mb-1 [.period-settings-list>&]:py-[11px] [.period-settings-list>&]:px-[13px] [.period-settings-list>&]:border [.period-settings-list>&]:border-white/10 [.period-settings-list>&]:rounded-[9px] [.period-settings-list>&]:bg-surface-1 [.action-modal_&]:text-ink-3 [.action-modal_&]:leading-[1.65]" },
        "Students can submit once by default. Grant another attempt to an individual student from Manage Assessments.",
      ),
      React.createElement(
        "label",
        { className: "flex flex-col gap-1.5 text-ink-2 text-[10px] font-bold [&_span]:text-ink-3 [&_span]:font-medium" },
        "Instructions ",
        React.createElement("span", null, "(optional)"),
        React.createElement(te, {
          value: n.instructions,
          onChange: (t) => _("instructions", t),
          placeholder: "Add instructions for your students...",
          uploadPathPrefix: `assessments/${g?.id ?? "new"}`,
        }),
      ),
      React.createElement(
        "section",
        { className: "my-4.5 mx-0 p-[15px] border border-white/10 rounded-[10px] bg-surface-2 [&>textarea]:box-border [&>textarea]:w-full [&>textarea]:border [&>textarea]:border-white/10 [&>textarea]:rounded-[7px] [&>textarea]:bg-surface-1 [&>textarea]:text-ink-2 [&>textarea]:p-2.5 [&>textarea]:text-[10px] [&>textarea]:leading-[1.5] [&>textarea]:[resize:vertical] [&>textarea]:outline-none [&>textarea:focus]:border-accent/30 [&>textarea:focus]:[box-shadow:0_0_0_3px_#162032]" },
        React.createElement(
          "div",
          { className: "flex items-start justify-between gap-[15px] mb-2.5 [&_strong]:block [&_strong]:text-ink-2 [&_strong]:text-[11px] [&_p]:mt-1 [&_p]:mx-0 [&_p]:mb-0 [&_p]:text-ink-3 [&_p]:text-[9px] [&>span]:text-accent [&>span]:text-[8px] [&>span]:font-extrabold [&>span]:tracking-[1px] [&>span]:whitespace-nowrap max-[760px]:items-start max-[760px]:flex-col" },
          React.createElement(
            "div",
            null,
            React.createElement(
              "strong",
              null,
              "Generate questions from pasted text",
            ),
            React.createElement(
              "p",
              null,
              h === "coding"
                ? 'Paste numbered questions, each followed by an "Answer:" line with the code or query.'
                : "Paste numbered questions with A\u2013D choices and optional answer lines.",
            ),
          ),
          React.createElement("span", null, "PASTE & GENERATE"),
        ),
        React.createElement(
          "div",
          { className: "flex gap-1.5 mb-3.5 [&_button]:border [&_button]:border-white/10 [&_button]:rounded-lg [&_button]:bg-surface-1 [&_button]:text-ink-3 [&_button]:py-[7px] [&_button]:px-2.5 [&_button]:text-[9px] [&_button]:font-bold [&_button]:cursor-pointer [&_button.active]:border-accent/30 [&_button.active]:bg-surface-2 [&_button.active]:text-accent" },
          React.createElement(
            "button",
            {
              type: "button",
              className: h === "multiple_choice" ? "active" : "",
              onClick: () => y("multiple_choice"),
            },
            "Multiple choice",
          ),
          React.createElement(
            "button",
            {
              type: "button",
              className: h === "coding" ? "active" : "",
              onClick: () => y("coding"),
            },
            "Coding",
          ),
        ),
        h === "coding" &&
          React.createElement(
            "label",
            { className: "assessment-paste-language-field" },
            "Language for generated questions",
            React.createElement(
              "select",
              {
                name: "pasteCodingLanguage",
                value: D,
                onChange: (t) => R(t.target.value),
              },
              K.map((t) =>
                React.createElement(
                  "option",
                  { value: t.key, key: t.key },
                  t.label,
                ),
              ),
            ),
          ),
        React.createElement("textarea", {
          name: "questionGeneratorText",
          rows: "7",
          value: E,
          placeholder:
            h === "coding"
              ? `Example:
1. Write a query to list all students and their enrolled courses.
Answer: SELECT s.Name, e.CourseID
FROM Students s
LEFT JOIN Enrollment e
    ON s.StudentID = e.StudentID;

2. Write a query to list students and course names.
Answer: SELECT s.Name, c.CourseName
FROM Students s
INNER JOIN Enrollment e ON s.StudentID = e.StudentID
INNER JOIN Courses c ON e.CourseID = c.CourseID;`
              : `Example:
1. What is 2 + 2?
A. 3
B. 4
C. 5
D. 6
Answer: B`,
          onChange: (t) => i(t.target.value),
        }),
        React.createElement(
          "div",
          { className: "flex items-center justify-between gap-3 mt-[9px] [&_small]:text-ink-3 [&_small]:text-[9px] max-[760px]:items-start max-[760px]:flex-col question-generator-footer" },
          React.createElement(
            "small",
            null,
            "Generated questions remain editable below.",
          ),
          React.createElement(
            "button",
            { type: "button", className: "inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50", onClick: Y },
            "Generate questions",
          ),
        ),
        F.text &&
          React.createElement(
            "p",
            {
              className: `mt-2 mx-0 mb-0 text-[9px] [&.success]:text-emerald-400 [&.error]:text-rose-300 ${F.status}`,
              role: "status",
            },
            F.text,
          ),
      ),
      React.createElement(
        "div",
        { className: "[.assessment-manager-editor_&]:max-h-[475px] [.assessment-manager-editor_&]:overflow-auto [.assessment-manager-editor_&]:pt-0.5 [.assessment-manager-editor_&]:px-[3px] [.assessment-manager-editor_&]:pb-[3px] max-[760px]:[.assessment-manager-editor_&]:max-h-[none] flex flex-col gap-[13px]" },
        d.map((t, o) =>
          React.createElement(
            "article",
            { className: "[.assessment-manager-editor_&]:[box-shadow:none] [&_label]:flex [&_label]:flex-col [&_label]:gap-1.5 [&_label]:text-ink-2 [&_label]:text-[10px] [&_label]:font-bold [&_label>span:not(.choice-letter)]:text-ink-3 [&_label>span:not(.choice-letter)]:font-medium p-[17px] border border-white/10 rounded-[14px] bg-surface-1 [box-shadow:0_5px_16px_rgba(0,240,255,0.02)]", key: o },
            React.createElement(
              "div",
              { className: "flex items-start justify-between gap-2.5 mb-[13px] [&_div]:flex [&_div]:flex-col [&_div]:gap-1 [&_span]:text-accent [&_span]:text-[8px] [&_span]:font-extrabold [&_span]:tracking-[1.3px] [&_strong]:text-ink-2 [&_strong]:text-[12px]" },
              React.createElement(
                "div",
                null,
                React.createElement("span", null, "QUESTION ", o + 1),
                React.createElement(
                  "strong",
                  null,
                  t.type === "multiple_choice"
                    ? "Multiple choice"
                    : "Coding question",
                ),
              ),
              d.length > 1 &&
                React.createElement(
                  "button",
                  {
                    type: "button",
                    className: "border-0 bg-transparent text-rose-300 text-[10px] font-bold cursor-pointer",
                    onClick: () => m((l) => l.filter((e, s) => s !== o)),
                  },
                  "Remove",
                ),
            ),
            React.createElement(
              "div",
              { className: "flex gap-1.5 mb-3.5 [&_button]:border [&_button]:border-white/10 [&_button]:rounded-lg [&_button]:bg-surface-1 [&_button]:text-ink-3 [&_button]:py-[7px] [&_button]:px-2.5 [&_button]:text-[9px] [&_button]:font-bold [&_button]:cursor-pointer [&_button.active]:border-accent/30 [&_button.active]:bg-surface-2 [&_button.active]:text-accent" },
              React.createElement(
                "button",
                {
                  type: "button",
                  className: t.type === "multiple_choice" ? "active" : "",
                  onClick: () => I(o, "multiple_choice"),
                },
                "Multiple choice",
              ),
              React.createElement(
                "button",
                {
                  type: "button",
                  className: t.type === "coding" ? "active" : "",
                  onClick: () => I(o, "coding"),
                },
                "Coding",
              ),
            ),
            React.createElement(
              "div",
              { className: "grid grid-cols-[repeat(2,1fr)] gap-3 [&.single]:grid-cols-[1fr] [&_label]:flex [&_label]:flex-col [&_label]:gap-1.5 [&_label]:text-ink-2 [&_label]:text-[10px] [&_label]:font-semibold [&_input]:w-full [&_input]:box-border [&_input]:border [&_input]:border-white/10 [&_input]:rounded-[7px] [&_input]:bg-surface-1 [&_input]:text-ink-2 [&_input]:p-[9px] [&_input]:text-[11px] [&_input]:outline-none [&_select]:w-full [&_select]:box-border [&_select]:border [&_select]:border-white/10 [&_select]:rounded-[7px] [&_select]:bg-surface-1 [&_select]:text-ink-2 [&_select]:p-[9px] [&_select]:text-[11px] [&_select]:outline-none [&_input:focus]:border-accent/30 [&_input:focus]:[box-shadow:0_0_0_3px_#162032] [&_select:focus]:border-accent/30 [&_select:focus]:[box-shadow:0_0_0_3px_#162032] max-[760px]:grid-cols-[repeat(2,1fr)] [.action-modal_&_label]:text-ink-2 [.action-modal_&_label]:text-[10px] [.action-modal_&_label]:tracking-[.1px] [.action-modal_&_input]:border-white/10 [.action-modal_&_input]:rounded-[9px] [.action-modal_&_input]:bg-surface-1 [.action-modal_&_input]:[box-shadow:0_2px_5px_rgba(0,240,255,0.01)] [.action-modal_&_input]:transition [.action-modal_&_select]:border-white/10 [.action-modal_&_select]:rounded-[9px] [.action-modal_&_select]:bg-surface-1 [.action-modal_&_select]:[box-shadow:0_2px_5px_rgba(0,240,255,0.01)] [.action-modal_&_select]:transition [.action-modal_&_input:hover]:border-accent/30 [.action-modal_&_select:hover]:border-accent/30 [.action-modal_&_input:focus]:border-accent/30 [.action-modal_&_input:focus]:[box-shadow:0_0_0_3px_#162032] [.action-modal_&_select:focus]:border-accent/30 [.action-modal_&_select:focus]:[box-shadow:0_0_0_3px_#162032] grid-cols-[minmax(0,1fr)_105px] max-[760px]:grid-cols-[1fr]" },
              React.createElement(
                "label",
                { className: "[grid-column:1]" },
                "Question prompt",
                React.createElement("textarea", {
                  name: `question-${o}-prompt`,
                  required: !0,
                  rows: "3",
                  value: t.prompt,
                  placeholder: "Write your question here...",
                  onChange: (l) => T(o, "prompt", l.target.value),
                }),
              ),
              React.createElement(
                "label",
                null,
                "Points",
                React.createElement("input", {
                  name: `question-${o}-points`,
                  type: "number",
                  min: "0.01",
                  step: "0.01",
                  value: t.points,
                  onChange: (l) => T(o, "points", l.target.value),
                }),
              ),
            ),
            t.type === "multiple_choice"
              ? React.createElement(
                  "div",
                  { className: "[.assessment-manager-editor_&]:mt-[3px] grid grid-cols-[1fr_1fr] [gap:10px_12px] mt-[3px] [&_label]:grid [&_label]:grid-cols-[23px_minmax(0,1fr)_20px] [&_label]:items-center [&_label]:gap-[7px] [&_input:not(.choice-radio)]:min-w-0 max-[760px]:grid-cols-[1fr]" },
                  t.choices.map((l, e) =>
                    React.createElement(
                      "label",
                      { key: L[e] },
                      React.createElement(
                        "span",
                        { className: "[.student-portal-options_&]:w-[24px] [.student-portal-options_&]:h-[24px] [.student-choice-list_&]:w-[24px] [.student-choice-list_&]:h-[24px] grid place-items-center w-[23px] h-[23px] rounded-[7px] bg-surface-2 text-accent text-[9px] font-extrabold choice-letter" },
                        L[e],
                      ),
                      React.createElement("input", {
                        name: `question-${o}-choice-${e}`,
                        required: !0,
                        value: l,
                        placeholder: `Choice ${L[e]}`,
                        onChange: (s) => q(o, e, s.target.value),
                      }),
                      React.createElement("input", {
                        className: "[.assessment-builder_&]:w-[15px] [.assessment-builder_&]:h-[15px] [.assessment-builder_&]:[accent-color:#00F0FF] choice-radio",
                        type: "radio",
                        name: `correct-answer-${o}`,
                        checked: t.correctAnswer === L[e],
                        onChange: () => T(o, "correctAnswer", L[e]),
                        "aria-label": `Mark choice ${L[e]} as correct`,
                      }),
                    ),
                  ),
                  React.createElement(
                    "p",
                    { className: "[grid-column:1/-1] m-0 text-ink-3 text-[9px] font-medium" },
                    "Select the radio button beside the correct answer.",
                  ),
                )
              : React.createElement(
                  "div",
                  { className: "grid grid-cols-[170px_1fr_1fr] gap-3 [&_label]:flex [&_label]:flex-col [&_label]:gap-1.5 [&_label]:text-ink-2 [&_label]:text-[10px] [&_label]:font-bold [&_textarea]:text-[10px] max-[760px]:grid-cols-[1fr]" },
                  React.createElement(
                    "label",
                    null,
                    "Programming language",
                    React.createElement(
                      "select",
                      {
                        name: `question-${o}-language`,
                        value: t.language,
                        onChange: (l) => T(o, "language", l.target.value),
                      },
                      K.map((l) =>
                        React.createElement(
                          "option",
                          { value: l.key, key: l.key },
                          l.label,
                        ),
                      ),
                    ),
                  ),
                  React.createElement(
                    "label",
                    null,
                    "Starter code ",
                    React.createElement("span", null, "(optional)"),
                    React.createElement("textarea", {
                      name: `question-${o}-starterCode`,
                      rows: "4",
                      value: t.starterCode,
                      placeholder: "Provide starter code or a code template...",
                      onChange: (l) => T(o, "starterCode", l.target.value),
                    }),
                  ),
                  React.createElement(
                    "label",
                    null,
                    "Expected output / answer criteria ",
                    React.createElement("span", null, "(optional)"),
                    React.createElement("textarea", {
                      name: `question-${o}-expectedOutput`,
                      rows: "3",
                      value: t.expectedOutput,
                      placeholder: "Describe the expected result...",
                      onChange: (l) => T(o, "expectedOutput", l.target.value),
                    }),
                  ),
                  React.createElement(
                    "label",
                    null,
                    "Near-match score ",
                    React.createElement(
                      "span",
                      null,
                      "(% of points, optional)",
                    ),
                    React.createElement("input", {
                      name: `question-${o}-nearMatchScorePercent`,
                      type: "number",
                      min: "0",
                      max: "100",
                      step: "1",
                      value: t.nearMatchScorePercent,
                      placeholder: "e.g. 50",
                      onChange: (l) =>
                        T(o, "nearMatchScorePercent", l.target.value),
                    }),
                  ),
                  React.createElement(
                    "label",
                    null,
                    "Incorrect score ",
                    React.createElement(
                      "span",
                      null,
                      "(% of points, optional)",
                    ),
                    React.createElement("input", {
                      name: `question-${o}-incorrectScorePercent`,
                      type: "number",
                      min: "0",
                      max: "100",
                      step: "1",
                      value: t.incorrectScorePercent,
                      placeholder: "e.g. 0",
                      onChange: (l) =>
                        T(o, "incorrectScorePercent", l.target.value),
                    }),
                  ),
                  React.createElement(
                    "p",
                    { className: "[grid-column:1/-1] m-0 text-ink-3 text-[9px] font-medium" },
                    "An answer close to the expected output (but not exact) earns the near-match score; anything else earns the incorrect score. Both are a percentage of this question's points.",
                  ),
                ),
          ),
        ),
      ),
      React.createElement(
        "button",
        {
          type: "button",
          className: "self-start border border-dashed border-accent/30 rounded-[9px] bg-surface-1 text-accent py-[9px] px-3 text-[10px] font-extrabold cursor-pointer hover:bg-surface-2 hover:border-accent/30",
          onClick: () => m((t) => [...t, Q()]),
        },
        "+ Add another question",
      ),
      $.text &&
        React.createElement(
          "p",
          { className: `mt-0 mx-0 mb-3 py-[9px] px-[11px] rounded-[7px] text-[10px] [&.error]:border [&.error]:border-white/10 [&.error]:bg-surface-2 [&.error]:text-rose-300 [&.success]:border [&.success]:border-white/10 [&.success]:bg-surface-2 [&.success]:text-emerald-400 ${$.status}`, role: "status" },
          $.text,
        ),
      React.createElement(
        "div",
        { className: "flex justify-end gap-2 mt-5.5 pt-[17px] border-t border-white/10 max-[760px]:flex-wrap max-[760px]:[&_button]:flex-1 [.assessment-builder_&]:mt-0.5" },
        React.createElement(
          "button",
          {
            type: "button",
            className: "inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50",
            onClick: p,
            disabled: C,
          },
          "Cancel",
        ),
        React.createElement(
          "button",
          { type: "submit", className: "inline-flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-canvas transition hover:shadow-halo active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50", disabled: C },
          C ? "Saving\u2026" : "Save assessment",
        ),
      ),
    ),
    N &&
      React.createElement(
        "div",
        {
          className: "fixed [inset:0] z-50 grid place-items-center p-5 bg-canvas/40 [backdrop-filter:blur(7px)]",
          onMouseDown: (t) => {
            t.target === t.currentTarget && r(null);
          },
        },
        React.createElement(
          "section",
          {
            className: "w-[min(390px,100%)] pt-7 px-6.5 pb-6 border border-white/10 rounded-[18px] bg-surface-2 [box-shadow:0_25px_70px_rgba(0,0,0,0.38)] text-center [&_p]:mt-0 [&_p]:mx-0 [&_p]:mb-[7px] [&_p]:text-rose-300 [&_p]:text-[8px] [&_p]:font-extrabold [&_p]:tracking-[1.6px] [&_h3]:m-0 [&_h3]:text-ink-2 [&_h3]:text-[17px] [&>span]:block [&>span]:[margin:10px_auto_0] [&>span]:max-w-[300px] [&>span]:text-ink-3 [&>span]:text-[10px] [&>span]:leading-[1.6] [&>div:last-child]:flex [&>div:last-child]:justify-center [&>div:last-child]:gap-2 [&>div:last-child]:mt-5 assessment-confirm-dialog",
            role: "alertdialog",
            "aria-modal": "true",
            "aria-labelledby": "assessment-replace-title",
          },
          React.createElement(
            "div",
            { className: "grid place-items-center w-[46px] h-[46px] [margin:0_auto_13px] rounded-[14px] bg-surface-2 text-rose-300 text-[22px] font-extrabold" },
            "!",
          ),
          React.createElement("p", null, "REPLACE ASSESSMENT"),
          React.createElement(
            "h3",
            { id: "assessment-replace-title" },
            G(n.category).find((t) => t.value === n.itemNo)?.label,
            " is already assigned to \u201C",
            N.title,
            "\u201D",
          ),
          React.createElement(
            "span",
            null,
            "Saving will delete \u201C",
            N.title,
            "\u201D (its questions and any recorded scores for this item) and put this new assessment in its place. This can't be undone.",
          ),
          React.createElement(
            "div",
            null,
            React.createElement(
              "button",
              {
                type: "button",
                className: "inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50",
                onClick: () => r(null),
                disabled: C,
              },
              "Cancel",
            ),
            React.createElement(
              "button",
              {
                type: "button",
                className: "inline-flex items-center justify-center gap-2 border-0 rounded-[10px] py-2.5 px-[15px] [background:linear-gradient(135deg,#162032,#0F172A)] text-ink text-[11px] font-bold [box-shadow:0_7px_15px_rgba(0,0,0,0.32)] cursor-pointer transition hover:[background:linear-gradient(135deg,#162032,#0F172A)] hover:[box-shadow:0_10px_20px_rgba(0,0,0,0.45)] hover:[transform:translateY(-1px)] disabled:cursor-not-allowed disabled:opacity-60 disabled:[transform:none] [.assessment-confirm-dialog_&]:min-w-[110px]",
                onClick: H,
                disabled: C,
              },
              C ? "Replacing\u2026" : "Replace assessment",
            ),
          ),
        ),
      ),
    A &&
      React.createElement(
        "div",
        {
          className: "fixed [inset:0] z-50 grid place-items-center p-5 bg-canvas/40 [backdrop-filter:blur(7px)]",
          onMouseDown: (t) => {
            t.target === t.currentTarget && k(!1);
          },
        },
        React.createElement(
          "section",
          {
            className: "w-[min(390px,100%)] pt-7 px-6.5 pb-6 border border-white/10 rounded-[18px] bg-surface-2 [box-shadow:0_25px_70px_rgba(0,0,0,0.38)] text-center [&_p]:mt-0 [&_p]:mx-0 [&_p]:mb-[7px] [&_p]:text-rose-300 [&_p]:text-[8px] [&_p]:font-extrabold [&_p]:tracking-[1.6px] [&_h3]:m-0 [&_h3]:text-ink-2 [&_h3]:text-[17px] [&>span]:block [&>span]:[margin:10px_auto_0] [&>span]:max-w-[300px] [&>span]:text-ink-3 [&>span]:text-[10px] [&>span]:leading-[1.6] [&>div:last-child]:flex [&>div:last-child]:justify-center [&>div:last-child]:gap-2 [&>div:last-child]:mt-5 assessment-confirm-dialog",
            role: "alertdialog",
            "aria-modal": "true",
            "aria-labelledby": "assessment-score-overwrite-title",
          },
          React.createElement(
            "div",
            { className: "grid place-items-center w-[46px] h-[46px] [margin:0_auto_13px] rounded-[14px] bg-surface-2 text-rose-300 text-[22px] font-extrabold" },
            "!",
          ),
          React.createElement("p", null, "EXISTING SCORES FOUND"),
          React.createElement(
            "h3",
            { id: "assessment-score-overwrite-title" },
            G(n.category).find((t) => t.value === n.itemNo)?.label,
            " already has recorded scores",
          ),
          React.createElement(
            "span",
            null,
            "No assessment is attached to this column yet, but scores have already been entered for it. Saving will reset those scores to 0 for every student so they line up with this new assessment. This can't be undone.",
          ),
          React.createElement(
            "div",
            null,
            React.createElement(
              "button",
              {
                type: "button",
                className: "inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50",
                onClick: () => k(!1),
                disabled: C,
              },
              "Cancel",
            ),
            React.createElement(
              "button",
              {
                type: "button",
                className: "inline-flex items-center justify-center gap-2 border-0 rounded-[10px] py-2.5 px-[15px] [background:linear-gradient(135deg,#162032,#0F172A)] text-ink text-[11px] font-bold [box-shadow:0_7px_15px_rgba(0,0,0,0.32)] cursor-pointer transition hover:[background:linear-gradient(135deg,#162032,#0F172A)] hover:[box-shadow:0_10px_20px_rgba(0,0,0,0.45)] hover:[transform:translateY(-1px)] disabled:cursor-not-allowed disabled:opacity-60 disabled:[transform:none] [.assessment-confirm-dialog_&]:min-w-[110px]",
                onClick: X,
                disabled: C,
              },
              C ? "Saving\u2026" : "Overwrite scores",
            ),
          ),
        ),
      ),
  );
}
function Z(g) {
  return {
    itemNo: String(g.item_no ?? "1"),
    title: g.title ?? "",
    category: g.category ?? "quiz",
    period: g.period?.code ?? "prelim",
    instructions: g.instructions ?? "",
    timeLimitMinutes: g.time_limit_minutes ? String(g.time_limit_minutes) : "",
    availableFrom: ee(g.available_from),
    availableUntil: ee(g.available_until),
    questions: [...(g.questions ?? [])]
      .sort((u, w) => Number(u.question_no) - Number(w.question_no))
      .map((u) => ({
        id: u.id,
        type: u.question_type,
        prompt: u.prompt ?? "",
        points: String(u.points ?? "1"),
        choices: Array.isArray(u.choices) ? u.choices : ["", "", "", ""],
        correctAnswer: u.correct_answer ?? "A",
        language: u.language ?? "sql",
        starterCode: u.starter_code ?? "",
        expectedOutput: u.expected_output ?? "",
        nearMatchScorePercent: String(u.near_match_score_percent ?? "50"),
        incorrectScorePercent: String(u.incorrect_score_percent ?? "0"),
      })),
  };
}
function le({
  section: g,
  assessments: u,
  students: w,
  onUpdate: p,
  onDelete: n,
  onGrantAttempt: S,
  onClose: d,
}) {
  const [m, E] = v(u[0]?.id ?? ""),
    [i, h] = v(() => (u[0] ? Z(u[0]) : null)),
    [y, D] = v(!1),
    [R, C] = v(""),
    [M, $] = v(null),
    [O, F] = v(""),
    [U, N] = v({ status: "", text: "" }),
    [r, A] = v(""),
    [k, P] = v(null),
    [ze, We] = v(""),
    b = u.find((e) => e.id === m),
    _ = i
      ? u.find(
          (e) =>
            e.id !== b?.id &&
            e.category === i.category &&
            e.period?.code === i.period &&
            Number(e.item_no) === Number(i.itemNo),
        )
      : null,
    T = (e) => {
      (E(e.id), h(Z(e)), N({ status: "", text: "" }), We(""));
    },
    q = (e, s) =>
      h((a) => {
        if (e === "category") {
          const c = se[s] ?? 4,
            f = Math.min(Math.max(Number(a.itemNo || 1), 1), c);
          return { ...a, category: s, itemNo: String(f) };
        }
        return { ...a, [e]: s };
      }),
    I = (e, s, a) => {
      h((c) => ({
        ...c,
        questions: c.questions.map((f, x) => (x === e ? { ...f, [s]: a } : f)),
      }));
    },
    Y = (e, s, a) => {
      h((c) => ({
        ...c,
        questions: c.questions.map((f, x) =>
          x === e
            ? { ...f, choices: f.choices.map((ae, ne) => (ne === s ? a : ae)) }
            : f,
        ),
      }));
    },
    W = (e, s) => {
      h((a) => ({
        ...a,
        questions: a.questions.map((c, f) =>
          f === e ? { ...Q(s), prompt: c.prompt, points: c.points } : c,
        ),
      }));
    },
    B = () => {
      if (!i || !b) return "Select an assessment to edit.";
      if (!i.title.trim()) return "Enter an assessment title.";
      if (
        i.timeLimitMinutes &&
        (!Number.isInteger(Number(i.timeLimitMinutes)) ||
          Number(i.timeLimitMinutes) < 1)
      )
        return "Time limit must be a whole number of minutes.";
      if (
        i.availableFrom &&
        i.availableUntil &&
        i.availableFrom >= i.availableUntil
      )
        return "The answer window end must be after the start.";
      if (!i.questions.length || i.questions.some((e) => !e.prompt.trim()))
        return "Every question needs a prompt.";
      if (
        i.questions.some(
          (e) =>
            e.type === "multiple_choice" && e.choices.some((s) => !s.trim()),
        )
      )
        return "Complete all multiple-choice options.";
      for (const e of i.questions) {
        if (e.type === "multiple_choice") continue;
        const s = Number(e.nearMatchScorePercent);
        if (!Number.isFinite(s) || s < 0 || s > 100)
          return "Enter a near-match score between 0 and 100 for every coding question.";
        const a = Number(e.incorrectScorePercent);
        if (!Number.isFinite(a) || a < 0 || a > 100)
          return "Enter an incorrect score between 0 and 100 for every coding question.";
      }
      return "";
    },
    j = async (e) => {
      (D(!0), N({ status: "", text: "" }));
      try {
        const s = await p({
          assessmentId: b.id,
          ...i,
          itemNo: Number(i.itemNo),
          title: i.title.trim(),
          instructions: i.instructions.trim(),
          replaceAssessmentId: e,
        });
        N({
          status: "success",
          text: `Assessment updated. Key ID: ${s?.access_key ?? b.access_key}`,
        });
      } catch (s) {
        s?.conflict
          ? P(s.conflict)
          : N({
              status: "error",
              text: s?.message || "Assessment could not be updated.",
            });
      } finally {
        D(!1);
      }
    },
    H = async (e) => {
      e.preventDefault();
      const s = B();
      if (s) {
        N({ status: "error", text: s });
        return;
      }
      if (_) {
        P(_);
        return;
      }
      await j();
    },
    X = async () => {
      if (!k) return;
      const e = k.id;
      (P(null), await j(e));
    },
    t = async (e) => {
      const s = e.studentId;
      if (!(!s || !S)) {
        (A(s), N({ status: "", text: "" }));
        try {
          const a = await S({ assessmentId: b.id, studentId: s });
          N({
            status: "success",
            text: `${e.name} can now take this assessment again (${a.extra_attempts} extra attempt${Number(a.extra_attempts) === 1 ? "" : "s"}).`,
          });
        } catch (a) {
          N({
            status: "error",
            text: a?.message || "The extra attempt could not be granted.",
          });
        } finally {
          A("");
        }
      }
    },
    Ve = (e) => {
      We((s) => (s === e ? "" : e));
    },
    o = (e, s) => {
      (e.stopPropagation(), $(s));
    },
    l = async () => {
      if (!M) return;
      const e = M;
      ($(null), C(e.id), N({ status: "", text: "" }));
      try {
        await n(e.id);
        const a = u.filter((c) => c.id !== e.id)[0];
        (E(a?.id ?? ""),
          h(a ? Z(a) : null),
          N({ status: "success", text: "Assessment deleted successfully." }),
          F(`\u201C${e.title}\u201D was deleted successfully.`));
      } catch (s) {
        N({
          status: "error",
          text: s?.message || "Assessment could not be deleted.",
        });
      } finally {
        C("");
      }
    };
  return u.length
    ? React.createElement(
        V,
        { title: "Manage Assessments", section: g, onClose: d, size: "wide" },
        React.createElement(
          "div",
          { className: "grid grid-cols-[245px_minmax(0,1fr)] gap-4.5 min-h-[440px] max-[760px]:grid-cols-[1fr]" },
          React.createElement(
            "aside",
            { className: "flex flex-col gap-[7px] p-3 border border-white/10 rounded-[13px] bg-surface-1 [&_button]:flex [&_button]:flex-col [&_button]:items-start [&_button]:gap-1 [&_button]:p-[11px] [&_button]:border [&_button]:border-transparent [&_button]:rounded-[9px] [&_button]:bg-transparent [&_button]:text-left [&_button]:cursor-pointer [&_button:hover]:border-accent/30 [&_button:hover]:bg-surface-1 [&_button:hover]:[box-shadow:0_3px_9px_rgba(0,240,255,0.03)] [&_button.selected]:border-accent/30 [&_button.selected]:bg-surface-1 [&_button.selected]:[box-shadow:0_3px_9px_rgba(0,240,255,0.03)] [&_button_strong]:overflow-hidden [&_button_strong]:w-full [&_button_strong]:text-ink-2 [&_button_strong]:text-[10px] [&_button_strong]:text-ellipsis [&_button_strong]:whitespace-nowrap [&_button_span]:text-ink-3 [&_button_span]:text-[9px] [&_button_small]:text-accent [&_button_small]:font-bold [&_button_small]:text-[8px] max-[760px]:max-h-[210px] max-[760px]:overflow-auto assessment-manager-list" },
            React.createElement(
              "div",
              { className: "flex items-center justify-between pt-[3px] px-1 pb-[9px] text-accent text-[8px] font-extrabold tracking-[1px] [&_strong]:grid [&_strong]:place-items-center [&_strong]:min-w-[20px] [&_strong]:h-[20px] [&_strong]:rounded-[6px] [&_strong]:bg-surface-2 [&_strong]:text-accent [&_strong]:text-[9px]" },
              React.createElement("span", null, "YOUR ASSESSMENTS"),
              React.createElement("strong", null, u.length),
            ),
            u.map((e) =>
              React.createElement(
                "div",
                {
                  className: `flex items-stretch gap-[3px] [&>button:first-child]:flex-1 [&>button:first-child]:min-w-0 ${e.id === m ? "selected" : ""}`,
                  key: e.id,
                },
                React.createElement(
                  "button",
                  { type: "button", onClick: () => T(e), disabled: R === e.id },
                  React.createElement("strong", null, e.title),
                  React.createElement(
                    "span",
                    null,
                    z.find((s) => s.key === e.category)?.label,
                    " \xB7 ",
                    e.period?.code
                      ? J.find((s) => s.key === e.period.code)?.label
                      : "Assessment",
                  ),
                  React.createElement("small", null, "Key: ", e.access_key),
                ),
                React.createElement(
                  "button",
                  {
                    type: "button",
                    className: "[.assessment-manager-list_&]:grid [.assessment-manager-list_&]:place-items-center [.assessment-manager-list_&]:self-center [.assessment-manager-list_&]:w-[25px] [.assessment-manager-list_&]:h-[25px] [.assessment-manager-list_&]:p-0 [.assessment-manager-list_&]:border-0 [.assessment-manager-list_&]:rounded-[7px] [.assessment-manager-list_&]:bg-transparent [.assessment-manager-list_&]:text-rose-300 [.assessment-manager-list_&]:text-[17px] [.assessment-manager-list_&]:leading-[1] [.assessment-manager-list_&:hover]:bg-surface-2 [.assessment-manager-list_&:hover]:border-transparent [.assessment-manager-list_&:hover]:text-rose-300 [.assessment-manager-list_&:hover]:[box-shadow:none] [.assessment-manager-list_&:disabled]:cursor-not-allowed [.assessment-manager-list_&:disabled]:opacity-50",
                    "aria-label": `Delete ${e.title}`,
                    disabled: R === e.id,
                    onClick: (s) => o(s, e),
                  },
                  "\xD7",
                ),
              ),
            ),
          ),
          i &&
            React.createElement(
              "form",
              { className: "min-w-0 assessment-manager-editor", onSubmit: H },
              React.createElement(
                "div",
                { className: "flex items-start justify-between gap-3 mb-[15px] [&_span]:text-accent [&_span]:text-[8px] [&_span]:font-extrabold [&_span]:tracking-[1.2px] [&_h3]:mt-[5px] [&_h3]:mx-0 [&_h3]:mb-0 [&_h3]:text-ink-2 [&_h3]:text-[15px] [&_code]:py-[7px] [&_code]:px-[9px] [&_code]:rounded-[7px] [&_code]:bg-surface-2 [&_code]:text-accent [&_code]:font-bold [&_code]:text-[9px] [&_code]:whitespace-nowrap max-[760px]:items-start max-[760px]:flex-col max-[760px]:[&_code]:self-end" },
                React.createElement(
                  "div",
                  null,
                  React.createElement("span", null, "EDIT ASSESSMENT"),
                  React.createElement("h3", null, b?.title),
                ),
                React.createElement(
                  "div",
                  { className: "flex items-center gap-2" },
                  React.createElement("code", null, b?.access_key),
                  b?.access_key &&
                    React.createElement(
                      "button",
                      {
                        type: "button",
                        title: "Copy key",
                        "aria-label": "Copy key",
                        className:
                          "rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700",
                        onClick: (e) => {
                          navigator.clipboard.writeText(b.access_key);
                          const s = e.currentTarget;
                          (s.classList.add("text-emerald-600"),
                            setTimeout(
                              () => s.classList.remove("text-emerald-600"),
                              1e3,
                            ));
                        },
                      },
                      React.createElement(
                        "svg",
                        {
                          className: "h-4 w-4",
                          fill: "none",
                          stroke: "currentColor",
                          viewBox: "0 0 24 24",
                        },
                        React.createElement("path", {
                          strokeLinecap: "round",
                          strokeLinejoin: "round",
                          strokeWidth: "2",
                          d: "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z",
                        }),
                      ),
                    ),
                ),
              ),
              React.createElement(
                "div",
                { className: "grid grid-cols-[repeat(2,1fr)] gap-3 [&.single]:grid-cols-[1fr] [&_label]:flex [&_label]:flex-col [&_label]:gap-1.5 [&_label]:text-ink-2 [&_label]:text-[10px] [&_label]:font-semibold [&_input]:w-full [&_input]:box-border [&_input]:border [&_input]:border-white/10 [&_input]:rounded-[7px] [&_input]:bg-surface-1 [&_input]:text-ink-2 [&_input]:p-[9px] [&_input]:text-[11px] [&_input]:outline-none [&_select]:w-full [&_select]:box-border [&_select]:border [&_select]:border-white/10 [&_select]:rounded-[7px] [&_select]:bg-surface-1 [&_select]:text-ink-2 [&_select]:p-[9px] [&_select]:text-[11px] [&_select]:outline-none [&_input:focus]:border-accent/30 [&_input:focus]:[box-shadow:0_0_0_3px_#162032] [&_select:focus]:border-accent/30 [&_select:focus]:[box-shadow:0_0_0_3px_#162032] max-[760px]:grid-cols-[repeat(2,1fr)] [.action-modal_&_label]:text-ink-2 [.action-modal_&_label]:text-[10px] [.action-modal_&_label]:tracking-[.1px] [.action-modal_&_input]:border-white/10 [.action-modal_&_input]:rounded-[9px] [.action-modal_&_input]:bg-surface-1 [.action-modal_&_input]:[box-shadow:0_2px_5px_rgba(0,240,255,0.01)] [.action-modal_&_input]:transition [.action-modal_&_select]:border-white/10 [.action-modal_&_select]:rounded-[9px] [.action-modal_&_select]:bg-surface-1 [.action-modal_&_select]:[box-shadow:0_2px_5px_rgba(0,240,255,0.01)] [.action-modal_&_select]:transition [.action-modal_&_input:hover]:border-accent/30 [.action-modal_&_select:hover]:border-accent/30 [.action-modal_&_input:focus]:border-accent/30 [.action-modal_&_input:focus]:[box-shadow:0_0_0_3px_#162032] [.action-modal_&_select:focus]:border-accent/30 [.action-modal_&_select:focus]:[box-shadow:0_0_0_3px_#162032] grid-cols-[minmax(0,2fr)_minmax(130px,1fr)_minmax(130px,1fr)] max-[760px]:grid-cols-[1fr]" },
                React.createElement(
                  "label",
                  null,
                  "Assessment title",
                  React.createElement("input", {
                    name: "editAssessmentTitle",
                    required: !0,
                    value: i.title,
                    onChange: (e) => q("title", e.target.value),
                  }),
                ),
                React.createElement(
                  "label",
                  null,
                  "Type",
                  React.createElement(
                    "select",
                    {
                      name: "editAssessmentCategory",
                      value: i.category,
                      onChange: (e) => q("category", e.target.value),
                    },
                    z.map((e) =>
                      React.createElement(
                        "option",
                        { value: e.key, key: e.key },
                        e.label,
                      ),
                    ),
                  ),
                ),
                React.createElement(
                  "label",
                  null,
                  "Item number",
                  React.createElement(
                    "select",
                    {
                      name: "editAssessmentItemNo",
                      value: i.itemNo,
                      onChange: (e) => q("itemNo", e.target.value),
                    },
                    G(i.category).map((e) => {
                      const s = u.find(
                        (a) =>
                          a.id !== b?.id &&
                          a.category === i.category &&
                          a.period?.code === i.period &&
                          Number(a.item_no) === Number(e.value),
                      );
                      return React.createElement(
                        "option",
                        { value: e.value, key: e.value },
                        e.label,
                        s ? ` \u2014 in use: ${s.title}` : "",
                      );
                    }),
                  ),
                ),
                React.createElement(
                  "label",
                  null,
                  "Grading period",
                  React.createElement(
                    "select",
                    {
                      name: "editAssessmentPeriod",
                      value: i.period,
                      onChange: (e) => q("period", e.target.value),
                    },
                    J.map((e) =>
                      React.createElement(
                        "option",
                        { value: e.key, key: e.key },
                        e.label,
                      ),
                    ),
                  ),
                ),
                React.createElement(
                  "label",
                  null,
                  "Available from ",
                  React.createElement("span", null, "(optional)"),
                  React.createElement("input", {
                    name: "editAssessmentAvailableFrom",
                    type: "datetime-local",
                    value: i.availableFrom,
                    onChange: (e) => q("availableFrom", e.target.value),
                  }),
                ),
                React.createElement(
                  "label",
                  null,
                  "Available until ",
                  React.createElement("span", null, "(optional)"),
                  React.createElement("input", {
                    name: "editAssessmentAvailableUntil",
                    type: "datetime-local",
                    value: i.availableUntil,
                    onChange: (e) => q("availableUntil", e.target.value),
                  }),
                ),
                React.createElement(
                  "label",
                  null,
                  "Time limit ",
                  React.createElement("span", null, "(minutes, optional)"),
                  React.createElement("input", {
                    name: "editAssessmentTimeLimit",
                    type: "number",
                    min: "1",
                    step: "1",
                    value: i.timeLimitMinutes,
                    placeholder: "e.g. 30",
                    onChange: (e) => q("timeLimitMinutes", e.target.value),
                  }),
                ),
              ),
              _ &&
                React.createElement(
                  "p",
                  {
                    className: "[grid-column:1/-1] m-0 text-ink-3 text-[9px] font-medium assessment-slot-conflict",
                    role: "status",
                  },
                  G(i.category).find((e) => e.value === i.itemNo)?.label,
                  " is currently assigned to \u201C",
                  _.title,
                  "\u201D. Saving will ask you to confirm replacing it.",
                ),
              React.createElement(
                "label",
                { className: "flex flex-col gap-1.5 text-ink-2 text-[10px] font-bold [&_span]:text-ink-3 [&_span]:font-medium" },
                "Instructions ",
                React.createElement("span", null, "(optional)"),
                React.createElement(te, {
                  value: i.instructions,
                  onChange: (e) => q("instructions", e),
                  uploadPathPrefix: `assessments/${b?.id ?? "edit"}`,
                }),
              ),
              React.createElement(
                "section",
                { className: "flex flex-col gap-3 p-[15px] border border-white/10 rounded-[13px] bg-surface-1 [&>div:first-child]:flex [&>div:first-child]:flex-col [&>div:first-child]:gap-[5px] [&_span]:text-accent [&_span]:text-[8px] [&_span]:font-extrabold [&_span]:tracking-[1.2px] [&_h4]:m-0 [&_h4]:text-ink-2 [&_h4]:text-[12px] [&_p]:m-0 [&_p]:text-ink-3 [&_p]:text-[10px] [&_p]:leading-[1.5]" },
                React.createElement(
                  "div",
                  null,
                  React.createElement("span", null, "STUDENT SUBMISSIONS"),
                  React.createElement(
                    "h4",
                    null,
                    "Review answers & allow another attempt",
                  ),
                  React.createElement(
                    "p",
                    null,
                    "Click \u201CView answers\u201D to see exactly what a student submitted for their most recent attempt. Students get one attempt by default \u2014 use \u201CAllow another\u201D to grant one more.",
                  ),
                ),
                React.createElement(
                  "div",
                  { className: "flex flex-col gap-[7px]" },
                  w.length
                    ? w.map((e) => {
                          const attempts = (b?.attempts ?? [])
                            .filter(
                              (c) => String(c.student_id) === String(e.studentId),
                            )
                            .sort((x, y) => {
                              const attemptNumberDifference =
                                Number(y.attempt_no) - Number(x.attempt_no);
                              if (attemptNumberDifference !== 0) {
                                return attemptNumberDifference;
                              }
                              return (
                                new Date(y.submitted_at || 0).getTime() -
                                new Date(x.submitted_at || 0).getTime()
                              );
                            }),
                          s = attempts.length,
                          latest = attempts[0] ?? null,
                          a = Number(
                            (b?.attemptGrants ?? []).find(
                              (c) => c.student_id === e.studentId,
                            )?.extra_attempts || 0,
                          ),
                          isOpen = ze === e.studentId;
                        return React.createElement(
                          React.Fragment,
                          { key: e.studentId },
                          React.createElement(
                            "div",
                            { className: "flex items-center justify-between gap-3 py-2.5 px-[11px] border border-white/10 rounded-[9px] bg-surface-1 [&>div]:flex [&>div]:min-w-0 [&>div]:flex-col [&>div]:gap-[3px] [&_strong]:overflow-hidden [&_strong]:text-ink-2 [&_strong]:text-[10px] [&_strong]:text-ellipsis [&_strong]:whitespace-nowrap [&_small]:text-ink-3 [&_small]:text-[9px] assessment-retry-row" },
                            React.createElement(
                              "div",
                              null,
                              React.createElement("strong", null, e.name),
                              React.createElement(
                                "small",
                                null,
                                e.number,
                                " \xB7 ",
                                s,
                                " used \xB7 ",
                                a,
                                " extra granted",
                              ),
                            ),
                            React.createElement(
                              "div",
                              { className: "flex flex-wrap gap-2" },
                              React.createElement(
                                "button",
                                {
                                  type: "button",
                                  className: "inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50",
                                  disabled: !latest,
                                  onClick: () => Ve(e.studentId),
                                },
                                isOpen ? "Hide answers" : "View answers",
                              ),
                              React.createElement(
                                "button",
                                {
                                  type: "button",
                                  className: "inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50",
                                  disabled: r === e.studentId,
                                  onClick: () => t(e),
                                },
                                r === e.studentId
                                  ? "Granting\u2026"
                                  : "Allow another",
                              ),
                            ),
                          ),
                          isOpen &&
                            latest &&
                            React.createElement(
                              "div",
                              {
                                className:
                                  "mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3",
                              },
                              React.createElement(
                                "div",
                                {
                                  className:
                                    "mb-2.5 flex items-center justify-between",
                                },
                                React.createElement(
                                  "span",
                                  {
                                    className:
                                      "text-[11px] font-bold uppercase tracking-wide text-slate-500",
                                  },
                                  `Attempt ${latest.attempt_no}`,
                                  latest.status === "needs_review"
                                    ? " \xB7 Needs review"
                                    : "",
                                ),
                                React.createElement(
                                  "strong",
                                  { className: "text-[13px] text-slate-900" },
                                  `${Number(latest.score ?? 0).toFixed(2)} / ${Number(latest.max_score ?? 0).toFixed(2)}`,
                                ),
                              ),
                              !(latest.answers ?? []).length &&
                                React.createElement(
                                  "p",
                                  { className: "m-0 text-xs text-slate-400" },
                                  "No submitted answer data found for this attempt (it may not have synced yet).",
                                ),
                              ...[...(b?.questions ?? [])]
                                .sort(
                                  (x, y) =>
                                    Number(x.question_no) -
                                    Number(y.question_no),
                                )
                                .map((qq, idx) => {
                                    const ansRow = (latest.answers ?? []).find(
                                      (ans) =>
                                        String(ans.question_id) ===
                                        String(qq.id),
                                    ),
                                    isMc = qq.question_type === "multiple_choice",
                                    answerText = ansRow?.answer ?? "",
                                    chosenLabel =
                                      isMc && answerText && L.includes(answerText)
                                        ? qq.choices?.[L.indexOf(answerText)]
                                        : "",
                                    statusColorClass =
                                      ansRow?.is_correct === true
                                        ? "text-emerald-600"
                                        : ansRow?.is_correct === false
                                          ? "text-rose-600"
                                          : "text-slate-500";
                                  return React.createElement(
                                    "div",
                                    {
                                      key: qq.id,
                                      className: `py-2.5 ${idx === 0 ? "" : "border-t border-slate-200"}`,
                                    },
                                    React.createElement(
                                      "p",
                                      { className: "mb-1 text-xs text-slate-600" },
                                      `Q${idx + 1}. `,
                                      React.createElement(
                                        "strong",
                                        { className: "text-slate-900" },
                                        qq.prompt,
                                      ),
                                    ),
                                    isMc
                                      ? React.createElement(
                                          "p",
                                          {
                                            className:
                                              "mb-1 text-[13px] text-slate-800",
                                          },
                                          "Answered: ",
                                          React.createElement(
                                            "b",
                                            null,
                                            answerText
                                              ? `${answerText}${chosenLabel ? ` \u2014 ${chosenLabel}` : ""}`
                                              : "\u2014",
                                          ),
                                          " \xB7 Correct: ",
                                          React.createElement(
                                            "b",
                                            null,
                                            qq.correct_answer,
                                          ),
                                        )
                                      : React.createElement(
                                          "pre",
                                          {
                                            className:
                                              "mb-1 whitespace-pre-wrap break-words rounded-lg bg-slate-900 px-2.5 py-2 text-xs text-slate-200",
                                          },
                                          answerText || "(no answer submitted)",
                                        ),
                                    React.createElement(
                                      "p",
                                      {
                                        className: `m-0 text-xs font-semibold ${statusColorClass}`,
                                      },
                                      ansRow
                                        ? `${Number(ansRow.points_earned ?? 0).toFixed(2)} / ${Number(qq.points ?? 0).toFixed(2)} pts`
                                        : "Not answered",
                                    ),
                                  );
                                }),
                            ),
                        );
                      })
                    : React.createElement(
                        "p",
                        { className: "[grid-column:1/-1] m-0 text-ink-3 text-[9px] font-medium" },
                        "No students are enrolled in this class.",
                      ),
                ),
              ),
              React.createElement(
                "section",
                { className: "flex flex-col gap-3 p-[15px] border border-white/10 rounded-[13px] bg-surface-1 [&>div:first-child]:flex [&>div:first-child]:flex-col [&>div:first-child]:gap-[5px] [&_span]:text-accent [&_span]:text-[8px] [&_span]:font-extrabold [&_span]:tracking-[1.2px] [&_h4]:m-0 [&_h4]:text-ink-2 [&_h4]:text-[12px] [&_p]:m-0 [&_p]:text-ink-3 [&_p]:text-[10px] [&_p]:leading-[1.5]" },
                React.createElement(
                  "div",
                  null,
                  React.createElement("span", null, "VIOLATION LIST"),
                  React.createElement("h4", null, "Student security events"),
                  React.createElement(
                    "p",
                    null,
                    "These events are recorded with the student attempt. Pressing Escape automatically submits the attempt.",
                  ),
                ),
                React.createElement(
                  "div",
                  { className: "flex flex-col gap-[7px]" },
                  (() => {
                    const e = b?.violations ?? [];
                    if (!e.length)
                      return React.createElement(
                        "p",
                        { className: "[grid-column:1/-1] m-0 text-ink-3 text-[9px] font-medium" },
                        "No violations recorded for this assessment.",
                      );
                    const s = e.reduce((a, c) => {
                      const f = c.student_id;
                      return (a[f] || (a[f] = []), a[f].push(c), a);
                    }, {});
                    return Object.entries(s).map(([a, c]) => {
                      const f = w.find((x) => x.studentId === a);
                      return React.createElement(
                        "div",
                        { className: "assessment-violation-group", key: a },
                        React.createElement(
                          "div",
                          { className: "assessment-violation-student-header" },
                          React.createElement(
                            "strong",
                            null,
                            f?.name ?? "Unknown student",
                          ),
                          React.createElement(
                            "small",
                            null,
                            f?.number ?? a,
                            " \xB7 ",
                            c.length,
                            " total violation(s)",
                          ),
                        ),
                        React.createElement(
                          "div",
                          { className: "assessment-violation-details-list" },
                          c.map((x) =>
                            React.createElement(
                              "div",
                              {
                                className: "flex items-center justify-between gap-3 py-2.5 px-[11px] border border-white/10 rounded-[9px] bg-surface-1 [&>div]:flex [&>div]:min-w-0 [&>div]:flex-col [&>div]:gap-[3px] [&_strong]:overflow-hidden [&_strong]:text-ink-2 [&_strong]:text-[10px] [&_strong]:text-ellipsis [&_strong]:whitespace-nowrap [&_small]:text-ink-3 [&_small]:text-[9px] [&>div:last-child]:items-end [&>div:last-child]:text-right [&_b]:text-rose-300 [&_b]:text-[9px] [&_b]:capitalize [&>div:last-child_small]:max-w-[300px]",
                                key: x.id,
                              },
                              React.createElement(
                                "b",
                                null,
                                String(
                                  x.violation_type || "security event",
                                ).replaceAll("_", " "),
                              ),
                              React.createElement(
                                "small",
                                null,
                                "Attempt ",
                                x.attempt_no,
                                " \xB7 ",
                                x.details || "Detected by student portal",
                                " \xB7 ",
                                new Date(x.occurred_at).toLocaleString(),
                              ),
                            ),
                          ),
                        ),
                      );
                    });
                  })(),
                ),
              ),
              React.createElement(
                "div",
                { className: "[.assessment-manager-editor_&]:max-h-[475px] [.assessment-manager-editor_&]:overflow-auto [.assessment-manager-editor_&]:pt-0.5 [.assessment-manager-editor_&]:px-[3px] [.assessment-manager-editor_&]:pb-[3px] max-[760px]:[.assessment-manager-editor_&]:max-h-[none] flex flex-col gap-[13px]" },
                i.questions.map((e, s) =>
                  React.createElement(
                    "article",
                    { className: "[.assessment-manager-editor_&]:[box-shadow:none] [&_label]:flex [&_label]:flex-col [&_label]:gap-1.5 [&_label]:text-ink-2 [&_label]:text-[10px] [&_label]:font-bold [&_label>span:not(.choice-letter)]:text-ink-3 [&_label>span:not(.choice-letter)]:font-medium p-[17px] border border-white/10 rounded-[14px] bg-surface-1 [box-shadow:0_5px_16px_rgba(0,240,255,0.02)]", key: s },
                    React.createElement(
                      "div",
                      { className: "flex items-start justify-between gap-2.5 mb-[13px] [&_div]:flex [&_div]:flex-col [&_div]:gap-1 [&_span]:text-accent [&_span]:text-[8px] [&_span]:font-extrabold [&_span]:tracking-[1.3px] [&_strong]:text-ink-2 [&_strong]:text-[12px]" },
                      React.createElement(
                        "div",
                        null,
                        React.createElement("span", null, "QUESTION ", s + 1),
                        React.createElement(
                          "strong",
                          null,
                          e.type === "multiple_choice"
                            ? "Multiple choice"
                            : "Coding question",
                        ),
                      ),
                      i.questions.length > 1 &&
                        React.createElement(
                          "button",
                          {
                            type: "button",
                            className: "border-0 bg-transparent text-rose-300 text-[10px] font-bold cursor-pointer",
                            onClick: () =>
                              q(
                                "questions",
                                i.questions.filter((a, c) => c !== s),
                              ),
                          },
                          "Remove",
                        ),
                    ),
                    React.createElement(
                      "div",
                      { className: "flex gap-1.5 mb-3.5 [&_button]:border [&_button]:border-white/10 [&_button]:rounded-lg [&_button]:bg-surface-1 [&_button]:text-ink-3 [&_button]:py-[7px] [&_button]:px-2.5 [&_button]:text-[9px] [&_button]:font-bold [&_button]:cursor-pointer [&_button.active]:border-accent/30 [&_button.active]:bg-surface-2 [&_button.active]:text-accent" },
                      React.createElement(
                        "button",
                        {
                          type: "button",
                          className:
                            e.type === "multiple_choice" ? "active" : "",
                          onClick: () => W(s, "multiple_choice"),
                        },
                        "Multiple choice",
                      ),
                      React.createElement(
                        "button",
                        {
                          type: "button",
                          className: e.type === "coding" ? "active" : "",
                          onClick: () => W(s, "coding"),
                        },
                        "Coding",
                      ),
                    ),
                    React.createElement(
                      "div",
                      {
                        className: "grid grid-cols-[repeat(2,1fr)] gap-3 [&.single]:grid-cols-[1fr] [&_label]:flex [&_label]:flex-col [&_label]:gap-1.5 [&_label]:text-ink-2 [&_label]:text-[10px] [&_label]:font-semibold [&_input]:w-full [&_input]:box-border [&_input]:border [&_input]:border-white/10 [&_input]:rounded-[7px] [&_input]:bg-surface-1 [&_input]:text-ink-2 [&_input]:p-[9px] [&_input]:text-[11px] [&_input]:outline-none [&_select]:w-full [&_select]:box-border [&_select]:border [&_select]:border-white/10 [&_select]:rounded-[7px] [&_select]:bg-surface-1 [&_select]:text-ink-2 [&_select]:p-[9px] [&_select]:text-[11px] [&_select]:outline-none [&_input:focus]:border-accent/30 [&_input:focus]:[box-shadow:0_0_0_3px_#162032] [&_select:focus]:border-accent/30 [&_select:focus]:[box-shadow:0_0_0_3px_#162032] max-[760px]:grid-cols-[repeat(2,1fr)] [.action-modal_&_label]:text-ink-2 [.action-modal_&_label]:text-[10px] [.action-modal_&_label]:tracking-[.1px] [.action-modal_&_input]:border-white/10 [.action-modal_&_input]:rounded-[9px] [.action-modal_&_input]:bg-surface-1 [.action-modal_&_input]:[box-shadow:0_2px_5px_rgba(0,240,255,0.01)] [.action-modal_&_input]:transition [.action-modal_&_select]:border-white/10 [.action-modal_&_select]:rounded-[9px] [.action-modal_&_select]:bg-surface-1 [.action-modal_&_select]:[box-shadow:0_2px_5px_rgba(0,240,255,0.01)] [.action-modal_&_select]:transition [.action-modal_&_input:hover]:border-accent/30 [.action-modal_&_select:hover]:border-accent/30 [.action-modal_&_input:focus]:border-accent/30 [.action-modal_&_input:focus]:[box-shadow:0_0_0_3px_#162032] [.action-modal_&_select:focus]:border-accent/30 [.action-modal_&_select:focus]:[box-shadow:0_0_0_3px_#162032] grid-cols-[minmax(0,1fr)_105px] max-[760px]:grid-cols-[1fr]",
                      },
                      React.createElement(
                        "label",
                        { className: "[grid-column:1]" },
                        "Question prompt",
                        React.createElement("textarea", {
                          name: `edit-question-${s}-prompt`,
                          required: !0,
                          rows: "3",
                          value: e.prompt,
                          onChange: (a) => I(s, "prompt", a.target.value),
                        }),
                      ),
                      React.createElement(
                        "label",
                        null,
                        "Points",
                        React.createElement("input", {
                          name: `edit-question-${s}-points`,
                          type: "number",
                          min: "0.01",
                          step: "0.01",
                          value: e.points,
                          onChange: (a) => I(s, "points", a.target.value),
                        }),
                      ),
                    ),
                    e.type === "multiple_choice"
                      ? React.createElement(
                          "div",
                          { className: "[.assessment-manager-editor_&]:mt-[3px] grid grid-cols-[1fr_1fr] [gap:10px_12px] mt-[3px] [&_label]:grid [&_label]:grid-cols-[23px_minmax(0,1fr)_20px] [&_label]:items-center [&_label]:gap-[7px] [&_input:not(.choice-radio)]:min-w-0 max-[760px]:grid-cols-[1fr]" },
                          e.choices.map((a, c) =>
                            React.createElement(
                              "label",
                              { key: L[c] },
                              React.createElement(
                                "span",
                                { className: "[.student-portal-options_&]:w-[24px] [.student-portal-options_&]:h-[24px] [.student-choice-list_&]:w-[24px] [.student-choice-list_&]:h-[24px] grid place-items-center w-[23px] h-[23px] rounded-[7px] bg-surface-2 text-accent text-[9px] font-extrabold choice-letter" },
                                L[c],
                              ),
                              React.createElement("input", {
                                name: `edit-question-${s}-choice-${c}`,
                                required: !0,
                                value: a,
                                onChange: (f) => Y(s, c, f.target.value),
                              }),
                              React.createElement("input", {
                                className: "[.assessment-builder_&]:w-[15px] [.assessment-builder_&]:h-[15px] [.assessment-builder_&]:[accent-color:#00F0FF] choice-radio",
                                type: "radio",
                                name: `edit-correct-${s}`,
                                checked: e.correctAnswer === L[c],
                                onChange: () => I(s, "correctAnswer", L[c]),
                                "aria-label": `Mark ${L[c]} correct`,
                              }),
                            ),
                          ),
                        )
                      : React.createElement(
                          "div",
                          { className: "grid grid-cols-[170px_1fr_1fr] gap-3 [&_label]:flex [&_label]:flex-col [&_label]:gap-1.5 [&_label]:text-ink-2 [&_label]:text-[10px] [&_label]:font-bold [&_textarea]:text-[10px] max-[760px]:grid-cols-[1fr]" },
                          React.createElement(
                            "label",
                            null,
                            "Programming language",
                            React.createElement(
                              "select",
                              {
                                name: `edit-question-${s}-language`,
                                value: e.language,
                                onChange: (a) =>
                                  I(s, "language", a.target.value),
                              },
                              K.map((a) =>
                                React.createElement(
                                  "option",
                                  { value: a.key, key: a.key },
                                  a.label,
                                ),
                              ),
                            ),
                          ),
                          React.createElement(
                            "label",
                            null,
                            "Starter code",
                            React.createElement("textarea", {
                              name: `edit-question-${s}-starterCode`,
                              rows: "4",
                              value: e.starterCode,
                              onChange: (a) =>
                                I(s, "starterCode", a.target.value),
                            }),
                          ),
                          React.createElement(
                            "label",
                            null,
                            "Expected output",
                            React.createElement("textarea", {
                              name: `edit-question-${s}-expectedOutput`,
                              rows: "3",
                              value: e.expectedOutput,
                              onChange: (a) =>
                                I(s, "expectedOutput", a.target.value),
                            }),
                          ),
                          React.createElement(
                            "label",
                            null,
                            "Near-match score ",
                            React.createElement("span", null, "(% of points)"),
                            React.createElement("input", {
                              name: `edit-question-${s}-nearMatchScorePercent`,
                              type: "number",
                              min: "0",
                              max: "100",
                              step: "1",
                              value: e.nearMatchScorePercent,
                              placeholder: "e.g. 50",
                              onChange: (a) =>
                                I(s, "nearMatchScorePercent", a.target.value),
                            }),
                          ),
                          React.createElement(
                            "label",
                            null,
                            "Incorrect score ",
                            React.createElement("span", null, "(% of points)"),
                            React.createElement("input", {
                              name: `edit-question-${s}-incorrectScorePercent`,
                              type: "number",
                              min: "0",
                              max: "100",
                              step: "1",
                              value: e.incorrectScorePercent,
                              placeholder: "e.g. 0",
                              onChange: (a) =>
                                I(s, "incorrectScorePercent", a.target.value),
                            }),
                          ),
                        ),
                  ),
                ),
              ),
              React.createElement(
                "button",
                {
                  type: "button",
                  className: "self-start border border-dashed border-accent/30 rounded-[9px] bg-surface-1 text-accent py-[9px] px-3 text-[10px] font-extrabold cursor-pointer hover:bg-surface-2 hover:border-accent/30",
                  onClick: () => q("questions", [...i.questions, Q()]),
                },
                "+ Add another question",
              ),
              U.text &&
                React.createElement(
                  "p",
                  {
                    className: `mt-0 mx-0 mb-3 py-[9px] px-[11px] rounded-[7px] text-[10px] [&.error]:border [&.error]:border-white/10 [&.error]:bg-surface-2 [&.error]:text-rose-300 [&.success]:border [&.success]:border-white/10 [&.success]:bg-surface-2 [&.success]:text-emerald-400 ${U.status}`,
                    role: "status",
                  },
                  U.text,
                ),
              React.createElement(
                "div",
                { className: "flex justify-end gap-2 mt-5.5 pt-[17px] border-t border-white/10 max-[760px]:flex-wrap max-[760px]:[&_button]:flex-1 [.assessment-builder_&]:mt-0.5" },
                React.createElement(
                  "button",
                  {
                    type: "button",
                    className: "inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50",
                    onClick: d,
                    disabled: y,
                  },
                  "Close",
                ),
                React.createElement(
                  "button",
                  { type: "submit", className: "inline-flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-canvas transition hover:shadow-halo active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50", disabled: y },
                  y ? "Saving\u2026" : "Save changes",
                ),
              ),
            ),
        ),
        O &&
          React.createElement(
            "div",
            { className: "absolute [right:20px] [bottom:20px] z-60 flex items-center gap-2.5 min-w-[245px] py-3 px-[13px] border border-white/10 rounded-xl bg-surface-1 [box-shadow:0_12px_28px_rgba(0,0,0,0.24)] [&>span]:grid [&>span]:place-items-center [&>span]:w-[25px] [&>span]:h-[25px] [&>span]:rounded-lg [&>span]:bg-surface-3 [&>span]:text-emerald-400 [&>span]:text-[14px] [&>span]:font-extrabold [&_div]:flex [&_div]:flex-1 [&_div]:flex-col [&_div]:gap-[3px] [&_strong]:text-emerald-400 [&_strong]:text-[10px] [&_small]:text-ink-3 [&_small]:text-[9px] [&>button]:border-0 [&>button]:bg-transparent [&>button]:text-ink-3 [&>button]:text-[16px] [&>button]:cursor-pointer [&>button:hover]:text-emerald-400", role: "status" },
            React.createElement("span", null, "\u2713"),
            React.createElement(
              "div",
              null,
              React.createElement("strong", null, "Assessment deleted"),
              React.createElement("small", null, O),
            ),
            React.createElement(
              "button",
              {
                type: "button",
                "aria-label": "Dismiss notification",
                onClick: () => F(""),
              },
              "\xD7",
            ),
          ),
        M &&
          React.createElement(
            "div",
            {
              className: "fixed [inset:0] z-50 grid place-items-center p-5 bg-canvas/40 [backdrop-filter:blur(7px)]",
              onMouseDown: (e) => {
                e.target === e.currentTarget && $(null);
              },
            },
            React.createElement(
              "section",
              {
                className: "w-[min(390px,100%)] pt-7 px-6.5 pb-6 border border-white/10 rounded-[18px] bg-surface-2 [box-shadow:0_25px_70px_rgba(0,0,0,0.38)] text-center [&_p]:mt-0 [&_p]:mx-0 [&_p]:mb-[7px] [&_p]:text-rose-300 [&_p]:text-[8px] [&_p]:font-extrabold [&_p]:tracking-[1.6px] [&_h3]:m-0 [&_h3]:text-ink-2 [&_h3]:text-[17px] [&>span]:block [&>span]:[margin:10px_auto_0] [&>span]:max-w-[300px] [&>span]:text-ink-3 [&>span]:text-[10px] [&>span]:leading-[1.6] [&>div:last-child]:flex [&>div:last-child]:justify-center [&>div:last-child]:gap-2 [&>div:last-child]:mt-5 assessment-confirm-dialog",
                role: "alertdialog",
                "aria-modal": "true",
                "aria-labelledby": "assessment-delete-title",
              },
              React.createElement(
                "div",
                { className: "grid place-items-center w-[46px] h-[46px] [margin:0_auto_13px] rounded-[14px] bg-surface-2 text-rose-300 text-[22px] font-extrabold" },
                "!",
              ),
              React.createElement("p", null, "DELETE ASSESSMENT"),
              React.createElement(
                "h3",
                { id: "assessment-delete-title" },
                "Delete \u201C",
                M.title,
                "\u201D?",
              ),
              React.createElement(
                "span",
                null,
                "This will permanently remove the assessment, its questions, and all student submissions.",
              ),
              React.createElement(
                "div",
                null,
                React.createElement(
                  "button",
                  {
                    type: "button",
                    className: "inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50",
                    onClick: () => $(null),
                  },
                  "Cancel",
                ),
                React.createElement(
                  "button",
                  { type: "button", className: "inline-flex items-center justify-center gap-2 border-0 rounded-[10px] py-2.5 px-[15px] [background:linear-gradient(135deg,#162032,#0F172A)] text-ink text-[11px] font-bold [box-shadow:0_7px_15px_rgba(0,0,0,0.32)] cursor-pointer transition hover:[background:linear-gradient(135deg,#162032,#0F172A)] hover:[box-shadow:0_10px_20px_rgba(0,0,0,0.45)] hover:[transform:translateY(-1px)] disabled:cursor-not-allowed disabled:opacity-60 disabled:[transform:none] [.assessment-confirm-dialog_&]:min-w-[110px]", onClick: l },
                  "Delete assessment",
                ),
              ),
            ),
          ),
        k &&
          React.createElement(
            "div",
            {
              className: "fixed [inset:0] z-50 grid place-items-center p-5 bg-canvas/40 [backdrop-filter:blur(7px)]",
              onMouseDown: (e) => {
                e.target === e.currentTarget && P(null);
              },
            },
            React.createElement(
              "section",
              {
                className: "w-[min(390px,100%)] pt-7 px-6.5 pb-6 border border-white/10 rounded-[18px] bg-surface-2 [box-shadow:0_25px_70px_rgba(0,0,0,0.38)] text-center [&_p]:mt-0 [&_p]:mx-0 [&_p]:mb-[7px] [&_p]:text-rose-300 [&_p]:text-[8px] [&_p]:font-extrabold [&_p]:tracking-[1.6px] [&_h3]:m-0 [&_h3]:text-ink-2 [&_h3]:text-[17px] [&>span]:block [&>span]:[margin:10px_auto_0] [&>span]:max-w-[300px] [&>span]:text-ink-3 [&>span]:text-[10px] [&>span]:leading-[1.6] [&>div:last-child]:flex [&>div:last-child]:justify-center [&>div:last-child]:gap-2 [&>div:last-child]:mt-5 assessment-confirm-dialog",
                role: "alertdialog",
                "aria-modal": "true",
                "aria-labelledby": "assessment-manager-replace-title",
              },
              React.createElement(
                "div",
                { className: "grid place-items-center w-[46px] h-[46px] [margin:0_auto_13px] rounded-[14px] bg-surface-2 text-rose-300 text-[22px] font-extrabold" },
                "!",
              ),
              React.createElement("p", null, "REPLACE ASSESSMENT"),
              React.createElement(
                "h3",
                { id: "assessment-manager-replace-title" },
                i && G(i.category).find((e) => e.value === i.itemNo)?.label,
                " is already assigned to \u201C",
                k.title,
                "\u201D",
              ),
              React.createElement(
                "span",
                null,
                "Saving will delete \u201C",
                k.title,
                "\u201D (its questions and any recorded scores for this item) and put this assessment in its place. This can't be undone.",
              ),
              React.createElement(
                "div",
                null,
                React.createElement(
                  "button",
                  {
                    type: "button",
                    className: "inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50",
                    onClick: () => P(null),
                    disabled: y,
                  },
                  "Cancel",
                ),
                React.createElement(
                  "button",
                  {
                    type: "button",
                    className: "inline-flex items-center justify-center gap-2 border-0 rounded-[10px] py-2.5 px-[15px] [background:linear-gradient(135deg,#162032,#0F172A)] text-ink text-[11px] font-bold [box-shadow:0_7px_15px_rgba(0,0,0,0.32)] cursor-pointer transition hover:[background:linear-gradient(135deg,#162032,#0F172A)] hover:[box-shadow:0_10px_20px_rgba(0,0,0,0.45)] hover:[transform:translateY(-1px)] disabled:cursor-not-allowed disabled:opacity-60 disabled:[transform:none] [.assessment-confirm-dialog_&]:min-w-[110px]",
                    onClick: X,
                    disabled: y,
                  },
                  y ? "Replacing\u2026" : "Replace assessment",
                ),
              ),
            ),
          ),
      )
    : React.createElement(
        V,
        { title: "Manage Assessments", section: g, onClose: d },
        React.createElement(
          "div",
          { className: "grid [justify-items:center] py-12.5 px-5 border border-dashed border-accent/30 rounded-[13px] bg-surface-2 text-center [&_h3]:m-0 [&_h3]:text-ink-2 [&_h3]:text-[14px] [&_p]:mt-[7px] [&_p]:mx-0 [&_p]:mb-0 [&_p]:text-ink-3 [&_p]:text-[10px] student-viewer-empty" },
          React.createElement(
            "span",
            { className: "[.student-viewer-empty_&]:mb-2.5 grid place-items-center w-[34px] h-[34px] rounded-[11px] bg-surface-2 text-accent text-[18px]" },
            "\u2726",
          ),
          React.createElement("h3", null, "No assessments created yet"),
          React.createElement(
            "p",
            null,
            "Create an assessment first, then edit its questions here.",
          ),
        ),
      );
}
function ce({
  section: g,
  students: u,
  assessments: w,
  onSubmit: p,
  onClose: n,
}) {
  const [S, d] = v(u[0]?.id ?? ""),
    [m, E] = v(w[0]?.id ?? ""),
    [i, h] = v({}),
    [y, D] = v(!1),
    [R, C] = v({ status: "", text: "" }),
    M = w.find((r) => r.id === m),
    $ = [...(M?.questions ?? [])].sort(
      (r, A) => Number(r.question_no) - Number(A.question_no),
    ),
    O = z.find((r) => r.key === M?.category)?.label,
    F = J.find((r) => r.key === M?.period?.code)?.label,
    U = (r) => {
      (E(r), h({}), C({ status: "", text: "" }));
    },
    N = async (r) => {
      if ((r.preventDefault(), !S || !m)) {
        C({ status: "error", text: "Select a student and assessment." });
        return;
      }
      (D(!0), C({ status: "", text: "" }));
      try {
        const A = await p({ assessmentId: m, studentId: S, answers: i });
        C({
          status: "success",
          text: A.needsReview
            ? "Answer submitted. Your coding response is waiting for review."
            : `Answer submitted. Score: ${A.score}/${A.maxScore}.`,
        });
      } catch (A) {
        C({
          status: "error",
          text: A?.message || "Answer could not be submitted.",
        });
      } finally {
        D(!1);
      }
    };
  return React.createElement(
    V,
    { title: "Student Viewer", section: g, onClose: n, size: "wide" },
    w.length
      ? React.createElement(
          "form",
          { className: "flex flex-col gap-4", onSubmit: N },
          React.createElement(
            "div",
            { className: "grid grid-cols-[1fr_1.5fr] gap-3 p-3.5 border border-white/10 rounded-[13px] bg-surface-1 [&_label]:flex [&_label]:flex-col [&_label]:gap-1.5 [&_label]:text-ink-2 [&_label]:text-[10px] [&_label]:font-bold [&_select]:box-border [&_select]:w-full [&_select]:border [&_select]:border-white/10 [&_select]:rounded-[9px] [&_select]:bg-surface-1 [&_select]:text-ink-2 [&_select]:p-2.5 [&_select]:text-[10px] max-[760px]:grid-cols-[1fr]" },
            React.createElement(
              "label",
              null,
              "Student",
              React.createElement(
                "select",
                {
                  name: "viewerStudent",
                  value: S,
                  onChange: (r) => d(r.target.value),
                },
                u.map((r) =>
                  React.createElement(
                    "option",
                    { value: r.id, key: r.id },
                    r.name,
                    " \xB7 ",
                    r.number,
                  ),
                ),
              ),
            ),
            React.createElement(
              "label",
              null,
              "Assessment",
              React.createElement(
                "select",
                {
                  name: "viewerAssessment",
                  value: m,
                  onChange: (r) => U(r.target.value),
                },
                w.map((r) =>
                  React.createElement(
                    "option",
                    { value: r.id, key: r.id },
                    r.title,
                    " \xB7 ",
                    z.find((A) => A.key === r.category)?.label,
                  ),
                ),
              ),
            ),
          ),
          M &&
            React.createElement(
              "div",
              { className: "flex items-start justify-between gap-3 py-[17px] px-4.5 border-l-3 border-accent rounded-xl bg-surface-2 [&_span]:text-accent [&_span]:text-[9px] [&_span]:font-extrabold [&_span]:tracking-[.8px] [&_h3]:mt-[5px] [&_h3]:mx-0 [&_h3]:mb-0 [&_h3]:text-ink-2 [&_h3]:text-[16px] [&_p]:mt-1.5 [&_p]:mx-0 [&_p]:mb-0 [&_p]:text-ink-3 [&_p]:text-[10px] [&_p]:leading-[1.5] [&_strong]:py-[7px] [&_strong]:px-[9px] [&_strong]:rounded-[7px] [&_strong]:bg-surface-1 [&_strong]:text-accent [&_strong]:text-[9px] [&_strong]:whitespace-nowrap max-[760px]:flex-col max-[760px]:[&_strong]:self-end" },
              React.createElement(
                "div",
                null,
                React.createElement(
                  "span",
                  null,
                  O,
                  " \xB7 ",
                  F || "Assessment",
                ),
                React.createElement("h3", null, M.title),
                M.instructions &&
                  React.createElement("div", {
                    className: "student-assessment-instructions",
                    dangerouslySetInnerHTML: { __html: M.instructions },
                  }),
              ),
              React.createElement(
                "strong",
                null,
                $.length,
                " ",
                $.length === 1 ? "question" : "questions",
              ),
            ),
          React.createElement(
            "div",
            { className: "flex flex-col gap-[13px]" },
            $.map((r, A) =>
              React.createElement(
                "article",
                { className: "py-[17px] px-4.5 border border-white/10 rounded-[13px] bg-surface-1 [box-shadow:0_4px_14px_rgba(0,240,255,0.02)] [&_h4]:mt-0 [&_h4]:mx-0 [&_h4]:mb-3.5 [&_h4]:text-ink-2 [&_h4]:text-[12px] [&_h4]:leading-[1.55] [&_h4]:[white-space:pre-wrap]", key: r.id },
                React.createElement(
                  "div",
                  { className: "flex items-center justify-between mb-[9px] [&_span]:text-accent [&_span]:text-[8px] [&_span]:font-extrabold [&_span]:tracking-[1.3px] [&_small]:text-ink-3 [&_small]:text-[9px]" },
                  React.createElement("span", null, "QUESTION ", A + 1),
                  React.createElement(
                    "small",
                    null,
                    r.points,
                    " ",
                    Number(r.points) === 1 ? "point" : "points",
                  ),
                ),
                React.createElement("h4", null, r.prompt),
                r.question_type === "multiple_choice"
                  ? React.createElement(
                      "div",
                      { className: "grid grid-cols-[1fr_1fr] gap-[9px] [&_label]:grid [&_label]:grid-cols-[15px_24px_minmax(0,1fr)] [&_label]:items-center [&_label]:gap-2 [&_label]:p-2.5 [&_label]:border [&_label]:border-white/10 [&_label]:rounded-[9px] [&_label]:text-ink-2 [&_label]:text-[10px] [&_label]:cursor-pointer [&_label]:transition [&_label:hover]:border-accent/30 [&_label:hover]:bg-surface-1 [&_label:hover]:text-accent [&_label.selected]:border-accent/30 [&_label.selected]:bg-surface-1 [&_label.selected]:text-accent [&_input]:[accent-color:#00F0FF] max-[760px]:grid-cols-[1fr] student-choice-list" },
                      (Array.isArray(r.choices) ? r.choices : []).map(
                        (k, P) => {
                          const b = L[P];
                          return React.createElement(
                            "label",
                            {
                              className: i[r.id] === b ? "selected" : "",
                              key: b,
                            },
                            React.createElement("input", {
                              type: "radio",
                              name: `answer-${r.id}`,
                              value: b,
                              checked: i[r.id] === b,
                              onChange: (_) =>
                                h((T) => ({ ...T, [r.id]: _.target.value })),
                            }),
                            React.createElement(
                              "span",
                              { className: "[.student-portal-options_&]:w-[24px] [.student-portal-options_&]:h-[24px] [.student-choice-list_&]:w-[24px] [.student-choice-list_&]:h-[24px] grid place-items-center w-[23px] h-[23px] rounded-[7px] bg-surface-2 text-accent text-[9px] font-extrabold choice-letter" },
                              b,
                            ),
                            React.createElement("span", null, k),
                          );
                        },
                      ),
                    )
                  : React.createElement(
                      "div",
                      { className: "overflow-hidden border border-white/10 rounded-[10px] bg-surface-1 [&_textarea]:block [&_textarea]:w-full [&_textarea]:box-border [&_textarea]:min-h-[150px] [&_textarea]:border-0 [&_textarea]:rounded-none [&_textarea]:bg-surface-1 [&_textarea]:text-ink-2 [&_textarea]:p-3 [&_textarea]:font-medium [&_textarea]:text-[11px] [&_textarea]:[resize:vertical] [&_textarea]:outline-none [&_textarea:focus]:[box-shadow:inset_0_0_0_2px_#162032]" },
                      React.createElement(
                        "div",
                        { className: "flex items-center justify-between py-[9px] px-[11px] border-b border-white/10 bg-surface-2 [&_span]:text-accent [&_span]:font-bold [&_span]:text-[10px] [&_small]:text-ink-3 [&_small]:text-[9px]" },
                        React.createElement(
                          "span",
                          null,
                          K.find((k) => k.key === r.language)?.label || "Code",
                        ),
                        React.createElement(
                          "small",
                          null,
                          "Write your solution below",
                        ),
                      ),
                      React.createElement("textarea", {
                        name: `viewer-answer-${r.id}`,
                        rows: "8",
                        spellCheck: "false",
                        value: i[r.id] ?? "",
                        placeholder:
                          r.starter_code || "Write your code here...",
                        onChange: (k) =>
                          h((P) => ({ ...P, [r.id]: k.target.value })),
                      }),
                    ),
              ),
            ),
          ),
          R.text &&
            React.createElement(
              "p",
              { className: `mt-0 mx-0 mb-3 py-[9px] px-[11px] rounded-[7px] text-[10px] [&.error]:border [&.error]:border-white/10 [&.error]:bg-surface-2 [&.error]:text-rose-300 [&.success]:border [&.success]:border-white/10 [&.success]:bg-surface-2 [&.success]:text-emerald-400 ${R.status}`, role: "status" },
              R.text,
            ),
          React.createElement(
            "div",
            { className: "flex justify-end gap-2 mt-5.5 pt-[17px] border-t border-white/10 max-[760px]:flex-wrap max-[760px]:[&_button]:flex-1 [.assessment-builder_&]:mt-0.5" },
            React.createElement(
              "button",
              {
                type: "button",
                className: "inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50",
                onClick: n,
                disabled: y,
              },
              "Close",
            ),
            React.createElement(
              "button",
              {
                type: "submit",
                className: "inline-flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-canvas transition hover:shadow-halo active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
                disabled: y || !$.length,
              },
              y ? "Submitting\u2026" : "Submit answers",
            ),
          ),
        )
      : React.createElement(
          "div",
          { className: "grid [justify-items:center] py-12.5 px-5 border border-dashed border-accent/30 rounded-[13px] bg-surface-2 text-center [&_h3]:m-0 [&_h3]:text-ink-2 [&_h3]:text-[14px] [&_p]:mt-[7px] [&_p]:mx-0 [&_p]:mb-0 [&_p]:text-ink-3 [&_p]:text-[10px] student-viewer-empty" },
          React.createElement(
            "span",
            { className: "[.student-viewer-empty_&]:mb-2.5 grid place-items-center w-[34px] h-[34px] rounded-[11px] bg-surface-2 text-accent text-[18px]" },
            "\u2726",
          ),
          React.createElement("h3", null, "No assessments available"),
          React.createElement(
            "p",
            null,
            "Create a quiz, assignment, graded activity, or exam first.",
          ),
        ),
  );
}
export {
  re as AssessmentBuilder,
  le as AssessmentManager,
  ce as StudentViewer,
};
