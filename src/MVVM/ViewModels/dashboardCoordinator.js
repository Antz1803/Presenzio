/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useEffect, useRef } from "react";
import { onValue, ref } from "firebase/database";
import { db } from "../../lib/Firebase";
import {
  countOfflineMutations,
  enqueueOfflineMutation,
  writeOfflineSnapshot,
} from "../../lib/offlineStore";
import { useDashboardActions } from "./useDashboardActions";

export function useDashboardCoordinator(context) {
  const {
    accountId,
    instructorName,
    accountScoped,
    currentSectionId,
    period,
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
    loadLiveData,
    clearLiveData,
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
    if (!accountScoped || !accountId || !db || !currentSectionId)
      return undefined;
    let initial = true;
    const unsubscribe = onValue(
      ref(db, `accounts/${accountId}/sectionData/${currentSectionId}`),
      () => {
        if (initial) {
          initial = false;
          return;
        }
        scheduleReload();
      },
    );
    return () => {
      clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = null;
      unsubscribe();
    };
  }, [accountId, accountScoped, currentSectionId, scheduleReload]);

  const {
    selectSection,
    saveGradingPeriods,
    importMasterList,
    syncToExcel,
    syncAllToExcel,
    refreshGrades,
    importGradeSheet,
    saveAttendance,
    deleteAttendance,
    saveGrades,
    saveAssessmentScores,
    saveAssessment,
    updateAssessment,
    deleteAssessment,
    saveStudentGroup,
    deleteStudentGroup,
    updateStudentGroup,
    grantAssessmentAttempt,
    loadStudentAssessment,
    submitAssessment,
    addStudent,
    updateStudent,
    deleteStudent,
    transferStudent,
    loadTransferPreview,
    updateSection,
    deleteSection,
    flushOfflineMutations,
  } = useDashboardActions({
    accountId,
    instructorName,
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
    helpers: {
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
  }, [
    accountId,
    accountScoped,
    currentSectionId,
    flushOfflineMutations,
    loadLiveData,
  ]);

  return {
    selectSection,
    saveGradingPeriods,
    importMasterList,
    syncToExcel,
    syncAllToExcel,
    refreshGrades,
    importGradeSheet,
    saveAttendance,
    deleteAttendance,
    saveGrades,
    saveAssessmentScores,
    saveAssessment,
    updateAssessment,
    deleteAssessment,
    saveStudentGroup,
    deleteStudentGroup,
    updateStudentGroup,
    grantAssessmentAttempt,
    loadStudentAssessment,
    submitAssessment,
    addStudent,
    updateStudent,
    deleteStudent,
    transferStudent,
    loadTransferPreview,
    updateSection,
    deleteSection,
    flushOfflineMutations,
  };
}
