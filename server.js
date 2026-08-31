/* global process, Buffer */

import http from "node:http";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import sql from "mssql";

const port = Number(process.env.PORT || 3000);
const dataFile = join(process.env.DATA_DIR || "/data", "presenzio-lan.json");
const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
const sqlServer = process.env.SQL_SERVER || "";
const sqlPort = Number(process.env.SQL_PORT || 1433);
const sqlDatabase = process.env.SQL_DATABASE || "";
const sqlUser = process.env.SQL_USER || "";
const sqlPassword = process.env.SQL_PASSWORD || "";
const sqlEnabled = Boolean(sqlServer && sqlDatabase && sqlUser && sqlPassword);
let sqlStorageAvailable = sqlEnabled;
const sqlConfig = {
  server: sqlServer,
  port: sqlPort,
  database: sqlDatabase,
  user: sqlUser,
  password: sqlPassword,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  connectionTimeout: 5000,
  requestTimeout: 10000,
};

let store = {
  catalog: null,
  submissions: [],
  lastCatalogSync: null,
};
let persistenceQueue = Promise.resolve();
let sqlPoolPromise = null;
let catalogSyncPromise = null;
let pendingSyncPromise = null;

function getSqlPool() {
  if (!sqlStorageAvailable) throw new Error("SQL Server storage is unavailable.");
  if (!sqlPoolPromise) {
    sqlPoolPromise = sql.connect(sqlConfig).catch((error) => {
      sqlPoolPromise = null;
      throw error;
    });
  }
  return sqlPoolPromise;
}

async function loadStore() {
  if (sqlStorageAvailable) {
    try {
      const pool = await getSqlPool();
      const stateResult = await pool
        .request()
        .input("stateKey", sql.NVarChar(50), "catalog")
        .query("SELECT payload FROM dbo.lan_state WHERE state_key = @stateKey");
      const submissionResult = await pool
        .request()
        .query("SELECT attempt_id, payload, created_at, synced_at, last_error FROM dbo.lan_submissions ORDER BY created_at");
      if (stateResult.recordset[0]?.payload) {
        const catalog = JSON.parse(stateResult.recordset[0].payload);
        store.catalog = {
          ...catalog,
          attemptGrants: catalog.attemptGrants ?? [],
          violations: catalog.violations ?? [],
        };
      }
      store.submissions = submissionResult.recordset.map((row) => ({
        ...JSON.parse(row.payload),
        syncedAt: row.synced_at?.toISOString?.() || row.synced_at || null,
        lastError: row.last_error || null,
      }));
      return;
    } catch (error) {
      sqlStorageAvailable = false;
      console.warn("SQL Server unavailable; using JSON fallback:", error.message);
    }
  }

  try {
    store = { ...store, ...JSON.parse(await readFile(dataFile, "utf8")) };
  } catch (error) {
    if (error.code !== "ENOENT") console.error("Could not read LAN data:", error.message);
    await persistStore();
  }
}

async function persistSqlStore(snapshot) {
  const pool = await getSqlPool();
  await pool
    .request()
    .input("stateKey", sql.NVarChar(50), "catalog")
    .input("payload", sql.NVarChar(sql.MAX), JSON.stringify(snapshot.catalog ?? null))
    .query(`
      MERGE dbo.lan_state AS target
      USING (SELECT @stateKey AS state_key, @payload AS payload) AS source
      ON target.state_key = source.state_key
      WHEN MATCHED THEN UPDATE SET payload = source.payload, updated_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (state_key, payload) VALUES (source.state_key, source.payload);
    `);

  for (const submission of snapshot.submissions) {
    await pool
      .request()
      .input("attemptId", sql.UniqueIdentifier, submission.attempt.id)
      .input("payload", sql.NVarChar(sql.MAX), JSON.stringify(submission))
      .input("createdAt", sql.DateTime2, new Date(submission.createdAt || Date.now()))
      .input("syncedAt", sql.DateTime2, submission.syncedAt ? new Date(submission.syncedAt) : null)
      .input("lastError", sql.NVarChar(2000), submission.lastError || null)
      .query(`
        MERGE dbo.lan_submissions AS target
        USING (
          SELECT @attemptId AS attempt_id, @payload AS payload,
                 @createdAt AS created_at, @syncedAt AS synced_at, @lastError AS last_error
        ) AS source
        ON target.attempt_id = source.attempt_id
        WHEN MATCHED THEN UPDATE SET payload = source.payload, synced_at = source.synced_at, last_error = source.last_error
        WHEN NOT MATCHED THEN INSERT (attempt_id, payload, created_at, synced_at, last_error)
          VALUES (source.attempt_id, source.payload, source.created_at, source.synced_at, source.last_error);
      `);
  }
}

