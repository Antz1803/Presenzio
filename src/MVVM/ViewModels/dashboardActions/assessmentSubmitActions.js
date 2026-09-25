/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import { supabase } from "../../../lib/supabaseClient";
import { buildAnswerRows } from "./assessmentScoring";

export function useAssessmentSubmitActions(context) {
  const {
    currentSectionId,
    students,
    assessmentDefinitions,
    loadLiveData,
    queueOfflineChange,
    helpers,
  } = context;
  const { answerSimilarity, browserIsOffline, createLocalId } =
    helpers;
  const submitAssessment = async ({
    assessmentId,
    studentId,
    answers,
    assessment: loadedAssessment,
    enrollmentId,
    attemptNumber = 1,
    autoSubmit = false,
    violations = [],
  }) => {
    const assessment =
      loadedAssessment ??
      assessmentDefinitions.find((item) => item.id === assessmentId);
    if (!assessment) throw new Error("The selected assessment was not found.");
    const grantedAttempts = Math.max(
      0,
      Number(
        assessment.attemptGrants?.find(
          (grant) => grant.student_id === studentId,
        )?.extra_attempts || 0,
      ),
    );
    const attemptLimit = 1 + grantedAttempts;
    const targetSectionId = currentSectionId ?? assessment.section_id;
    if (!targetSectionId) throw new Error("No active Supabase section.");
    if (
      !loadedAssessment &&
      !students.some((student) => student.id === studentId)
    )
      throw new Error("Select a valid student before submitting.");
    if (!enrollmentId)
      throw new Error("The student enrollment could not be identified.");
    const questions = [...(assessment.questions ?? [])].sort(
      (first, second) => Number(first.question_no) - Number(second.question_no),
    );
    const maxScore = questions.reduce(
      (total, question) => total + Number(question.points || 0),
      0,
    );

    // Build answers from the client's cached question set first.
    let answerRows = buildAnswerRows(questions, answers, answerSimilarity);

    // Guard against stale question IDs: if the assessment was edited or
    // regenerated after the student loaded it, the client's cached
    // `assessment.questions` may reference question rows that no longer
    // exist. Re-fetch the live set of question IDs and drop any answer
    // that doesn't match, so we never hit the FK constraint on
    // assessment_answers.question_id.
    if (supabase && !browserIsOffline()) {
      const { data: liveQuestions, error: liveQuestionsError } = await supabase
        .from("assessment_questions") // <-- verify this table name against your schema
        .select("id")
        .eq("assessment_id", assessmentId);
      if (liveQuestionsError) throw liveQuestionsError;
      const validQuestionIds = new Set((liveQuestions ?? []).map((q) => q.id));
      answerRows = answerRows.filter((answer) =>
        validQuestionIds.has(answer.question_id),
      );
    }

    if (!autoSubmit && answerRows.some((answer) => !answer.answer.trim())) {
      throw new Error("Answer every question before submitting.");
    }
    const score = answerRows.reduce(
      (total, answer) => total + Number(answer.points_earned || 0),
      0,
    );
    const needsReview = questions.some(
      (question) =>
        question.question_type === "coding" &&
        !question.expected_output?.trim(),
    );
    if (browserIsOffline() || !supabase) {
      if (!assessment.item_no) {
        throw new Error("This assessment is missing its Record Score column.");
      }
      const attemptId = createLocalId();
      await queueOfflineChange("submit-assessment", {
        attempt: {
          id: attemptId,
          assessment_id: assessmentId,
          student_id: studentId,
          attempt_no: Number(attemptNumber) || 1,
          status: needsReview ? "needs_review" : "submitted",
          score,
          max_score: maxScore,
          submitted_at: new Date().toISOString(),
        },
        answers: answerRows.map((answer) => ({
          ...answer,
          attempt_id: attemptId,
        })),
        violations: violations.map((violation) => ({
          ...violation,
          assessment_id: assessmentId,
          student_id: studentId,
          attempt_no: Number(attemptNumber) || 1,
        })),
        score: {
          section_id: targetSectionId,
          period_id: assessment.period_id,
          enrollment_id: enrollmentId,
          category: assessment.category,
          item_no: assessment.item_no,
          score,
          max_score: maxScore,
        },
      });
      return {
        score,
        maxScore,
        needsReview,
        queued: true,
        attemptNumber: Number(attemptNumber) || 1,
        attemptsRemaining: Math.max(
          0,
          attemptLimit - (Number(attemptNumber) || 1),
        ),
        autoSubmitted: autoSubmit,
      };
    }
    // Upsert instead of insert: two near-simultaneous submit triggers
    // (timer expiry, Escape key, tab-hidden) can race and both pass the
    // "already submitted" guard before either write lands. Upserting on
    // the same unique constraint that used to throw a duplicate-key
    // error makes the second call update instead of crash.
    const { data: attempt, error: attemptError } = await supabase
      .from("assessment_attempts")
      .upsert(
        {
          assessment_id: assessmentId,
          student_id: studentId,
          attempt_no: Number(attemptNumber) || 1,
          status: needsReview ? "needs_review" : "submitted",
          score,
          max_score: maxScore,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: "assessment_id,student_id,attempt_no" }, // <-- verify against your actual constraint columns
      )
      .select("id")
      .maybeSingle();
    if (attemptError) throw attemptError;
    if (!attempt)
      throw new Error("Could not create or update the assessment attempt.");
    const { error: clearAnswersError } = await supabase
      .from("assessment_answers")
      .delete()
      .eq("attempt_id", attempt.id);
    if (clearAnswersError) throw clearAnswersError;
    if (answerRows.length) {
      const { error: answerError } = await supabase
        .from("assessment_answers")
        .insert(
          answerRows.map((answer) => ({ ...answer, attempt_id: attempt.id })),
        );
      if (answerError) throw answerError;
    }
    if (violations.length) {
      const { error: violationError } = await supabase
        .from("assessment_violations")
        .insert(
          violations.map((violation) => ({
            ...violation,
            assessment_id: assessmentId,
            student_id: studentId,
            attempt_no: Number(attemptNumber) || 1,
          })),
        );
      if (violationError) throw violationError;
    }
    if (!assessment.item_no) {
      throw new Error(
        "This assessment is missing its Record Score column. Re-run the latest schema migration.",
      );
    }
    const { error: scoreError } = await supabase
      .from("assessment_scores")
      .upsert(
        {
          section_id: assessment.section_id,
          period_id: assessment.period_id,
          enrollment_id: enrollmentId,
          category: assessment.category,
          item_no: assessment.item_no,
          score,
          max_score: maxScore,
        },
        { onConflict: "section_id,period_id,enrollment_id,category,item_no" },
      );
    if (scoreError) throw scoreError;
    await loadLiveData(assessment.section_id);
    return {
      score,
      maxScore,
      needsReview,
      attemptNumber: Number(attemptNumber) || 1,
      attemptsRemaining: Math.max(
        0,
        attemptLimit - (Number(attemptNumber) || 1),
      ),
      autoSubmitted: autoSubmit,
    };
  };
  return { submitAssessment };
}
