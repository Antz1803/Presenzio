import * as XLSX from "xlsx";
import { ensureGradingPeriods, newId, patch, read, sec } from "../../lib/accountDb";

const PERIOD_SHEETS = { prelim: "Prelim", midterm: "Midterm", semifinal: "SemiFinal", final: "Final" };
const SCORE_COLUMNS = { quiz: [2, 4, 6, 8], assignment: [11, 13, 15, 17], activity: [20, 22, 24, 26], exam: [33] };
const PERIOD_COLUMNS = {
  prelim: { startColumn: 4, endColumn: 19 },
  midterm: { startColumn: 22, endColumn: 37 },
  semifinal: { startColumn: 40, endColumn: 55 },
  final: { startColumn: 58, endColumn: 73 },
};
const GRADE_COLUMNS = {
  prelim: { own: 35 },
  midterm: { own: 35, cumulative: 37 },
  semifinal: { own: 35, cumulative: 38 },
  final: { own: 35, cumulative: 39 },
};
const NAME_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

const text = (value) => String(value ?? "").trim();
const number = (value) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
};
const normalizeName = (value) =>
  text(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .split(/[^a-z0-9]+/).filter(Boolean).filter((token) => !NAME_SUFFIXES.has(token)).sort().join("|");

function dateValue(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getFullYear() + "-" + String(value.getMonth() + 1).padStart(2, "0") + "-" + String(value.getDate()).padStart(2, "0");
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d) {
      return parsed.y + "-" + String(parsed.m).padStart(2, "0") + "-" + String(parsed.d).padStart(2, "0");
    }
  }
  const raw = text(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  return match ? match[3] + "-" + String(match[1]).padStart(2, "0") + "-" + String(match[2]).padStart(2, "0") : "";
}

function lookup(rows, label) {
  const wanted = String(label).toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const row of rows) {
    const index = row.findIndex((value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "") === wanted);
    if (index >= 0) return text(row[index + 1]);
  }
  return "";
}

function periodForColumn(column) {
  return Object.entries(PERIOD_COLUMNS).find(([, range]) => column >= range.startColumn && column <= range.endColumn)?.[0] ?? "";
}

function statusValue(value) {
  const normalized = text(value).toUpperCase();
  if (["1", "P", "PRESENT"].includes(normalized)) return "present";
  if (["A", "ABSENT"].includes(normalized)) return "absent";
  if (["L", "LATE"].includes(normalized)) return "late";
  if (["E", "EXCUSED"].includes(normalized)) return "excused";
  return "";
}

function collectWorkbookStudents(workbook) {
  const byName = new Map();
  const add = (name, ctrlNo, gender = null) => {
    const displayName = text(name);
    const key = normalizeName(displayName);
    if (!key) return;
    const current = byName.get(key) ?? { name: displayName, ctrlNo: number(ctrlNo), gender };
    if (current.ctrlNo == null && number(ctrlNo) != null) current.ctrlNo = number(ctrlNo);
    if (!current.gender && gender) current.gender = gender;
    byName.set(key, current);
  };
  Object.values(PERIOD_SHEETS).forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (sheet) XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }).slice(9).forEach((row) => add(row?.[1], row?.[0]));
  });
  const attendance = workbook.Sheets.Attendance;
  if (attendance) {
    XLSX.utils.sheet_to_json(attendance, { header: 1, defval: "" }).slice(6).forEach((row) => {
      const value = text(row?.[1]).toUpperCase();
      const gender = value === "F" || value === "FEMALE" ? "F" : value === "M" || value === "MALE" ? "M" : null;
      add(row?.[2], row?.[0], gender);
    });
  }
  return [...byName.values()];
}

function studentLookup(row, roster, byControl, byName) {
  return normalizeName(row?.[1]) ? byName.get(normalizeName(row?.[1])) ?? null : byControl.get(text(row?.[0])) ?? null;
}

async function findSection(uid, settingsRows) {
  const schoolYear = lookup(settingsRows, "School Year");
  const semester = lookup(settingsRows, "Semester");
  const edpCode = lookup(settingsRows, "EDP Code");
  const subjectCode = lookup(settingsRows, "Subject Code");
  const sectionNo = lookup(settingsRows, "Section");
  if (!edpCode && !subjectCode) throw new Error("The grade sheet does not contain class identification details.");
  const [schoolYears, sections] = await Promise.all([read(uid, "schoolYears"), read(uid, "sections")]);
  const yearId = Object.entries(schoolYears ?? {}).find(([, value]) => value?.label === schoolYear && value?.semester === semester)?.[0];
  const matches = Object.entries(sections ?? {}).filter(([, section]) =>
    (!edpCode || section.edp_code === edpCode) &&
    (edpCode || (section.subject_code === subjectCode && (!sectionNo || section.section_no === sectionNo))) &&
    (!yearId || section.school_year_id === yearId),
  );
  if (!matches.length) throw new Error("No matching class was found for this grade sheet. Import its master list first.");
  if (matches.length > 1) throw new Error("More than one class matches this grade sheet. Add a unique EDP code.");
  return { id: matches[0][0], ...matches[0][1] };
}

