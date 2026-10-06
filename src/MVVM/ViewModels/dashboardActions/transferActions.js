import { useCallback } from "react";
import { db } from "../../../lib/Firebase";
import * as store from "../../../lib/accountDb";
import { syncGradeSheetToExcel } from "../syncGradeSheetToExcelPreservingTemplate";

export function useTransferActions(context) {
  const {
    accountId,
    instructorName,
    currentSectionId,
    section,
    loadLiveData,
    queueOfflineChange,
    setStudents,
    setAssessmentScores,
    helpers,
  } = context;
  const { browserIsOffline } = helpers;

  const loadTransferPreview = useCallback(
    ({ enrollmentId, fromSectionId, toSectionId }) => {
      if (!accountId) throw new Error("No Firebase account is signed in.");
      return store.getTransferPreview(accountId, enrollmentId, fromSectionId, toSectionId);
    },
    [accountId],
  );

  const transferStudent = useCallback(
    async ({ enrollmentId, studentId, fromSectionId, toSectionId, attendanceEntries = [] }) => {
      if (!enrollmentId || !studentId) throw new Error("Student information is incomplete.");
      if (!toSectionId) throw new Error("Select a class to transfer to.");
      if (toSectionId === fromSectionId) throw new Error("This student is already in that class.");
      if (browserIsOffline() || !db) {
        await queueOfflineChange("transfer-student", {
          enrollmentId, studentId, fromSectionId, toSectionId, attendanceEntries,
        });
        if (fromSectionId === currentSectionId) {
          setStudents((current) => current.filter((item) => item.id !== enrollmentId));
          setAssessmentScores((current) => current.filter((row) => row.enrollment_id !== enrollmentId));
        }
        return { attendanceRecorded: 0, offline: true };
      }
      const attendanceRecorded = await store.transferStudent(accountId, {
        enrollmentId, studentId, fromSectionId, toSectionId, attendanceEntries,
      });
      await loadLiveData(fromSectionId);
      return { attendanceRecorded, offline: false };
    },
    [
      accountId,
      browserIsOffline,
      currentSectionId,
      loadLiveData,
      queueOfflineChange,
      setAssessmentScores,
      setStudents,
    ],
  );

  const syncToExcel = useCallback(async () => {
    if (!section?.id) throw new Error("No active class is selected.");
    if (browserIsOffline() || !db) throw new Error("Excel sync requires a live Firebase connection.");
    const fresh = await loadLiveData(section.id);
    if (!fresh?.live || fresh.sectionId !== section.id) {
      throw new Error("The latest class records could not be loaded for Excel sync.");
    }
    await syncGradeSheetToExcel({
      section: fresh.section,
      instructor: { name: instructorName },
      students: fresh.students,
      assessmentScores: fresh.assessmentScores,
      assessmentDefinitions: fresh.assessmentDefinitions,
      attendanceSessions: fresh.attendanceSessions,
      gradingPeriods: fresh.periods,
    });
  }, [browserIsOffline, instructorName, loadLiveData, section]);

  return { loadTransferPreview, transferStudent, syncToExcel };
}
