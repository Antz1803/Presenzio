/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import { useCallback } from "react";
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

export function useScoreActions(context) {
  const {
    accountId,
    accountScoped,
    currentSectionId,
    period,
    section,
    sections,
    students,
    gradingPeriods,
    assessmentScores,
    assessmentDefinitions,
    studentGroups,
    attendanceSessions,
    recalculatePeriodGrades,
    loadLiveData,
    clearLiveData,
    queueOfflineChange,
    setSection,
    setSections,
    setStudents,
    setGradingPeriods,
    setAssessmentScores,
    setAssessmentDefinitions,
    setStudentGroups,
    setAssessmentAttemptGrants,
    setAttendanceSessions,
    setConnectionStatus,
    setConnectionMessage,
    setPendingSyncCount,
    setImportState,
    setGradeSheetImportState,
    helpers,
  } = context;
  const {
    answerSimilarity,
    assessmentItemLimits,
    average,
    browserIsOffline,
    callLanApi,
    createAssessmentAccessKey,
    createLocalId,
    formatShortDate,
    gradingWeights,
    isNetworkError,
    serializeAssessmentDate,
    transmutePercentage,
  } = helpers;
  const saveAssessmentScores = useCallback(
    async ({ period, category, scores, maxScores }) => {
      if (!currentSectionId) throw new Error("No active Supabase section.");
      const periodCode = period.toLowerCase();
      const baseRows = Object.entries(scores)
        .map(([itemNo, value]) => {
          const itemNumber = Number(itemNo.split(":")[1]);
          const itemMaxScore = Number(maxScores?.[String(itemNumber)]);

          if (
            value === "" &&
            (!Number.isFinite(itemMaxScore) || itemMaxScore <= 0)
          ) {
            return null;
          }
          if (!Number.isFinite(itemMaxScore) || itemMaxScore <= 0) {
            throw new Error(
              "Enter a maximum score for every column that has a score.",
            );
          }
          if (value !== "" && !Number.isFinite(Number(value))) {
            throw new Error("Scores must contain valid numbers.");
          }

          return {
            section_id: currentSectionId,
            enrollment_id: itemNo.split(":")[0],
            category,
            item_no: itemNumber,
            score:
              value === ""
                ? 0
                : Math.max(0, Math.min(Number(value), itemMaxScore)),
            max_score: itemMaxScore,
          };
        })
        .filter(Boolean);

      if (browserIsOffline() || !supabase) {
        await queueOfflineChange("save-assessment-scores", {
          sectionId: currentSectionId,
          periodCode,
          category,
          rows: baseRows,
        });
        setAssessmentScores((current) => [
          ...current.filter(
            (row) =>
              !(row.period?.code === periodCode && row.category === category),
          ),
          ...baseRows.map((row) => ({
            ...row,
            period: { code: periodCode },
          })),
        ]);
        return;
      }

      const { data: periodRow, error: periodError } = await supabase
        .from("grading_periods")
        .select("id")
        .eq("code", periodCode)
        .single();
      if (periodError) throw periodError;
      const assessmentRows = baseRows.map((row) => ({
        ...row,
        period_id: periodRow.id,
      }));

      const { error: clearError } = await supabase
        .from("assessment_scores")
        .delete()
        .eq("section_id", currentSectionId)
        .eq("period_id", periodRow.id)
        .eq("category", category);
      if (clearError) throw clearError;

      if (assessmentRows.length) {
        const { error } = await supabase
          .from("assessment_scores")
          .upsert(assessmentRows, {
            onConflict: "section_id,period_id,enrollment_id,category,item_no",
          });
        if (error) throw error;
      }
      await recalculatePeriodGrades(periodRow.id);
      await loadLiveData(currentSectionId);
    },
    [
      currentSectionId,
      loadLiveData,
      queueOfflineChange,
      recalculatePeriodGrades,
    ],
  );

  /**
   * Create a new assessment for a category/period/item-number slot.
   *
   * If `replaceAssessmentId` is provided, the caller has already confirmed
   * (via the UI) that they want to replace the assessment currently sitting
   * in that slot. In that case:
   *   - the conflict check ignores the slot IF it's occupied by exactly
   *     confirmation the user saw was only for the assessment they were
   *     shown);
   *   - the old assessment row (and its questions, via DB cascade / local
   *     state) is deleted;
   *   - any previously recorded assessment_scores for that section/period/
   *     category/item_no are cleared, since they belonged to the old
   *     assessment's question set and point scale.
   * Everything else behaves exactly like a normal, non-conflicting save.
   */

  return { saveAssessmentScores };
}
