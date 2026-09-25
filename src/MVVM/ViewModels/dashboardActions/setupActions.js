/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import { useCallback } from "react";
import { importMasterListFile } from "../importMasterList";
import { importGradeSheetFile } from "../importRecord";
import { syncGradeSheetToExcel } from "../syncGradeSheetToExcelPreservingTemplate";
import { getPeriodGradingWeightPercentages } from "../dashboardConstants";
import { supabase } from "../../../lib/supabaseClient";
import {
  countOfflineMutations,
  listOfflineMutations,
  readOfflineSnapshot,
  removeOfflineMutation,
  replayOfflineMutation,
} from "../../../lib/offlineStore";

export function useSetupActions(context) {
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
  const selectSection = useCallback(
    (sectionId) => {
      if (sectionId) loadLiveData(sectionId);
    },
    [loadLiveData],
  );

  const saveGradingPeriods = useCallback(
    async ({ dateRanges = {}, weightSettings = {} } = {}) => {
      if (!supabase) throw new Error("Supabase is not configured.");

      const invalidPeriod = Object.entries(dateRanges).find(([, dates]) => {
        const hasStart = Boolean(dates.start);
        const hasEnd = Boolean(dates.end);
        return (
          hasStart !== hasEnd || (hasStart && hasEnd && dates.start > dates.end)
        );
      });
      if (invalidPeriod) {
        throw new Error(
          "Each period needs both dates, and the start date must be before the end date.",
        );
      }

      const rows = Object.entries(dateRanges).map(([code, dates], index) => {
        const period = gradingPeriods.find(
          (periodItem) => periodItem.code === code,
        );
        const savedWeights =
          weightSettings[code] ?? getPeriodGradingWeightPercentages(period);
        return {
          code,
          sort_order: period?.sort_order ?? index + 1,
          start_date: dates.start || null,
          end_date: dates.end || null,
          weights: Object.fromEntries(
            Object.entries(savedWeights).map(([key, value]) => [
              key,
              Number(value),
            ]),
          ),
        };
      });
      if (browserIsOffline() || !supabase) {
        await queueOfflineChange("save-grading-periods", { rows });
        setGradingPeriods((current) =>
          current.map((currentPeriod) => {
            const next = rows.find((row) => row.code === currentPeriod.code);
            return next
              ? {
                  ...currentPeriod,
                  start_date: next.start_date,
                  end_date: next.end_date,
                  weights: next.weights,
                }
              : currentPeriod;
          }),
        );
        return;
      }
      const { error } = await supabase
        .from("grading_periods")
        .upsert(rows, { onConflict: "code" });
      if (error) throw error;

      // Keep existing attendance sessions aligned with the date ranges. This
      // repairs sessions that were previously assigned from the selected tab
      // instead of from their actual date.
      const { data: existingSessions, error: existingSessionsError } =
        await supabase
          .from("class_sessions")
          .select("id, session_date")
          .eq("section_id", currentSectionId);
      if (existingSessionsError) throw existingSessionsError;
      for (const session of existingSessions ?? []) {
        const matchingPeriod = rows
          .filter((row) => row.start_date && row.end_date)
          .sort((first, second) => first.sort_order - second.sort_order)
          .find(
            (row) =>
              session.session_date >= row.start_date &&
              session.session_date <= row.end_date,
          );
        if (!matchingPeriod) continue;
        const periodId = gradingPeriods.find(
          (periodItem) => periodItem.code === matchingPeriod.code,
        )?.id;
        if (!periodId) continue;
        const { error: sessionUpdateError } = await supabase
          .from("class_sessions")
          .update({ period_id: periodId })
          .eq("id", session.id);
        if (sessionUpdateError) throw sessionUpdateError;
      }
      await loadLiveData(currentSectionId);
    },
    [currentSectionId, gradingPeriods, loadLiveData, queueOfflineChange],
  );

  const importMasterList = useCallback(
    async (file) => {
      setImportState({ status: "working", message: "Reading master list…" });
      try {
        if (browserIsOffline() || !supabase) {
          await queueOfflineChange("import-master-list", { file });
          setImportState({
            status: "success",
            message: "Master list saved offline and queued for automatic sync.",
          });
          return;
        }
        const result = await importMasterListFile({
          file,
          supabase,
          userId: accountId,
        });
        const preferredSectionId = result.sectionIds?.includes(currentSectionId)
          ? currentSectionId
          : result.sectionId;
        await loadLiveData(preferredSectionId);
        setImportState({
          status: "success",
          message:
            result.count +
            " student records imported from " +
            result.sheetName +
            "." +
            (result.dedupSummary?.studentsMerged
              ? ` ${result.dedupSummary.studentsMerged} duplicate student record(s) were merged.`
              : "") +
            (result.dedupSummary?.errors?.length
              ? ` ${result.dedupSummary.errors.length} possible duplicate(s) could not be merged automatically.`
              : ""),
        });
      } catch (error) {
        const message = error.message ?? "Master-list import failed.";
        setConnectionStatus(isNetworkError(error) ? "offline" : "error");
        setConnectionMessage(message);
        setImportState({
          status: "error",
          message,
        });
      }
    },
    [accountId, currentSectionId, loadLiveData, queueOfflineChange],
  );

  return { selectSection, saveGradingPeriods, importMasterList };
}
