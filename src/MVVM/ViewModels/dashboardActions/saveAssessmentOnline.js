/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import { importMasterListFile } from "../importMasterList";
import { importGradeSheetFile } from "../importRecord";
import { syncGradeSheetToExcel } from "../syncGradeSheetToExcelPreservingTemplate";
import { supabase } from "../../../lib/supabaseClient";
import {
  countOfflineMutations,
  listOfflineMutations,
  readOfflineSnapshot,
  removeOfflineMutation,
  replayOfflineMutation,
} from "../../../lib/offlineStore";

export async function saveAssessmentOnline(context, input, periodRow) {
  const {
    currentSectionId,
    students,
    gradingPeriods,
    assessmentScores,
    assessmentDefinitions,
    setAssessmentDefinitions,
    setAssessmentScores,
    queueOfflineChange,
    helpers,
  } = context;
  const {
    assessmentItemLimits,
    createAssessmentAccessKey,
    createLocalId,
    serializeAssessmentDate,
  } = helpers;
  const {
    title,
    category,
    period,
    itemNo: requestedItemNo,
    instructions,
    timeLimitMinutes,
    availableFrom,
    availableUntil,
    questions,
    replaceAssessmentId,
    overwriteScores,
  } = input;
  if (replaceAssessmentId) {
    const { error: deleteAssessmentError } = await supabase
      .from("assessments")
      .delete()
      .eq("id", replaceAssessmentId)
      .eq("section_id", currentSectionId);
    if (deleteAssessmentError) throw deleteAssessmentError;
  }

  const [
    { data: existingAssessments, error: existingAssessmentError },
    { data: existingScores, error: existingScoreError },
  ] = await Promise.all([
    supabase
      .from("assessments")
      .select("id, item_no, title")
      .eq("section_id", currentSectionId)
      .eq("period_id", periodRow.id)
      .eq("category", category),
    supabase
      .from("assessment_scores")
      .select("item_no")
      .eq("section_id", currentSectionId)
      .eq("period_id", periodRow.id)
      .eq("category", category),
  ]);
  if (existingAssessmentError) throw existingAssessmentError;
  if (existingScoreError) throw existingScoreError;
  const usedByAssessment = new Set(
    (existingAssessments ?? []).map((item) => Number(item.item_no)),
  );
  const usedByScoresOnly = new Set(
    (existingScores ?? [])
      .map((item) => Number(item.item_no))
      .filter((itemNumber) => !usedByAssessment.has(itemNumber)),
  );
  const itemLimit = assessmentItemLimits[category] ?? 1;
  let itemNo;
  if (requestedItemNo) {
    const candidate = Number(requestedItemNo);
    if (
      !Number.isInteger(candidate) ||
      candidate < 1 ||
      candidate > itemLimit
    ) {
      throw new Error(
        `Item number must be between 1 and ${itemLimit} for this type.`,
      );
    }
    // Note: when replaceAssessmentId was set, that assessment's own row
    // was already deleted above, so a legitimate replace no longer trips
    if (usedByAssessment.has(candidate)) {
      // This query reflects the live DB, not the modal's (possibly stale)
      // cached assessments list, so this can fire even when the modal's
      // own client-side conflict check found nothing. Attach who actually
      // occupies the slot so the modal can still offer a replace-confirm
      // dialog instead of a dead-end error.
      const occupyingAssessment = (existingAssessments ?? []).find(
        (item) => Number(item.item_no) === candidate,
      );
      const conflictError = new Error(
        `Item ${candidate} for this type and period is already used by another assessment.`,
      );
      if (occupyingAssessment) {
        conflictError.conflict = {
          id: occupyingAssessment.id,
          title: occupyingAssessment.title,
        };
      }
      throw conflictError;
    }
    if (usedByScoresOnly.has(candidate) && !overwriteScores) {
      // scores. There's nothing to "replace", so this needs a different
      // confirmation: overwrite those scores.
      const scoreConflictError = new Error(
        `Item ${candidate} for this type and period already has recorded scores. Creating this assessment will reset those scores to 0 for every student.`,
      );
      scoreConflictError.scoreConflict = true;
      throw scoreConflictError;
    }
    itemNo = candidate;
    if (replaceAssessmentId) {
      const { error: deleteScoresError } = await supabase
        .from("assessment_scores")
        .delete()
        .eq("section_id", currentSectionId)
        .eq("period_id", periodRow.id)
        .eq("category", category)
        .eq("item_no", itemNo);
      if (deleteScoresError) throw deleteScoresError;
    }
  } else {
    itemNo = Array.from({ length: itemLimit }, (_, index) => index + 1).find(
      (candidate) =>
        !usedByAssessment.has(candidate) && !usedByScoresOnly.has(candidate),
    );
    if (!itemNo) {
      throw new Error(
        `All ${itemLimit} ${category} score columns are already in use.`,
      );
    }
  }

  const { data: assessment, error: assessmentError } = await supabase
    .from("assessments")
    .insert({
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
    })
    .select("id, access_key")
    .single();
  if (assessmentError) throw assessmentError;

  const questionRows = questions.map((question, index) => ({
    assessment_id: assessment.id,
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
      question.type === "coding"
        ? Math.max(
            0,
            Math.min(100, Number(question.nearMatchScorePercent) || 0),
          )
        : null,
    incorrect_score_percent:
      question.type === "coding"
        ? Math.max(
            0,
            Math.min(100, Number(question.incorrectScorePercent) || 0),
          )
        : null,
  }));
  const { error: questionError } = await supabase
    .from("assessment_questions")
    .insert(questionRows);
  if (questionError) {
    await supabase.from("assessments").delete().eq("id", assessment.id);
    throw questionError;
  }
  const maxScore = questions.reduce(
    (total, question) => total + Number(question.points || 0),
    0,
  );
  const initialScoreRows = students.map((student) => ({
    section_id: currentSectionId,
    period_id: periodRow.id,
    enrollment_id: student.id,
    category,
    item_no: itemNo,
    score: 0,
    max_score: maxScore,
  }));
  if (initialScoreRows.length) {
    const { error: scoreError } = await supabase
      .from("assessment_scores")
      .upsert(initialScoreRows, {
        onConflict: "section_id,period_id,enrollment_id,category,item_no",
      });
    if (scoreError) throw scoreError;
  }
  await loadLiveData(currentSectionId);
}
