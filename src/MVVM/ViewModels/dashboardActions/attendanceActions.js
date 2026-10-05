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
      if (!currentSectionId) throw new Error("No active Supabase section.");
      const selectedPeriodCode = period.toLowerCase();
      const datePeriodCode = gradingPeriods
        .filter((periodItem) => periodItem.start_date && periodItem.end_date)
        .sort((first, second) => first.sort_order - second.sort_order)
        .find(
          (periodItem) =>
            date >= periodItem.start_date && date <= periodItem.end_date,
        )?.code;
      const periodCode = datePeriodCode ?? selectedPeriodCode;
      if (browserIsOffline() || !supabase) {
        const existingSession = attendanceSessions.find(
          (session) =>
            session.sessionDate === date &&
            session.sessionTime === sessionTime &&
            session.periodCode === periodCode,
        );
        const sessionId = existingSession?.id ?? createLocalId();
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
      const { data: periodRow, error: periodError } = await supabase
        .from("grading_periods")
        .select("id")
        .eq("code", periodCode)
        .single();
      if (periodError) throw periodError;
      let { data: session, error: sessionLookupError } = await supabase
        .from("class_sessions")
        .select("id, period_id")
        .eq("section_id", currentSectionId)
        .eq("session_date", date)
        .eq("session_time", sessionTime)
        .maybeSingle();
      if (sessionLookupError) throw sessionLookupError;
      if (!session) {
        const result = await supabase
          .from("class_sessions")
          .insert({
            section_id: currentSectionId,
            period_id: periodRow.id,
            session_date: date,
            session_time: sessionTime,
          })
          .select("id")
          .single();
        if (result.error) throw result.error;
        session = result.data;
      }
      if (session.period_id !== periodRow.id) {
        const { error } = await supabase
          .from("class_sessions")
          .update({ period_id: periodRow.id })
          .eq("id", session.id);
        if (error) throw error;
      }
      const records = Object.entries(statuses).map(
        ([enrollmentId, status]) => ({
          session_id: session.id,
          enrollment_id: enrollmentId,
          status,
        }),
      );
      if (records.length) {
        const { error } = await supabase
          .from("attendance_records")
          .upsert(records, { onConflict: "session_id,enrollment_id" });
        if (error) throw error;
      }
      await recalculatePeriodGrades(periodRow.id);
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
      if (!currentSectionId) throw new Error("No active Supabase section.");
      const periodCode = sessionRecord?.periodCode;

      if (browserIsOffline() || !supabase) {
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

      const { data: existingSession, error: sessionLookupError } =
        await supabase
          .from("class_sessions")
          .select("id, period_id")
          .eq("section_id", currentSectionId)
          .eq("session_date", date)
          .eq("session_time", sessionTime)
          .maybeSingle();
      if (sessionLookupError) throw sessionLookupError;
      if (!existingSession) {
        // Nothing saved server-side for this date/time; just drop it locally.
        setAttendanceSessions((current) =>
          current.filter(
            (item) =>
              !(item.sessionDate === date && item.sessionTime === sessionTime),
          ),
        );
        return;
      }

      const { error: recordsError } = await supabase
        .from("attendance_records")
        .delete()
        .eq("session_id", existingSession.id);
      if (recordsError) throw recordsError;

      const { error: sessionError } = await supabase
        .from("class_sessions")
        .delete()
        .eq("id", existingSession.id);
      if (sessionError) throw sessionError;

      if (existingSession.period_id) {
        await recalculatePeriodGrades(existingSession.period_id);
      }
      await loadLiveData(currentSectionId);
    },
    [
      currentSectionId,
      loadLiveData,
      attendanceSessions,
      queueOfflineChange,
      recalculatePeriodGrades,
    ],
  );

  return { saveAttendance, deleteAttendance };
}
