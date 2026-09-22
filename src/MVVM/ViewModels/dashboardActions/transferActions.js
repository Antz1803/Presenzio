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

export function useTransferActions(context) {
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
    callLanApi,
    createAssessmentAccessKey,
    createLocalId,
    formatShortDate,
    gradingWeights,
    isNetworkError,
    serializeAssessmentDate,
    transmutePercentage,
  } = helpers;
  const loadTransferPreview = useCallback(
    async ({ enrollmentId, fromSectionId, toSectionId }) => {
      if (!supabase)
        throw new Error(
          "Attendance transfer requires a live database connection.",
        );

      const { count: oldRecordCount, error: oldCountError } = await supabase
        .from("attendance_records")
        .select("id, class_sessions!inner(section_id)", {
          count: "exact",
          head: true,
        })
        .eq("enrollment_id", enrollmentId)
        .eq("class_sessions.section_id", fromSectionId);
      if (oldCountError) throw oldCountError;

      const { data: targetSessions, error: targetSessionsError } =
        await supabase
          .from("class_sessions")
          .select("id, session_date, session_time")
          .eq("section_id", toSectionId)
          .order("session_date", { ascending: true });
      if (targetSessionsError) throw targetSessionsError;

      return {
        oldRecordCount: oldRecordCount ?? 0,
        targetSessions: (targetSessions ?? []).map((session) => ({
          id: session.id,
          date: session.session_date,
          time: session.session_time,
        })),
      };
    },
    [],
  );

  /**
   * Moves a student's enrollment, assessment scores, and period grades to a
   * new class, then records their attendance for that new class based on the
   * class's attendance history. `attendanceEntries` is one entry per target
   * session the teacher marked: { sessionId, status }. Sessions the teacher
   * left unmarked are not recorded either way.
   *
   * Once the new attendance is written, every one of the student's old
   * attendance history for this student does not persist anywhere after a
   * transfer is confirmed.
   */
  const transferStudent = useCallback(
    async ({
      enrollmentId,
      studentId,
      fromSectionId,
      toSectionId,
      attendanceEntries = [],
    }) => {
      if (!enrollmentId || !studentId)
        throw new Error("Student information is incomplete.");
      if (!toSectionId) throw new Error("Select a class to transfer to.");
      if (toSectionId === fromSectionId)
        throw new Error("This student is already in that class.");

      if (browserIsOffline() || !supabase) {
        await queueOfflineChange("transfer-student", {
          enrollmentId,
          studentId,
          fromSectionId,
          toSectionId,
        });
        if (fromSectionId === currentSectionId) {
          setStudents((current) =>
            current.filter((item) => item.id !== enrollmentId),
          );
          setAssessmentScores((current) =>
            current.filter((row) => row.enrollment_id !== enrollmentId),
          );
        }
        return { attendanceRecorded: 0, offline: true };
      }

      const { data: existing, error: existingError } = await supabase
        .from("enrollments")
        .select("id")
        .eq("section_id", toSectionId)
        .eq("student_id", studentId)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing)
        throw new Error("This student is already enrolled in that class.");

      const { data: maxCtrlRows, error: maxCtrlError } = await supabase
        .from("enrollments")
        .select("ctrl_no")
        .eq("section_id", toSectionId)
        .order("ctrl_no", { ascending: false })
        .limit(1);
      if (maxCtrlError) throw maxCtrlError;
      const nextCtrlNo = (maxCtrlRows?.[0]?.ctrl_no ?? 0) + 1;

      const { error: enrollmentUpdateError } = await supabase
        .from("enrollments")
        .update({ section_id: toSectionId, ctrl_no: nextCtrlNo })
        .eq("id", enrollmentId);
      if (enrollmentUpdateError) throw enrollmentUpdateError;

      const { error: scoresMoveError } = await supabase
        .from("assessment_scores")
        .update({ section_id: toSectionId })
        .eq("section_id", fromSectionId)
        .eq("enrollment_id", enrollmentId);
      if (scoresMoveError) throw scoresMoveError;

      const { error: gradesMoveError } = await supabase
        .from("period_grades")
        .update({ section_id: toSectionId })
        .eq("section_id", fromSectionId)
        .eq("enrollment_id", enrollmentId);
      if (gradesMoveError) throw gradesMoveError;

      const markedEntries = attendanceEntries.filter(
        (entry) => entry.sessionId && entry.status,
      );
      if (markedEntries.length) {
        const rows = markedEntries.map((entry) => ({
          session_id: entry.sessionId,
          enrollment_id: enrollmentId,
          status: entry.status,
        }));
        const { error: attendanceUpsertError } = await supabase
          .from("attendance_records")
          .upsert(rows, { onConflict: "session_id,enrollment_id" });
        if (attendanceUpsertError) throw attendanceUpsertError;
      }

      // The old class's attendance history for this student is discarded
      // not moved, not archived.
      const { data: oldSessionRows, error: oldSessionsError } = await supabase
        .from("class_sessions")
        .select("id")
        .eq("section_id", fromSectionId);
      if (oldSessionsError) throw oldSessionsError;
      const oldSessionIds = (oldSessionRows ?? []).map((session) => session.id);
      if (oldSessionIds.length) {
        const { error: deleteOldError } = await supabase
          .from("attendance_records")
          .delete()
          .eq("enrollment_id", enrollmentId)
          .in("session_id", oldSessionIds);
        if (deleteOldError) throw deleteOldError;
      }

      await loadLiveData(fromSectionId);
      return { attendanceRecorded: markedEntries.length, offline: false };
    },
    [currentSectionId, loadLiveData, queueOfflineChange],
  );

  const syncToExcel = useCallback(async () => {
    if (!section?.id) throw new Error("No active class is selected.");
    if (browserIsOffline() || !supabase) {
      throw new Error(
        "Excel sync requires a live database connection so every record can be included.",
      );
    }
    const fresh = await loadLiveData(section.id);
    if (!fresh?.live || fresh.sectionId !== section.id) {
      throw new Error(
        "The latest class records could not be loaded for Excel sync.",
      );
    }
    await syncGradeSheetToExcel({
      section: fresh.section,
      students: fresh.students,
      assessmentScores: fresh.assessmentScores,
      assessmentDefinitions: fresh.assessmentDefinitions,
      attendanceSessions: fresh.attendanceSessions,
      gradingPeriods: fresh.periods,
    });
  }, [section, loadLiveData]);

  return { loadTransferPreview, transferStudent, syncToExcel };
}
