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

export function useGradeImportActions(context) {
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
    createAssessmentAccessKey,
    createLocalId,
    formatShortDate,
    gradingWeights,
    isNetworkError,
    serializeAssessmentDate,
    transmutePercentage,
  } = helpers;
  const importGradeSheet = useCallback(
    async (file) => {
      setGradeSheetImportState({
        status: "working",
        message: "Reading grade sheet and finding its class…",
      });
      try {
        if (browserIsOffline() || !supabase) {
          await queueOfflineChange("import-grade-sheet", { file });
          setGradeSheetImportState({
            status: "success",
            message: "Grade sheet saved offline and queued for automatic sync.",
          });
          return;
        }
        const result = await importGradeSheetFile({
          file,
          supabase,
          userId: accountId,
        });
        // recalculatePeriodGrades always recomputes every grading period for
        // the section in one shot (it ignores which periodId it's passed
        // beyond the empty check below) and replaces the whole
        // period_grades table for this section each time it runs. Calling
        // it once per touched period therefore did the same full
        // delete-and-reinsert 2-4 times in a row for no benefit, and each
        // of those extra writes fired its own realtime change event that
        // could race with (and stale-overwrite) the final reload below.
        // Run it once, right after the scores/attendance are written.
        if (result.periodIds?.length) {
          await recalculatePeriodGrades(
            result.periodIds[0],
            result.sectionId,
            result.students,
            result.gradeOverrides,
          );
        }
        await loadLiveData(result.sectionId);
        setGradeSheetImportState({
          status: "success",
          message:
            result.scoreCount +
            " scores and " +
            result.attendanceCount +
            " attendance records imported into " +
            (result.subjectCode || "the matching class") +
            "." +
            (result.rosterChanges?.createdStudents?.length
              ? ` ${result.rosterChanges.createdStudents.length} missing student(s) were added to the class.`
              : "") +
            (result.unmatchedStudents
              ? ` ${result.unmatchedStudents} student row(s) were not matched.`
              : "") +
            (result.dedupSummary?.studentsMerged
              ? ` ${result.dedupSummary.studentsMerged} duplicate student record(s) were merged.`
              : "") +
            (result.dedupSummary?.errors?.length
              ? ` ${result.dedupSummary.errors.length} possible duplicate(s) could not be merged automatically.`
              : ""),
        });
      } catch (error) {
        const message = error.message ?? "Grade-sheet import failed.";
        if (isNetworkError(error)) {
          setConnectionStatus("offline");
          setConnectionMessage(message);
        }
        setGradeSheetImportState({
          status: "error",
          message,
        });
      }
    },
    [accountId, recalculatePeriodGrades, loadLiveData, queueOfflineChange],
  );

  return { importGradeSheet };
}
