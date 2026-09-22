const I = "presenzio-offline",
  g = 1,
  m = "snapshots",
  f = "mutations";
let w;
function l() {
  return (
    w ||
    (typeof indexedDB > "u"
      ? Promise.resolve(null)
      : ((w = new Promise((t, n) => {
          const o = indexedDB.open(I, 1);
          ((o.onupgradeneeded = () => {
            const c = o.result;
            (c.objectStoreNames.contains(m) ||
              c.createObjectStore(m, { keyPath: "key" }),
              c.objectStoreNames.contains(f) ||
                c
                  .createObjectStore(f, { keyPath: "id" })
                  .createIndex("created_at", "createdAt"));
          }),
            (o.onsuccess = () => t(o.result)),
            (o.onerror = () => n(o.error)));
        }).catch(() => null)),
        w))
  );
}
function _(t) {
  return new Promise((n, o) => {
    ((t.onsuccess = () => n(t.result)), (t.onerror = () => o(t.error)));
  });
}
function u(t) {
  return new Promise((n, o) => {
    ((t.oncomplete = () => n()),
      (t.onerror = () => o(t.error)),
      (t.onabort = () => o(t.error)));
  });
}
export async function writeOfflineSnapshot(t, n) {
  const o = await l();
  if (!o) return;
  const c = o.transaction(m, "readwrite");
  (c.objectStore(m).put({ key: t, value: n, savedAt: Date.now() }), await u(c));
}
export async function readOfflineSnapshot(t) {
  const n = await l();
  if (!n) return null;
  const o = n.transaction(m, "readonly");
  return (await _(o.objectStore(m).get(t)))?.value ?? null;
}
export async function enqueueOfflineMutation(t, n) {
  const o = await l();
  if (!o) throw new Error("This browser does not support offline storage.");
  const i = {
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      type: t,
      payload: n,
      createdAt: Date.now(),
    },
    e = o.transaction(f, "readwrite");
  return (e.objectStore(f).put(i), await u(e), i);
}
export async function listOfflineMutations() {
  const t = await l();
  if (!t) return [];
  const n = t.transaction(f, "readonly");
  return (await _(n.objectStore(f).getAll())).sort(
    (c, i) => c.createdAt - i.createdAt,
  );
}
export async function removeOfflineMutation(t) {
  const n = await l();
  if (!n) return;
  const o = n.transaction(f, "readwrite");
  (o.objectStore(f).delete(t), await u(o));
}
export async function countOfflineMutations() {
  const t = await l();
  if (!t) return 0;
  const n = t.transaction(f, "readonly");
  return _(n.objectStore(f).count());
}
async function p(t, n) {
  const { data: o, error: c } = await t
    .from("grading_periods")
    .select("id")
    .eq("code", n)
    .single();
  if (c) throw c;
  return o.id;
}
export async function replayOfflineMutation({
  supabase: t,
  mutation: n,
  importMasterList: o,
  importGradeSheet: c,
}) {
  const { type: i, payload: e } = n;
  if (i === "import-master-list") return o(e.file);
  if (i === "import-grade-sheet") return c(e.file);
  if (i === "save-grading-periods") {
    const { error: r } = await t
      .from("grading_periods")
      .upsert(e.rows, { onConflict: "code" });
    if (r) throw r;
    return;
  }
  if (i === "save-attendance") {
    const r = await p(t, e.periodCode),
      { error: s } = await t
        .from("class_sessions")
        .upsert(
          {
            id: e.sessionId,
            section_id: e.sectionId,
            period_id: r,
            session_date: e.date,
            session_time: e.sessionTime,
          },
          { onConflict: "id" },
        );
    if (s) throw s;
    const a = Object.entries(e.statuses).map(([d, h]) => ({
      session_id: e.sessionId,
      enrollment_id: d,
      status: h,
    }));
    if (a.length) {
      const { error: d } = await t
        .from("attendance_records")
        .upsert(a, { onConflict: "session_id,enrollment_id" });
      if (d) throw d;
    }
    return { sectionId: e.sectionId, periodId: r };
  }
  if (i === "save-grades") {
    const r = await p(t, e.periodCode),
      s = e.rows.map((a) => ({ ...a, period_id: r }));
    if (s.length) {
      const { error: a } = await t
        .from("period_grades")
        .upsert(s, { onConflict: "section_id,period_id,enrollment_id" });
      if (a) throw a;
    }
    return { sectionId: e.sectionId, periodId: r };
  }
  if (i === "save-assessment-scores") {
    const r = await p(t, e.periodCode),
      { error: s } = await t
        .from("assessment_scores")
        .delete()
        .eq("section_id", e.sectionId)
        .eq("period_id", r)
        .eq("category", e.category);
    if (s) throw s;
    const a = e.rows.map((d) => ({ ...d, period_id: r }));
    if (a.length) {
      const { error: d } = await t
        .from("assessment_scores")
        .upsert(a, {
          onConflict: "section_id,period_id,enrollment_id,category,item_no",
        });
      if (d) throw d;
    }
    return { sectionId: e.sectionId, periodId: r };
  }
  if (i === "add-student") {
    const { error: r } = await t
      .from("students")
      .upsert(e.student, { onConflict: "id" });
    if (r) throw r;
    const { error: s } = await t
      .from("enrollments")
      .upsert(e.enrollment, { onConflict: "id" });
    if (s) throw s;
    return { sectionId: e.enrollment.section_id };
  }
  if (i === "update-student") {
    const { error: r } = await t
      .from("students")
      .update(e.student)
      .eq("id", e.student.id);
    if (r) throw r;
    const { error: s } = await t
      .from("enrollments")
      .update(e.enrollment)
      .eq("id", e.enrollment.id)
      .eq("section_id", e.enrollment.section_id);
    if (s) throw s;
    return { sectionId: e.enrollment.section_id };
  }
  if (i === "update-section") {
    const { error: r } = await t
      .from("sections")
      .update(e.changes)
      .eq("id", e.sectionId);
    if (r) throw r;
    return { sectionId: e.sectionId };
  }
  if (i === "save-assessment") {
    const { error: r } = await t
      .from("assessments")
      .upsert(e.assessment, { onConflict: "id" });
    if (r) throw r;
    const { error: s } = await t
      .from("assessment_questions")
      .upsert(e.questions, { onConflict: "assessment_id,question_no" });
    if (s) throw s;
    if (e.scoreRows.length) {
      const { error: a } = await t
        .from("assessment_scores")
        .upsert(e.scoreRows, {
          onConflict: "section_id,period_id,enrollment_id,category,item_no",
        });
      if (a) throw a;
    }
    return {
      sectionId: e.assessment.section_id,
      periodId: e.assessment.period_id,
    };
  }
  if (i === "update-assessment") {
    const { error: r } = await t
      .from("assessments")
      .update(e.assessment)
      .eq("id", e.assessmentId)
      .eq("section_id", e.assessment.section_id);
    if (r) throw r;
    const { error: s } = await t
      .from("assessment_questions")
      .delete()
      .eq("assessment_id", e.assessmentId);
    if (s) throw s;
    const { error: a } = await t
      .from("assessment_questions")
      .upsert(e.questions, { onConflict: "assessment_id,question_no" });
    if (a) throw a;
    if (e.itemNo) {
      const { error: d } = await t
        .from("assessment_scores")
        .update({ max_score: e.maxScore })
        .eq("section_id", e.assessment.section_id)
        .eq("period_id", e.assessment.period_id)
        .eq("category", e.assessment.category)
        .eq("item_no", Number(e.itemNo));
      if (d) throw d;
    }
    return {
      sectionId: e.assessment.section_id,
      periodId: e.assessment.period_id,
    };
  }
  if (i === "delete-assessment") {
    const { error: r } = await t
      .from("assessments")
      .delete()
      .eq("id", e.assessmentId)
      .eq("section_id", e.sectionId);
    if (r) throw r;
    return { sectionId: e.sectionId };
  }
  if (i === "submit-assessment") {
    const { error: r } = await t
      .from("assessment_attempts")
      .upsert(e.attempt, { onConflict: "assessment_id,student_id,attempt_no" });
    if (r) throw r;
    const { error: s } = await t
      .from("assessment_answers")
      .delete()
      .eq("attempt_id", e.attempt.id);
    if (s) throw s;
    if (e.answers.length) {
      const { error: d } = await t
        .from("assessment_answers")
        .upsert(e.answers, { onConflict: "attempt_id,question_id" });
      if (d) throw d;
    }
    if (e.violations?.length) {
      const { error: d } = await t
        .from("assessment_violations")
        .insert(e.violations);
      if (d) throw d;
    }
    const { error: a } = await t
      .from("assessment_scores")
      .upsert(e.score, {
        onConflict: "section_id,period_id,enrollment_id,category,item_no",
      });
    if (a) throw a;
    return { sectionId: e.score.section_id, periodId: e.score.period_id };
  }
  if (i === "grant-assessment-attempt") {
    const { data: r, error: s } = await t
      .from("assessment_attempt_grants")
      .select("id, extra_attempts")
      .eq("assessment_id", e.assessmentId)
      .eq("student_id", e.studentId)
      .maybeSingle();
    if (s) throw s;
    const { error: a } = await t
      .from("assessment_attempt_grants")
      .upsert(
        {
          id: r?.id,
          assessment_id: e.assessmentId,
          student_id: e.studentId,
          extra_attempts: Number(r?.extra_attempts || 0) + 1,
        },
        { onConflict: "assessment_id,student_id" },
      );
    if (a) throw a;
    return { sectionId: e.sectionId };
  }
  if (i === "delete-section") {
    const { error: r } = await t
      .from("sections")
      .delete()
      .eq("id", e.sectionId);
    if (r) throw r;
    return { sectionId: e.sectionId };
  }
  throw new Error(`Unknown offline change: ${i}`);
}
