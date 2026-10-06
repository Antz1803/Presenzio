/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import { useCallback } from "react";
import { importMasterListFile } from "../importMasterListFirebase";
import { syncGradeSheetToExcel } from "../syncGradeSheetToExcelPreservingTemplate";
import { getPeriodGradingWeightPercentages } from "../dashboardConstants";
import { db } from "../../../lib/Firebase";
import * as store from "../../../lib/accountDb";
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
      if (!db) throw new Error("Firebase is not configured.");

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
      if (browserIsOffline() || !db) {
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
      await store.saveGradingPeriods(accountId, rows);
      await store.realignSessionPeriods(accountId, currentSectionId, rows);
      await loadLiveData(currentSectionId);
    },
    [
      currentSectionId,
      gradingPeriods,
      loadLiveData,
      queueOfflineChange,
      section,
      setSection,
      setSections,
    ],
  );

  const importMasterList = useCallback(
    async (file) => {
      setImportState({ status: "working", message: "Reading master list…" });
      try {
        if (browserIsOffline() || !db) {
          await queueOfflineChange("import-master-list", { file });
          setImportState({
            status: "success",
            message: "Master list saved offline and queued for automatic sync.",
          });
          return;
        }
        const result = await importMasterListFile({
          file,
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
