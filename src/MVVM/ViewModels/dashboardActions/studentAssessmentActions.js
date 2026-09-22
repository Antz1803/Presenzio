/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import { useCallback } from "react";
import { supabase } from "../../../lib/supabaseClient";
import {
  countOfflineMutations,
  listOfflineMutations,
  readOfflineSnapshot,
  removeOfflineMutation,
  replayOfflineMutation,
} from "../../../lib/offlineStore";

export function useStudentAssessmentActions(context) {
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
  const loadStudentAssessment = useCallback(
    async ({ accessKey, studentNumber }) => {
      const normalizedKey = accessKey?.trim().toUpperCase();
      const normalizedStudentNumber = studentNumber?.trim();
      if (!normalizedKey) throw new Error("Enter the Assessment Key ID.");
      if (!normalizedStudentNumber)
        throw new Error("Enter your student ID number.");

      const lanResult = await callLanApi(
        `/api/student-assessment?accessKey=${encodeURIComponent(normalizedKey)}&studentNumber=${encodeURIComponent(normalizedStudentNumber)}`,
      );
      if (lanResult) return lanResult;

      if (browserIsOffline() || !supabase) {
        const cachedSections =
          (await readOfflineSnapshot("sections")) ?? sections;
        const cachedSnapshots = await Promise.all(
          cachedSections.map((item) =>
            readOfflineSnapshot(`section:${item.id}`),
          ),
        );
        const cachedAssessment = cachedSnapshots
          .flatMap((snapshot) => snapshot?.assessmentDefinitions ?? [])
          .find((item) => item.access_key?.toUpperCase() === normalizedKey);
        if (!cachedAssessment)
          throw new Error("Assessment Key ID not found offline.");
        const cachedSection =
          cachedSections.find(
            (item) => item.id === cachedAssessment.section_id,
          ) ?? cachedAssessment.section;
        const cachedSnapshot =
          cachedSnapshots.find(
            (snapshot) => snapshot?.section?.id === cachedAssessment.section_id,
          ) ?? null;
        const cachedStudent = (cachedSnapshot?.students ?? students).find(
          (item) => String(item.number).trim() === normalizedStudentNumber,
        );
        if (!cachedStudent)
          throw new Error("Student ID number not found offline.");
        return {
          assessment: {
            ...cachedAssessment,
            section: cachedSection,
          },
          enrollmentId: cachedStudent.id,
          attemptsUsed: 0,
          attemptsRemaining: 1,
          attemptNumber: 1,
          attemptLimit: 1,
          availableFrom: cachedAssessment.available_from || null,
          availableUntil: cachedAssessment.available_until || null,
          serverNow: new Date().toISOString(),
          student: {
            id: cachedStudent.studentId ?? cachedStudent.id,
            number: cachedStudent.number,
            name: cachedStudent.name,
          },
        };
      }

      let { data: assessment, error: assessmentError } = await supabase
        .from("assessments")
        .select(
          "id, section_id, period_id, category, item_no, access_key, title, instructions, time_limit_minutes, available_from, available_until, created_at, period:grading_periods(code), section:sections(id, subject_code, subject_title), questions:assessment_questions(id, question_no, question_type, prompt, points, choices, correct_answer, language, starter_code, expected_output, near_match_score_percent, incorrect_score_percent)",
        )
        .eq("access_key", normalizedKey)
        .maybeSingle();
      if (assessmentError) {
        const fallbackAssessment = await supabase
          .from("assessments")
          .select(
            "id, section_id, period_id, category, item_no, access_key, title, instructions, created_at, period:grading_periods(code), section:sections(id, subject_code, subject_title), questions:assessment_questions(id, question_no, question_type, prompt, points, choices, correct_answer, language, starter_code, expected_output, near_match_score_percent, incorrect_score_percent)",
          )
          .eq("access_key", normalizedKey)
          .maybeSingle();
        if (fallbackAssessment.error) throw assessmentError;
        assessment = fallbackAssessment.data
          ? {
              ...fallbackAssessment.data,
              time_limit_minutes: null,
              available_from: null,
              available_until: null,
            }
          : null;
      }
      if (!assessment) throw new Error("Assessment Key ID not found.");

      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("id, student_no, full_name")
        .eq("student_no", normalizedStudentNumber)
        .maybeSingle();
      if (studentError) throw studentError;
      if (!student) throw new Error("Student ID number not found.");

      const { data: enrollment, error: enrollmentError } = await supabase
        .from("enrollments")
        .select("id")
        .eq("section_id", assessment.section_id)
        .eq("student_id", student.id)
        .maybeSingle();
      if (enrollmentError) throw enrollmentError;
      if (!enrollment)
        throw new Error(
          "This student is not enrolled in the assessment class.",
        );

      const { data: grantRow } = await supabase
        .from("assessment_attempt_grants")
        .select("extra_attempts")
        .eq("assessment_id", assessment.id)
        .eq("student_id", student.id)
        .maybeSingle();
      const grantedAttempts = Math.max(
        0,
        Number(grantRow?.extra_attempts || 0),
      );
      assessment = {
        ...assessment,
        attemptGrants: grantRow ? [grantRow] : [],
      };
      const { count: attemptCount, error: attemptCountError } = await supabase
        .from("assessment_attempts")
        .select("id", { count: "exact", head: true })
        .eq("assessment_id", assessment.id)
        .eq("student_id", student.id);
      if (!attemptCountError) {
        const attemptsUsed = attemptCount || 0;
        const attemptLimit = 1 + grantedAttempts;
        if (attemptsUsed >= attemptLimit) {
          throw new Error(
            `You have used all ${attemptLimit} allowed attempt${attemptLimit === 1 ? "" : "s"}.`,
          );
        }
        const now = Date.now();
        const availableFrom = assessment.available_from
          ? Date.parse(assessment.available_from)
          : NaN;
        const availableUntil = assessment.available_until
          ? Date.parse(assessment.available_until)
          : NaN;
        if (Number.isFinite(availableFrom) && now < availableFrom)
          throw new Error("This assessment is not open yet.");
        if (Number.isFinite(availableUntil) && now > availableUntil)
          throw new Error("The answer time for this assessment has ended.");
        return {
          assessment,
          enrollmentId: enrollment.id,
          attemptsUsed,
          attemptsRemaining: attemptLimit - attemptsUsed,
          attemptNumber: attemptsUsed + 1,
          attemptLimit,
          availableFrom: assessment.available_from || null,
          availableUntil: assessment.available_until || null,
          serverNow: new Date().toISOString(),
          student: {
            id: student.id,
            number: student.student_no,
            name: student.full_name,
          },
        };
      }

      return {
        assessment,
        enrollmentId: enrollment.id,
        attemptsUsed: 0,
        attemptsRemaining: 1 + grantedAttempts,
        attemptNumber: 1,
        attemptLimit: 1 + grantedAttempts,
        availableFrom: assessment.available_from || null,
        availableUntil: assessment.available_until || null,
        serverNow: new Date().toISOString(),
        student: {
          id: student.id,
          number: student.student_no,
          name: student.full_name,
        },
      };
    },
    [sections, students],
  );

  return { loadStudentAssessment };
}
