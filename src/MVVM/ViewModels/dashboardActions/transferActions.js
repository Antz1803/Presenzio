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
    sections,
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

  const syncAllToExcel = useCallback(
    async ({ onProgress } = {}) => {
      if (!sections?.length) throw new Error("No classes are available to sync.");
      if (browserIsOffline() || !db) {
        throw new Error("Excel sync requires a live Firebase connection.");
      }

      let directoryHandle = null;
      if (typeof window !== "undefined" && "showDirectoryPicker" in window) {
        try {
          directoryHandle = await window.showDirectoryPicker({ mode: "readwrite" });
        } catch (error) {
          if (error?.name === "AbortError") return { cancelled: true, total: 0, results: [] };
          throw error;
        }
      }

      const originalSectionId = section?.id || currentSectionId;
      const results = [];

      for (let index = 0; index < sections.length; index += 1) {
        const classSection = sections[index];
        onProgress?.({ completed: index, total: sections.length, section: classSection });

        try {
          const fresh = await loadLiveData(classSection.id);
          if (!fresh?.live || fresh.sectionId !== classSection.id) {
            throw new Error("The latest class records could not be loaded.");
          }

          await syncGradeSheetToExcel({
            section: fresh.section,
            instructor: { name: instructorName },
            students: fresh.students,
            assessmentScores: fresh.assessmentScores,
            assessmentDefinitions: fresh.assessmentDefinitions,
            attendanceSessions: fresh.attendanceSessions,
            gradingPeriods: fresh.periods,
            useFilePicker: false,
            directoryHandle,
          });
          results.push({ section: classSection, ok: true });
        } catch (error) {
          results.push({ section: classSection, ok: false, error });
        }
      }

      onProgress?.({ completed: sections.length, total: sections.length });

      // Loading each class updates the dashboard selection. Restore the class
      // the instructor had open before starting the batch export.
      if (originalSectionId && originalSectionId !== sections.at(-1)?.id) {
        await loadLiveData(originalSectionId);
      }

      const failed = results.filter((result) => !result.ok);
      if (failed.length) {
        const failedNames = failed
          .map((result) => result.section.subject_code || result.section.subject_title || result.section.id)
          .join(", ");
        const error = new Error(
          `${results.length - failed.length} of ${results.length} class files synced. Failed: ${failedNames}.`,
        );
        error.results = results;
        throw error;
      }

      return { total: results.length, results };
    },
    [
      browserIsOffline,
      currentSectionId,
      instructorName,
      loadLiveData,
      section,
      sections,
    ],
  );

  return { loadTransferPreview, transferStudent, syncToExcel, syncAllToExcel };
}
