import * as j from "xlsx";
import { mergeDuplicateStudentRecords as q } from "./Studentdedup";
function b(o, t) {
  return String(o?.[t] ?? "").trim();
}
function x(o) {
  return o.findIndex(
    (t) =>
      b(t, 0).toLowerCase() === "item" &&
      b(t, 1).toLowerCase() === "student id",
  );
}
function y(o, t) {
  const s = o.find((i) => b(i, 0).toLowerCase() === t.toLowerCase());
  return s ? b(s, 2) : "";
}
function v(o) {
  const s = (
    o
      .flat()
      .map((i) => String(i ?? "").trim())
      .find((i) =>
        i.toLowerCase().startsWith("class list for the academic year:"),
      ) ?? ""
  ).match(/academic year:\s*([^,]+),\s*semester:\s*(.+)$/i);
  return {
    label: s?.[1]?.trim() || "Unknown",
    semester: s?.[2]?.trim() || "Unknown",
  };
}
function P(o) {
  const t = o.match(
    /^(.+?)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*(AM|PM)$/i,
  );
  if (!t) return { days: o || null, time_start: null, time_end: null };
  const s = (i) => {
    const [a, n] = i.split(":").map(Number),
      l =
        t[4].toUpperCase() === "PM"
          ? a === 12
            ? 12
            : a + 12
          : a === 12
            ? 0
            : a;
    return `${String(l).padStart(2, "0")}:${String(n).padStart(2, "0")}:00`;
  };
  return { days: t[1].trim(), time_start: s(t[2]), time_end: s(t[3]) };
}
async function $({ rows: o, sheetName: t, supabase: s, userId: i }) {
  const a = v(o),
    n = y(o, "EDP Code") || t.split(",")[0].trim(),
    c = y(o, "Subject Code") || "Imported class",
    l = y(o, "Subject Name") || c,
    w = P(y(o, "Schedule")),
    C = y(o, "Room No.") || null,
    N = t.includes(",") ? t.split(",").slice(1).join(",").trim() : null,
    { data: E, error: _ } = await s
      .from("school_years")
      .select("id")
      .eq("label", a.label)
      .eq("semester", a.semester)
      .maybeSingle();
  if (_) throw _;
  let u = E?.id;
  if (!u) {
    const { data: r, error: h } = await s
      .from("school_years")
      .insert({ label: a.label, semester: a.semester })
      .select("id")
      .single();
    if (h) throw h;
    u = r.id;
  }
  let m = s.from("sections").select("id").eq("school_year_id", u);
  (i && (m = m.eq("teacher_id", i)),
    (m = n
      ? m.eq("edp_code", n)
      : m.eq("subject_code", c).eq("section_no", N)));
  const { data: p, error: S } = await m.limit(1).maybeSingle();
  if (S) throw S;
  const L = {
    school_year_id: u,
    teacher_id: i || null,
    subject_code: c,
    subject_title: l,
    edp_code: n || null,
    section_no: N,
    room: C,
    days: w.days,
    time_start: w.time_start,
    time_end: w.time_end,
  };
  if (p) {
    const { error: r } = await s.from("sections").update(L).eq("id", p.id);
    if (r) throw r;
    return { id: p.id, subjectCode: c, edpCode: n };
  }
  const { data: d, error: e } = await s
    .from("sections")
    .insert(L)
    .select("id")
    .single();
  if (e) throw e;
  return { id: d.id, subjectCode: c, edpCode: n };
}
function A({ workbook: o, sheetName: t }) {
  const s = j.utils.sheet_to_json(o.Sheets[t], { header: 1, defval: "" }),
    i = x(s);
  if (i < 0)
    throw new Error(
      "The selected worksheet does not have the expected master-list headers.",
    );
  const a = s
    .slice(i + 1)
    .map((n) => ({
      student_no: String(n[1]).trim(),
      full_name: String(n[2]).trim(),
      gender:
        String(n[3]).trim().toLowerCase() === "female"
          ? "F"
          : String(n[3]).trim().toLowerCase() === "male"
            ? "M"
            : null,
      course: String(n[4]).trim() || null,
      year_level: String(n[5]).trim() || null,
      contact_no: String(n[6]).trim() || null,
      email: String(n[7]).trim() || null,
      ctrl_no: Number(n[0]) || null,
    }))
    .filter((n) => n.student_no && n.full_name);
  if (!a.length)
    throw new Error("No student records were found in the worksheet.");
  return { rows: s, sheetName: t, records: a };
}
export async function importMasterListFile({
  file: o,
  supabase: t,
  userId: s,
}) {
  if (!s)
    throw new Error(
      "Your account session is not ready. Please sign in again before importing.",
    );
  const i = j.read(await o.arrayBuffer(), { type: "array" });
  if (i.Sheets.Settings)
    throw new Error(
      "This is a grade sheet. Use Import grade sheet for this file.",
    );
  const a = i.SheetNames.filter((e) => {
    const r = j.utils.sheet_to_json(i.Sheets[e], { header: 1, defval: "" });
    return x(r) >= 0;
  });
  if (!a.length)
    throw new Error(
      "No worksheet with Item and Student ID master-list headers was found.",
    );
  const n = a.map((e) => A({ workbook: i, sheetName: e })),
    c = [];
  for (const e of n)
    try {
      const r = await $({
        rows: e.rows,
        sheetName: e.sheetName,
        supabase: t,
        userId: s,
      });
      c.push({ ...e, section: r });
    } catch (r) {
      throw new Error(
        `${e.sheetName}: ${r.message ?? "section import failed."}`,
        { cause: r },
      );
    }
  const l = new Map();
  c.forEach((e) =>
    e.records.forEach((r) => {
      l.set(r.student_no, r);
    }),
  );
  const { data: w, error: C } = await t
    .from("students")
    .select("id, student_no")
    .in("student_no", [...l.keys()]);
  if (C) throw C;
  const N = new Map((w ?? []).map((e) => [e.student_no, e])),
    E = (e) => ({
      student_no: e.student_no,
      full_name: e.full_name,
      gender: e.gender,
      course: e.course === "N/A" ? null : e.course,
      year_level: e.year_level === "N/A" ? null : e.year_level,
      contact_no: e.contact_no === "N/A" ? null : e.contact_no,
      email: e.email === "N/A" ? null : e.email,
    }),
    _ = [],
    u = [];
  if (
    (l.forEach((e, r) => {
      const h = N.get(r);
      h ? _.push({ id: h.id, ...E(e) }) : u.push(E(e));
    }),
    _.length)
  ) {
    const { error: e } = await t
      .from("students")
      .upsert(_, { onConflict: "id" });
    if (e) throw e;
  }
  if (u.length) {
    const { error: e } = await t.from("students").insert(u);
    if (e) throw e;
  }
  const m = await q(t),
    { data: p, error: S } = await t
      .from("students")
      .select("id, student_no")
      .in("student_no", [...l.keys()]);
  if (S) throw S;
  const L = new Map((p ?? []).map((e) => [e.student_no, e])),
    d = [];
  for (const e of c) {
    const { data: r, error: h } = await t
      .from("enrollments")
      .select("student_id")
      .eq("section_id", e.section.id);
    if (h) throw h;
    const M = new Set((r ?? []).map((f) => f.student_id)),
      k = [],
      I = new Set();
    if (
      (e.records.forEach((f) => {
        const g = L.get(f.student_no);
        !g ||
          M.has(g.id) ||
          I.has(g.id) ||
          (I.add(g.id),
          k.push({
            section_id: e.section.id,
            student_id: g.id,
            ctrl_no: f.ctrl_no,
            status: "active",
          }));
      }),
      k.length)
    ) {
      const { error: f } = await t.from("enrollments").insert(k);
      if (f) throw f;
    }
    d.push({
      count: e.records.length,
      sheetName: e.sheetName,
      sectionId: e.section.id,
      subjectCode: e.section.subjectCode,
      edpCode: e.section.edpCode,
      enrollmentCount: k.length,
    });
  }
  return {
    count: d.reduce((e, r) => e + r.count, 0),
    sheetName: `${d.length} worksheets`,
    worksheetCount: d.length,
    sectionId: d[0]?.sectionId ?? null,
    sectionIds: d.map((e) => e.sectionId),
    subjectCode: "all classes",
    edpCode: d.map((e) => e.edpCode).filter(Boolean),
    results: d,
    dedupSummary: m,
  };
}
