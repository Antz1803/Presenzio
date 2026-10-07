/* eslint-disable no-unused-vars */
import { get, push, ref, runTransaction, update } from "firebase/database";
import { db } from "./Firebase";

const DEFAULT_WEIGHTS = { quiz: 20, assignment: 10, activity: 30, attendance: 5, exam: 35 };
const DEFAULT_PERIODS = ["prelim", "midterm", "semifinal", "final"].map((code, i) => ({
  code,
  sort_order: i + 1,
  weights: DEFAULT_WEIGHTS,
}));

const base = (uid) => `accounts/${uid}`;
export const sec = (sid, path = "") => `sectionData/${sid}${path ? `/${path}` : ""}`;
const nowIso = () => new Date().toISOString();

// Realtime Database has JSON nodes rather than SQL tables. This creates the
// account's empty collections only when they are genuinely missing and never
// replaces data that the teacher has already created.
export async function ensureAccountSchema(uid) {
  if (!db || !uid) return;
  const snapshot = await get(ref(db, base(uid)));
  const existing = snapshot.val() ?? {};
  const updates = {};
  ["students", "enrollments", "sections", "schoolYears", "sectionData"].forEach((node) => {
    if (!Object.prototype.hasOwnProperty.call(existing, node)) updates[node] = {};
  });
  if (!Object.prototype.hasOwnProperty.call(existing, "gradingPeriods")) {
    updates.gradingPeriods = Object.fromEntries(DEFAULT_PERIODS.map((period) => [period.code, period]));
  }
  if (!Object.prototype.hasOwnProperty.call(existing, "schemaVersion")) updates.schemaVersion = 1;
  if (Object.keys(updates).length) await update(ref(db, base(uid)), updates);
}

export const newId = () => push(ref(db)).key;
export const rows = (obj) => Object.entries(obj ?? {}).map(([id, v]) => ({ id, ...v }));
// RTDB rejects `undefined`, and null means "delete", so normalise everything.
const clean = (v) => (v && typeof v === "object" ? JSON.parse(JSON.stringify(v)) : v ?? null);

export async function read(uid, path) {
  return (await get(ref(db, `${base(uid)}/${path}`))).val();
}

// One atomic multi-path write. `updates` are relative to the account;
// `absolute` are full paths (used for the root-level accessKeys index).
export async function patch(uid, updates, absolute = {}) {
  const out = {};
  for (const [p, v] of Object.entries(updates)) out[`${base(uid)}/${p}`] = clean(v);
  for (const [p, v] of Object.entries(absolute)) out[p] = clean(v);
  await update(ref(db), out);
}

/* ---------- grading periods ---------- */

export async function ensureGradingPeriods(uid) {
  let value = await read(uid, "gradingPeriods");
  if (!value) {
    value = Object.fromEntries(DEFAULT_PERIODS.map((p) => [p.code, p]));
    await patch(uid, { gradingPeriods: value });
  }
  return rows(value).sort((a, b) => a.sort_order - b.sort_order); // id === code
}

export function saveGradingPeriods(uid, periodRows) {
  return patch(uid, Object.fromEntries(periodRows.map((r) => [`gradingPeriods/${r.code}`, r])));
}

export async function realignSessionPeriods(uid, sid, periodRows) {
  const sessions = rows(await read(uid, sec(sid, "sessions")));
  const ranged = periodRows
    .filter((r) => r.start_date && r.end_date)
    .sort((a, b) => a.sort_order - b.sort_order);
  const updates = {};
  sessions.forEach((s) => {
    const match = ranged.find((r) => s.session_date >= r.start_date && s.session_date <= r.end_date);
    if (match && match.code !== s.period_id) updates[sec(sid, `sessions/${s.id}/period_id`)] = match.code;
  });
  if (Object.keys(updates).length) await patch(uid, updates);
}

/* ---------- sections ---------- */

export async function listSections(uid) {
  const [sections, years] = await Promise.all([read(uid, "sections"), read(uid, "schoolYears")]);
  return rows(sections)
    .map((s) => ({
      ...s,
      school_year: years?.[s.school_year_id]
        ? { label: years[s.school_year_id].label, semester: years[s.school_year_id].semester }
        : null,
    }))
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
}

export function updateSection(uid, sid, changes) {
  return patch(
    uid,
    Object.fromEntries(Object.entries(changes).map(([k, v]) => [`sections/${sid}/${k}`, v])),
  );
}