async function ensureRoster(uid, section, workbook, updates) {
  const [students, enrollments] = await Promise.all([read(uid, "students"), read(uid, "enrollments/" + section.id)]);
  const studentMap = students ?? {};
  const enrollmentMap = enrollments ?? {};
  const byName = new Map(Object.entries(studentMap).map(([id, value]) => [normalizeName(value?.full_name), { id, ...value }]));
  const existing = Object.entries(enrollmentMap).map(([id, value]) => ({ id, ...value }));
  const byStudentId = new Map(existing.map((enrollment) => [enrollment.student_id, enrollment]));
  const usedControls = new Set(existing.map((enrollment) => Number(enrollment.ctrl_no)).filter(Number.isInteger));
  let nextControl = Math.max(0, ...usedControls) + 1;
  const rosterChanges = { createdStudents: [], createdEnrollments: [] };
  for (const candidate of collectWorkbookStudents(workbook)) {
    let student = byName.get(normalizeName(candidate.name));
    if (!student) {
      const id = newId();
      student = { id, full_name: candidate.name, gender: candidate.gender, created_at: new Date().toISOString() };
      byName.set(normalizeName(candidate.name), student);
      studentMap[id] = student;
      updates["students/" + id] = student;
      rosterChanges.createdStudents.push(student.full_name);
    } else if (!student.gender && candidate.gender) {
      student = { ...student, gender: candidate.gender };
      studentMap[student.id] = student;
      updates["students/" + student.id + "/gender"] = candidate.gender;
    }
    if (byStudentId.has(student.id)) continue;
    let ctrlNo = Number(candidate.ctrlNo);
    if (!Number.isInteger(ctrlNo) || ctrlNo < 1 || usedControls.has(ctrlNo)) {
      while (usedControls.has(nextControl)) nextControl += 1;
      ctrlNo = nextControl;
    }
    usedControls.add(ctrlNo);
    const enrollmentId = newId();
    const enrollment = { id: enrollmentId, student_id: student.id, ctrl_no: ctrlNo, status: "active" };
    byStudentId.set(student.id, enrollment);
    updates["enrollments/" + section.id + "/" + enrollmentId] = { student_id: student.id, ctrl_no: ctrlNo, status: "active" };
    rosterChanges.createdEnrollments.push({ name: student.full_name, ctrlNo });
  }
  const roster = [...byStudentId.values()].map((enrollment) => ({
    id: enrollment.id,
    studentId: enrollment.student_id,
    ctrlNo: enrollment.ctrl_no,
    name: studentMap[enrollment.student_id]?.full_name ?? "",
    number: studentMap[enrollment.student_id]?.student_no ?? "",
  }));
  return { byName, byStudentId, roster, rosterChanges };
}

