/* Firebase-backed student assessment access. */
import { useCallback } from "react";
import * as store from "../../../lib/accountDb";
import { readOfflineSnapshot } from "../../../lib/offlineStore";

export function useStudentAssessmentActions(context) {
  const { accountId, sections, students, helpers } = context;
  const { browserIsOffline } = helpers;
  const loadStudentAssessment = useCallback(
    async ({ accessKey, studentNumber }) => {
      const normalizedKey = accessKey?.trim().toUpperCase();
      const normalizedStudentNumber = studentNumber?.trim();
      if (!normalizedKey) throw new Error("Enter the Assessment Key ID.");
      if (!normalizedStudentNumber) throw new Error("Enter your student ID number.");
      if (browserIsOffline()) {
        const cachedSections = (await readOfflineSnapshot("sections")) ?? sections;
        const cachedSnapshots = await Promise.all(
          cachedSections.map((item) => readOfflineSnapshot(`section:${item.id}`)),
        );
        const cachedAssessment = cachedSnapshots
          .flatMap((snapshot) => snapshot?.assessmentDefinitions ?? [])
          .find((item) => item.access_key?.toUpperCase() === normalizedKey);
        if (!cachedAssessment) throw new Error("Assessment Key ID not found offline.");
        const cachedSection = cachedSections.find((item) => item.id === cachedAssessment.section_id) ?? cachedAssessment.section;
        const cachedSnapshot = cachedSnapshots.find((snapshot) => snapshot?.section?.id === cachedAssessment.section_id);
        const cachedStudent = (cachedSnapshot?.students ?? students).find((item) => String(item.number).trim() === normalizedStudentNumber);
        if (!cachedStudent) throw new Error("Student ID number not found offline.");
        return {
          assessment: { ...cachedAssessment, section: cachedSection },
          enrollmentId: cachedStudent.id,
          attemptsUsed: 0,
          attemptsRemaining: 1,
          attemptNumber: 1,
          attemptLimit: 1,
          availableFrom: cachedAssessment.available_from || null,
          availableUntil: cachedAssessment.available_until || null,
          serverNow: new Date().toISOString(),
          student: { id: cachedStudent.studentId ?? cachedStudent.id, number: cachedStudent.number, name: cachedStudent.name },
        };
      }
      if (!accountId) {
        const publicPayload = await store.readPublicAssessment(normalizedKey);
        if (!publicPayload?.assessment) throw new Error("Assessment Key ID not found.");
        const publicStudent = Object.values(publicPayload.students ?? {}).find(
          (student) => String(student.number ?? "").trim() === normalizedStudentNumber,
        );
        if (!publicStudent) throw new Error("Student ID number not found in this assessment class.");
        const previousSubmission = await store.readPublicSubmission(
          normalizedKey,
          publicStudent.id,
        );
        const publicQuestions = Object.values(publicPayload.questions ?? {})
          .map((question) => ({
            ...question,
            assessment_id: publicPayload.assessment.id,
            choices: question.choices ?? [],
          }))
          .sort((a, b) => Number(a.question_no) - Number(b.question_no));
        return {
          assessment: {
            ...publicPayload.assessment,
            period: { code: publicPayload.assessment.period_id },
            section: publicPayload.section,
            questions: publicQuestions,
            public_access_key: normalizedKey,
            attemptGrants: [],
          },
          enrollmentId: publicStudent.enrollmentId,
          attemptsUsed: previousSubmission ? 1 : 0,
          attemptsRemaining: previousSubmission ? 0 : 1,
          attemptNumber: previousSubmission ? 2 : 1,
          attemptLimit: 1,
          availableFrom: publicPayload.assessment.available_from || null,
          availableUntil: publicPayload.assessment.available_until || null,
          serverNow: new Date().toISOString(),
          student: {
            id: publicStudent.id,
            number: publicStudent.number,
            name: publicStudent.name,
          },
          previousSubmission,
        };
      }
      const sectionList = await store.listSections(accountId);
      const studentsMap = (await store.read(accountId, "students")) ?? {};
      for (const section of sectionList) {
        const data = (await store.read(accountId, store.sec(section.id))) ?? {};
        const assessment = store.rows(data.assessments).find((item) => item.access_key?.toUpperCase() === normalizedKey);
        if (!assessment) continue;
        const enrollmentEntry = Object.entries((await store.read(accountId, `enrollments/${section.id}`)) ?? {}).find(([, enrollment]) => {
          const student = studentsMap[enrollment.student_id] ?? {};
          return String(student.number ?? student.student_no ?? "").trim() === normalizedStudentNumber;
        });
        if (!enrollmentEntry) throw new Error("This student is not enrolled in the assessment class.");
        const [enrollmentId, enrollment] = enrollmentEntry;
        const student = studentsMap[enrollment.student_id];
        const assessmentWithQuestions = {
          ...assessment,
          section_id: section.id,
          period: { code: assessment.period_id },
          section: { id: section.id, subject_code: section.subject_code, subject_title: section.subject_title },
          questions: store.rows(data.questions?.[assessment.id]).map((question) => ({ ...question, assessment_id: assessment.id, choices: question.choices ?? [] })).sort((a, b) => Number(a.question_no) - Number(b.question_no)),
        };
        const grant = data.grants?.[assessment.id]?.[student.id];
        const grantedAttempts = Math.max(0, Number(grant?.extra_attempts || 0));
        const attempts = store.rows(data.attempts?.[assessment.id]).filter((attempt) => String(attempt.student_id) === String(student.id));
        const attemptsUsed = attempts.length;
        const attemptLimit = 1 + grantedAttempts;
        if (attemptsUsed >= attemptLimit) throw new Error(`You have used all ${attemptLimit} allowed attempt${attemptLimit === 1 ? "" : "s"}.`);
        const availableFrom = assessment.available_from ? Date.parse(assessment.available_from) : NaN;
        const availableUntil = assessment.available_until ? Date.parse(assessment.available_until) : NaN;
        if (Number.isFinite(availableFrom) && Date.now() < availableFrom) throw new Error("This assessment is not open yet.");
        if (Number.isFinite(availableUntil) && Date.now() > availableUntil) throw new Error("The answer time for this assessment has ended.");
        return {
          assessment: { ...assessmentWithQuestions, attemptGrants: grant ? [{ ...grant, student_id: student.id }] : [] },
          enrollmentId,
          attemptsUsed,
          attemptsRemaining: attemptLimit - attemptsUsed,
          attemptNumber: attemptsUsed + 1,
          attemptLimit,
          availableFrom: assessment.available_from || null,
          availableUntil: assessment.available_until || null,
          serverNow: new Date().toISOString(),
          student: { id: student.id, number: student.number ?? student.student_no, name: student.name ?? student.full_name },
        };
      }
      throw new Error("Assessment Key ID not found.");
    },
    [accountId, sections, students, browserIsOffline],
  );

  return { loadStudentAssessment };
}
