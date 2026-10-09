import * as store from "../../../lib/accountDb";

export async function saveAssessmentOnline(context, input, periodRow) {
  const {
    accountId, currentSectionId, students, loadLiveData,
    helpers: { assessmentItemLimits, createAssessmentAccessKey, serializeAssessmentDate },
  } = context;
  const {
    title, category, itemNo: requestedItemNo, instructions, timeLimitMinutes,
    availableFrom, availableUntil, questions, replaceAssessmentId, overwriteScores,
  } = input;

  if (replaceAssessmentId) {
    await store.deleteAssessment(accountId, currentSectionId, replaceAssessmentId);
  }

  const { assessments, scoreItemNos } = await store.getAssessmentSlots(
    accountId, currentSectionId, periodRow.id, category,
  );
  const usedByAssessment = new Set(assessments.map((a) => Number(a.item_no)));
  const usedByScoresOnly = new Set(scoreItemNos.filter((n) => !usedByAssessment.has(n)));
  const itemLimit = assessmentItemLimits[category] ?? 1;

  let itemNo;
  if (requestedItemNo) {
    const candidate = Number(requestedItemNo);
    if (!Number.isInteger(candidate) || candidate < 1 || candidate > itemLimit) {
      throw new Error(`Item number must be between 1 and ${itemLimit} for this type.`);
    }
    if (usedByAssessment.has(candidate)) {
      const occupying = assessments.find((a) => Number(a.item_no) === candidate);
      const error = new Error(
        `Item ${candidate} for this type and period is already used by another assessment.`,
      );
      if (occupying) error.conflict = { id: occupying.id, title: occupying.title };
      throw error;
    }
    if (usedByScoresOnly.has(candidate) && !overwriteScores) {
      const error = new Error(
        `Item ${candidate} for this type and period already has recorded scores. Creating this assessment will reset those scores to 0 for every student.`,
      );
      error.scoreConflict = true;
      throw error;
    }
    itemNo = candidate;
  } else {
    itemNo = Array.from({ length: itemLimit }, (_, i) => i + 1).find(
      (n) => !usedByAssessment.has(n) && !usedByScoresOnly.has(n),
    );
    if (!itemNo) throw new Error(`All ${itemLimit} ${category} score columns are already in use.`);
  }

  const questionRows = questions.map((question, index) => ({
    question_no: index + 1,
    question_type: question.type,
    prompt: question.prompt,
    points: Number(question.points),
    choices: question.choices ?? [],
    correct_answer: question.correctAnswer || null,
    language: question.language || null,
    starter_code: question.starterCode || null,
    expected_output: question.expectedOutput || null,
    near_match_score_percent:
      question.type === "coding" ? Math.max(0, Math.min(100, Number(question.nearMatchScorePercent) || 0)) : null,
    incorrect_score_percent:
      question.type === "coding" ? Math.max(0, Math.min(100, Number(question.incorrectScorePercent) || 0)) : null,
  }));
  const maxScore = questions.reduce((t, q) => t + Number(q.points || 0), 0);

  const createdAssessment = await store.createAssessment(accountId, {
    assessment: {
      section_id: currentSectionId,
      period_id: periodRow.id,
      category,
      item_no: itemNo,
      access_key: createAssessmentAccessKey(),
      title: title.trim(),
      instructions: instructions?.trim() || null,
      time_limit_minutes: timeLimitMinutes ? Number(timeLimitMinutes) : null,
      available_from: serializeAssessmentDate(availableFrom),
      available_until: serializeAssessmentDate(availableUntil),
    },
    questions: questionRows,
    scoreRows: students.map((student) => ({
      section_id: currentSectionId,
      period_id: periodRow.id,
      enrollment_id: student.id,
      category,
      item_no: itemNo,
      score: 0,
      max_score: maxScore,
    })),
  });
  await store.publishPublicAssessment(
    accountId,
    currentSectionId,
    createdAssessment.id,
  );
  await loadLiveData(currentSectionId);
}
