import { useCallback } from "react";
import { db } from "../../../lib/Firebase";
import * as store from "../../../lib/accountDb";
import { syncGradeSheetToExcel } from "../syncGradeSheetToExcelPreservingTemplate";
import {
  readExcelHandle,
  requestExcelWritePermission,
  writeExcelHandle,
} from "../excelFileHandleStorage";

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
    const removedOrphanedScores = await store.removeOrphanedAssessmentScores(
      accountId,
      section.id,
      fresh.students.map((student) => student.id),
    );
    const synced = removedOrphanedScores
      ? await loadLiveData(section.id)
      : fresh;
    if (!synced?.live || synced.sectionId !== section.id) {
      throw new Error("The latest class records could not be reloaded after cleanup.");
    }
    await syncGradeSheetToExcel({
      section: synced.section,
      instructor: { name: instructorName },
      students: synced.students,
      assessmentScores: synced.assessmentScores,
      assessmentDefinitions: synced.assessmentDefinitions,
      attendanceSessions: synced.attendanceSessions,
      gradingPeriods: synced.periods,
    });
    return { removedOrphanedScores: removedOrphanedScores.length };
  }, [accountId, browserIsOffline, instructorName, loadLiveData, section]);

  const syncAllToExcel = useCallback(
    async ({ onProgress } = {}) => {
      if (!sections?.length) throw new Error("No classes are available to sync.");
      if (browserIsOffline() || !db) {
        throw new Error("Excel sync requires a live Firebase connection.");
      }

      let directoryHandle = null;
      if (typeof window !== "undefined" && "showDirectoryPicker" in window) {
        try {
          const savedDirectoryHandle = await readExcelHandle("directory");
          if (
            savedDirectoryHandle &&
            (await requestExcelWritePermission(savedDirectoryHandle))
          ) {
            directoryHandle = savedDirectoryHandle;
          } else {
            directoryHandle = await window.showDirectoryPicker({ mode: "readwrite" });
            await writeExcelHandle("directory", directoryHandle);
          }
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

          const removedOrphanedScores = await store.removeOrphanedAssessmentScores(
            accountId,
            classSection.id,
            fresh.students.map((student) => student.id),
          );
          const synced = removedOrphanedScores
            ? await loadLiveData(classSection.id)
            : fresh;
          if (!synced?.live || synced.sectionId !== classSection.id) {
            throw new Error("The latest class records could not be reloaded after cleanup.");
          }

          await syncGradeSheetToExcel({
            section: synced.section,
            instructor: { name: instructorName },
            students: synced.students,
            assessmentScores: synced.assessmentScores,
            assessmentDefinitions: synced.assessmentDefinitions,
            attendanceSessions: synced.attendanceSessions,
            gradingPeriods: synced.periods,
            // If directory access is unavailable, use the save picker so the
            // user can select the existing workbook instead of triggering a
            // browser download that gets renamed to "(1)".
            useFilePicker: !directoryHandle,
            directoryHandle,
          });
          results.push({
            section: classSection,
            ok: true,
            removedOrphanedScores: removedOrphanedScores.length,
            removedOrphanedStudentNames: removedOrphanedScores.map(
              (item) => item.studentName,
            ),
          });
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
          .map((result) => {
            const name =
              result.section.subject_code || result.section.subject_title || result.section.id;
            const reason = result.error?.message || "unknown error";
            return `${name} (${reason})`;
          })
          .join("; ");
        const error = new Error(
          `${results.length - failed.length} of ${results.length} class files synced. Failed: ${failedNames}.`,
        );
        error.results = results;
        throw error;
      }

      return { total: results.length, results };
    },
    [
      accountId,
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
