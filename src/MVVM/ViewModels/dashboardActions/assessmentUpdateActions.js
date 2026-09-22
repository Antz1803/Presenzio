/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import { supabase } from "../../../lib/supabaseClient";

export function useAssessmentUpdateActions(context) {
  const {
    currentSectionId,
    gradingPeriods,
    assessmentDefinitions,
    loadLiveData,
    queueOfflineChange,
    setAssessmentDefinitions,
    setAssessmentScores,
    helpers,
  } = context;
  const { browserIsOffline, createLocalId, serializeAssessmentDate } = helpers;
  const updateAssessment = async ({
    assessmentId,
    itemNo,
    title,
    category,
    period,
    instructions,
    timeLimitMinutes,
    availableFrom,
    availableUntil,
    questions,
    replaceAssessmentId,
  }) => {
    if (!currentSectionId) throw new Error("No active Supabase section.");
    const periodRow = gradingPeriods.find((item) => item.code === period);
    if (!periodRow)
      throw new Error("The selected grading period is not available.");
    if (!title?.trim()) throw new Error("An assessment title is required.");
    if (!Array.isArray(questions) || !questions.length)
      throw new Error("Add at least one assessment question.");
    const conflict = assessmentDefinitions.find(
      (item) =>
        item.id !== assessmentId &&
        item.category === category &&
        item.period?.code === period &&
        Number(item.item_no) === Number(itemNo),
    );
    const confirmedReplace =
      Boolean(conflict) && conflict.id === replaceAssessmentId;
    if (conflict && !confirmedReplace) {
      const conflictError = new Error(
        `Item ${itemNo} for this type and period is already used by another assessment.`,
      );
      conflictError.conflict = { id: conflict.id, title: conflict.title };
      throw conflictError;
    }
    if (browserIsOffline() || !supabase) {
      if (confirmedReplace) {
        await queueOfflineChange("delete-assessment", {
          assessmentId: conflict.id,
          sectionId: currentSectionId,
        });
        setAssessmentDefinitions((current) =>
          current.filter((item) => item.id !== conflict.id),
        );
        setAssessmentScores((current) =>
          current.filter(
            (row) =>
              !(
                row.period?.code === conflict.period?.code &&
                row.category === conflict.category &&
                Number(row.item_no) === Number(conflict.item_no)
              ),
          ),
        );
      }
      const existing = assessmentDefinitions.find(
        (item) => item.id === assessmentId,
      );
      const questionRows = questions.map((question, index) => ({
        id: createLocalId(),
        assessment_id: assessmentId,
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
      const maxScore = questions.reduce(
        (total, question) => total + Number(question.points || 0),
        0,
      );
      const assessment = {
        id: assessmentId,
        section_id: currentSectionId,
        period_id: periodRow.id,
        category,
        item_no: Number(itemNo ?? existing?.item_no),
        access_key: existing?.access_key,
        title: title.trim(),
        instructions: instructions?.trim() || null,
        time_limit_minutes: timeLimitMinutes ? Number(timeLimitMinutes) : null,
        available_from: serializeAssessmentDate(availableFrom),
        available_until: serializeAssessmentDate(availableUntil),
      };
      await queueOfflineChange("update-assessment", {
        assessmentId,
        itemNo,
        assessment,
        questions: questionRows,
        maxScore,
      });
      setAssessmentDefinitions((current) =>
        current.map((item) =>
          item.id === assessmentId
            ? {
                ...assessment,
                period: { code: period },
                questions: questionRows,
              }
            : item,
        ),
      );
      setAssessmentScores((current) =>
        current.map((row) =>
          row.section_id === currentSectionId &&
          row.category === category &&
          Number(row.item_no) === Number(itemNo)
            ? { ...row, max_score: maxScore }
            : row,
        ),
      );
      return { id: assessmentId, access_key: existing?.access_key };
    }
    if (confirmedReplace) {
      const { error: deleteConflictError } = await supabase
        .from("assessments")
        .delete()
        .eq("id", conflict.id)
        .eq("section_id", currentSectionId);
      if (deleteConflictError) throw deleteConflictError;
      const { error: deleteConflictScoresError } = await supabase
        .from("assessment_scores")
        .delete()
        .eq("section_id", currentSectionId)
        .eq("period_id", conflict.period_id)
        .eq("category", conflict.category)
        .eq("item_no", conflict.item_no);
      if (deleteConflictScoresError) throw deleteConflictScoresError;
    }
    const { data: assessment, error: assessmentError } = await supabase
      .from("assessments")
      .update({
        title: title.trim(),
        category,
        period_id: periodRow.id,
        item_no: Number(itemNo),
        instructions: instructions?.trim() || null,
        time_limit_minutes: timeLimitMinutes ? Number(timeLimitMinutes) : null,
        available_from: serializeAssessmentDate(availableFrom),
        available_until: serializeAssessmentDate(availableUntil),
      })
      .eq("id", assessmentId)
      .eq("section_id", currentSectionId)
      .select("id, access_key")
      .single();
    if (assessmentError) throw assessmentError;
    const { error: clearQuestionsError } = await supabase
      .from("assessment_questions")
      .delete()
      .eq("assessment_id", assessmentId);
    if (clearQuestionsError) throw clearQuestionsError;
    const questionRows = questions.map((question, index) => ({
      assessment_id: assessmentId,
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
    if (questionError) throw questionError;
    const maxScore = questions.reduce(
      (total, question) => total + Number(question.points || 0),
      0,
    );
    if (itemNo) {
      const { error: scoreMaxError } = await supabase
        .from("assessment_scores")
        .update({ max_score: maxScore })
        .eq("section_id", currentSectionId)
        .eq("period_id", periodRow.id)
        .eq("category", category)
        .eq("item_no", Number(itemNo));
      if (scoreMaxError) throw scoreMaxError;
    }
    await loadLiveData(currentSectionId);
    return assessment;
  };
  return { updateAssessment };
}
