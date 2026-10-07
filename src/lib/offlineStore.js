const DATABASE_NAME = "presenzio-offline";
const DATABASE_VERSION = 1;
const SNAPSHOTS = "snapshots";
const MUTATIONS = "mutations";
let databasePromise;

function openDatabase() {
  if (databasePromise) return databasePromise;
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SNAPSHOTS)) {
        database.createObjectStore(SNAPSHOTS, { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains(MUTATIONS)) {
        const store = database.createObjectStore(MUTATIONS, { keyPath: "id" });
        store.createIndex("created_at", "createdAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch(() => null);
  return databasePromise;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function writeOfflineSnapshot(key, value) {
  const database = await openDatabase();
  if (!database) return;
  const transaction = database.transaction(SNAPSHOTS, "readwrite");
  transaction.objectStore(SNAPSHOTS).put({ key, value, savedAt: Date.now() });
  await transactionComplete(transaction);
}

export async function readOfflineSnapshot(key) {
  const database = await openDatabase();
  if (!database) return null;
  const transaction = database.transaction(SNAPSHOTS, "readonly");
  return (await requestResult(transaction.objectStore(SNAPSHOTS).get(key)))?.value ?? null;
}

export async function enqueueOfflineMutation(type, payload) {
  const database = await openDatabase();
  if (!database) throw new Error("This browser does not support offline storage.");
  const mutation = {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    type,
    payload,
    createdAt: Date.now(),
  };
  const transaction = database.transaction(MUTATIONS, "readwrite");
  transaction.objectStore(MUTATIONS).put(mutation);
  await transactionComplete(transaction);
  return mutation;
}

export async function listOfflineMutations() {
  const database = await openDatabase();
  if (!database) return [];
  const transaction = database.transaction(MUTATIONS, "readonly");
  return (await requestResult(transaction.objectStore(MUTATIONS).getAll())).sort(
    (a, b) => a.createdAt - b.createdAt,
  );
}

export async function removeOfflineMutation(id) {
  const database = await openDatabase();
  if (!database) return;
  const transaction = database.transaction(MUTATIONS, "readwrite");
  transaction.objectStore(MUTATIONS).delete(id);
  await transactionComplete(transaction);
}

export async function countOfflineMutations() {
  const database = await openDatabase();
  if (!database) return 0;
  const transaction = database.transaction(MUTATIONS, "readonly");
  return requestResult(transaction.objectStore(MUTATIONS).count());
}

import * as store from "./accountDb";

export async function replayOfflineMutation({ uid, mutation, importMasterList, importGradeSheet }) {
  const { type, payload: e } = mutation;

  switch (type) {
    case "import-master-list":
      return importMasterList(e.file);
    case "import-grade-sheet":
      return importGradeSheet(e.file);

    case "save-grading-periods":
      return void (await store.saveGradingPeriods(uid, e.rows));

    case "save-attendance":
      await store.saveAttendance(uid, e.sectionId, {
        sessionId: e.sessionId,
        periodId: e.periodCode,
        date: e.date,
        sessionTime: e.sessionTime,
        statuses: e.statuses,
      });
      return { sectionId: e.sectionId, periodId: e.periodCode };

    case "delete-attendance":
      await store.deleteSession(uid, e.sectionId, e.sessionId ?? `${e.date}_${e.sessionTime}`);
      return { sectionId: e.sectionId };

    case "save-grades":
      await store.upsertPeriodGrades(
        uid, e.sectionId, e.rows.map((r) => ({ ...r, period_id: e.periodCode })),
      );
      return { sectionId: e.sectionId, periodId: e.periodCode };

    case "save-assessment-scores":
      await store.replaceCategoryScores(
        uid, e.sectionId, e.periodCode, e.category,
        e.rows.map((r) => ({ ...r, period_id: e.periodCode })),
      );
      return { sectionId: e.sectionId, periodId: e.periodCode };

    case "add-student":
      await store.addStudent(uid, e.enrollment.section_id, e.student, {
        enrollmentId: e.enrollment.id,
        ctrlNo: e.enrollment.ctrl_no,
      });
      return { sectionId: e.enrollment.section_id };

    case "update-student":
      await store.updateStudent(uid, {
        student: e.student,
        sectionId: e.enrollment.section_id,
        enrollmentId: e.enrollment.id,
        ctrlNo: e.enrollment.ctrl_no,
      });
      return { sectionId: e.enrollment.section_id };

    case "delete-student":
      await store.deleteEnrollment(uid, e.sectionId, e.enrollmentId);
      return { sectionId: e.sectionId };

    case "transfer-student":
      await store.transferStudent(uid, e);
      return { sectionId: e.fromSectionId };

    case "update-section":
      await store.updateSection(uid, e.sectionId, e.changes);
      return { sectionId: e.sectionId };

    case "delete-section":
      await store.deleteSection(uid, e.sectionId);
      return { sectionId: e.sectionId };

    case "save-student-group": {
      const g = e.group;
      await store.saveStudentGroup(uid, e.sectionId, {
        id: g.id, label: g.label, groupCount: g.group_count, assignments: g.assignments,
        category: g.category, period: g.period_code, itemNo: g.item_no, maxScore: g.max_score,
      });
      return { sectionId: e.sectionId };
    }
    case "update-student-group":
      await store.updateStudentGroup(uid, e.sectionId, e.groupId, {
        label: e.label,
        assignments: e.assignments,
        groupCount: e.groupCount,
        category: e.category,
        period: e.period,
        itemNo: e.itemNo,
        maxScore: e.maxScore,
      });
      return { sectionId: e.sectionId };
    case "delete-student-group":
      await store.deleteStudentGroup(
        uid, e.sectionId, e.groupId,
        e.clearScores
          ? { periodId: e.clearScores.periodCode, category: e.clearScores.category, itemNo: e.clearScores.itemNo }
          : null,
      );
      return { sectionId: e.sectionId };

    case "save-assessment":
      await store.createAssessment(uid, {
        assessment: e.assessment, questions: e.questions, scoreRows: e.scoreRows,
      });
      return { sectionId: e.assessment.section_id, periodId: e.assessment.period_id };
    case "update-assessment":
      await store.updateAssessment(uid, e.assessment.section_id, e.assessmentId, {
        assessment: e.assessment, questions: e.questions, maxScore: e.maxScore, itemNo: e.itemNo,
      });
      return { sectionId: e.assessment.section_id, periodId: e.assessment.period_id };
    case "delete-assessment":
      await store.deleteAssessment(uid, e.sectionId, e.assessmentId);
      return { sectionId: e.sectionId };

    case "grant-assessment-attempt":
      await store.grantAttempt(uid, e.sectionId, e.assessmentId, e.studentId);
      return { sectionId: e.sectionId };

    case "submit-assessment":
      await store.saveAssessmentAttempt(uid, e.score.section_id, {
        assessmentId: e.attempt.assessment_id,
        studentId: e.attempt.student_id,
        attemptNumber: e.attempt.attempt_no,
        status: e.attempt.status,
        score: e.attempt.score,
        maxScore: e.attempt.max_score,
        submittedAt: e.attempt.submitted_at,
        answers: e.answers,
        violations: e.violations,
        scoreRow: e.score,
      });
      return { sectionId: e.score.section_id };

    default:
      throw new Error(`Unknown offline change: ${type}`);
  }
}