export async function importGradeSheetFile({ file, userId }) {
  if (!userId) throw new Error("Your account session is not ready. Please sign in again before importing.");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  if (!workbook.Sheets.Settings) throw new Error("This is a master list. Use Import master list for this file.");
  const settingsRows = XLSX.utils.sheet_to_json(workbook.Sheets.Settings, { header: 1, defval: "" });
  const section = await findSection(userId, settingsRows);
  const periods = await ensureGradingPeriods(userId);
  const periodMap = new Map(periods.map((period) => [period.code, period]));
  const updates = {};
  const rosterData = await ensureRoster(userId, section, workbook, updates);
  const byControl = new Map(rosterData.roster.map((student) => [String(student.ctrlNo), student]));
  const byName = new Map(rosterData.roster.map((student) => [normalizeName(student.name), student]));
  const scores = new Map();
  const gradeOverrides = {};
  const touchedPeriods = new Set();
  const unmatched = new Set();
  const matched = new Set();

  Object.entries(PERIOD_SHEETS).forEach(([periodCode, sheetName]) => {
    const period = periodMap.get(periodCode);
    const sheet = workbook.Sheets[sheetName];
    if (!period || !sheet) return;
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    const hps = rows[8] ?? [];
    const gradeColumns = GRADE_COLUMNS[periodCode];
    rows.slice(9).forEach((row) => {
      if (!text(row?.[1])) return;
      const student = studentLookup(row, rosterData.roster, byControl, byName);
      if (!student) {
        unmatched.add(normalizeName(row[1]));
        return;
      }
      matched.add(student.id);
      Object.entries(SCORE_COLUMNS).forEach(([category, columns]) => columns.forEach((column, index) => {
        const maxScore = number(hps[column]);
        const score = number(row[column]);
        if (maxScore == null || maxScore <= 0 || score == null) return;
        const key = periodCode + ":" + student.id + ":" + category + ":" + (index + 1);
        scores.set(key, { section_id: section.id, period_id: periodCode, enrollment_id: student.id, category, item_no: index + 1, score: Math.max(0, Math.min(score, maxScore)), max_score: maxScore, source: "grade-sheet-import" });
        touchedPeriods.add(periodCode);
      }));
      const own = number(row[gradeColumns.own]);
      const cumulative = gradeColumns.cumulative == null ? null : number(row[gradeColumns.cumulative]);
      if (own != null || cumulative != null) {
        gradeOverrides[periodCode] ??= {};
        gradeOverrides[periodCode][student.id] = { own, cumulative };
        touchedPeriods.add(periodCode);
      }
    });
  });

  const existingData = (await read(userId, sec(section.id))) ?? {};
  // Grade-sheet imports are additive. Blank or missing cells must not erase
  // scores that were already recorded in Firebase.
  scores.forEach((score, key) => {
    updates[sec(section.id, "scores/" + key)] = { ...score, recorded_at: new Date().toISOString() };
  });

  let attendanceCount = 0;
  const attendanceSheet = workbook.Sheets.Attendance;
  if (attendanceSheet) {
    const rows = XLSX.utils.sheet_to_json(attendanceSheet, { header: 1, defval: "" });
    const headers = rows[5] ?? [];
    const sessions = new Map();
    headers.forEach((value, column) => {
      const date = dateValue(value);
      const periodCode = periodForColumn(column);
      if (!date || !periodMap.has(periodCode)) return;
      const sessionTime = Number(String(section.time_start ?? "").slice(0, 2)) >= 12 ? "PM" : "AM";
      sessions.set(date + "_" + sessionTime, { date, sessionTime, periodCode, statuses: {} });
    });
    rows.slice(6).forEach((row) => {
      if (!text(row?.[2])) return;
      const student = studentLookup([row[0], row[2]], rosterData.roster, byControl, byName);
      if (!student) {
        unmatched.add(normalizeName(row[2]));
        return;
      }
      headers.forEach((value, column) => {
        const date = dateValue(value);
        const periodCode = periodForColumn(column);
        if (!date || !periodMap.has(periodCode)) return;
        const sessionTime = Number(String(section.time_start ?? "").slice(0, 2)) >= 12 ? "PM" : "AM";
        const session = sessions.get(date + "_" + sessionTime);
        const status = statusValue(row[column]);
        if (!session || !status) return;
        session.statuses[student.id] = status;
      });
    });
    sessions.forEach((session, sessionId) => {
      updates[sec(section.id, "sessions/" + sessionId)] = { period_id: session.periodCode, session_date: session.date, session_time: session.sessionTime };
      updates[sec(section.id, "attendance/" + sessionId)] = {
        ...(existingData.attendance?.[sessionId] ?? {}),
        ...session.statuses,
      };
      attendanceCount += Object.keys(session.statuses).length;
      touchedPeriods.add(session.periodCode);
    });
  }
  if (!scores.size && !attendanceCount && !Object.keys(gradeOverrides).length) {
    throw new Error("No record scores, grades, or attendance values could be imported from this workbook.");
  }
  await patch(userId, updates);
  return {
    section: { id: section.id, ...section },
    sectionId: section.id,
    subjectCode: section.subject_code,
    students: rosterData.roster,
    gradingPeriods: periods,
    rosterChanges: rosterData.rosterChanges,
    scoreCount: scores.size,
    attendanceCount,
    matchedStudents: matched.size,
    unmatchedStudents: unmatched.size,
    periodIds: [...touchedPeriods],
    gradeOverrides,
    dedupSummary: { groupsFound: 0, studentsMerged: 0, errors: [] },
  };
}

export async function importRecordFile({ file, userId }) {
  return importGradeSheetFile({ file, userId });
}
