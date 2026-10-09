import * as store from "../../../lib/accountDb";
import { buildAnswerRows } from "./assessmentScoring";

export function useAssessmentSubmitActions(context) {
  const {
    accountId,
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
    if (!targetSectionId) throw new Error("No active Firebase section.");
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
    if (!questions.length) {
      throw new Error("This assessment has no questions to submit.");
    }
    const maxScore = questions.reduce(
      (total, question) => total + Number(question.points || 0),
      0,
    );

    // Build answers from the client's cached question set first.
    let answerRows = buildAnswerRows(questions, answers, answerSimilarity);

    if (answerRows.length !== questions.length) {
      throw new Error(
        "Some assessment questions could not be matched to the current question records. Please reload the assessment and try again.",
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
    if (browserIsOffline()) {
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
    if (!assessment.item_no) {
      throw new Error(
        "This assessment is missing its Record Score column. Re-run the latest schema migration.",
      );
    }
    if (!accountId) {
      const publicAccessKey = loadedAssessment?.public_access_key;
      if (!publicAccessKey) throw new Error("This assessment is not available publicly.");
      await store.savePublicAssessmentSubmission(publicAccessKey, studentId, {
        access_key: publicAccessKey,
        assessment_id: assessmentId,
        student_id: studentId,
        enrollment_id: enrollmentId,
        attempt_no: Number(attemptNumber) || 1,
        status: needsReview ? "needs_review" : "submitted",
        score,
        max_score: maxScore,
        submitted_at: new Date().toISOString(),
        answers: Object.fromEntries(
          answerRows.map(({ question_id, ...answer }) => [question_id, answer]),
        ),
        violations,
      });
      return {
        score,
        maxScore,
        needsReview,
        attemptNumber: Number(attemptNumber) || 1,
        attemptsRemaining: 0,
        autoSubmitted: autoSubmit,
      };
    }
    await store.saveAssessmentAttempt(accountId, targetSectionId, {
      assessmentId,
      studentId,
      attemptNumber,
      status: needsReview ? "needs_review" : "submitted",
      score,
      maxScore,
      submittedAt: new Date().toISOString(),
      answers: answerRows,
      violations,
      scoreRow: {
        section_id: targetSectionId,
        period_id: assessment.period_id,
        enrollment_id: enrollmentId,
        category: assessment.category,
        item_no: assessment.item_no,
        score,
        max_score: maxScore,
      },
    });
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