export async function deleteSection(uid, sid) {
  const [all, assessments] = await Promise.all([
    read(uid, "enrollments"),
    read(uid, sec(sid, "assessments")),
  ]);
  const enrollments = all ?? {};
  const stillEnrolled = new Set(
    Object.entries(enrollments)
      .filter(([id]) => id !== sid)
      .flatMap(([, m]) => Object.values(m).map((e) => e.student_id)),
  );
  const updates = { [`sections/${sid}`]: null, [`enrollments/${sid}`]: null, [sec(sid)]: null };
  Object.values(enrollments[sid] ?? {}).forEach((e) => {
    if (!stillEnrolled.has(e.student_id)) updates[`students/${e.student_id}`] = null; // orphans
  });
  const keys = Object.fromEntries(
    Object.values(assessments ?? {})
      .filter((a) => a.access_key)
      .map((a) => [`accessKeys/${a.access_key}`, null]),
  );
  await patch(uid, updates, keys);
}

/* ---------- students & enrollments ---------- */

export async function addStudent(uid, sid, student, { enrollmentId, ctrlNo } = {}) {
  const studentId = student.id ?? newId();
  const eid = enrollmentId ?? newId();
  const existing = await read(uid, `enrollments/${sid}`);
  const next =
    ctrlNo ?? Math.max(0, ...Object.values(existing ?? {}).map((e) => Number(e.ctrl_no) || 0)) + 1;
  const fields = { ...student };
  delete fields.id;
  await patch(uid, {
    [`students/${studentId}`]: { ...fields, gender: fields.gender || null, created_at: nowIso() },
    [`enrollments/${sid}/${eid}`]: {
      student_id: studentId,
      ctrl_no: next,
      status: "active",
      enrolled_on: nowIso().slice(0, 10),
    },
  });
}

export function updateStudent(uid, { student, sectionId, enrollmentId, ctrlNo }) {
  const { id, ...fields } = student;
  const updates = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [`students/${id}/${k}`, v]),
  );
  updates[`enrollments/${sectionId}/${enrollmentId}/ctrl_no`] = ctrlNo;
  return patch(uid, updates);
}

export async function deleteEnrollment(uid, sid, eid) {
  const data = (await read(uid, sec(sid))) ?? {};
  const updates = { [`enrollments/${sid}/${eid}`]: null };
  ["scores", "periodGrades"].forEach((node) =>
    Object.entries(data[node] ?? {}).forEach(([key, r]) => {
      if (r.enrollment_id === eid) updates[sec(sid, `${node}/${key}`)] = null;
    }),
  );
  Object.keys(data.attendance ?? {}).forEach((sessionId) => {
    updates[sec(sid, `attendance/${sessionId}/${eid}`)] = null;
  });
  return patch(uid, updates);
}

export async function getTransferPreview(uid, eid, fromSid, toSid) {
  const [attendance, sessions] = await Promise.all([
    read(uid, sec(fromSid, "attendance")),
    read(uid, sec(toSid, "sessions")),
  ]);
  return {
    oldRecordCount: Object.values(attendance ?? {}).filter((m) => m?.[eid] != null).length,
    targetSessions: rows(sessions)
      .sort((a, b) => String(a.session_date).localeCompare(String(b.session_date)))
      .map((s) => ({ id: s.id, date: s.session_date, time: s.session_time })),
  };
}

export async function transferStudent(
  uid,
  { enrollmentId, studentId, fromSectionId, toSectionId, attendanceEntries = [] },
) {
  const [target, source, enrollment] = await Promise.all([
    read(uid, `enrollments/${toSectionId}`),
    read(uid, sec(fromSectionId)),
    read(uid, `enrollments/${fromSectionId}/${enrollmentId}`),
  ]);
  if (!enrollment) throw new Error("The student's enrollment was not found.");
  if (Object.values(target ?? {}).some((e) => e.student_id === studentId))
    throw new Error("This student is already enrolled in that class.");
  const ctrl = Math.max(0, ...Object.values(target ?? {}).map((e) => Number(e.ctrl_no) || 0)) + 1;

  const updates = {
    [`enrollments/${fromSectionId}/${enrollmentId}`]: null,
    [`enrollments/${toSectionId}/${enrollmentId}`]: { ...enrollment, ctrl_no: ctrl },
  };
  ["scores", "periodGrades"].forEach((node) =>
    Object.entries(source?.[node] ?? {}).forEach(([key, r]) => {
      if (r.enrollment_id !== enrollmentId) return;
      updates[sec(fromSectionId, `${node}/${key}`)] = null;
      updates[sec(toSectionId, `${node}/${key}`)] = { ...r, section_id: toSectionId };
    }),
  );
  // Old class attendance for this student is discarded, as before.
  Object.keys(source?.attendance ?? {}).forEach((sessionId) => {
    updates[sec(fromSectionId, `attendance/${sessionId}/${enrollmentId}`)] = null;
  });
  const marked = attendanceEntries.filter((e) => e.sessionId && e.status);
  marked.forEach((e) => {
    updates[sec(toSectionId, `attendance/${e.sessionId}/${enrollmentId}`)] = e.status;
  });
  await patch(uid, updates);
  return marked.length;
}

