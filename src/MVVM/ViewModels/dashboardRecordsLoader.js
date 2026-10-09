import {
  buildSessions,
  ensureGradingPeriods,
  publishPublicAssessment,
  read,
  readPublicSubmissions,
  rows,
} from "../../lib/accountDb";

const byCreatedDesc = (a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));

export async function loadDashboardRecords({ uid, sectionData, sectionList }) {
  const sid = sectionData.id;
  const [studentsMap, allEnrollments, periods, data] = await Promise.all([
    read(uid, "students"),
    read(uid, "enrollments"),
    ensureGradingPeriods(uid),
    read(uid, `sectionData/${sid}`),
  ]);
  const sd = data ?? {};
  const studentById = (id) => (studentsMap?.[id] ? { id, ...studentsMap[id] } : null);

  const enrollments = Object.entries(allEnrollments?.[sid] ?? {})
    .map(([id, e]) => ({
      id,
      ctrl_no: e.ctrl_no,
      status: e.status ?? "active",
      student: studentById(e.student_id),
    }))
    .sort((a, b) => (a.ctrl_no ?? 1e9) - (b.ctrl_no ?? 1e9));

  const studentNamesBySection = Object.fromEntries(
    (sectionList ?? []).map((section) => [
      section.id,
      Object.values(allEnrollments?.[section.id] ?? {})
        .map((enrollment) => studentById(enrollment.student_id)?.full_name)
        .filter(Boolean),
    ]),
  );

  // Whole-account student count for the "Total students" card.
  const unique = new Map();
  (sectionList ?? []).forEach((s) =>
    Object.values(allEnrollments?.[s.id] ?? {}).forEach((e) => {
      const st = studentById(e.student_id);
      if (st) unique.set(st.id, { id: st.id, gender: st.gender });
    }),
  );
  const allStudentsData = [...unique.values()];

  const periodGrades = Object.values(sd.periodGrades ?? {}).map((g) => ({
    ...g,
    period: { code: g.period_id },
  }));
  const combinedAssessmentScoreData = Object.values(sd.scores ?? {}).map((r) => ({
    ...r,
    period: { code: r.period_id },
  }));

  const liveStudentGroups = rows(sd.groups)
    .sort(byCreatedDesc)
    .map((g) => ({
      id: g.id,
      label: g.label,
      groupCount: g.group_count,
      assignments: g.assignments ?? {},
      category: g.category ?? null,
      period: g.period_code ?? null,
      itemNo: g.item_no ?? null,
      maxScore: g.max_score ?? null,
      createdAt: g.created_at,
    }));

  const assessmentRows = rows(sd.assessments)
    .sort(byCreatedDesc)
    .map((a) => ({
      ...a,
      section_id: sid,
      period: { code: a.period_id },
      section: { id: sid, subject_code: sectionData.subject_code, subject_title: sectionData.subject_title },
      questions: rows(sd.questions?.[a.id])
        .map((q) => ({ ...q, assessment_id: a.id, choices: q.choices ?? [] })) // RTDB drops empty arrays
        .sort((x, y) => Number(x.question_no) - Number(y.question_no)),
    }));

  // Keep the public student portal in sync for assessments that existed before
  // the public access flow was added.
  void Promise.all(
    assessmentRows.map((assessment) =>
      publishPublicAssessment(uid, sid, assessment.id).catch((error) =>
        console.warn("[public assessment sync] failed:", error),
      ),
    ),
  );
  const publicSubmissionMaps = await Promise.all(
    assessmentRows.map((assessment) =>
      assessment.access_key
        ? readPublicSubmissions(assessment.access_key).catch(() => ({}))
        : {},
    ),
  );

  const attemptRows = [];
  const grantRows = [];
  const violationRows = [];
  assessmentRows.forEach((a, assessmentIndex) => {
    rows(sd.attempts?.[a.id]).forEach((attempt) => {
      const { answers, ...rest } = attempt;
      attemptRows.push({
        ...rest,
        assessment_id: a.id,
        answers: Object.entries(answers ?? {}).map(([question_id, ans]) => ({
          id: `${attempt.id}:${question_id}`,
          attempt_id: attempt.id,
          question_id,
          ...ans,
        })),
      });
    });
    Object.entries(sd.grants?.[a.id] ?? {}).forEach(([student_id, g]) =>
      grantRows.push({ id: `${a.id}:${student_id}`, assessment_id: a.id, student_id, ...g }),
    );
    rows(sd.violations?.[a.id]).forEach((v) => violationRows.push({ ...v, assessment_id: a.id }));
    Object.entries(publicSubmissionMaps[assessmentIndex] ?? {}).forEach(
      ([studentId, submission]) => {
        const { answers, ...rest } = submission ?? {};
        const answerRows = Array.isArray(answers)
          ? answers
          : Object.entries(answers ?? {}).map(([question_id, answer]) => ({
              question_id,
              ...answer,
            }));
        attemptRows.push({
          ...rest,
          id: rest.id ?? `public:${a.id}:${studentId}`,
          assessment_id: a.id,
          student_id: rest.student_id ?? studentId,
          answers: answerRows.map((answer) => ({
            id: `${rest.id ?? `public:${a.id}:${studentId}`}:${answer.question_id}`,
            attempt_id: rest.id ?? `public:${a.id}:${studentId}`,
            ...answer,
          })),
        });
      },
    );
  });
  violationRows.sort((x, y) => String(y.occurred_at).localeCompare(String(x.occurred_at)));

  // Latest submitted attempt fills in a missing Record Score (never overwrites one).
  const latest = new Map();
  for (const attempt of attemptRows) {
    if (attempt.status === "in_progress") continue;
    const key = `${attempt.assessment_id}:${attempt.student_id}`;
    const current = latest.get(key);
    const n = Number(attempt.attempt_no) || 0;
    const cn = Number(current?.attempt_no) || 0;
    const t = new Date(attempt.submitted_at || 0).getTime();
    const ct = new Date(current?.submitted_at || 0).getTime();
    if (!current || n > cn || (n === cn && t > ct)) latest.set(key, attempt);
  }
  for (const attempt of latest.values()) {
    const assessment = assessmentRows.find((a) => String(a.id) === String(attempt.assessment_id));
    const enrollment = enrollments.find((e) => String(e.student?.id) === String(attempt.student_id));
    if (!assessment || !enrollment || !assessment.item_no) continue;
    const exists = combinedAssessmentScoreData.some(
      (r) =>
        String(r.enrollment_id) === String(enrollment.id) &&
        String(r.period_id) === String(assessment.period_id) &&
        r.category === assessment.category &&
        Number(r.item_no) === Number(assessment.item_no),
    );
    if (!exists) {
      combinedAssessmentScoreData.push({
        section_id: sid,
        period_id: assessment.period_id,
        enrollment_id: enrollment.id,
        category: assessment.category,
        item_no: assessment.item_no,
        score: attempt.score,
        max_score: attempt.max_score,
        period: assessment.period,
      });
    }
  }

  const liveAssessmentDefinitions = assessmentRows.map((a) => ({
    ...a,
    attempts: attemptRows.filter((x) => x.assessment_id === a.id),
    attemptGrants: grantRows.filter((g) => g.assessment_id === a.id),
    violations: violationRows.filter((v) => v.assessment_id === a.id),
  }));

  const classSessions = buildSessions(sd).sort((a, b) =>
    String(b.session_date).localeCompare(String(a.session_date)),
  );

  return {
    enrollments,
    studentNamesBySection,
    allStudentsData,
    periods,
    periodGrades,
    combinedAssessmentScoreData,
    liveStudentGroups,
    liveAssessmentDefinitions,
    attemptRows,
    grantRows,
    violationRows,
    classSessions,
  };
}
