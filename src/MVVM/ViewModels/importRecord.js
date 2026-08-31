import * as XLSX from "xlsx";

const periodSheets = {
  prelim: "Prelim",
  midterm: "Midterm",
  semifinal: "SemiFinal",
  final: "Final",
};

const categoryColumns = {
  quiz: [2, 4, 6, 8],
  assignment: [11, 13, 15, 17],
  activity: [20, 22, 24, 26],
  exam: [33],
};

const attendanceLayout = {
  prelim: { startColumn: 4, endColumn: 19 },
  midterm: { startColumn: 22, endColumn: 37 },
  semifinal: { startColumn: 40, endColumn: 55 },
  final: { startColumn: 58, endColumn: 73 },
};

// Prelim has no cumulative column — it *is* the cumulative value.
const gradeColumns = {
  prelim:    { own: 35 },
  midterm:   { own: 35, cumulative: 37 },
  semifinal: { own: 35, cumulative: 38 },
  final:     { own: 35, cumulative: 39 },
};

// The period sheets have two distinct row roles. Excel row 9 is the hidden,
// class-wide HPS definition row; student records begin on Excel row 10.
const gradeSheetRows = {
  hps: 8,
  firstStudent: 9,
};

const attendanceRows = {
  firstStudent: 6,
};

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeControlNumber(value) {
  const number = numeric(value);
  return number == null ? String(value ?? "").trim() : String(number);
}

function controlNumber(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }
  const text = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const slashMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slashMatch) {
    return `${slashMatch[3]}-${String(slashMatch[1]).padStart(2, "0")}-${String(slashMatch[2]).padStart(2, "0")}`;
  }
  return "";
}

function findStudent(row, students, byControlNumber, byName) {
  const normalizedName = normalizeName(row?.[1]);
  if (normalizedName) return byName.get(normalizedName) ?? null;
  return byControlNumber.get(normalizeControlNumber(row?.[0])) ?? null;
}

function genderValue(value) {
  const text = String(value ?? "").trim().toLowerCase();
  return text === "female" || text === "f"
    ? "F"
    : text === "male" || text === "m"
      ? "M"
      : null;
}

function collectGradeSheetRoster(workbook) {
  const candidates = new Map();
  const addCandidate = (name, ctrlNo, gender) => {
    const fullName = String(name ?? "").trim();
    const normalized = normalizeName(fullName);
    if (!normalized) return;
    const current = candidates.get(normalized) ?? {
      name: fullName,
      ctrlNo: controlNumber(ctrlNo),
      gender: null,
    };
    if (current.ctrlNo == null && controlNumber(ctrlNo) != null) {
      current.ctrlNo = controlNumber(ctrlNo);
    }
    if (!current.gender && gender) current.gender = gender;
    candidates.set(normalized, current);
  };

  Object.values(periodSheets).forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;
    XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })
      .slice(gradeSheetRows.firstStudent)
      .forEach((row) => addCandidate(row?.[1], row?.[0], null));
  });

  const attendanceSheet = workbook.Sheets.Attendance;
  if (attendanceSheet) {
    XLSX.utils.sheet_to_json(attendanceSheet, { header: 1, defval: "" })
      .slice(attendanceRows.firstStudent)
      .forEach((row) => addCandidate(row?.[2], row?.[0], genderValue(row?.[1])));
  }

  return [...candidates.values()];
}

async function ensureGradeSheetRoster({ workbook, supabase, section, enrollments }) {
  const { data: allStudents, error: studentLookupError } = await supabase
    .from("students")
    .select("id, full_name, gender, student_no");
  if (studentLookupError) throw studentLookupError;

  const studentsByName = new Map(
    (allStudents ?? []).map((student) => [normalizeName(student.full_name), student]),
  );
  const enrolledStudentIds = new Set((enrollments ?? []).map((enrollment) => enrollment.student_id));
  const usedControlNumbers = new Set(
    (enrollments ?? [])
      .map((enrollment) => Number(enrollment.ctrl_no))
      .filter((ctrlNo) => Number.isInteger(ctrlNo)),
  );
  let nextControlNumber = Math.max(0, ...usedControlNumbers) + 1;
  const createdStudents = [];
  const createdEnrollments = [];

  for (const candidate of collectGradeSheetRoster(workbook)) {
    let student = studentsByName.get(normalizeName(candidate.name));
    if (!student) {
      const { data: createdStudent, error } = await supabase
        .from("students")
        .insert({ full_name: candidate.name, gender: candidate.gender })
        .select("id, full_name, gender, student_no")
        .single();
      if (error) throw error;
      student = createdStudent;
      studentsByName.set(normalizeName(student.full_name), student);
      createdStudents.push(student.full_name);
    } else if (!student.gender && candidate.gender) {
      const { error } = await supabase
        .from("students")
        .update({ gender: candidate.gender })
        .eq("id", student.id);
      if (error) throw error;
      student = { ...student, gender: candidate.gender };
    }

    if (enrolledStudentIds.has(student.id)) continue;
    let ctrlNo = candidate.ctrlNo;
    if (!Number.isInteger(ctrlNo) || usedControlNumbers.has(ctrlNo)) {
      while (usedControlNumbers.has(nextControlNumber)) nextControlNumber += 1;
      ctrlNo = nextControlNumber;
      nextControlNumber += 1;
    }
    const { error } = await supabase.from("enrollments").insert({
      section_id: section.id,
      student_id: student.id,
      ctrl_no: ctrlNo,
      status: "active",
    });
    if (error) throw error;
    enrolledStudentIds.add(student.id);
    usedControlNumbers.add(ctrlNo);
    createdEnrollments.push({ name: student.full_name, ctrlNo });
  }

  return { createdStudents, createdEnrollments };
}