/* ---------- attendance ---------- */

export function saveAttendance(uid, sid, { sessionId, periodId, date, sessionTime, statuses }) {
  const updates = {
    [sec(sid, `sessions/${sessionId}`)]: {
      period_id: periodId,
      session_date: date,
      session_time: sessionTime,
    },
  };
  Object.entries(statuses).forEach(([eid, status]) => {
    updates[sec(sid, `attendance/${sessionId}/${eid}`)] = status;
  });
  return patch(uid, updates);
}

export async function deleteSession(uid, sid, sessionId) {
  const session = await read(uid, sec(sid, `sessions/${sessionId}`));
  if (!session) return null;
  await patch(uid, {
    [sec(sid, `sessions/${sessionId}`)]: null,
    [sec(sid, `attendance/${sessionId}`)]: null,
  });
  return { id: sessionId, ...session };
}

// Sessions in the shape the old `class_sessions(attendance_records(...))` join returned.
export function buildSessions(data) {
  const attendance = data?.attendance ?? {};
  return rows(data?.sessions).map((s) => ({
    ...s,
    attendance_records: Object.entries(attendance[s.id] ?? {}).map(([enrollment_id, status]) => ({
      enrollment_id,
      status,
    })),
  }));
}

/* ---------- scores & grades ---------- */

const scoreKey = (r) => `${r.period_id}:${r.enrollment_id}:${r.category}:${r.item_no}`;
const scoreUpdates = (sid, list) =>
  Object.fromEntries(
    list.map((r) => [sec(sid, `scores/${scoreKey(r)}`), { ...r, recorded_at: nowIso() }]),
  );

async function itemScores(uid, sid, periodId, category, itemNo) {
  const all = await read(uid, sec(sid, "scores"));
  return Object.entries(all ?? {}).filter(
    ([, r]) =>
      r.period_id === periodId && r.category === category && Number(r.item_no) === Number(itemNo),
  );
}

export async function replaceCategoryScores(uid, sid, periodId, category, list) {
  const existing = await read(uid, sec(sid, "scores"));
  const updates = {};
  Object.entries(existing ?? {}).forEach(([key, r]) => {
    if (r.period_id === periodId && r.category === category) updates[sec(sid, `scores/${key}`)] = null;
  });
  Object.assign(updates, scoreUpdates(sid, list));
  return patch(uid, updates);
}

export function upsertPeriodGrades(uid, sid, list) {
  return patch(
    uid,
    Object.fromEntries(
      list.map((r) => [sec(sid, `periodGrades/${r.period_id}:${r.enrollment_id}`), r]),
    ),
  );
}

// Atomic replacement: readers never see a half-written gradebook.
export function replacePeriodGrades(uid, sid, list) {
  return patch(uid, {
    [sec(sid, "periodGrades")]: Object.fromEntries(
      list.map((r) => [`${r.period_id}:${r.enrollment_id}`, r]),
    ),
  });
}

export async function getGradingInputs(uid, sid) {
  const [data, periods] = await Promise.all([read(uid, sec(sid)), ensureGradingPeriods(uid)]);
  return {
    assessmentRows: Object.values(data?.scores ?? {}),
    sessionRows: buildSessions(data),
    periods,
  };
}

/* ---------- groups ---------- */

export async function saveStudentGroup(uid, sid, g) {
  const id = g.id ?? newId();
  const created_at = g.createdAt ?? nowIso();
  await patch(uid, {
    [sec(sid, `groups/${id}`)]: {
      label: g.label,
      group_count: g.groupCount,
      assignments: g.assignments,
      category: g.category ?? null,
      period_code: g.period ?? null,
      item_no: g.itemNo ?? null,
      max_score: g.maxScore ?? null,
      created_at,
    },
  });
  return {
    id,
    label: g.label,
    groupCount: g.groupCount,
    assignments: g.assignments ?? {},
    category: g.category ?? null,
    period: g.period ?? null,
    itemNo: g.itemNo ?? null,
    maxScore: g.maxScore ?? null,
    createdAt: created_at,
  };
}

