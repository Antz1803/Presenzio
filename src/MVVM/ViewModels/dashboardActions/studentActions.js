/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import { useCallback } from "react";
import { db } from "../../../lib/Firebase";
import * as store from "../../../lib/accountDb";
import {
  countOfflineMutations,
  listOfflineMutations,
  readOfflineSnapshot,
  removeOfflineMutation,
  replayOfflineMutation,
} from "../../../lib/offlineStore";

export function useStudentActions(context) {
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
  const addStudent = useCallback(
    async (student) => {
      if (!currentSectionId) throw new Error("No active Firebase section.");
      if (browserIsOffline() || !db) {
        const studentId = createLocalId();
        const enrollmentId = createLocalId();
        const studentRow = {
          id: studentId,
          ...student,
          gender: student.gender || null,
        };
        const enrollment = {
          id: enrollmentId,
          section_id: currentSectionId,
          student_id: studentId,
          ctrl_no: students.length + 1,
          status: "active",
        };
        await queueOfflineChange("add-student", {
          student: studentRow,
          enrollment,
        });
        const fullName = student.full_name || "Unnamed student";
        setStudents((current) => [
          ...current,
          {
            id: enrollmentId,
            studentId,
            ctrlNo: enrollment.ctrl_no,
            name: fullName,
            initials: fullName
              .split(" ")
              .map((part) => part[0])
              .slice(0, 2)
              .join("")
              .toUpperCase(),
            color: "plum",
            number: student.student_no || `CTRL-${enrollment.ctrl_no}`,
            gender: student.gender || "",
            attendance: 0,
            grades: {},
            grade: 0,
            status: "On track",
          },
        ]);
        return;
      }
      await store.addStudent(accountId, currentSectionId, student);
      await loadLiveData(currentSectionId);
    },
    [currentSectionId, loadLiveData, queueOfflineChange, students.length],
  );

  const deleteStudent = useCallback(
    async ({ enrollmentId, sectionId }) => {
      if (!enrollmentId || !sectionId) {
        throw new Error("Student information is incomplete.");
      }
      if (browserIsOffline() || !db) {
        await queueOfflineChange("delete-student", {
          enrollmentId,
          sectionId,
        });
        setStudents((current) =>
          current.filter((item) => item.id !== enrollmentId),
        );
        return;
      }
      await store.deleteEnrollment(accountId, sectionId, enrollmentId);
      await loadLiveData(sectionId);
    },
    [accountId, browserIsOffline, loadLiveData, queueOfflineChange, setStudents],
  );

  const updateStudent = useCallback(
    async ({ studentId, enrollmentId, sectionId, ctrlNo, ...student }) => {
      if (!studentId || !enrollmentId || !sectionId) {
        throw new Error("Student information is incomplete.");
      }
      const studentPayload = {
        id: studentId,
        student_no: String(student.student_no ?? "").trim() || null,
        full_name: String(student.full_name ?? "").trim(),
        gender: student.gender || null,
        course: String(student.course ?? "").trim() || null,
        year_level: String(student.year_level ?? "").trim() || null,
        contact_no: String(student.contact_no ?? "").trim() || null,
        email: String(student.email ?? "").trim() || null,
        photo_url: student.photo_url || null,
      };
      if (!studentPayload.full_name) throw new Error("Full name is required.");
      const nextCtrlNo = Number(ctrlNo);
      if (!Number.isInteger(nextCtrlNo) || nextCtrlNo < 1) {
        throw new Error("Control number must be a positive whole number.");
      }
      if (browserIsOffline() || !db) {
        await queueOfflineChange("update-student", {
          student: studentPayload,
          enrollment: {
            id: enrollmentId,
            section_id: sectionId,
            ctrl_no: nextCtrlNo,
          },
        });
        setStudents((current) =>
          current.map((item) =>
            item.id === enrollmentId
              ? {
                  ...item,
                  ctrlNo: nextCtrlNo,
                  name: studentPayload.full_name,
                  number: studentPayload.student_no || `CTRL-${nextCtrlNo}`,
                  gender: studentPayload.gender || "",
                  course: studentPayload.course || "",
                  yearLevel: studentPayload.year_level || "",
                  contactNo: studentPayload.contact_no || "",
                  email: studentPayload.email || "",
                  photoUrl: studentPayload.photo_url || "",
                }
              : item,
          ),
        );
        return;
      }
      await store.updateStudent(accountId, {
        student: studentPayload,
        sectionId,
        enrollmentId,
        ctrlNo: nextCtrlNo,
      });
      await loadLiveData(sectionId);
    },
    [accountId, browserIsOffline, loadLiveData, queueOfflineChange, setStudents],
  );

  return { addStudent, updateStudent, deleteStudent };
}