function persistJsonStore(snapshot) {
  const serializedSnapshot = JSON.stringify(snapshot, null, 2);
  const temporaryFile = `${dataFile}.tmp`;
  persistenceQueue = persistenceQueue
    .catch(() => {})
    .then(async () => {
      await mkdir(dirname(dataFile), { recursive: true });
      await writeFile(temporaryFile, serializedSnapshot, "utf8");
      await rename(temporaryFile, dataFile);
    });
  return persistenceQueue;
}

function persistStore() {
  const snapshot = JSON.parse(JSON.stringify(store));
  if (sqlStorageAvailable) {
    persistenceQueue = persistenceQueue
      .catch(() => {})
      .then(() => persistSqlStore(snapshot))
      .catch((error) => {
        sqlStorageAvailable = false;
        console.warn("SQL Server became unavailable; using JSON fallback:", error.message);
        return persistJsonStore(snapshot);
      });
    return persistenceQueue;
  }
  return persistJsonStore(snapshot);
}

function jsonResponse(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  response.end(payload);
}

function errorResponse(response, status, error) {
  console.error(error);
  jsonResponse(response, status, { error: error?.message || "LAN service error" });
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 5 * 1024 * 1024) throw new Error("Request is too large.");
  }
  return body ? JSON.parse(body) : {};
}

function requireSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase is not configured on the LAN service.");
}

