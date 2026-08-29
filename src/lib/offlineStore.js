const DATABASE_NAME = "presenzio-offline";
const DATABASE_VERSION = 1;
const SNAPSHOT_STORE = "snapshots";
const MUTATION_STORE = "mutations";

let databasePromise;

function openDatabase() {
  if (databasePromise) return databasePromise;
  if (typeof indexedDB === "undefined") return Promise.resolve(null);

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) {
        database.createObjectStore(SNAPSHOT_STORE, { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains(MUTATION_STORE)) {
        const store = database.createObjectStore(MUTATION_STORE, { keyPath: "id" });
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

function transactionResult(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function writeOfflineSnapshot(key, value) {
  const database = await openDatabase();
  if (!database) return;
  const transaction = database.transaction(SNAPSHOT_STORE, "readwrite");
  transaction.objectStore(SNAPSHOT_STORE).put({ key, value, savedAt: Date.now() });
  await transactionResult(transaction);
}

export async function readOfflineSnapshot(key) {
  const database = await openDatabase();
  if (!database) return null;
  const transaction = database.transaction(SNAPSHOT_STORE, "readonly");
  const record = await requestResult(transaction.objectStore(SNAPSHOT_STORE).get(key));
  return record?.value ?? null;
}

export async function enqueueOfflineMutation(type, payload) {
  const database = await openDatabase();
  if (!database) {
    throw new Error("This browser does not support offline storage.");
  }
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const mutation = { id, type, payload, createdAt: Date.now() };
  const transaction = database.transaction(MUTATION_STORE, "readwrite");
  transaction.objectStore(MUTATION_STORE).put(mutation);
  await transactionResult(transaction);
  return mutation;
}

export async function listOfflineMutations() {
  const database = await openDatabase();
  if (!database) return [];
  const transaction = database.transaction(MUTATION_STORE, "readonly");
  const records = await requestResult(transaction.objectStore(MUTATION_STORE).getAll());
  return records.sort((first, second) => first.createdAt - second.createdAt);
}

export async function removeOfflineMutation(id) {
  const database = await openDatabase();
  if (!database) return;
  const transaction = database.transaction(MUTATION_STORE, "readwrite");
  transaction.objectStore(MUTATION_STORE).delete(id);
  await transactionResult(transaction);
}

export async function countOfflineMutations() {
  const database = await openDatabase();
  if (!database) return 0;
  const transaction = database.transaction(MUTATION_STORE, "readonly");
  return requestResult(transaction.objectStore(MUTATION_STORE).count());
}

async function getPeriodId(supabase, periodCode) {
  const { data, error } = await supabase
    .from("grading_periods")
    .select("id")
    .eq("code", periodCode)
    .single();
  if (error) throw error;
  return data.id;
}

export async function replayOfflineMutation({ supabase, mutation, importMasterList, importGradeSheet }) {
  const { type, payload } = mutation;

  if (type === "import-master-list") {
    return importMasterList(payload.file);
  }
  if (type === "import-grade-sheet") {
    return importGradeSheet(payload.file);
  }

  if (type === "save-grading-periods") {
    const { error } = await supabase.from("grading_periods").upsert(payload.rows, {
      onConflict: "code",
    });
    if (error) throw error;
    return;
  }

  if (type === "save-attendance") {
    const periodId = await getPeriodId(supabase, payload.periodCode);
    const { error: sessionError } = await supabase.from("class_sessions").upsert(
      {
        id: payload.sessionId,
        section_id: payload.sectionId,
        period_id: periodId,
        session_date: payload.date,
        session_time: payload.sessionTime,
      },
      { onConflict: "id" },
    );
    if (sessionError) throw sessionError;
    const records = Object.entries(payload.statuses).map(([enrollmentId, status]) => ({
      session_id: payload.sessionId,
      enrollment_id: enrollmentId,
      status,
    }));
    if (records.length) {
      const { error } = await supabase.from("attendance_records").upsert(records, {
        onConflict: "session_id,enrollment_id",
      });
      if (error) throw error;
    }
    return { sectionId: payload.sectionId, periodId };
  }

  if (type === "save-grades") {
    const periodId = await getPeriodId(supabase, payload.periodCode);
    const rows = payload.rows.map((row) => ({ ...row, period_id: periodId }));
    if (rows.length) {
      const { error } = await supabase.from("period_grades").upsert(rows, {
        onConflict: "section_id,period_id,enrollment_id",
      });
      if (error) throw error;
    }
    return { sectionId: payload.sectionId, periodId };
  }

  if (type === "save-assessment-scores") {
    const periodId = await getPeriodId(supabase, payload.periodCode);
    const { error: clearError } = await supabase
      .from("assessment_scores")
      .delete()
      .eq("section_id", payload.sectionId)
      .eq("period_id", periodId)
      .eq("category", payload.category);
    if (clearError) throw clearError;
    const rows = payload.rows.map((row) => ({ ...row, period_id: periodId }));
    if (rows.length) {
      const { error } = await supabase.from("assessment_scores").upsert(rows, {
        onConflict: "section_id,period_id,enrollment_id,category,item_no",
      });
      if (error) throw error;
    }
    return { sectionId: payload.sectionId, periodId };
  }

  if (type === "add-student") {
    const { error: studentError } = await supabase.from("students").upsert(
      payload.student,
      { onConflict: "id" },
    );
    if (studentError) throw studentError;
    const { error: enrollmentError } = await supabase.from("enrollments").upsert(
      payload.enrollment,
      { onConflict: "id" },
    );
    if (enrollmentError) throw enrollmentError;
    return { sectionId: payload.enrollment.section_id };
  }

  if (type === "save-assessment") {
    const { error: assessmentError } = await supabase.from("assessments").upsert(
      payload.assessment,
      { onConflict: "id" },
    );
    if (assessmentError) throw assessmentError;
    const { error: questionError } = await supabase
      .from("assessment_questions")
      .upsert(payload.questions, { onConflict: "assessment_id,question_no" });
    if (questionError) throw questionError;
    if (payload.scoreRows.length) {
      const { error: scoreError } = await supabase
        .from("assessment_scores")
        .upsert(payload.scoreRows, {
          onConflict: "section_id,period_id,enrollment_id,category,item_no",
        });
      if (scoreError) throw scoreError;
    }
    return { sectionId: payload.assessment.section_id, periodId: payload.assessment.period_id };
  }

  if (type === "update-assessment") {
    const { error: assessmentError } = await supabase
      .from("assessments")
      .update(payload.assessment)
      .eq("id", payload.assessmentId)
      .eq("section_id", payload.assessment.section_id);
    if (assessmentError) throw assessmentError;
    const { error: clearQuestionsError } = await supabase
      .from("assessment_questions")
      .delete()
      .eq("assessment_id", payload.assessmentId);
    if (clearQuestionsError) throw clearQuestionsError;
    const { error: questionError } = await supabase
      .from("assessment_questions")
      .upsert(payload.questions, { onConflict: "assessment_id,question_no" });
    if (questionError) throw questionError;
    if (payload.itemNo) {
      const { error: scoreError } = await supabase
        .from("assessment_scores")
        .update({ max_score: payload.maxScore })
        .eq("section_id", payload.assessment.section_id)
        .eq("period_id", payload.assessment.period_id)
        .eq("category", payload.assessment.category)
        .eq("item_no", Number(payload.itemNo));
      if (scoreError) throw scoreError;
    }
    return { sectionId: payload.assessment.section_id, periodId: payload.assessment.period_id };
  }

  if (type === "delete-assessment") {
    const { error } = await supabase
      .from("assessments")
      .delete()
      .eq("id", payload.assessmentId)
      .eq("section_id", payload.sectionId);
    if (error) throw error;
    return { sectionId: payload.sectionId };
  }

  if (type === "submit-assessment") {
    const { error: attemptError } = await supabase
      .from("assessment_attempts")
      .upsert(payload.attempt, { onConflict: "assessment_id,student_id,attempt_no" });
    if (attemptError) throw attemptError;
    const { error: clearAnswersError } = await supabase
      .from("assessment_answers")
      .delete()
      .eq("attempt_id", payload.attempt.id);
    if (clearAnswersError) throw clearAnswersError;
    if (payload.answers.length) {
      const { error: answerError } = await supabase
        .from("assessment_answers")
        .upsert(payload.answers, { onConflict: "attempt_id,question_id" });
      if (answerError) throw answerError;
    }
    if (payload.violations?.length) {
      const { error: violationError } = await supabase
        .from("assessment_violations")
        .insert(payload.violations);
      if (violationError) throw violationError;
    }
    const { error: scoreError } = await supabase
      .from("assessment_scores")
      .upsert(payload.score, {
        onConflict: "section_id,period_id,enrollment_id,category,item_no",
      });
    if (scoreError) throw scoreError;
    return { sectionId: payload.score.section_id, periodId: payload.score.period_id };
  }

  if (type === "grant-assessment-attempt") {
    const { data: existing, error: existingError } = await supabase
      .from("assessment_attempt_grants")
      .select("id, extra_attempts")
      .eq("assessment_id", payload.assessmentId)
      .eq("student_id", payload.studentId)
      .maybeSingle();
    if (existingError) throw existingError;
    const { error } = await supabase
      .from("assessment_attempt_grants")
      .upsert(
        {
          id: existing?.id,
          assessment_id: payload.assessmentId,
          student_id: payload.studentId,
          extra_attempts: Number(existing?.extra_attempts || 0) + 1,
        },
        { onConflict: "assessment_id,student_id" },
      );
    if (error) throw error;
    return { sectionId: payload.sectionId };
  }

  if (type === "delete-section") {
    const { error } = await supabase.from("sections").delete().eq("id", payload.sectionId);
    if (error) throw error;
    return { sectionId: payload.sectionId };
  }

  throw new Error(`Unknown offline change: ${type}`);
}
