/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import { countOfflineMutations, enqueueOfflineMutation, writeOfflineSnapshot } from "../../lib/offlineStore";
import { useDashboardActions } from "./useDashboardActions";

export function useDashboardCoordinator(context) {
  const { accountId, accountScoped, currentSectionId, period, section, sections, students, gradeRows, gradingPeriods, assessmentScores, assessmentDefinitions, studentGroups, assessmentAttempts, assessmentAttemptGrants, assessmentViolations, attendanceSessions, sessions, stats, loadLiveData, clearLiveData, setSection, setSections, setStudents, setGradingPeriods, setAssessmentScores, setAssessmentDefinitions, setStudentGroups, setAssessmentAttempts, setAssessmentAttemptGrants, setAssessmentViolations, setAttendanceSessions, setConnectionStatus, setConnectionMessage, setPendingSyncCount, setImportState, setGradeSheetImportState, helpers } = context;
  const { answerSimilarity, assessmentItemLimits, average, browserIsOffline, callLanApi, createAssessmentAccessKey, createLocalId, formatShortDate, gradingWeights, isNetworkError, serializeAssessmentDate, transmutePercentage } = helpers;

  const reloadTimerRef = useRef(null);
  const scheduleReload = useCallback(() => {
    clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = setTimeout(() => {
      reloadTimerRef.current = null;
      void loadLiveData(currentSectionId);
    }, 300);
  }, [currentSectionId, loadLiveData]);

  useEffect(() => {
    const persistSections = setTimeout(() => {
      if (sections.length) void writeOfflineSnapshot("sections", sections);
    }, 250);
    return () => clearTimeout(persistSections);
  }, [sections]);

  useEffect(() => {
    if (!section?.id) return undefined;
    const persistSnapshot = setTimeout(() => {
      void writeOfflineSnapshot(`section:${section.id}`, {
        section,
        sections,
        students,
        gradeRows,
        gradingPeriods,
        assessmentScores,
        assessmentDefinitions,
        studentGroups,
        assessmentAttempts,
        assessmentAttemptGrants,
        assessmentViolations,
        attendanceSessions,
        sessions,
        stats,
      });
    }, 250);
    return () => clearTimeout(persistSnapshot);
  }, [
    section,
    sections,
    students,
    gradeRows,
    gradingPeriods,
    assessmentScores,
    assessmentDefinitions,
    studentGroups,
    assessmentAttempts,
    assessmentAttemptGrants,
    assessmentViolations,
    attendanceSessions,
    sessions,
    stats,
  ]);

  useEffect(() => {
    if (!accountScoped || !accountId) return undefined;
    const timer = setTimeout(() => loadLiveData(), 0);
    return () => clearTimeout(timer);
  }, [accountId, accountScoped, loadLiveData]);

  const queueOfflineChange = useCallback(async (type, payload) => {
    await enqueueOfflineMutation(type, payload);
    setPendingSyncCount(await countOfflineMutations());
    setConnectionStatus("offline");
    setConnectionMessage("Offline · saved locally; waiting to sync");
    return { queued: true };
  }, []);

  useEffect(() => {
    if (!accountScoped || !accountId || !supabase || !currentSectionId) return undefined;
    const channel = supabase
      .channel("section-" + currentSectionId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "period_grades",
          filter: "section_id=eq." + currentSectionId,
        },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "assessment_scores",
          filter: "section_id=eq." + currentSectionId,
        },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "class_sessions",
          filter: "section_id=eq." + currentSectionId,
        },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_records" },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "student_groups",
          filter: "section_id=eq." + currentSectionId,
        },
        scheduleReload,
      )
      .subscribe();
    return () => {
      clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [accountId, accountScoped, currentSectionId, scheduleReload]);

  const {
    selectSection, saveGradingPeriods, importMasterList, syncToExcel,
    refreshGrades, importGradeSheet, saveAttendance,
    saveGrades, saveAssessmentScores, saveAssessment, updateAssessment,
    deleteAssessment, saveStudentGroup, deleteStudentGroup,
    grantAssessmentAttempt, loadStudentAssessment,
    submitAssessment, addStudent, updateStudent, transferStudent, loadTransferPreview,
    updateSection, deleteSection,
    flushOfflineMutations,
  } = useDashboardActions({
    accountId, accountScoped, currentSectionId, period, section, sections, students,
    gradingPeriods, assessmentScores, assessmentDefinitions, studentGroups, attendanceSessions,
    loadLiveData, clearLiveData, queueOfflineChange, setSection, setSections,
    setStudents,
    setGradingPeriods, setAssessmentScores, setAssessmentDefinitions, setStudentGroups, setAssessmentAttemptGrants,
    setAttendanceSessions, setConnectionStatus, setConnectionMessage,
    setPendingSyncCount, setImportState, setGradeSheetImportState,
    helpers: {
      answerSimilarity, assessmentItemLimits, average, browserIsOffline, callLanApi,
      createAssessmentAccessKey, createLocalId, formatShortDate, gradingWeights,
      isNetworkError, serializeAssessmentDate, transmutePercentage,
    },
  });

  useEffect(() => {
    if (!accountScoped || !accountId) return undefined;
    const handleOffline = () => {
      setConnectionStatus("offline");
      setConnectionMessage("Offline · changes will be saved locally");
    };
    const handleOnline = () => {
      setConnectionStatus("connecting");
      setConnectionMessage("Online · syncing saved changes…");
      void flushOfflineMutations().then(() => loadLiveData(currentSectionId));
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    void countOfflineMutations().then(setPendingSyncCount);
    const syncTimer = setTimeout(() => {
      if (!browserIsOffline()) void flushOfflineMutations();
    }, 0);
    return () => {
      clearTimeout(syncTimer);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [accountId, accountScoped, currentSectionId, flushOfflineMutations, loadLiveData]);

  return { selectSection, saveGradingPeriods, importMasterList, syncToExcel, refreshGrades, importGradeSheet, saveAttendance, saveGrades, saveAssessmentScores, saveAssessment, updateAssessment, deleteAssessment, saveStudentGroup, deleteStudentGroup, grantAssessmentAttempt, loadStudentAssessment, submitAssessment, addStudent, updateStudent, transferStudent, loadTransferPreview, updateSection, deleteSection, flushOfflineMutations };
}