async function supabaseRequest(table, filters = {}, options = {}) {
  requireSupabase();
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
  url.searchParams.set("select", options.select || "*");
  Object.entries(filters).forEach(([key, value]) => {
    url.searchParams.set(key, `eq.${value}`);
  });
  if (options.order) url.searchParams.set("order", options.order);
  if (options.limit) url.searchParams.set("limit", String(options.limit));
  const response = await fetch(url, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${table} request failed (${response.status}): ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : [];
}

async function supabaseMutation(table, method, rows, options = {}) {
  requireSupabase();
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
  if (options.onConflict) url.searchParams.set("on_conflict", options.onConflict);
  const response = await fetch(url, {
    method,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
      Prefer: options.returnData ? "resolution=merge-duplicates,return=representation" : "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${table} write failed (${response.status}): ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : [];
}

async function supabaseDelete(table, filters) {
  requireSupabase();
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
  Object.entries(filters).forEach(([key, value]) => {
    url.searchParams.set(key, `eq.${value}`);
  });
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      Prefer: "return=minimal",
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase ${table} delete failed (${response.status}): ${text.slice(0, 300)}`);
  }
}

function normalizedStudentNumber(value) {
  return String(value ?? "").trim();
}

function assessmentAttemptLimit(assessment, studentId) {
  const baseLimit = 1;
  const grant = (assessment?.attemptGrants ?? []).find(
    (item) => item.assessment_id === assessment?.id && item.student_id === studentId,
  ) ?? (store.catalog?.attemptGrants ?? []).find(
    (item) => item.assessment_id === assessment?.id && item.student_id === studentId,
  );
  return baseLimit + Math.max(0, Number(grant?.extra_attempts || 0));
}

function assessmentWindowError(assessment, now = Date.now()) {
  const availableFrom = assessment?.available_from ? Date.parse(assessment.available_from) : NaN;
  const availableUntil = assessment?.available_until ? Date.parse(assessment.available_until) : NaN;
  if (Number.isFinite(availableFrom) && now < availableFrom) {
    return "This assessment is not open yet.";
  }
  if (Number.isFinite(availableUntil) && now > availableUntil) {
    return "The answer time for this assessment has ended.";
  }
  return null;
}

function studentAssessmentSubmissions(assessmentId, studentId) {
  return store.submissions.filter(
    (submission) =>
      submission.attempt?.assessment_id === assessmentId &&
      submission.attempt?.student_id === studentId,
  );
}

function assessmentAccess(assessment, studentId, { allowExpiredAutoSubmit = false } = {}) {
  const submissions = studentAssessmentSubmissions(assessment.id, studentId);
  const attemptLimit = assessmentAttemptLimit(assessment, studentId);
  const attemptsUsed = submissions.length;
  if (attemptsUsed >= attemptLimit) {
    throw new Error(`You have used all ${attemptLimit} allowed attempt${attemptLimit === 1 ? "" : "s"}.`);
  }
  const windowError = assessmentWindowError(assessment);
  if (windowError && !(allowExpiredAutoSubmit && windowError.includes("ended"))) {
    throw new Error(windowError);
  }
  return {
    attemptsUsed,
    attemptsRemaining: attemptLimit - attemptsUsed,
    attemptNumber: attemptsUsed + 1,
    attemptLimit,
    availableFrom: assessment.available_from || null,
    availableUntil: assessment.available_until || null,
    serverNow: new Date().toISOString(),
  };
}

function assessmentResult(assessment, questions, section, period, student, enrollment) {
  return {
    assessment: {
      ...assessment,
      section,
      period,
      questions: questions.filter((question) => question.assessment_id === assessment.id),
    },
    enrollmentId: enrollment.id,
    ...assessmentAccess(assessment, student.id),
    student: {
      id: student.id,
      number: student.student_no,
      name: student.full_name,
    },
  };
}

function catalogResult(accessKey, studentNumber) {
  const catalog = store.catalog;
  if (!catalog) return null;
  const assessment = catalog.assessments.find((item) => item.access_key?.toUpperCase() === accessKey);
  if (!assessment) return null;
  const student = catalog.students.find((item) => normalizedStudentNumber(item.student_no) === studentNumber);
  if (!student) return null;
  const enrollment = catalog.enrollments.find(
    (item) => item.section_id === assessment.section_id && item.student_id === student.id,
  );
  if (!enrollment) return null;
  const section = catalog.sections.find((item) => item.id === assessment.section_id);
  const period = catalog.periods.find((item) => item.id === assessment.period_id);
  return assessmentResult(assessment, catalog.questions, section, period, student, enrollment);
}

async function cacheResult(result) {
  const assessment = result.assessment;
  const catalog = store.catalog || {
    sections: [],
    students: [],
    enrollments: [],
    periods: [],
    assessments: [],
    questions: [],
    attemptGrants: [],
    violations: [],
  };
  catalog.attemptGrants ??= [];
  catalog.violations ??= [];
  const merge = (rows, row, key = "id") => [
    ...rows.filter((item) => item[key] !== row[key]),
    row,
  ];
  catalog.sections = merge(catalog.sections, assessment.section);
  catalog.students = merge(catalog.students, {
    id: result.student.id,
    student_no: result.student.number,
    full_name: result.student.name,
  });
  catalog.enrollments = merge(catalog.enrollments, {
    id: result.enrollmentId,
    section_id: assessment.section_id,
    student_id: result.student.id,
  });
  if (assessment.period) catalog.periods = merge(catalog.periods, assessment.period);
  const assessmentRow = { ...assessment };
  delete assessmentRow.section;
  delete assessmentRow.period;
  delete assessmentRow.questions;
  catalog.assessments = merge(catalog.assessments, assessmentRow);
  for (const question of assessment.questions || []) catalog.questions = merge(catalog.questions, question);
  store.catalog = catalog;
  await persistStore();
}

async function loadRemoteAssessment(accessKey, studentNumber) {
  let [assessment] = await supabaseRequest("assessments", { access_key: accessKey }, { limit: 1 });
  if (!assessment) throw new Error("Assessment Key ID not found.");
  const [student] = await supabaseRequest("students", { student_no: studentNumber }, { limit: 1 });
  if (!student) throw new Error("Student ID number not found.");
  const [enrollment] = await supabaseRequest("enrollments", {
    section_id: assessment.section_id,
    student_id: student.id,
  }, { limit: 1 });
  if (!enrollment) throw new Error("This student is not enrolled in the assessment class.");
  const [section] = await supabaseRequest("sections", { id: assessment.section_id }, { limit: 1 });
  const [period] = await supabaseRequest("grading_periods", { id: assessment.period_id }, { limit: 1 });
  const questions = await supabaseRequest("assessment_questions", { assessment_id: assessment.id }, { order: "question_no.asc" });
  const attemptGrants = await supabaseRequest("assessment_attempt_grants", {
    assessment_id: assessment.id,
    student_id: student.id,
  }, { limit: 1 }).catch(() => []);
  assessment = { ...assessment, attemptGrants };
  const result = assessmentResult(assessment, questions, section, period, student, enrollment);
  await cacheResult(result);
  return result;
}

async function getStudentAssessment(accessKey, studentNumber) {
  try {
    return await loadRemoteAssessment(accessKey, studentNumber);
  } catch (remoteError) {
    const cached = catalogResult(accessKey, studentNumber);
    if (cached) return { ...cached, cached: true };
    throw remoteError;
  }
}

async function syncCatalog() {
  if (catalogSyncPromise) return catalogSyncPromise;
  catalogSyncPromise = (async () => {
    const localGrants = store.catalog?.attemptGrants ?? [];
    const localViolations = store.catalog?.violations ?? [];
    const [sections, students, enrollments, periods, assessments, questions, attemptGrants, violations] = await Promise.all([
      supabaseRequest("sections"),
      supabaseRequest("students"),
      supabaseRequest("enrollments"),
      supabaseRequest("grading_periods", {}, { order: "sort_order.asc" }),
      supabaseRequest("assessments"),
      supabaseRequest("assessment_questions"),
      supabaseRequest("assessment_attempt_grants").catch(() => []),
      supabaseRequest("assessment_violations", {}, { order: "occurred_at.asc" }).catch(() => []),
    ]);
    const grantsByStudent = new Map(
      attemptGrants.map((grant) => [
        `${grant.assessment_id}:${grant.student_id}`,
        grant,
      ]),
    );
    for (const localGrant of localGrants) {
      const key = `${localGrant.assessment_id}:${localGrant.student_id}`;
      const remoteGrant = grantsByStudent.get(key);
      if (!remoteGrant || Number(localGrant.extra_attempts || 0) > Number(remoteGrant.extra_attempts || 0)) {
        grantsByStudent.set(key, localGrant);
      }
    }
    const violationsById = new Map(
      [...violations, ...localViolations]
        .filter((violation) => violation?.id)
        .map((violation) => [violation.id, violation]),
    );
    store.catalog = {
      sections,
      students,
      enrollments,
      periods,
      assessments,
      questions,
      attemptGrants: [...grantsByStudent.values()],
      violations: [...violationsById.values()],
    };
    store.lastCatalogSync = new Date().toISOString();
    await persistStore();
    return store.catalog;
  })().finally(() => {
    catalogSyncPromise = null;
  });
  return catalogSyncPromise;
}

function scoreRecordKey(score = {}) {
  return [
    score.section_id,
    score.period_id,
    score.enrollment_id,
    score.category,
    score.item_no,
  ].join(":");
}

function recordSubmissionByScore() {
  const records = new Map();
  for (const submission of store.submissions) {
    const key = scoreRecordKey(submission.score);
    const current = records.get(key);
    const currentTime = Date.parse(current?.createdAt || "") || 0;
    const submissionTime = Date.parse(submission.createdAt || "") || 0;
    const currentScore = Number(current?.score?.score ?? -Infinity);
    const submissionScore = Number(submission.score?.score ?? -Infinity);
    if (
      !current ||
      submissionScore > currentScore ||
      (submissionScore === currentScore && submissionTime >= currentTime)
    ) {
      records.set(key, submission);
    }
  }
  return records;
}

async function syncSubmission(submission, { writeScore = true } = {}) {
  const { attempt, answers, score } = submission;
  const attemptFields = { ...attempt };
  const localAttemptId = attemptFields.id;
  delete attemptFields.id;
  delete attemptFields.auto_submitted;
  const [remoteAttempt] = await supabaseMutation("assessment_attempts", "POST", [attemptFields], {
    onConflict: "assessment_id,student_id,attempt_no",
    returnData: true,
  });
  const remoteAttemptId = remoteAttempt?.id || localAttemptId;
  await supabaseDelete("assessment_answers", { attempt_id: remoteAttemptId });
  if (answers?.length) {
    await supabaseMutation(
      "assessment_answers",
      "POST",
      answers.map((answer) => ({ ...answer, attempt_id: remoteAttemptId })),
    );
  }
  if (submission.violations?.length) {
    await supabaseMutation("assessment_violations", "POST", submission.violations);
  }
  if (writeScore) {
    await supabaseMutation("assessment_scores", "POST", [score], {
      onConflict: "section_id,period_id,enrollment_id,category,item_no",
    });
  }
}

async function syncAttemptGrant(grant) {
  await supabaseMutation("assessment_attempt_grants", "POST", [grant], {
    onConflict: "assessment_id,student_id",
  });
}

async function syncPending() {
  if (pendingSyncPromise) return pendingSyncPromise;
  pendingSyncPromise = (async () => {
    if (!supabaseUrl || !supabaseAnonKey) return;
    for (const grant of store.catalog?.attemptGrants ?? []) {
      try {
        await syncAttemptGrant(grant);
      } catch (error) {
        console.warn("Attempt grant sync deferred:", error.message);
      }
    }
    const recordByScore = recordSubmissionByScore();
    for (const submission of store.submissions) {
      if (submission.syncedAt) continue;
      try {
        await syncSubmission(submission, {
          writeScore: recordByScore.get(scoreRecordKey(submission.score)) === submission,
        });
        submission.syncedAt = new Date().toISOString();
        submission.lastError = null;
        await persistStore();
      } catch (error) {
        submission.lastError = error.message;
        await persistStore();
      }
    }
    for (const submission of recordByScore.values()) {
      if (!submission.syncedAt) continue;
      try {
        await supabaseMutation("assessment_scores", "POST", [submission.score], {
          onConflict: "section_id,period_id,enrollment_id,category,item_no",
        });
      } catch (error) {
        submission.lastError = error.message;
        await persistStore();
      }
    }
  })().finally(() => {
    pendingSyncPromise = null;
  });
  return pendingSyncPromise;
}

function saveSubmission(submission) {
  const existing = store.submissions.findIndex((item) => item.attempt?.id === submission.attempt?.id);
  if (existing >= 0) store.submissions[existing] = submission;
  else store.submissions.push(submission);
  return persistStore();
}

async function handleRequest(request, response) {
  if (request.method === "OPTIONS") return jsonResponse(response, 204, {});
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (request.method === "GET" && requestUrl.pathname === "/api/health") {
    return jsonResponse(response, 200, {
      ok: true,
      storage: sqlStorageAvailable ? "sqlserver" : "json-fallback",
      pending: store.submissions.filter((item) => !item.syncedAt).length,
      lastCatalogSync: store.lastCatalogSync,
    });
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/sync") {
    const lastSync = store.lastCatalogSync ? Date.parse(store.lastCatalogSync) : 0;
    if (!store.catalog || Date.now() - lastSync > 30_000) {
      try {
        await syncCatalog();
      } catch (error) {
        console.warn("Catalog sync deferred:", error.message);
      }
    }
    await syncPending();
    return jsonResponse(response, 200, {
      ok: true,
      pending: store.submissions.filter((item) => !item.syncedAt).length,
      lastCatalogSync: store.lastCatalogSync,
    });
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/assessment-management") {
    const sectionId = requestUrl.searchParams.get("sectionId");
    const assessmentIds = new Set(
      (store.catalog?.assessments ?? [])
        .filter((assessment) => !sectionId || assessment.section_id === sectionId)
        .map((assessment) => assessment.id),
    );
    const attempts = store.submissions
      .map((submission) => submission.attempt)
      .filter((attempt) => assessmentIds.has(attempt?.assessment_id));
    const submissionViolations = store.submissions.flatMap((submission) => submission.violations ?? []);
    const violations = [
      ...(store.catalog?.violations ?? []),
      ...submissionViolations,
    ].filter((violation, index, rows) =>
      assessmentIds.has(violation.assessment_id) &&
      rows.findIndex((item) => item.id && item.id === violation.id) === index,
    );
    return jsonResponse(response, 200, {
      attempts,
      attemptGrants: (store.catalog?.attemptGrants ?? []).filter((grant) => assessmentIds.has(grant.assessment_id)),
      violations,
    });
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/student-assessment") {
    const accessKey = String(requestUrl.searchParams.get("accessKey") || "").trim().toUpperCase();
    const studentNumber = normalizedStudentNumber(requestUrl.searchParams.get("studentNumber"));
    if (!accessKey || !studentNumber) return jsonResponse(response, 400, { error: "Assessment key and student number are required." });
    try {
      return jsonResponse(response, 200, await getStudentAssessment(accessKey, studentNumber));
    } catch (error) {
      return errorResponse(response, 503, error);
    }
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/student-assessment/submit") {
    const payload = await readJson(request);
    if (!payload.attempt?.id || !payload.attempt?.assessment_id || !payload.attempt?.student_id || !payload.score?.section_id || !payload.score?.period_id) {
      return jsonResponse(response, 400, { error: "The submission is missing required identifiers." });
    }
    const assessment = store.catalog?.assessments?.find(
      (item) => item.id === payload.attempt.assessment_id,
    );
    if (!assessment) {
      return jsonResponse(response, 409, { error: "Assessment details are not available on the LAN computer. Refresh the student page." });
    }
    let access;
    try {
      access = assessmentAccess(assessment, payload.attempt.student_id, {
        allowExpiredAutoSubmit: Boolean(payload.autoSubmit),
      });
    } catch (error) {
      return jsonResponse(response, 409, { error: error.message });
    }
    const questions = store.catalog.questions.filter(
      (question) => question.assessment_id === assessment.id,
    );
    const submittedAnswers = new Map(
      (payload.answers || []).map((answer) => [answer.question_id, String(answer.answer ?? "").trim()]),
    );
    const missingAnswer = questions.find((question) => !submittedAnswers.get(question.id));
    if (missingAnswer && !payload.autoSubmit) {
      return jsonResponse(response, 400, { error: "Answer every question before submitting." });
    }
    const submission = {
      attempt: payload.attempt,
      answers: payload.answers || [],
      violations: (payload.violations || []).map((violation) => ({
        ...violation,
        id: violation.id || randomUUID(),
        assessment_id: payload.attempt.assessment_id,
        student_id: payload.attempt.student_id,
        attempt_no: access.attemptNumber,
      })),
      score: payload.score,
      periodCode: payload.periodCode || null,
      createdAt: new Date().toISOString(),
      syncedAt: null,
      lastError: null,
    };
    submission.attempt.attempt_no = access.attemptNumber;
    submission.attempt.auto_submitted = Boolean(payload.autoSubmit);
    store.catalog.violations = [
      ...(store.catalog.violations ?? []),
      ...submission.violations,
    ];
    await saveSubmission(submission);
    await syncPending();
    return jsonResponse(response, 200, {
      score: Number(payload.score.score || 0),
      maxScore: Number(payload.score.max_score || 0),
      needsReview: payload.attempt.status === "needs_review",
      queued: !submission.syncedAt,
      synced: Boolean(submission.syncedAt),
      attemptsUsed: access.attemptsUsed + 1,
      attemptsRemaining: access.attemptsRemaining - 1,
      attemptNumber: access.attemptNumber,
      autoSubmitted: Boolean(payload.autoSubmit),
    });
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/assessment-attempt-grants") {
    const payload = await readJson(request);
    const assessmentId = String(payload.assessment_id || "");
    const studentId = String(payload.student_id || "");
    const assessment = store.catalog?.assessments?.find((item) => item.id === assessmentId);
    const student = store.catalog?.students?.find((item) => item.id === studentId);
    const enrolled = store.catalog?.enrollments?.some(
      (item) => item.section_id === assessment?.section_id && item.student_id === studentId,
    );
    if (!assessment || !student || !enrolled) {
      return jsonResponse(response, 400, { error: "The student is not enrolled in this assessment class." });
    }
    const current = (store.catalog.attemptGrants ?? []).find(
      (item) => item.assessment_id === assessmentId && item.student_id === studentId,
    );
    const grant = {
      id: current?.id || randomUUID(),
      assessment_id: assessmentId,
      student_id: studentId,
      extra_attempts: Number(current?.extra_attempts || 0) + 1,
      granted_at: new Date().toISOString(),
    };
    store.catalog.attemptGrants = [
      ...(store.catalog.attemptGrants ?? []).filter((item) => item.id !== grant.id),
      grant,
    ];
    await persistStore();
    let synced = false;
    try {
      await syncAttemptGrant(grant);
      synced = true;
    } catch (error) {
      console.warn("Attempt grant queued for sync:", error.message);
    }
    return jsonResponse(response, 200, { ok: true, grant, queued: !synced });
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/submissions") {
    const sectionId = requestUrl.searchParams.get("sectionId");
    const recordByScore = recordSubmissionByScore();
    const scores = [...recordByScore.values()]
      .filter((item) => !sectionId || item.score?.section_id === sectionId)
      .map((item) => ({
        ...item.score,
        recorded_at: item.createdAt,
        period: item.periodCode ? { code: item.periodCode } : undefined,
        pending_sync: !item.syncedAt,
      }));
    return jsonResponse(response, 200, { scores });
  }

  return jsonResponse(response, 404, { error: "Not found" });
}

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => errorResponse(response, 500, error));
});

await loadStore();
server.listen(port, "0.0.0.0", () => {
  console.log(`Presenzio LAN service listening on ${port}`);
});

setInterval(() => {
  void syncPending();
}, 15_000).unref();

setTimeout(() => {
  void syncPending();
}, 1_000);
