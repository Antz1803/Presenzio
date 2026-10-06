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

export function useAttendanceActions(context) {
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
  const saveAttendance = useCallback(
    async ({ date, sessionTime, statuses }) => {
      if (!currentSectionId) throw new Error("No active Firebase section.");
      const selectedPeriodCode = period.toLowerCase();
      const datePeriodCode = gradingPeriods
        .filter((periodItem) => periodItem.start_date && periodItem.end_date)
        .sort((first, second) => first.sort_order - second.sort_order)
        .find(
          (periodItem) =>
            date >= periodItem.start_date && date <= periodItem.end_date,
        )?.code;
      const periodCode = datePeriodCode ?? selectedPeriodCode;
      if (browserIsOffline() || !db) {
        const existingSession = attendanceSessions.find(
          (session) =>
            session.sessionDate === date &&
            session.sessionTime === sessionTime &&
            session.periodCode === periodCode,
        );
        const sessionId = `${date}_${sessionTime}`;
        await queueOfflineChange("save-attendance", {
          sectionId: currentSectionId,
          periodCode,
          date,
          sessionTime,
          statuses,
          sessionId,
        });
        setAttendanceSessions((current) => {
          const existing = current.find(
            (session) =>
              session.sessionDate === date &&
              session.sessionTime === sessionTime &&
              session.periodCode === periodCode,
          );
          const next = {
            id: existing?.id ?? sessionId,
            date: formatShortDate(date),
            sessionDate: date,
            sessionTime,
            periodCode,
            statuses,
          };
          return existing
            ? current.map((session) =>
                session.id === existing.id ? next : session,
              )
            : [...current, next].sort((first, second) =>
                first.sessionDate.localeCompare(second.sessionDate),
              );
        });
        return;
      }
      await store.saveAttendance(accountId, currentSectionId, {
        sessionId: `${date}_${sessionTime}`,
        periodId: periodCode,
        date,
        sessionTime,
        statuses,
      });
      await recalculatePeriodGrades(periodCode);
      await loadLiveData(currentSectionId);
    },
    [
      currentSectionId,
      loadLiveData,
      period,
      gradingPeriods,
      attendanceSessions,
      queueOfflineChange,
      recalculatePeriodGrades,
    ],
  );

  const deleteAttendance = useCallback(
    async ({ date, sessionTime, session: sessionRecord }) => {
      if (!currentSectionId) throw new Error("No active Firebase section.");
      const periodCode = sessionRecord?.periodCode;

      if (browserIsOffline() || !db) {
        const existingSession =
          sessionRecord ??
          attendanceSessions.find(
            (item) =>
              item.sessionDate === date && item.sessionTime === sessionTime,
          );
        if (!existingSession) return;
        await queueOfflineChange("delete-attendance", {
          sectionId: currentSectionId,
          date,
          sessionTime,
          sessionId: existingSession.id,
        });
        setAttendanceSessions((current) =>
          current.filter((item) => item.id !== existingSession.id),
        );
        return;
      }

      const removed = await store.deleteSession(
        accountId,
        currentSectionId,
        sessionRecord?.id ?? `${date}_${sessionTime}`,
      );
      if (!removed) {
        // Nothing saved server-side for this date/time; just drop it locally.
        setAttendanceSessions((current) =>
          current.filter(
            (item) =>
              !(item.sessionDate === date && item.sessionTime === sessionTime),
          ),
        );
        return;
      }

      if (removed.period_id) {
        await recalculatePeriodGrades(removed.period_id);
      }
      await loadLiveData(currentSectionId);
    },
    [
      accountId,
      currentSectionId,
      loadLiveData,
      attendanceSessions,
      queueOfflineChange,
      recalculatePeriodGrades,
    ],
  );

  return { saveAttendance, deleteAttendance };
}