export async function deleteStudentGroup(uid, sid, groupId, clear) {
  const updates = { [sec(sid, `groups/${groupId}`)]: null };
  if (clear) {
    (await itemScores(uid, sid, clear.periodId, clear.category, clear.itemNo)).forEach(([key]) => {
      updates[sec(sid, `scores/${key}`)] = null;
    });
  }
  return patch(uid, updates);
}

export async function updateStudentGroup(uid, sid, groupId, changes) {
  const values = typeof changes === "string" ? { label: changes } : changes ?? {};
  const existingGroup = await read(uid, sec(sid, `groups/${groupId}`));
  const updates = {};
  if (values.label !== undefined) updates[sec(sid, `groups/${groupId}/label`)] = values.label;
  if (values.assignments !== undefined) updates[sec(sid, `groups/${groupId}/assignments`)] = values.assignments;
  if (values.groupCount !== undefined) updates[sec(sid, `groups/${groupId}/group_count`)] = values.groupCount;
  if (values.category !== undefined) updates[sec(sid, `groups/${groupId}/category`)] = values.category;
  if (values.period !== undefined) updates[sec(sid, `groups/${groupId}/period_code`)] = values.period;
  if (values.itemNo !== undefined) updates[sec(sid, `groups/${groupId}/item_no`)] = values.itemNo;
  if (values.maxScore !== undefined) updates[sec(sid, `groups/${groupId}/max_score`)] = values.maxScore;
  const oldSlot = {
    period: existingGroup?.period_code,
    category: existingGroup?.category,
    itemNo: existingGroup?.item_no,
  };
  const nextSlot = {
    period: values.period ?? oldSlot.period,
    category: values.category ?? oldSlot.category,
    itemNo: values.itemNo ?? oldSlot.itemNo,
  };
  const hasCompleteSlot = (slot) =>
    slot.period && slot.category && slot.itemNo !== null && slot.itemNo !== undefined;
  const slotChanged =
    hasCompleteSlot(oldSlot) &&
    hasCompleteSlot(nextSlot) &&
    (oldSlot.period !== nextSlot.period ||
      oldSlot.category !== nextSlot.category ||
      Number(oldSlot.itemNo) !== Number(nextSlot.itemNo));
  const shouldUpdateMax = values.maxScore !== undefined;
  if (hasCompleteSlot(nextSlot) && (slotChanged || shouldUpdateMax)) {
    const scores = await read(uid, sec(sid, "scores"));
    Object.entries(scores ?? {})
      .filter(([, row]) => {
        return (
          row.source !== "grade-sheet-import" &&
          row.period_id === oldSlot.period &&
          row.category === oldSlot.category &&
          Number(row.item_no) === Number(oldSlot.itemNo)
        );
      })
      .forEach(([key, row]) => {
        const movedRow = {
          ...row,
          period_id: nextSlot.period,
          category: nextSlot.category,
          item_no: Number(nextSlot.itemNo),
          ...(shouldUpdateMax ? { max_score: values.maxScore } : {}),
        };
        updates[sec(sid, `scores/${key}`)] = null;
        updates[sec(sid, `scores/${scoreKey(movedRow)}`)] = movedRow;
      });
  }
  return patch(uid, updates);
}

/* ---------- assessments ---------- */

const questionMap = (list) =>
  Object.fromEntries(
    list.map((q) => {
      const { id, assessment_id, ...rest } = q;
      return [id ?? newId(), rest];
    }),
  );

export async function createAssessment(uid, { assessment, questions, scoreRows = [] }) {
  const sid = assessment.section_id;
  const { id: given, ...fields } = assessment;
  const aid = given ?? newId();
  await patch(
    uid,
    {
      [sec(sid, `assessments/${aid}`)]: { ...fields, created_at: nowIso() },
      [sec(sid, `questions/${aid}`)]: questionMap(questions),
      ...scoreUpdates(sid, scoreRows),
    },
    { [`accessKeys/${fields.access_key}`]: { uid, section_id: sid, assessment_id: aid } },
  );
  return { id: aid, access_key: fields.access_key };
}