function attendanceStatus(value) {
  const text = String(value ?? "").trim().toUpperCase();
  if (text === "1" || text === "P" || text === "PRESENT") return "present";
  if (text === "A" || text === "ABSENT") return "absent";
  if (text === "L" || text === "LATE") return "late";
  if (text === "E" || text === "EXCUSED") return "excused";
  return "";
}

function getSessionTime(section) {
  const hour = Number(String(section?.time_start ?? "").split(":")[0]);
  return Number.isFinite(hour) && hour >= 12 ? "PM" : "AM";
}

function periodCodeForAttendanceColumn(column) {
  return Object.entries(attendanceLayout).find(
    ([, layout]) => column >= layout.startColumn && column <= layout.endColumn,
  )?.[0] ?? "";
}

function metadataValue(rows, label) {
  const normalizedLabel = String(label).toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const row of rows) {
    const index = row.findIndex(
      (value) =>
        String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "") ===
        normalizedLabel,
    );
    if (index >= 0) return String(row[index + 1] ?? "").trim();
  }
  return "";
}

function parseTimeStart(value) {
  const match = String(value ?? "").match(/(\d{1,2}):?(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  const suffix = match[3].toUpperCase();
  const normalizedHour =
    suffix === "PM" ? (hour === 12 ? 12 : hour + 12) : hour === 12 ? 0 : hour;
  return `${String(normalizedHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

async function resolveGradeSheetClass({ workbook, supabase }) {
  if (!workbook.Sheets.Settings) {
    throw new Error("The selected file is not a supported grade sheet.");
  }
  const settingsRows = XLSX.utils.sheet_to_json(workbook.Sheets.Settings, {
    header: 1,
    defval: "",
  });
  const metadata = {
    schoolYear: metadataValue(settingsRows, "School Year"),
    semester: metadataValue(settingsRows, "Semester"),
    edpCode: metadataValue(settingsRows, "EDP Code"),
    subjectCode: metadataValue(settingsRows, "Subject Code"),
    sectionNo: metadataValue(settingsRows, "Section"),
    timeStart: parseTimeStart(metadataValue(settingsRows, "Time")),
  };

  let schoolYearId = null;
  if (metadata.schoolYear && metadata.semester) {
    const { data: schoolYear, error } = await supabase
      .from("school_years")
      .select("id")
      .eq("label", metadata.schoolYear)
      .eq("semester", metadata.semester)
      .maybeSingle();
    if (error) throw error;
    schoolYearId = schoolYear?.id ?? null;
  }

  let sectionQuery = supabase.from("sections").select("*");
  if (metadata.edpCode) {
    sectionQuery = sectionQuery.eq("edp_code", metadata.edpCode);
  } else if (metadata.subjectCode) {
    sectionQuery = sectionQuery.eq("subject_code", metadata.subjectCode);
    if (metadata.sectionNo) sectionQuery = sectionQuery.eq("section_no", metadata.sectionNo);
  } else {
    throw new Error("The grade sheet does not contain class identification details.");
  }
  if (schoolYearId) sectionQuery = sectionQuery.eq("school_year_id", schoolYearId);

  const { data: matchingSections, error: sectionError } = await sectionQuery.limit(2);
  if (sectionError) throw sectionError;
  if (!matchingSections?.length) {
    throw new Error(
      "No matching class was found for this grade sheet. Import its master list first.",
    );
  }
  if (matchingSections.length > 1) {
    throw new Error("More than one class matches this grade sheet. Add a unique EDP code.");
  }
  const section = matchingSections[0];

  let { data: enrollments, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("id, student_id, ctrl_no, student:students(id, full_name, gender, student_no)")
    .eq("section_id", section.id)
    .order("ctrl_no");
  if (enrollmentError) throw enrollmentError;

  const rosterChanges = await ensureGradeSheetRoster({
    workbook,
    supabase,
    section,
    enrollments,
  });
  if (rosterChanges.createdEnrollments.length) {
      const refreshed = await supabase
        .from("enrollments")
        .select("id, student_id, ctrl_no, student:students(id, full_name, gender, student_no)")
        .eq("section_id", section.id)
        .order("ctrl_no");
    if (refreshed.error) throw refreshed.error;
    enrollments = refreshed.data;
  }

  const students = (enrollments ?? []).map((enrollment, index) => ({
    id: enrollment.id,
    ctrlNo: enrollment.ctrl_no ?? index + 1,
    name: enrollment.student?.full_name ?? "",
    number: enrollment.student?.student_no ?? "",
  }));

  const { data: gradingPeriods, error: periodError } = await supabase
    .from("grading_periods")
    .select("id, code, sort_order, start_date, end_date")
    .order("sort_order");
  if (periodError) throw periodError;

  return {
    section: {
      ...section,
      time_start: section.time_start ?? metadata.timeStart,
    },
    students,
    gradingPeriods: gradingPeriods ?? [],
    rosterChanges,
  };
}

async function importRecordWorkbook({
  workbook,
  supabase,
  section,
  students,
  gradingPeriods,
}) {
  const byControlNumber = new Map(
    students.map((student) => [normalizeControlNumber(student.ctrlNo), student]),
  );
  const byName = new Map(students.map((student) => [normalizeName(student.name), student]));
  const periodByCode = new Map(gradingPeriods.map((period) => [period.code, period]));
  const scoreRows = new Map();
  const gradeOverrides = {}; // { [periodCode]: { [enrollmentId]: { own, cumulative } } }
  const importedPeriods = new Set();
  const matchedStudents = new Set();
  const unmatchedRows = new Set();

  Object.entries(periodSheets).forEach(([periodCode, sheetName]) => {
    const sheet = workbook.Sheets[sheetName];
    const period = periodByCode.get(periodCode);
    if (!sheet || !period) return;
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    const maximumRow = rows[gradeSheetRows.hps] ?? [];
    const dataRows = rows.slice(gradeSheetRows.firstStudent);
    const gradeCols = gradeColumns[periodCode];

    dataRows.forEach((row) => {
      if (!String(row?.[1] ?? "").trim()) return;
      const student = findStudent(row, students, byControlNumber, byName);
      if (!student) {
        unmatchedRows.add(normalizeName(row[1]));
        return;
      }
      matchedStudents.add(student.id);
      Object.entries(categoryColumns).forEach(([category, columns]) => {
        columns.forEach((scoreColumn, index) => {
          const maximum = numeric(maximumRow[scoreColumn]);
          if (maximum == null || maximum <= 0) return;
          const rawValue = row[scoreColumn];
          // Excel leaves the transmuted point cell blank when the student's
          // raw score is blank. COUNT/AVERAGE therefore ignores that item;
          // only an explicit numeric 0 is a recorded zero score.
          if (rawValue == null || String(rawValue).trim() === "") return;
          const rawScore = numeric(rawValue);
          if (rawScore == null) return;
          const score = Math.max(0, Math.min(rawScore, maximum));
          scoreRows.set(
            `${period.id}:${student.id}:${category}:${index + 1}`,
            {
              section_id: section.id,
              period_id: period.id,
              enrollment_id: student.id,
              category,
              item_no: index + 1,
              score,
              max_score: maximum,
            },
          );
          importedPeriods.add(period.id);
        });
      });

      // A teacher may type a grade directly into the sheet instead of
      // (or in addition to) itemized scores. Capture it so it survives
      // the round trip even when no raw scores exist for this student.
      if (gradeCols) {
        const ownGrade = numeric(row[gradeCols.own]);
        const cumulativeGrade =
          gradeCols.cumulative != null ? numeric(row[gradeCols.cumulative]) : null;
        if (ownGrade != null || cumulativeGrade != null) {
          gradeOverrides[periodCode] ??= {};
          gradeOverrides[periodCode][student.id] = {
            own: ownGrade,
            cumulative: cumulativeGrade,
          };
          importedPeriods.add(period.id);
        }
      }
    });
  });

  for (const period of periodByCode.values()) {
    const existingScores = await supabase
      .from("assessment_scores")
      .select("id, enrollment_id, category, item_no")
      .eq("section_id", section.id)
      .eq("period_id", period.id);
    if (existingScores.error) throw existingScores.error;
    const staleIds = (existingScores.data ?? [])
      .filter(
        (row) =>
          !scoreRows.has(
            `${period.id}:${row.enrollment_id}:${row.category}:${row.item_no}`,
          ),
      )
      .map((row) => row.id);
    if (staleIds.length) {
      const { error } = await supabase
        .from("assessment_scores")
        .delete()
        .in("id", staleIds);
      if (error) throw error;
    }
  }
  if (scoreRows.size) {
    const { error } = await supabase
      .from("assessment_scores")
      .upsert([...scoreRows.values()], {
      onConflict: "section_id,period_id,enrollment_id,category,item_no",
      });
    if (error) throw error;
  }

  let attendanceCount = 0;
  const attendanceSheet = workbook.Sheets.Attendance;
  if (attendanceSheet) {
    const rows = XLSX.utils.sheet_to_json(attendanceSheet, { header: 1, defval: "" });
    const header = rows[5] ?? [];
    const dateColumns = header
      .map((value, column) => ({
        date: parseDate(value),
        column,
        periodCode: periodCodeForAttendanceColumn(column),
      }))
      .filter((item) => item.date && item.periodCode);
    const sessions = new Map();

    dateColumns.forEach(({ date, column, periodCode }) => {
      const period = periodByCode.get(periodCode);
      if (!period) return;
      sessions.set(`${date}:${period.id}`, { date, period, column, records: new Map() });
    });

    rows.slice(attendanceRows.firstStudent).forEach((row) => {
      if (!String(row?.[2] ?? "").trim()) return;
      const student = findStudent([row[0], row[2]], students, byControlNumber, byName);
      if (!student) {
        unmatchedRows.add(normalizeName(row[2]));
        return;
      }
      matchedStudents.add(student.id);
      dateColumns.forEach(({ date, column, periodCode }) => {
        const period = periodByCode.get(periodCode);
        if (!period) return;
        const status = attendanceStatus(row[column]);
        if (!status) return;
        const session = sessions.get(`${date}:${period.id}`);
        session.records.set(student.id, {
          enrollment_id: student.id,
          status,
        });
      });
    });

    for (const session of sessions.values()) {
      const { data: savedSession, error: sessionError } = await supabase
        .from("class_sessions")
        .upsert(
          {
            section_id: section.id,
            period_id: session.period.id,
            session_date: session.date,
            session_time: getSessionTime(section),
          },
          { onConflict: "section_id,session_date,session_time" },
        )
        .select("id")
        .single();
      if (sessionError) throw sessionError;
      const { error: clearAttendanceError } = await supabase
        .from("attendance_records")
        .delete()
        .eq("session_id", savedSession.id);
      if (clearAttendanceError) throw clearAttendanceError;
      if (!session.records.size) continue;
      const records = [...session.records.values()].map((record) => ({
        session_id: savedSession.id,
        enrollment_id: record.enrollment_id,
        status: record.status,
      }));
      const { error: attendanceError } = await supabase
        .from("attendance_records")
        .upsert(records, { onConflict: "session_id,enrollment_id" });
      if (attendanceError) throw attendanceError;
      attendanceCount += records.length;
      importedPeriods.add(session.period.id);
    }
  }

  if (!scoreRows.size && !attendanceCount && !Object.keys(gradeOverrides).length) {
    throw new Error("No record scores, grades, or attendance values could be imported from this workbook.");
  }

  return {
    scoreCount: scoreRows.size,
    attendanceCount,
    matchedStudents: matchedStudents.size,
    unmatchedStudents: unmatchedRows.size,
    periodIds: [...importedPeriods],
    gradeOverrides,
  };
}

export async function importRecordFile({
  file,
  supabase,
  section,
  students,
  gradingPeriods,
}) {
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: true,
  });
  return importRecordWorkbook({
    workbook,
    supabase,
    section,
    students,
    gradingPeriods,
  });
}

export async function importGradeSheetFile({ file, supabase }) {
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: true,
  });
  if (!workbook.Sheets.Settings) {
    throw new Error(
      "This is a master list. Use Import master list for this file.",
    );
  }
  const resolved = await resolveGradeSheetClass({ workbook, supabase });
  const result = await importRecordWorkbook({
    workbook,
    supabase,
    ...resolved,
  });
  return {
    ...result,
    sectionId: resolved.section.id,
    subjectCode: resolved.section.subject_code,
    students: resolved.students,
    rosterChanges: resolved.rosterChanges,
  };
}
