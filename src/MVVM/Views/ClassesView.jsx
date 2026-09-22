import React, { useMemo as E, useState as g } from "react";
import { Icon as s } from "./DashboardShared";
function S(t) {
  if (!t) return "—";
  const [l, c] = String(t).split(":").map(Number),
    n = l >= 12 ? "PM" : "AM";
  return `${l % 12 || 12}:${String(c).padStart(2, "0")} ${n}`;
}
function z(t) {
  return {
    days: t.days || "",
    time_start: String(t.time_start || "").slice(0, 5),
    time_end: String(t.time_end || "").slice(0, 5),
    edp_code: t.edp_code || "",
    subject_code: t.subject_code || "",
    subject_title: t.subject_title || "",
    room: t.room || "",
    year_level: t.year_level || "",
    section_no: t.section_no || "",
  };
}
function M({ item: t, onClose: l, onSave: c }) {
  const [n, b] = g(() => z(t)),
    [i, d] = g(!1),
    [u, m] = g(""),
    h = (a, r) => b((p) => ({ ...p, [a]: r })),
    v = async (a) => {
      (a.preventDefault(), d(!0), m(""));
      try {
        await c(t.id, n);
      } catch (r) {
        m(r?.message || "This class could not be saved.");
      } finally {
        d(!1);
      }
    },
    o = (a, r, p = "text", f = !1) =>
      React.createElement(
        "label",
        {
          className:
            (f ? "col-span-2 " : "") +
            "flex flex-col gap-1.5 text-xs font-semibold text-slate-700",
        },
        r,
        React.createElement("input", {
          name: a,
          className:
            "w-full rounded-xl border border-white/60 bg-white/50 px-3.5 py-2.5 text-sm font-normal text-slate-800 outline-none backdrop-blur-md shadow-inner transition duration-200 placeholder:text-slate-400 hover:bg-white/80 focus:border-indigo-500/50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10",
          type: p,
          value: n[a],
          onChange: (x) => h(a, x.target.value),
        }),
      );
  return React.createElement(
    "div",
    {
      className:
        "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-md transition-all",
      role: "presentation",
      onMouseDown: (a) => a.target === a.currentTarget && !i && l(),
    },
    React.createElement(
      "section",
      {
        className:
          "relative max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/60 bg-white/70 p-7 shadow-[0_20px_50px_rgba(0,0,0,0.1)] backdrop-blur-2xl ring-1 ring-white/80",
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "edit-class-title",
      },
      React.createElement(
        "div",
        {
          className:
            "mb-6 flex items-start justify-between gap-4 border-b border-slate-200/50 pb-4",
        },
        React.createElement(
          "div",
          null,
          React.createElement(
            "span",
            {
              className:
                "inline-flex items-center gap-1.5 rounded-full border border-indigo-200/50 bg-indigo-50/50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 backdrop-blur-sm",
            },
            React.createElement("span", {
              className: "h-1.5 w-1.5 rounded-full bg-indigo-500",
            }),
            " Class Management",
          ),
          React.createElement(
            "h2",
            {
              id: "edit-class-title",
              className:
                "mt-2 text-2xl font-bold tracking-tight text-slate-900",
            },
            "Edit Class Schedule",
          ),
          React.createElement(
            "p",
            { className: "mt-1 text-xs text-slate-500" },
            "Update course metadata, room assignments, and meeting times.",
          ),
        ),
        React.createElement(
          "button",
          {
            className:
              "flex h-8 w-8 items-center justify-center rounded-full border border-white/80 bg-white/60 text-slate-400 backdrop-blur-sm transition hover:bg-white hover:text-slate-700",
            type: "button",
            "aria-label": "Close edit dialog",
            onClick: l,
            disabled: i,
          },
          "✕",
        ),
      ),
      React.createElement(
        "form",
        { onSubmit: v },
        React.createElement(
          "div",
          { className: "grid grid-cols-2 gap-4 max-sm:grid-cols-1" },
          o("days", "Days"),
          o("room", "Room"),
          o("time_start", "Start time", "time"),
          o("time_end", "End time", "time"),
          o("edp_code", "EDP code"),
          o("subject_code", "Subject code"),
          o("subject_title", "Subject name", "text", !0),
          o("year_level", "Year level"),
          o("section_no", "Section number"),
        ),
        u &&
          React.createElement(
            "p",
            {
              className:
                "mt-4 rounded-xl border border-rose-200/60 bg-rose-50/60 p-3 text-xs font-medium text-rose-600 backdrop-blur-md",
              role: "alert",
            },
            u,
          ),
        React.createElement(
          "div",
          {
            className:
              "mt-8 flex justify-end gap-3 border-t border-slate-200/50 pt-5",
          },
          React.createElement(
            "button",
            {
              className:
                "rounded-xl border border-white/80 bg-white/60 px-5 py-2.5 text-xs font-semibold text-slate-600 backdrop-blur-sm transition hover:bg-white active:scale-95",
              type: "button",
              onClick: l,
              disabled: i,
            },
            "Cancel",
          ),
          React.createElement(
            "button",
            {
              className:
                "rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-700 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:shadow-indigo-500/40 active:scale-95 disabled:opacity-60",
              type: "submit",
              disabled: i,
            },
            i ? "Saving changes..." : "Save details",
          ),
        ),
      ),
    ),
  );
}
export default function $({
  sections: t = [],
  section: l,
  importMasterList: c,
  importGradeSheet: n,
  importState: b,
  gradeSheetImportState: i,
  connectionStatus: d = "connecting",
  connectionMessage: u = "Connecting to Supabase…",
  pendingSyncCount: m = 0,
  onOpenStudents: h,
  onOpenClassOptions: v,
  onDeleteClass: o,
  onUpdateClass: a,
}) {
  const [r, p] = g(""),
    [f, x] = g(null),
    k = E(
      () =>
        t.filter((e) =>
          `${e.subject_code} ${e.subject_title} ${e.room} ${e.edp_code} ${e.section_no} ${e.year_level}`
            .toLowerCase()
            .includes(r.toLowerCase()),
        ),
      [t, r],
    ),
    w = d === "offline",
    N = d === "live" || d === "online",
    y = d === "error",
    C = (e, _) => {
      const j = e.target.files?.[0];
      (j && _(j), (e.target.value = ""));
    };
  return React.createElement(
    "div",
    {
      className:
        "relative flex min-h-full flex-col gap-8 bg-gradient-to-br from-slate-100/80 via-indigo-50/20 to-slate-100/60 p-8 text-slate-900 [font-family:system-ui,-apple-system,sans-serif] max-md:p-4",
    },
    f &&
      React.createElement(M, {
        item: f,
        onClose: () => x(null),
        onSave: async (e, _) => {
          if (!a) throw new Error("Editing is not available.");
          (await a(e, _), x(null));
        },
      }),
    React.createElement(
      "header",
      {
        className:
          "relative overflow-hidden rounded-3xl border border-white/80 bg-white/40 p-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] backdrop-blur-xl",
      },
      React.createElement("div", {
        className:
          "pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl",
      }),
      React.createElement("div", {
        className:
          "pointer-events-none absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl",
      }),
      React.createElement(
        "div",
        {
          className:
            "relative z-10 flex items-center justify-between gap-6 max-md:flex-col max-md:items-start",
        },
        React.createElement(
          "div",
          { className: "flex items-center gap-4" },
          React.createElement(
            "div",
            {
              className:
                "flex h-14 w-14 items-center justify-center rounded-2xl border border-white/80 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg shadow-indigo-500/20 backdrop-blur-md",
            },
            React.createElement(s, { name: "users", size: 26 }),
          ),
          React.createElement(
            "div",
            null,
            React.createElement(
              "div",
              { className: "flex items-center gap-2" },
              React.createElement(
                "span",
                {
                  className:
                    "text-[10px] font-bold uppercase tracking-widest text-indigo-600",
                },
                "Academic Management",
              ),
            ),
            React.createElement(
              "h1",
              {
                className:
                  "mt-0.5 text-3xl font-extrabold tracking-tight text-slate-900",
              },
              "Classes",
            ),
            React.createElement(
              "p",
              { className: "mt-0.5 text-xs font-medium text-slate-500" },
              "Manage course sections, enrollment lists, score synchronization, and attendance.",
            ),
          ),
        ),
        React.createElement(
          "div",
          {
            className:
              "flex items-center gap-3 text-xs font-semibold max-md:w-full max-md:flex-wrap",
          },
          React.createElement(
            "div",
            {
              className: `flex items-center gap-2 rounded-full border px-4 py-2 shadow-sm backdrop-blur-md ${N ? "border-emerald-200/80 bg-emerald-50/60 text-emerald-700" : w || y ? "border-rose-200/80 bg-rose-50/60 text-rose-700" : "border-amber-200/80 bg-amber-50/60 text-amber-700"}`,
              title: u,
            },
            React.createElement("span", {
              className: `h-2 w-2 rounded-full ${N ? "bg-emerald-500 animate-pulse" : w || y ? "bg-rose-500" : "bg-amber-500"}`,
            }),
            N
              ? "Live Connected"
              : w
                ? "Offline Mode"
                : y
                  ? "Connection Error"
                  : "Syncing Status...",
          ),
          m > 0 &&
            React.createElement(
              "div",
              {
                className:
                  "flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/60 px-4 py-2 text-sky-700 shadow-sm backdrop-blur-md",
              },
              React.createElement(s, { name: "arrow", size: 14 }),
              m,
              " pending syncs",
            ),
        ),
      ),
    ),
    React.createElement(
      "div",
      {
        className:
          "grid grid-cols-[minmax(0,1fr)_320px] gap-8 max-lg:grid-cols-1",
      },
      React.createElement(
        "section",
        null,
        React.createElement(
          "div",
          { className: "mb-6 flex gap-4" },
          React.createElement(
            "label",
            {
              className:
                "flex flex-1 items-center gap-3 rounded-2xl border border-white/80 bg-white/50 px-4 py-3 text-slate-400 shadow-[0_4px_20px_0_rgba(0,0,0,0.03)] backdrop-blur-md transition hover:border-white hover:bg-white/70 focus-within:border-indigo-500/50 focus-within:bg-white/90 focus-within:ring-4 focus-within:ring-indigo-500/10",
            },
            React.createElement(s, { name: "search", size: 18 }),
            React.createElement("input", {
              name: "classSearch",
              className:
                "w-full border-0 bg-transparent text-sm font-normal text-slate-800 outline-none placeholder:text-slate-400",
              placeholder:
                "Search by course code, title, room, EDP, section...",
              value: r,
              onChange: (e) => p(e.target.value),
            }),
          ),
        ),
        React.createElement(
          "div",
          {
            className:
              "grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-5",
          },
          k.length
            ? k.map((e) =>
                React.createElement(
                  "article",
                  {
                    className: `group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-white/60 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-white/80 hover:shadow-[0_15px_35px_rgba(79,70,229,0.1)] ${e.id === l?.id ? "border-indigo-500/80 ring-2 ring-indigo-500/20" : "border-white/80"}`,
                    key: e.id,
                  },
                  React.createElement("div", {
                    className:
                      "absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent opacity-0 transition group-hover:opacity-100",
                  }),
                  React.createElement(
                    "div",
                    null,
                    React.createElement(
                      "div",
                      { className: "flex items-start justify-between gap-3" },
                      React.createElement(
                        "div",
                        null,
                        React.createElement(
                          "div",
                          { className: "flex flex-wrap items-center gap-1.5" },
                          React.createElement(
                            "span",
                            {
                              className:
                                "rounded-lg border border-indigo-200/50 bg-indigo-50/70 px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase text-indigo-600 backdrop-blur-sm",
                            },
                            e.subject_code || "No code",
                          ),
                          e.edp_code &&
                            React.createElement(
                              "span",
                              {
                                className:
                                  "rounded-lg border border-slate-200/60 bg-slate-100/60 px-2 py-1 text-[11px] font-semibold text-slate-600 backdrop-blur-sm",
                              },
                              "EDP ",
                              e.edp_code,
                            ),
                        ),
                        React.createElement(
                          "h2",
                          {
                            className:
                              "mt-2.5 text-base font-bold text-slate-800 transition group-hover:text-indigo-600",
                          },
                          e.subject_title || "Untitled class",
                        ),
                      ),
                      React.createElement(
                        "div",
                        {
                          className:
                            "flex items-center gap-1 opacity-80 group-hover:opacity-100",
                        },
                        React.createElement(
                          "button",
                          {
                            className:
                              "rounded-lg p-1.5 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600",
                            title: "Edit class",
                            "aria-label": "Edit class",
                            type: "button",
                            onClick: () => x(e),
                          },
                          React.createElement(s, { name: "edit", size: 15 }),
                        ),
                        React.createElement(
                          "button",
                          {
                            className:
                              "rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500",
                            title: "Delete class",
                            type: "button",
                            onClick: () => o(e),
                          },
                          React.createElement(s, { name: "trash", size: 15 }),
                        ),
                      ),
                    ),
                    React.createElement(
                      "div",
                      {
                        className:
                          "mb-5 mt-4 flex flex-col gap-2 text-xs font-medium text-slate-500",
                      },
                      (e.year_level || e.section_no) &&
                        React.createElement(
                          "div",
                          {
                            className:
                              "flex items-center gap-2 font-semibold text-slate-700",
                          },
                          e.year_level &&
                            React.createElement(
                              "span",
                              null,
                              e.year_level,
                              " Year",
                            ),
                          e.year_level &&
                            e.section_no &&
                            React.createElement(
                              "span",
                              { className: "text-slate-300" },
                              "•",
                            ),
                          e.section_no &&
                            React.createElement(
                              "span",
                              null,
                              "Section ",
                              e.section_no,
                            ),
                        ),
                      React.createElement(
                        "div",
                        { className: "flex items-center gap-2" },
                        React.createElement(s, { name: "calendar", size: 14 }),
                        React.createElement(
                          "span",
                          { className: "text-slate-700" },
                          e.days || "Schedule unset",
                        ),
                      ),
                      React.createElement(
                        "div",
                        { className: "flex items-center gap-2" },
                        React.createElement(s, { name: "clock", size: 14 }),
                        React.createElement(
                          "span",
                          { className: "text-slate-700" },
                          S(e.time_start),
                          " – ",
                          S(e.time_end),
                        ),
                      ),
                      e.room &&
                        React.createElement(
                          "div",
                          { className: "flex items-center gap-2" },
                          React.createElement(s, {
                            name: "location",
                            size: 14,
                          }),
                          React.createElement(
                            "span",
                            { className: "text-slate-700" },
                            "Room ",
                            e.room,
                          ),
                        ),
                    ),
                  ),
                  React.createElement(
                    "div",
                    {
                      className:
                        "grid grid-cols-3 gap-2 border-t border-slate-200/50 pt-3.5",
                    },
                    React.createElement(
                      "button",
                      {
                        className:
                          "inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/80 bg-white/50 px-3 py-2 text-xs font-semibold text-slate-700 backdrop-blur-sm transition hover:bg-white active:scale-95",
                        type: "button",
                        onClick: () => h(e.id),
                      },
                      React.createElement(s, { name: "users", size: 15 }),
                      "Students",
                    ),
                    React.createElement(
                      "button",
                      {
                        className:
                          "inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200/60 bg-indigo-50/40 px-3 py-2 text-xs font-semibold text-indigo-600 backdrop-blur-sm transition hover:bg-indigo-100/60 active:scale-95",
                        type: "button",
                        onClick: () => v(e.id),
                      },
                      React.createElement(s, { name: "settings", size: 15 }),
                      "Manage",
                    ),
                  ),
                ),
              )
            : React.createElement(
                "div",
                {
                  className:
                    "col-span-full flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300/80 bg-white/40 p-8 text-center text-xs text-slate-500 backdrop-blur-md",
                },
                React.createElement(s, { name: "file", size: 32 }),
                React.createElement(
                  "p",
                  { className: "mt-3 font-medium" },
                  r
                    ? "No class sections match your search."
                    : "Import a master list to create your first class.",
                ),
              ),
        ),
      ),
      React.createElement(
        "aside",
        {
          className:
            "rounded-3xl border border-white/80 bg-white/50 p-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] backdrop-blur-xl",
        },
        React.createElement(
          "div",
          { className: "mb-5 flex gap-3 text-slate-900" },
          React.createElement(
            "div",
            {
              className:
                "flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 backdrop-blur-sm",
            },
            React.createElement(s, { name: "arrow", size: 18 }),
          ),
          React.createElement(
            "div",
            null,
            React.createElement(
              "h2",
              { className: "font-bold text-slate-800" },
              "Import Center",
            ),
            React.createElement(
              "p",
              { className: "mt-0.5 text-xs leading-5 text-slate-500" },
              "Upload Excel or CSV files to batch update class rosters and test records.",
            ),
          ),
        ),
        React.createElement(
          "div",
          { className: "flex flex-col gap-4" },
          React.createElement(
            "div",
            {
              className:
                "rounded-2xl border border-dashed border-slate-200/80 bg-white/40 p-4 text-center backdrop-blur-sm transition hover:border-indigo-200 hover:bg-white/60",
            },
            React.createElement(
              "h3",
              { className: "text-xs font-bold text-slate-700" },
              "Master Student List",
            ),
            React.createElement(
              "p",
              { className: "mb-3.5 mt-1 text-[11px] text-slate-500" },
              "Batch create student IDs & profiles.",
            ),
            React.createElement(
              "label",
              {
                className:
                  "inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 transition hover:from-indigo-500 hover:to-indigo-600 active:scale-95",
              },
              React.createElement(s, { name: "file", size: 15 }),
              "Choose Master File",
              React.createElement("input", {
                name: "masterListFile",
                className: "hidden",
                type: "file",
                accept: ".xlsx,.xls,.csv",
                onChange: (e) => C(e, c),
              }),
            ),
          ),
          React.createElement(
            "div",
            {
              className:
                "rounded-2xl border border-dashed border-slate-200/80 bg-white/40 p-4 text-center backdrop-blur-sm transition hover:border-indigo-200 hover:bg-white/60",
            },
            React.createElement(
              "h3",
              { className: "text-xs font-bold text-slate-700" },
              "Grade Sheets",
            ),
            React.createElement(
              "p",
              { className: "mb-3.5 mt-1 text-[11px] text-slate-500" },
              "Upload computed assessment files.",
            ),
            React.createElement(
              "label",
              {
                className:
                  "inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 transition hover:from-indigo-500 hover:to-indigo-600 active:scale-95",
              },
              React.createElement(s, { name: "chart", size: 15 }),
              "Choose Grade File",
              React.createElement("input", {
                name: "gradeSheetFile",
                className: "hidden",
                type: "file",
                accept: ".xlsx,.xls,.xlsm,.csv",
                disabled: i?.status === "working",
                onChange: (e) => C(e, n),
              }),
            ),
          ),
          b?.message &&
            React.createElement(
              "p",
              {
                className:
                  "rounded-xl border border-slate-200/60 bg-slate-100/50 p-2.5 text-center text-xs text-slate-600 backdrop-blur-sm",
                role: "status",
              },
              b.message,
            ),
          i?.message &&
            React.createElement(
              "p",
              {
                className:
                  "rounded-xl border border-slate-200/60 bg-slate-100/50 p-2.5 text-center text-xs text-slate-600 backdrop-blur-sm",
                role: "status",
              },
              i.message,
            ),
        ),
      ),
    ),
  );
}