export async function updateAssessment(uid, sid, aid, { assessment, questions, maxScore, itemNo }) {
  const existing = await read(uid, sec(sid, `assessments/${aid}`));
  if (!existing) throw new Error("The assessment no longer exists.");
  const { id, section_id, access_key, ...changes } = assessment;
  const updates = Object.fromEntries(
    Object.entries(changes).map(([k, v]) => [sec(sid, `assessments/${aid}/${k}`), v]),
  );
  updates[sec(sid, `questions/${aid}`)] = questionMap(questions); // replaces the whole set
  if (itemNo) {
    const slot = await itemScores(
      uid,
      sid,
      changes.period_id ?? existing.period_id,
      changes.category ?? existing.category,
      itemNo,
    );
    slot.forEach(([key]) => {
      updates[sec(sid, `scores/${key}/max_score`)] = maxScore;
    });
  }
  await patch(uid, updates);
  return { id: aid, access_key: existing.access_key };
}

// Removes the assessment, its questions/attempts/grants/violations, and the
// Record Score column it owned.
export async function deleteAssessment(uid, sid, aid) {
  const a = await read(uid, sec(sid, `assessments/${aid}`));
  const updates = {};
  ["assessments", "questions", "attempts", "grants", "violations"].forEach((node) => {
    updates[sec(sid, `${node}/${aid}`)] = null;
  });
  if (a?.item_no) {
    (await itemScores(uid, sid, a.period_id, a.category, a.item_no)).forEach(([key]) => {
      updates[sec(sid, `scores/${key}`)] = null;
    });
  }
  await patch(uid, updates, a?.access_key ? { [`accessKeys/${a.access_key}`]: null } : {});
  return a ? { id: aid, ...a } : null;
}

export async function getAssessmentSlots(uid, sid, periodId, category) {
  const data = (await read(uid, sec(sid))) ?? {};
  return {
    assessments: rows(data.assessments).filter(
      (a) => a.period_id === periodId && a.category === category,
    ),
    scoreItemNos: Object.values(data.scores ?? {})
      .filter((r) => r.period_id === periodId && r.category === category)
      .map((r) => Number(r.item_no)),
  };
}

// Transaction, so two simultaneous grants can't overwrite each other.
export async function grantAttempt(uid, sid, aid, studentId) {
  const target = ref(db, `${base(uid)}/${sec(sid, `grants/${aid}/${studentId}`)}`);
  const result = await runTransaction(target, (current) => ({
    extra_attempts: Number(current?.extra_attempts || 0) + 1,
    granted_at: nowIso(),
  }));
  return { id: `${aid}:${studentId}`, assessment_id: aid, student_id: studentId, ...result.snapshot.val() };
}

export async function saveAssessmentAttempt(uid, sid, {
  assessmentId,
  studentId,
  attemptNumber,
  status,
  score,
  maxScore,
  submittedAt,
  answers = [],
  violations = [],
  scoreRow,
}) {
  const attempts = await read(uid, sec(sid, `attempts/${assessmentId}`));
  const existing = Object.entries(attempts ?? {}).find(
    ([, attempt]) =>
      String(attempt.student_id) === String(studentId) &&
      Number(attempt.attempt_no) === Number(attemptNumber),
  );
  const attemptId = existing?.[0] ?? newId();
  const answerMap = Object.fromEntries(
    answers.map(({ question_id, ...answer }) => [question_id, answer]),
  );
  const updates = {
    [sec(sid, `attempts/${assessmentId}/${attemptId}`)]: {
      id: attemptId,
      assessment_id: assessmentId,
      student_id: studentId,
      attempt_no: Number(attemptNumber) || 1,
      status,
      score,
      max_score: maxScore,
      submitted_at: submittedAt,
      answers: answerMap,
    },
  };
  violations.forEach((violation) => {
    const violationId = violation.id ?? newId();
    const { id, ...fields } = violation;
    updates[sec(sid, `violations/${assessmentId}/${violationId}`)] = {
      ...fields,
      assessment_id: assessmentId,
      student_id: studentId,
      attempt_no: Number(attemptNumber) || 1,
    };
  });
  if (scoreRow) {
    updates[sec(sid, `scores/${scoreKey(scoreRow)}`)] = {
      ...scoreRow,
      recorded_at: nowIso(),
    };
  }
  await patch(uid, updates);
  return { id: attemptId, assessment_id: assessmentId, student_id: studentId };
}
