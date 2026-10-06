/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import { useCallback } from "react";
import { importMasterListFile } from "../importMasterListFirebase";
import { importGradeSheetFile } from "../importRecordFirebase";
import { syncGradeSheetToExcel } from "../syncGradeSheetToExcelPreservingTemplate";
import { db } from "../../../lib/Firebase";
import * as store from "../../../lib/accountDb";
import {
  countOfflineMutations,
  listOfflineMutations,
  readOfflineSnapshot,
  removeOfflineMutation,
  replayOfflineMutation,
} from "../../../lib/offlineStore";

export function useGradeActions(context) {
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
  const saveGrades = useCallback(
    async ({ period, grades }) => {
      if (!currentSectionId) throw new Error("No active Firebase section.");
      const periodCode = period.toLowerCase();
      const baseRows = Object.entries(grades)
        .filter(([, value]) => value !== "" && Number.isFinite(Number(value)))
        .map(([enrollmentId, value]) => ({
          section_id: currentSectionId,
          enrollment_id: enrollmentId,
          own_period_grade: Number(value),
          cumulative_grade: Number(value),
        }));
      if (browserIsOffline() || !db) {
        await queueOfflineChange("save-grades", {
          sectionId: currentSectionId,
          periodCode,
          rows: baseRows,
        });
        setStudents((current) =>
          current.map((student) => {
            const value = grades[student.id];
            if (value === "" || !Number.isFinite(Number(value))) return student;
            const nextGrades = {
              ...student.grades,
              [periodCode]: Number(value),
            };
            return {
              ...student,
              grades: nextGrades,
              grade: nextGrades.prelim ?? student.grade,
            };
          }),
        );
        return;
      }
      const rows = baseRows.map((row) => ({ ...row, period_id: periodCode }));
      if (rows.length) await store.upsertPeriodGrades(accountId, currentSectionId, rows);
      await loadLiveData(currentSectionId);
    },
    [currentSectionId, loadLiveData, queueOfflineChange],
  );

  return { saveGrades };
}
