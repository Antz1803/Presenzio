import { supabase } from "../../lib/supabaseClient";

export async function loadDashboardRecords({ sectionData, sectionList }) {
  const { data: enrollments, error: enrollmentError } = await supabase
    .from("enrollments")
    .select(
      "id, ctrl_no, status, student:students(id, full_name, gender, student_no, course, year_level, contact_no, email, photo_url)",
    )
    .eq("section_id", sectionData.id)
    .order("ctrl_no");
  if (enrollmentError) throw enrollmentError;

  // Every student saved in the database, independent of which section is
  // currently selected. Used to power the "Total students" stat card so
  // it reflects the whole roster rather than just the active class.
  const sectionIds = (sectionList ?? []).map((item) => item.id);
  const { data: allEnrollmentRows, error: allStudentsError } = sectionIds.length
    ? await supabase
        .from("enrollments")
        .select("section_id, student:students(id, gender)")
        .in("section_id", sectionIds)
    : { data: [], error: null };
  if (allStudentsError) throw allStudentsError;
  const allStudentsData = (allEnrollmentRows ?? [])
    .map((row) => row.student)
    .filter(Boolean)
    .filter(
      (student, index, rows) =>
        rows.findIndex((item) => item.id === student.id) === index,
    );

  let { data: periods, error: periodError } = await supabase
    .from("grading_periods")
    .select("id, code, sort_order, start_date, end_date")
    .order("sort_order");
  if (periodError) {
    // Keep existing classes visible until the date columns are added to
    // an existing Supabase project through the schema migration.
    const fallbackPeriods = await supabase
      .from("grading_periods")
      .select("id, code, sort_order")
      .order("sort_order");
    if (fallbackPeriods.error) throw periodError;
    periods = fallbackPeriods.data ?? [];
  }

  const { data: periodGrades, error: gradeError } = await supabase
    .from("period_grades")
    .select(
      "enrollment_id, own_period_grade, cumulative_grade, period:grading_periods(code)",
    )
    .eq("section_id", sectionData.id);
  if (gradeError) throw gradeError;

  const { data: assessmentScoreData, error: assessmentScoreError } =
    await supabase
      .from("assessment_scores")
      .select(
        "period_id, enrollment_id, category, item_no, score, max_score, recorded_at, period:grading_periods(code)",
      )
      .eq("section_id", sectionData.id);
  if (assessmentScoreError) throw assessmentScoreError;

  const combinedAssessmentScoreData = assessmentScoreData ?? [];

  const { data: studentGroupData, error: studentGroupError } = await supabase
    .from("student_groups")
    .select(
      "id, label, group_count, assignments, category, period_code, item_no, created_at",
    )
    .eq("section_id", sectionData.id)
    .order("created_at", { ascending: false });
  if (studentGroupError) throw studentGroupError;
  const liveStudentGroups = (studentGroupData ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    groupCount: row.group_count,
    assignments: row.assignments ?? {},
    category: row.category ?? null,
    period: row.period_code ?? null,
    itemNo: row.item_no ?? null,
    createdAt: row.created_at,
  }));
  // Assessment authoring is optional for existing projects. If the new
  // tables have not been migrated yet, keep the class dashboard usable.
  let { data: assessmentData, error: assessmentDataError } = await supabase
    .from("assessments")
    .select(
      "id, section_id, period_id, category, item_no, access_key, title, instructions, time_limit_minutes, available_from, available_until, created_at, period:grading_periods(code), section:sections(id, subject_code, subject_title), questions:assessment_questions(id, question_no, question_type, prompt, points, choices, correct_answer, language, starter_code, expected_output, near_match_score_percent, incorrect_score_percent)",
    )
    .eq("section_id", sectionData.id)
    .order("created_at", { ascending: false });
  if (assessmentDataError) {
    const fallbackAssessments = await supabase
      .from("assessments")
      .select(
        "id, section_id, period_id, category, item_no, access_key, title, instructions, created_at, period:grading_periods(code), section:sections(id, subject_code, subject_title), questions:assessment_questions(id, question_no, question_type, prompt, points, choices, correct_answer, language, starter_code, expected_output, near_match_score_percent, incorrect_score_percent)",
      )
      .eq("section_id", sectionData.id)
      .order("created_at", { ascending: false });
    if (!fallbackAssessments.error) {
      assessmentData = (fallbackAssessments.data ?? []).map((assessment) => ({
        ...assessment,
        time_limit_minutes: null,
        available_from: null,
        available_until: null,
      }));
      assessmentDataError = null;
    }
  }
  const assessmentRows = assessmentDataError ? [] : (assessmentData ?? []);
  const assessmentIds = assessmentRows.map((assessment) => assessment.id);
  let attemptRows = [];
  let grantRows = [];
  let violationRows = [];
  if (assessmentIds.length) {
    const [attemptResult, grantResult, violationResult] = await Promise.all([
      supabase
        .from("assessment_attempts")
        .select(
          "id, assessment_id, student_id, attempt_no, score, max_score, status, submitted_at",
        )
        .in("assessment_id", assessmentIds),
      supabase
        .from("assessment_attempt_grants")
        .select("id, assessment_id, student_id, extra_attempts, granted_at")
        .in("assessment_id", assessmentIds),
      supabase
        .from("assessment_violations")
        .select(
          "id, assessment_id, student_id, attempt_no, violation_type, details, occurred_at",
        )
        .in("assessment_id", assessmentIds)
        .order("occurred_at", { ascending: false }),
    ]);
    attemptRows = attemptResult.error ? [] : (attemptResult.data ?? []);
    grantRows = grantResult.error ? [] : (grantResult.data ?? []);
    violationRows = violationResult.error ? [] : (violationResult.data ?? []);
  }
  // Fetch each attempt's actual submitted answers (question_id, the raw
  // answer text/choice, correctness, and points earned) and attach them
  // to their attempt row.
  let answerRows = [];
  const attemptIds = attemptRows.map((attempt) => attempt.id).filter(Boolean);
  if (attemptIds.length) {
    const { data: answerData, error: answerError } = await supabase
      .from("assessment_answers")
      .select("id, attempt_id, question_id, answer, is_correct, points_earned")
      .in("attempt_id", attemptIds);
    if (answerError) {
      console.error("Failed to load assessment_answers:", answerError);
    }
    answerRows = answerError ? [] : (answerData ?? []);
  }
  attemptRows = attemptRows.map((attempt) => ({
    ...attempt,
    answers: answerRows.filter((answer) => answer.attempt_id === attempt.id),
  }));

  const liveAssessmentDefinitions = assessmentRows.map((assessment) => ({
    ...assessment,
    attempts: attemptRows.filter(
      (attempt) => attempt.assessment_id === assessment.id,
    ),
    attemptGrants: grantRows.filter(
      (grant) => grant.assessment_id === assessment.id,
    ),
    violations: violationRows.filter(
      (violation) => violation.assessment_id === assessment.id,
    ),
  }));

  const { data: classSessions, error: sessionError } = await supabase
    .from("class_sessions")
    .select(
      "id, period_id, session_date, session_time, attendance_records(enrollment_id, status)",
    )
    .eq("section_id", sectionData.id)
    .order("session_date", { ascending: false });
  if (sessionError) throw sessionError;
  return {
    enrollments,
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
