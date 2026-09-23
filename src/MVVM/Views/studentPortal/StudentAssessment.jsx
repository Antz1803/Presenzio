import React from "react";
import L from "../../../assets/Icon.png";
import {
  categoryLabels as _,
  periodLabels as U,
  letters as V,
  formatCountdown as R,
  formatStudentName as j,
} from "./studentPortalUtils";
export default function H({
  answers: b,
  setAnswers: c,
  submitting: u,
  message: x,
  remainingSeconds: i,
  securityMessage: h,
  currentQuestionIndex: o,
  setCurrentQuestionIndex: p,
  violations: N,
  selectedAssessment: d,
  selectedStudent: s,
  section: y,
  sections: g,
  students: v,
  assessmentDefinitions: f,
  activeSectionId: C,
  activeStudentId: S,
  activeAssessmentId: A,
  setSelectedSectionId: $,
  setStudentId: z,
  setAssessmentId: T,
  selectSection: M,
  changeAssessment: O,
  questions: l,
  submit: P,
  allAnswered: w,
  activeQuestion: t,
  answeredCount: k,
  connectionStatus: m,
}) {
  return React.createElement(
    "div",
    { className: "min-h-screen bg-[#07090e] font-sans text-slate-100 pb-16" },
    React.createElement(
      "header",
      {
        className:
          "sticky top-0 z-40 flex items-center justify-between border-b border-cyan-950/60 bg-[#0b0f17]/90 px-6 py-3.5 backdrop-blur-md",
      },
      React.createElement(
        "a",
        {
          className:
            "flex items-center gap-2.5 text-lg font-bold text-white transition hover:opacity-80",
          href: "/",
        },
        React.createElement("img", {
          className: "h-7 w-7 object-contain",
          src: L,
          alt: "Presenzio",
        }),
        React.createElement(
          "span",
          { className: "tracking-tight text-cyan-400 font-mono" },
          "presenzio",
        ),
      ),
      React.createElement(
        "div",
        { className: "flex items-center gap-3" },
        React.createElement(
          "div",
          {
            className:
              "flex items-center gap-2 rounded-full border border-slate-800 bg-[#121824] px-3 py-1 text-xs font-medium text-slate-300",
          },
          React.createElement("span", {
            className: `h-2 w-2 rounded-full ${m === "live" ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" : m === "offline" ? "bg-rose-500" : "bg-amber-400"}`,
          }),
          m === "offline"
            ? "Offline"
            : m === "live"
              ? "Online"
              : "Connecting...",
        ),
        React.createElement(
          "span",
          {
            className:
              "rounded border border-cyan-900/40 bg-cyan-950/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-300",
          },
          "Student View",
        ),
      ),
    ),
    React.createElement(
      "main",
      { className: "mx-auto max-w-7xl px-4 pt-6 md:px-6" },
      React.createElement(
        "div",
        {
          className:
            "mb-6 flex flex-col justify-between gap-4 border-b border-slate-800/80 pb-6 md:flex-row md:items-center",
        },
        React.createElement(
          "div",
          null,
          React.createElement(
            "p",
            {
              className:
                "text-xs font-bold uppercase tracking-widest text-cyan-400 font-mono",
            },
            y?.subject_code || "ASSESSMENT PORTAL",
          ),
          React.createElement(
            "h1",
            {
              className:
                "mt-1 text-2xl font-black tracking-tight text-white md:text-3xl",
            },
            "Complete Your Assessment",
          ),
          React.createElement(
            "p",
            { className: "mt-1 text-sm text-slate-400" },
            "Read instructions thoroughly before answering questions.",
          ),
        ),
        s &&
          React.createElement(
            "div",
            {
              className:
                "flex min-w-[240px] items-center gap-3 rounded-xl border border-slate-800 bg-[#121824] p-3 shadow-lg",
            },
            React.createElement(
              "div",
              {
                className:
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-950/50 text-base font-bold text-cyan-300 font-mono",
              },
              s?.name
                ? s.name
                    .replace(/[^a-zA-Z]/g, "")
                    .charAt(0)
                    .toUpperCase()
                : "S",
            ),
            React.createElement(
              "div",
              { className: "min-w-0 flex-1 text-left leading-tight" },
              React.createElement(
                "span",
                {
                  className:
                    "block text-[10px] font-bold uppercase tracking-wider text-slate-400",
                },
                y?.subject_code || "Class",
              ),
              React.createElement(
                "strong",
                {
                  className: "block truncate text-sm font-bold text-slate-100",
                  title: j(s?.name),
                },
                j(s?.name),
              ),
              React.createElement(
                "small",
                { className: "block text-[11px] text-slate-400 font-mono" },
                s?.number,
              ),
            ),
          ),
      ),
      React.createElement(
        "div",
        { className: "mb-6 grid grid-cols-1 gap-4 md:grid-cols-3" },
        React.createElement(
          "div",
          {
            className:
              "rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-slate-200 shadow-md md:col-span-2",
          },
          React.createElement(
            "div",
            { className: "flex items-center gap-2" },
            React.createElement(
              "span",
              {
                className:
                  "rounded border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300",
              },
              "Mandatory Rules",
            ),
            React.createElement(
              "h3",
              { className: "text-sm font-bold text-amber-200" },
              "Exam Integrity Policy",
            ),
          ),
          React.createElement(
            "ul",
            {
              className:
                "mt-2.5 grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs text-slate-300 sm:grid-cols-2",
            },
            React.createElement(
              "li",
              { className: "flex items-center gap-2" },
              React.createElement(
                "span",
                { className: "text-amber-400 font-bold" },
                "\u2022",
              ),
              " No tab switching or browser minimization",
            ),
            React.createElement(
              "li",
              { className: "flex items-center gap-2" },
              React.createElement(
                "span",
                { className: "text-amber-400 font-bold" },
                "\u2022",
              ),
              " No refreshing or leaving this page",
            ),
            React.createElement(
              "li",
              { className: "flex items-center gap-2" },
              React.createElement(
                "span",
                { className: "text-amber-400 font-bold" },
                "\u2022",
              ),
              " No screenshots or screen recording",
            ),
            React.createElement(
              "li",
              { className: "flex items-center gap-2" },
              React.createElement(
                "span",
                { className: "text-amber-400 font-bold" },
                "\u2022",
              ),
              " No sharing answers or external aids",
            ),
          ),
        ),
        React.createElement(
          "div",
          {
            className:
              "flex flex-col justify-center rounded-xl border border-rose-500/30 bg-rose-950/20 p-4",
          },
          React.createElement(
            "span",
            {
              className:
                "mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-300",
            },
            React.createElement(
              "svg",
              {
                className: "h-4 w-4 fill-current text-rose-400",
                viewBox: "0 0 20 20",
              },
              React.createElement("path", {
                d: "M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z",
              }),
            ),
            "Auto-Violation Tracking",
          ),
          React.createElement(
            "p",
            { className: "text-xs leading-relaxed text-rose-200/80" },
            "Unapproved focus switches are recorded live and will auto-submit your exam with penalty flags.",
          ),
        ),
      ),
      g.length > 0 &&
        React.createElement(
          "section",
          {
            className:
              "mb-6 rounded-xl border border-slate-800 bg-[#121824] p-4 shadow-md",
          },
          React.createElement(
            "div",
            { className: "grid grid-cols-1 gap-4 md:grid-cols-3" },
            React.createElement(
              "label",
              {
                className:
                  "flex flex-col text-xs font-bold uppercase tracking-wider text-slate-300",
              },
              "Class",
              React.createElement(
                "select",
                {
                  name: "assessmentClass",
                  className:
                    "mt-1.5 rounded-lg border border-slate-700 bg-[#0b0f17] px-3 py-2 text-sm font-normal text-slate-100 focus:border-cyan-500 focus:outline-none",
                  value: C,
                  onChange: (e) => {
                    const a = e.target.value;
                    ($(a), T(""), c({}), M(a));
                  },
                },
                !g.length &&
                  React.createElement(
                    "option",
                    { value: "" },
                    "No classes available",
                  ),
                g.map((e) =>
                  React.createElement(
                    "option",
                    { value: e.id, key: e.id },
                    e.subject_code,
                    " \xB7 ",
                    e.subject_title,
                  ),
                ),
              ),
            ),
            React.createElement(
              "label",
              {
                className:
                  "flex flex-col text-xs font-bold uppercase tracking-wider text-slate-300",
              },
              "Your Name",
              React.createElement(
                "select",
                {
                  name: "assessmentStudent",
                  className:
                    "mt-1.5 rounded-lg border border-slate-700 bg-[#0b0f17] px-3 py-2 text-sm font-normal text-slate-100 focus:border-cyan-500 focus:outline-none",
                  value: S,
                  onChange: (e) => z(e.target.value),
                },
                !v.length &&
                  React.createElement(
                    "option",
                    { value: "" },
                    "No students available",
                  ),
                v.map((e) =>
                  React.createElement(
                    "option",
                    { value: e.id, key: e.id },
                    e.name,
                  ),
                ),
              ),
            ),
            React.createElement(
              "label",
              {
                className:
                  "flex flex-col text-xs font-bold uppercase tracking-wider text-slate-300",
              },
              "Assessment",
              React.createElement(
                "select",
                {
                  name: "assessmentSelection",
                  className:
                    "mt-1.5 rounded-lg border border-slate-700 bg-[#0b0f17] px-3 py-2 text-sm font-normal text-slate-100 focus:border-cyan-500 focus:outline-none",
                  value: A,
                  onChange: (e) => O(e.target.value),
                },
                !f.length &&
                  React.createElement(
                    "option",
                    { value: "" },
                    "No assessments available",
                  ),
                f.map((e) =>
                  React.createElement(
                    "option",
                    { value: e.id, key: e.id },
                    e.title,
                    " \xB7 ",
                    _[e.category],
                  ),
                ),
              ),
            ),
          ),
        ),
      f.length
        ? React.createElement(
            "form",
            { onSubmit: P, className: "space-y-6" },
            React.createElement(
              "div",
              {
                className:
                  "flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-[#121824] p-6 shadow-xl md:flex-row md:items-start",
              },
              React.createElement(
                "div",
                { className: "flex-1" },
                React.createElement(
                  "span",
                  {
                    className:
                      "text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono",
                  },
                  _[d?.category],
                  " \xB7 ",
                  U[d?.period?.code] || "Assessment",
                ),
                React.createElement(
                  "h2",
                  { className: "mt-1 text-2xl font-black text-white" },
                  d?.title,
                ),
                d?.instructions &&
                  React.createElement("div", {
                    className: `mt-4 overflow-x-auto rounded-xl border border-slate-800 bg-[#0b0f17] p-5 text-sm leading-relaxed text-slate-100
                      [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-lg [&_table]:border [&_table]:border-slate-800
                      [&_th]:border [&_th]:border-slate-800 [&_th]:bg-[#030712] [&_th]:p-3 [&_th]:text-left [&_th]:font-bold [&_th]:!text-black
                      [&_td]:border [&_td]:border-slate-800 [&_td]:bg-[#0b0f17] [&_td]:p-3 [&_td]:text-slate-200
                      [&_p]:my-1.5 [&_a]:text-cyan-400 [&_a]:underline [&_img]:max-w-full [&_img]:rounded-lg`,
                    dangerouslySetInnerHTML: { __html: d.instructions },
                  }),
              ),
              React.createElement(
                "div",
                {
                  className:
                    "flex flex-wrap gap-2 text-xs md:w-48 md:flex-col md:items-stretch shrink-0",
                },
                React.createElement(
                  "div",
                  {
                    className:
                      "flex justify-between items-center rounded-xl border border-slate-700 bg-[#0b0f17] p-3 font-semibold text-slate-300",
                  },
                  React.createElement("span", null, "Questions"),
                  React.createElement(
                    "strong",
                    { className: "text-base text-white font-mono" },
                    l.length,
                  ),
                ),
                React.createElement(
                  "div",
                  {
                    className: `flex justify-between items-center rounded-xl border p-3 font-semibold ${i != null && i < 60 ? "animate-pulse border-rose-500/80 bg-rose-950/80 text-rose-200" : "border-slate-700 bg-[#0b0f17] text-cyan-300"}`,
                  },
                  React.createElement("span", null, "Timer"),
                  React.createElement(
                    "strong",
                    { className: "text-sm font-mono" },
                    i != null ? R(i) : "\u221E",
                  ),
                ),
                N.length > 0 &&
                  React.createElement(
                    "div",
                    {
                      className:
                        "flex justify-between items-center rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 font-bold text-rose-300",
                    },
                    React.createElement("span", null, "Violations"),
                    React.createElement(
                      "span",
                      { className: "font-mono" },
                      N.length,
                    ),
                  ),
              ),
            ),
            React.createElement(
              "div",
              {
                className: "grid grid-cols-1 items-start gap-6 lg:grid-cols-4",
              },
              React.createElement(
                "aside",
                {
                  className:
                    "sticky top-20 rounded-2xl border border-slate-800 bg-[#121824] p-5 shadow-lg lg:col-span-1",
                },
                React.createElement(
                  "h4",
                  {
                    className:
                      "mb-3 text-xs font-bold uppercase tracking-wider text-slate-400 font-mono",
                  },
                  "Question Map",
                ),
                React.createElement(
                  "div",
                  { className: "grid grid-cols-5 gap-2" },
                  l.map((e, a) => {
                    const r = String(b[e.id] ?? "").trim() !== "",
                      n = a === o;
                    return React.createElement(
                      "button",
                      {
                        key: e.id,
                        type: "button",
                        onClick: () => p(a),
                        className: `flex h-10 w-full items-center justify-center rounded-lg border text-xs font-bold font-mono transition ${n ? "border-cyan-400 bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(34,211,238,0.4)] ring-2 ring-cyan-400/30" : r ? "border-emerald-500/50 bg-emerald-950/60 text-emerald-300" : "border-slate-700/80 bg-[#0b0f17] text-slate-400 hover:border-slate-600 hover:text-slate-100"}`,
                      },
                      a + 1,
                    );
                  }),
                ),
                React.createElement(
                  "div",
                  {
                    className:
                      "mt-4 flex items-center justify-between border-t border-slate-800 pt-3 text-xs text-slate-400",
                  },
                  React.createElement("span", null, "Progress"),
                  React.createElement(
                    "span",
                    { className: "font-bold text-slate-200 font-mono" },
                    k,
                    " / ",
                    l.length,
                  ),
                ),
              ),
              React.createElement(
                "div",
                { className: "space-y-4 lg:col-span-3" },
                t &&
                  React.createElement(
                    "article",
                    {
                      className:
                        "rounded-2xl border border-slate-800 bg-[#121824] p-6 shadow-2xl",
                    },
                    React.createElement(
                      "div",
                      {
                        className:
                          "mb-4 flex items-center justify-between border-b border-slate-800 pb-3",
                      },
                      React.createElement(
                        "span",
                        {
                          className:
                            "text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono",
                        },
                        "QUESTION ",
                        o + 1,
                        " OF ",
                        l.length,
                      ),
                      React.createElement(
                        "span",
                        {
                          className:
                            "rounded-md border border-slate-700 bg-[#0b0f17] px-2.5 py-1 text-xs font-bold text-slate-300 font-mono",
                        },
                        t.points,
                        " ",
                        Number(t.points) === 1 ? "POINT" : "POINTS",
                      ),
                    ),
                    React.createElement(
                      "h3",
                      {
                        className:
                          "mb-6 text-xl font-bold text-white leading-relaxed",
                      },
                      t.prompt,
                    ),
                    t.question_type === "multiple_choice"
                      ? React.createElement(
                          "div",
                          { className: "space-y-3" },
                          (Array.isArray(t.choices) ? t.choices : []).map(
                            (e, a) => {
                              const r = V[a],
                                n = b[t.id] === r;
                              return React.createElement(
                                "label",
                                {
                                  key: r,
                                  className: `flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${n ? "border-cyan-400 bg-cyan-950/40 text-white ring-1 ring-cyan-400/40" : "border-slate-800 bg-[#0b0f17] text-slate-200 hover:border-slate-700 hover:bg-[#161d2b]"}`,
                                },
                                React.createElement("input", {
                                  type: "radio",
                                  className: "sr-only",
                                  name: `question-${t.id}`,
                                  value: r,
                                  checked: n,
                                  onChange: (E) =>
                                    c((Y) => ({
                                      ...Y,
                                      [t.id]: E.target.value,
                                    })),
                                }),
                                React.createElement(
                                  "span",
                                  {
                                    className: `flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold font-mono ${n ? "bg-cyan-400 text-slate-950" : "border border-slate-700 bg-[#121824] text-slate-400"}`,
                                  },
                                  r,
                                ),
                                React.createElement(
                                  "span",
                                  { className: "pt-0.5 text-sm font-semibold" },
                                  e,
                                ),
                              );
                            },
                          ),
                        )
                      : React.createElement(
                          "div",
                          {
                            className:
                              "overflow-hidden rounded-xl border border-slate-800 bg-[#0b0f17]",
                          },
                          React.createElement(
                            "div",
                            {
                              className:
                                "flex items-center justify-between border-b border-slate-800 bg-[#161d2b] px-4 py-2 font-mono text-xs text-slate-300",
                            },
                            React.createElement(
                              "b",
                              { className: "text-cyan-400" },
                              String(t.language || "code").toUpperCase(),
                            ),
                            React.createElement(
                              "span",
                              null,
                              "Solution Editor",
                            ),
                          ),
                          React.createElement("textarea", {
                            name: `answer-${t.id}`,
                            spellCheck: "false",
                            rows: 10,
                            className:
                              "w-full bg-[#0b0f17] p-4 font-mono text-sm text-emerald-400 focus:outline-none focus:ring-1 focus:ring-cyan-500",
                            value: b[t.id] ?? "",
                            placeholder:
                              t.starter_code ||
                              "// Write your code solution here...",
                            onChange: (e) =>
                              c((a) => ({ ...a, [t.id]: e.target.value })),
                          }),
                        ),
                    React.createElement(
                      "div",
                      {
                        className:
                          "mt-8 flex items-center justify-between border-t border-slate-800 pt-5",
                      },
                      React.createElement(
                        "button",
                        {
                          type: "button",
                          className:
                            "rounded-xl border border-slate-700 bg-[#0b0f17] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-200 transition hover:bg-[#161d2b] disabled:cursor-not-allowed disabled:opacity-40",
                          disabled: o === 0,
                          onClick: () => p((e) => Math.max(0, e - 1)),
                        },
                        "\u2190 Previous",
                      ),
                      o < l.length - 1 &&
                        React.createElement(
                          "button",
                          {
                            type: "button",
                            className:
                              "rounded-xl bg-cyan-500 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-md transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40",
                            disabled: !String(b[t.id] ?? "").trim(),
                            onClick: () =>
                              p((e) => Math.min(l.length - 1, e + 1)),
                          },
                          "Next \u2192",
                        ),
                    ),
                  ),
                !w &&
                  React.createElement(
                    "p",
                    {
                      className:
                        "rounded-xl border border-slate-800 bg-[#121824] p-4 text-xs font-medium text-slate-400",
                    },
                    "Answer every item before submitting. You have completed ",
                    k,
                    " of ",
                    l.length,
                    " questions.",
                  ),
                x.text &&
                  React.createElement(
                    "div",
                    {
                      className: `rounded-xl border p-4 text-xs font-bold ${x.status === "error" ? "border-rose-500/50 bg-rose-950/60 text-rose-200" : "border-emerald-500/50 bg-emerald-950/60 text-emerald-200"}`,
                      role: "status",
                    },
                    x.text,
                  ),
                h &&
                  React.createElement(
                    "div",
                    {
                      className:
                        "rounded-xl border border-amber-500/50 bg-amber-950/60 p-4 text-xs font-bold text-amber-200",
                      role: "alert",
                    },
                    h,
                  ),
                React.createElement(
                  "div",
                  {
                    className:
                      "flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#121824] p-5 shadow-lg sm:flex-row",
                  },
                  React.createElement(
                    "span",
                    { className: "text-xs font-medium text-slate-400" },
                    s
                      ? `Student Session: ${s.name}`
                      : "Select student identity to submit",
                  ),
                  o === l.length - 1 &&
                    React.createElement(
                      "button",
                      {
                        className:
                          "w-full rounded-xl bg-cyan-400 px-8 py-3 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg shadow-cyan-400/20 transition hover:bg-cyan-300 disabled:border disabled:border-slate-800 disabled:bg-[#0b0f17] disabled:text-slate-600 disabled:shadow-none sm:w-auto",
                        disabled: u || !w,
                      },
                      u ? "Submitting Assessment\u2026" : "Submit Assessment",
                    ),
                ),
              ),
            ),
          )
        : React.createElement(
            "div",
            {
              className:
                "rounded-2xl border border-dashed border-slate-800 bg-[#121824]/40 py-16 text-center",
            },
            React.createElement(
              "span",
              { className: "text-4xl text-cyan-400" },
              "\u2726",
            ),
            React.createElement(
              "h2",
              { className: "mt-2 text-xl font-bold text-slate-200" },
              "No Assessment Available Yet",
            ),
            React.createElement(
              "p",
              { className: "mt-1 text-sm text-slate-400" },
              "Your teacher has not published an assessment for this class.",
            ),
          ),
    ),
  );
}
