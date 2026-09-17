/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import { supabase } from "../../../lib/supabaseClient";
import { buildAnswerRows } from "./assessmentScoring";

export function useAssessmentSubmitActions(context) {
  const { currentSectionId, students, assessmentDefinitions, loadLiveData, queueOfflineChange, helpers } = context;
  const { answerSimilarity, browserIsOffline, callLanApi, createLocalId } = helpers;
  const submitAssessment = async ({ assessmentId, studentId, answers, assessment: loadedAssessment, enrollmentId, attemptNumber = 1, autoSubmit = false, violations = [] }) => {
      const assessment =
        loadedAssessment ??
        assessmentDefinitions.find((item) => item.id === assessmentId);
      if (!assessment) throw new Error("The selected assessment was not found.");
      const grantedAttempts = Math.max(
        0,
        Number(
          assessment.attemptGrants?.find((grant) => grant.student_id === studentId)
            ?.extra_attempts || 0,
        ),
      );
      const attemptLimit = 1 + grantedAttempts;
      const targetSectionId = currentSectionId ?? assessment.section_id;
      if (!targetSectionId) throw new Error("No active Supabase section.");
      if (!loadedAssessment && !students.some((student) => student.id === studentId))
        throw new Error("Select a valid student before submitting.");
      if (!enrollmentId) throw new Error("The student enrollment could not be identified.");
      const questions = [...(assessment.questions ?? [])].sort(
        (first, second) => Number(first.question_no) - Number(second.question_no),
      );
      const maxScore = questions.reduce(
        (total, question) => total + Number(question.points || 0),
        0,
      );
      const answerRows = buildAnswerRows(questions, answers, answerSimilarity);
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
      const lanAttemptId = createLocalId();
      const lanResult = await callLanApi("/api/student-assessment/submit", {
        method: "POST",
        body: JSON.stringify({
          attempt: {
            id: lanAttemptId,
            assessment_id: assessmentId,
            student_id: studentId,
            status: needsReview ? "needs_review" : "submitted",
            score,
            max_score: maxScore,
            attempt_no: Number(attemptNumber) || 1,
            submitted_at: new Date().toISOString(),
          },
          answers: answerRows.map((answer) => ({
            ...answer,
            attempt_id: lanAttemptId,
          })),
          violations,
          score: {
            section_id: assessment.section_id,
            period_id: assessment.period_id,
            enrollment_id: enrollmentId,
            category: assessment.category,
            item_no: assessment.item_no,
            score,
            max_score: maxScore,
          },
          periodCode: assessment.period?.code || null,
          autoSubmit,
        }),
      });
      if (lanResult) return lanResult;
      if (browserIsOffline() || !supabase) {
        if (!assessment.item_no) {
          throw new Error("This assessment is missing its Record Score column.");
        }
        const attemptId =
          createLocalId();
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
          answers: answerRows.map((answer) => ({ ...answer, attempt_id: attemptId })),
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
          attemptsRemaining: Math.max(0, attemptLimit - (Number(attemptNumber) || 1)),
          autoSubmitted: autoSubmit,
        };
      }
      const { data: attempt, error: attemptError } = await supabase
        .from("assessment_attempts")
        .insert(
          {
            assessment_id: assessmentId,
            student_id: studentId,
            attempt_no: Number(attemptNumber) || 1,
            status: needsReview ? "needs_review" : "submitted",
            score,
            max_score: maxScore,
            submitted_at: new Date().toISOString(),
          },
        )
        .select("id")
        .single();
      if (attemptError) throw attemptError;
      const { error: clearAnswersError } = await supabase
        .from("assessment_answers")
        .delete()
        .eq("attempt_id", attempt.id);
      if (clearAnswersError) throw clearAnswersError;
      if (answerRows.length) {
        const { error: answerError } = await supabase
          .from("assessment_answers")
          .insert(answerRows.map((answer) => ({ ...answer, attempt_id: attempt.id })));
        if (answerError) throw answerError;
      }
      if (violations.length) {
        const { error: violationError } = await supabase
          .from("assessment_violations")
          .insert(violations.map((violation) => ({
            ...violation,
            assessment_id: assessmentId,
            student_id: studentId,
            attempt_no: Number(attemptNumber) || 1,
          })));
        if (violationError) throw violationError;
      }
      if (!assessment.item_no) {
        throw new Error("This assessment is missing its Record Score column. Re-run the latest schema migration.");
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
        attemptsRemaining: Math.max(0, attemptLimit - (Number(attemptNumber) || 1)),
        autoSubmitted: autoSubmit,
      };
    };;
  return { submitAssessment };
}
