import React, { useEffect as D, useMemo as M, useState as m } from "react";
import { Icon as F } from "../DashboardShared";
import { formatClassTime as C, getLiveClassInfo as L } from "./overviewUtils";
function x({ label: a, children: b }) {
  return React.createElement(
    "div",
    {
      className:
        "bg-slate-50/80 backdrop-blur-sm p-3 rounded-2xl border border-slate-100/80 shadow-inner",
    },
    React.createElement(
      "span",
      {
        className:
          "text-slate-400 font-medium block text-[10px] uppercase tracking-wider mb-1",
      },
      a,
    ),
    b,
  );
}
function I(a) {
  return String(a || "Teacher")
    .split(/\s+/)
    .map((b) => b[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
export default function T({
  instructor: a,
  onUpdateInstructor: b,
  sections: S,
}) {
  const [h, f] = m(!1),
    [l, v] = m(!1),
    [w, u] = m(""),
    [, P] = m(0);
  D(() => {
    const e = setInterval(() => P((i) => i + 1), 6e4);
    return () => clearInterval(e);
  }, []);
  const n = L(S),
    d = M(
      () => ({
        name: a?.name || "Teacher",
        position: a?.position || "Instructor",
        gmail: a?.gmail || "",
        facebook: a?.facebook || "",
        courses: Array.isArray(a?.courses) ? a.courses : [],
        initials: a?.initials || I(a?.name),
        color: a?.color || "bg-gradient-to-br from-indigo-500 to-violet-600",
        avatarUrl: a?.avatarUrl || "",
      }),
      [a],
    ),
    [o, p] = m(d),
    [N, y] = m(""),
    t = h ? o : d,
    j = (e) => {
      (e.preventDefault(),
        e.stopPropagation(),
        p(d),
        u(""),
        y(Array.isArray(d.courses) ? d.courses.join(", ") : d.courses || ""),
        f(!0));
    },
    g = (e) => p((i) => ({ ...i, [e.target.name]: e.target.value })),
    E = (e) => {
      y(e.target.value);
    },
    U = (e) => {
      const i = e.target.files?.[0];
      if (i) {
        const r = new FileReader();
        ((r.onload = () => {
          const s = new Image();
          ((s.onload = () => {
            const k = Math.min(1, 512 / Math.max(s.width, s.height)),
              c = document.createElement("canvas");
            ((c.width = Math.max(1, Math.round(s.width * k))),
              (c.height = Math.max(1, Math.round(s.height * k))),
              c.getContext("2d").drawImage(s, 0, 0, c.width, c.height),
              p((A) => ({ ...A, avatarUrl: c.toDataURL("image/jpeg", 0.82) })));
          }),
            (s.src = r.result));
        }),
          r.readAsDataURL(i));
      }
    },
    B = async (e) => {
      (e.preventDefault(), e.stopPropagation(), u(""));
      const i = N.split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        r = {
          ...o,
          name: o.name.trim(),
          position: o.position.trim(),
          gmail: o.gmail.trim(),
          facebook: o.facebook.trim(),
          courses: i,
          initials: I(o.name),
        };
      if (!r.name) {
        u("Full name is required.");
        return;
      }
      v(!0);
      try {
        (await b?.(r), p(r), f(!1));
      } catch (s) {
        u(s?.message || "Could not save the profile details.");
      } finally {
        v(!1);
      }
    };
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "div",
      {
        className:
          "bg-white/70 backdrop-blur-xl p-6 rounded-3xl border border-white/60 shadow-xl shadow-slate-200/50 relative",
      },
      React.createElement(
        "button",
        {
          type: "button",
          onClick: j,
          className:
            "absolute top-5 right-5 p-2.5 bg-slate-100/80 hover:bg-slate-200/80 rounded-2xl text-slate-600 transition-all border border-slate-200/50 backdrop-blur-md shadow-sm z-10",
          title: "Edit Profile Settings",
        },
        React.createElement(F, { name: "settings", size: 16 }),
      ),
      React.createElement(
        "div",
        { className: "grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch" },
        React.createElement(
          "div",
          {
            className: "md:col-span-7 flex flex-col justify-between space-y-3",
          },
          React.createElement(
            "div",
            { className: "space-y-2.5 text-xs" },
            React.createElement(
              x,
              { label: "Live Schedule" },
              n
                ? React.createElement(
                    "div",
                    { className: "space-y-1.5" },
                    React.createElement(
                      "div",
                      { className: "flex items-center gap-2 flex-wrap" },
                      React.createElement(
                        "span",
                        {
                          className:
                            "font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-lg border border-emerald-200/50",
                        },
                        n.code,
                      ),
                      n.name &&
                        React.createElement(
                          "span",
                          {
                            className:
                              "text-slate-600 font-medium text-xs truncate",
                          },
                          n.name,
                        ),
                      React.createElement(
                        "span",
                        {
                          className:
                            "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow-sm shadow-emerald-200",
                        },
                        "Ongoing",
                      ),
                    ),
                    React.createElement(
                      "div",
                      {
                        className:
                          "flex flex-wrap gap-1.5 text-[11px] text-slate-500",
                      },
                      React.createElement(
                        "span",
                        {
                          className:
                            "bg-slate-200/60 font-medium text-slate-700 px-2 py-0.5 rounded-md",
                        },
                        "Sec. ",
                        n.sec,
                      ),
                      React.createElement(
                        "span",
                        {
                          className:
                            "bg-indigo-50 font-medium text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100/50",
                        },
                        "Room: ",
                        n.room,
                      ),
                      React.createElement(
                        "span",
                        { className: "self-center" },
                        C(n.timeStart),
                        " - ",
                        C(n.timeEnd),
                      ),
                    ),
                  )
                : React.createElement(
                    "span",
                    { className: "font-semibold text-slate-400" },
                    "No class in session",
                  ),
            ),
            React.createElement(
              x,
              { label: "Gmail Account" },
              React.createElement(
                "a",
                {
                  href: `mailto:${t.gmail}`,
                  className:
                    "font-semibold text-indigo-600 hover:underline truncate block",
                },
                t.gmail || "Not set",
              ),
            ),
            React.createElement(
              x,
              { label: "Facebook Profile" },
              t.facebook
                ? React.createElement(
                    "a",
                    {
                      href: t.facebook.startsWith("http")
                        ? t.facebook
                        : `https://${t.facebook}`,
                      target: "_blank",
                      rel: "noreferrer",
                      className:
                        "font-semibold text-indigo-600 hover:underline truncate block",
                    },
                    t.facebook,
                  )
                : React.createElement(
                    "span",
                    { className: "font-semibold text-slate-400" },
                    "Not set",
                  ),
            ),
            React.createElement(
              x,
              { label: "Courses Handled" },
              React.createElement(
                "div",
                { className: "flex flex-wrap gap-1.5" },
                (t.courses || []).map((e, i) =>
                  React.createElement(
                    "span",
                    {
                      key: `${e}-${i}`,
                      className:
                        "bg-indigo-50/80 text-indigo-700 font-semibold px-2.5 py-0.5 rounded-lg text-[11px] border border-indigo-100/50",
                    },
                    e,
                  ),
                ),
              ),
            ),
          ),
        ),
        React.createElement(
          "div",
          {
            className:
              "md:col-span-5 flex flex-col items-center justify-between",
          },
          React.createElement(
            "div",
            {
              className:
                "w-full h-full min-h-[180px] max-h-[260px] bg-slate-100/80 rounded-2xl overflow-hidden border border-slate-200/60 shadow-inner flex items-center justify-center relative group",
            },
            t.avatarUrl
              ? React.createElement("img", {
                  src: t.avatarUrl,
                  alt: t.name,
                  className:
                    "w-full h-full object-cover transition-transform duration-500 group-hover:scale-105",
                })
              : React.createElement(
                  "div",
                  {
                    className: `w-full h-full ${t.color} flex items-center justify-center text-white text-5xl font-black bg-gradient-to-br from-indigo-500 to-violet-600`,
                  },
                  t.initials,
                ),
          ),
          React.createElement(
            "div",
            { className: "text-center pt-3 w-full" },
            React.createElement(
              "h2",
              { className: "text-lg font-black text-slate-900 leading-tight" },
              t.name,
            ),
            React.createElement(
              "p",
              { className: "text-xs font-bold text-indigo-600 mt-0.5" },
              t.position,
            ),
          ),
        ),
      ),
    ),
    h &&
      React.createElement(
        "div",
        {
          className:
            "fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4",
        },
        React.createElement(
          "div",
          {
            className:
              "bg-white/90 backdrop-blur-2xl rounded-3xl max-w-md w-full p-6 shadow-2xl border border-white/60 space-y-4 max-h-[90vh] overflow-y-auto",
          },
          React.createElement(
            "div",
            {
              className:
                "flex justify-between items-center border-b border-slate-100 pb-3",
            },
            React.createElement(
              "h3",
              { className: "text-base font-bold text-slate-800" },
              "Edit Profile Details",
            ),
            React.createElement(
              "button",
              {
                type: "button",
                onClick: () => f(!1),
                className:
                  "text-slate-400 hover:text-slate-600 text-sm font-bold",
              },
              "\xC3\u2014",
            ),
          ),
          React.createElement(
            "form",
            { onSubmit: B, className: "space-y-3 text-xs" },
            React.createElement(
              "div",
              null,
              React.createElement(
                "label",
                { className: "block text-slate-500 font-semibold mb-1" },
                "Upload Profile Photo",
              ),
              React.createElement("input", {
                name: "profilePhoto",
                type: "file",
                accept: "image/*",
                onChange: U,
                disabled: l,
                className:
                  "w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer disabled:opacity-50",
              }),
            ),
            React.createElement(
              "div",
              null,
              React.createElement(
                "label",
                { className: "block text-slate-500 font-semibold mb-1" },
                "Full Name",
              ),
              React.createElement("input", {
                type: "text",
                name: "name",
                value: o.name,
                onChange: g,
                required: !0,
                disabled: l,
                className:
                  "w-full p-2.5 rounded-xl border border-slate-200/80 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50",
              }),
            ),
            React.createElement(
              "div",
              null,
              React.createElement(
                "label",
                { className: "block text-slate-500 font-semibold mb-1" },
                "Position / Title",
              ),
              React.createElement("input", {
                type: "text",
                name: "position",
                value: o.position,
                onChange: g,
                disabled: l,
                className:
                  "w-full p-2.5 rounded-xl border border-slate-200/80 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50",
              }),
            ),
            React.createElement(
              "div",
              null,
              React.createElement(
                "label",
                { className: "block text-slate-500 font-semibold mb-1" },
                "Courses Handled (comma-separated)",
              ),
              React.createElement("input", {
                type: "text",
                name: "courses",
                value: N,
                onChange: E,
                placeholder: "e.g. BSIT 3A - Web Dev, BSCS 2B - OOP",
                disabled: l,
                className:
                  "w-full p-2.5 rounded-xl border border-slate-200/80 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50",
              }),
            ),
            React.createElement(
              "div",
              null,
              React.createElement(
                "label",
                { className: "block text-slate-500 font-semibold mb-1" },
                "Gmail Address",
              ),
              React.createElement("input", {
                type: "email",
                name: "gmail",
                value: o.gmail,
                onChange: g,
                disabled: l,
                className:
                  "w-full p-2.5 rounded-xl border border-slate-200/80 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50",
              }),
            ),
            React.createElement(
              "div",
              null,
              React.createElement(
                "label",
                { className: "block text-slate-500 font-semibold mb-1" },
                "Facebook URL",
              ),
              React.createElement("input", {
                type: "text",
                name: "facebook",
                value: o.facebook,
                onChange: g,
                disabled: l,
                className:
                  "w-full p-2.5 rounded-xl border border-slate-200/80 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50",
              }),
            ),
            w &&
              React.createElement(
                "p",
                {
                  className:
                    "rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600",
                },
                w,
              ),
            React.createElement(
              "div",
              {
                className:
                  "flex justify-end gap-2 pt-3 border-t border-slate-100",
              },
              React.createElement(
                "button",
                {
                  type: "button",
                  onClick: () => !l && f(!1),
                  disabled: l,
                  className:
                    "px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 disabled:opacity-50",
                },
                "Cancel",
              ),
              React.createElement(
                "button",
                {
                  type: "submit",
                  disabled: l,
                  className:
                    "px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold hover:opacity-90 shadow-md shadow-indigo-200 disabled:opacity-60",
                },
                l ? "Saving..." : "Save Changes",
              ),
            ),
          ),
        ),
      ),
  );
}
