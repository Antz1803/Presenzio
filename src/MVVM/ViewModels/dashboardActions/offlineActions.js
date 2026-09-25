/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import { useCallback } from "react";
import { supabase } from "../../../lib/supabaseClient";
import {
  countOfflineMutations,
  listOfflineMutations,
  readOfflineSnapshot,
  removeOfflineMutation,
  replayOfflineMutation,
} from "../../../lib/offlineStore";
import { importMasterListFile } from "../importMasterList";
import { importGradeSheetFile } from "../importRecord";

export function useOfflineActions(context) {
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
  const flushOfflineMutations = useCallback(async () => {
    if (!accountScoped || !accountId || !supabase || browserIsOffline()) return;
    const mutations = await listOfflineMutations();
    setPendingSyncCount(mutations.length);
    if (!mutations.length) return;

    const affectedSections = new Set();
    try {
      for (const mutation of mutations) {
        const result = await replayOfflineMutation({
          supabase,
          mutation,
          importMasterList: (file) =>
            importMasterListFile({ file, supabase, userId: accountId }),
          importGradeSheet: (file) =>
            importGradeSheetFile({ file, supabase, userId: accountId }),
        });
        if (result?.sectionId) affectedSections.add(result.sectionId);
        await removeOfflineMutation(mutation.id);
        setPendingSyncCount((current) => Math.max(current - 1, 0));
      }

      for (const sectionId of affectedSections) {
        const loaded = await loadLiveData(sectionId);
        if (loaded?.students?.length && loaded.periods?.length) {
          // See the comment in importGradeSheet: recalculatePeriodGrades
          // recomputes every period for the section in one call, so looping
          // over each period here just repeated the same full rewrite.
          await recalculatePeriodGrades(
            loaded.periods[0].id,
            sectionId,
            loaded.students,
          );
          await loadLiveData(sectionId);
        }
      }
      setConnectionStatus("live");
      setConnectionMessage("Online · changes synced");
    } catch (error) {
      if (isNetworkError(error)) {
        setConnectionStatus("offline");
        setConnectionMessage("Offline · changes remain queued");
      } else {
        setConnectionStatus("error");
        setConnectionMessage(
          "Sync paused · " + (error.message ?? "retrying later"),
        );
      }
      setPendingSyncCount(await countOfflineMutations());
    }
  }, [accountId, accountScoped, loadLiveData, recalculatePeriodGrades]);

  return { flushOfflineMutations };
}
