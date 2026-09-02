import * as XLSX from "xlsx";
import { mergeDuplicateStudentRecords } from "./studentDedup";

function cellText(row, index) {
  return String(row?.[index] ?? "").trim();
}

function findMasterListHeader(rows) {
  return rows.findIndex(
    (row) =>
      cellText(row, 0).toLowerCase() === "item" &&
      cellText(row, 1).toLowerCase() === "student id",
  );
}

function metadataValue(rows, label) {
  const row = rows.find(
    (item) => cellText(item, 0).toLowerCase() === label.toLowerCase(),
  );
  return row ? cellText(row, 2) : "";
}

function parseAcademicInfo(rows) {
  const line =
    rows
      .flat()
      .map((value) => String(value ?? "").trim())
      .find((value) =>
        value.toLowerCase().startsWith("class list for the academic year:"),
      ) ?? "";
  const match = line.match(/academic year:\s*([^,]+),\s*semester:\s*(.+)$/i);
  return {
    label: match?.[1]?.trim() || "Unknown",
    semester: match?.[2]?.trim() || "Unknown",
  };
}

function parseSchedule(value) {
  const match = value.match(
    /^(.+?)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*(AM|PM)$/i,
  );
  if (!match) return { days: value || null, time_start: null, time_end: null };
  const to24Hour = (time) => {
    const [hour, minute] = time.split(":").map(Number);
    const suffix = match[4].toUpperCase();
    const normalizedHour =
      suffix === "PM" ? (hour === 12 ? 12 : hour + 12) : hour === 12 ? 0 : hour;
    return `${String(normalizedHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
  };
  return {
    days: match[1].trim(),
    time_start: to24Hour(match[2]),
    time_end: to24Hour(match[3]),
  };
}

async function getOrCreateSection({ rows, sheetName, supabase }) {
  const academic = parseAcademicInfo(rows);
  const edpCode =
    metadataValue(rows, "EDP Code") || sheetName.split(",")[0].trim();
  const subjectCode = metadataValue(rows, "Subject Code") || "Imported class";
  const subjectTitle = metadataValue(rows, "Subject Name") || subjectCode;
  const schedule = parseSchedule(metadataValue(rows, "Schedule"));
  const room = metadataValue(rows, "Room No.") || null;
  const sectionNo = sheetName.includes(",")
    ? sheetName.split(",").slice(1).join(",").trim()
    : null;

  const { data: schoolYear, error: schoolYearLookupError } = await supabase
    .from("school_years")
    .select("id")
    .eq("label", academic.label)
    .eq("semester", academic.semester)
    .maybeSingle();
  if (schoolYearLookupError) throw schoolYearLookupError;

  let schoolYearId = schoolYear?.id;
  if (!schoolYearId) {
    const { data: createdSchoolYear, error } = await supabase
      .from("school_years")
      .insert({ label: academic.label, semester: academic.semester })
      .select("id")
      .single();
    if (error) throw error;
    schoolYearId = createdSchoolYear.id;
  }

  let sectionQuery = supabase
    .from("sections")
    .select("id")
    .eq("school_year_id", schoolYearId);
  sectionQuery = edpCode
    ? sectionQuery.eq("edp_code", edpCode)
    : sectionQuery.eq("subject_code", subjectCode).eq("section_no", sectionNo);
  const { data: existingSection, error: sectionLookupError } =
    await sectionQuery.limit(1).maybeSingle();
  if (sectionLookupError) throw sectionLookupError;

  const sectionPayload = {
    school_year_id: schoolYearId,
    subject_code: subjectCode,
    subject_title: subjectTitle,
    edp_code: edpCode || null,
    section_no: sectionNo,
    room,
    days: schedule.days,
    time_start: schedule.time_start,
    time_end: schedule.time_end,
  };
  if (existingSection) {
    const { error } = await supabase
      .from("sections")
      .update(sectionPayload)
      .eq("id", existingSection.id);
    if (error) throw error;
    return { id: existingSection.id, subjectCode, edpCode };
  }
  const { data: createdSection, error } = await supabase
    .from("sections")
    .insert(sectionPayload)
    .select("id")
    .single();
  if (error) throw error;
  return { id: createdSection.id, subjectCode, edpCode };
}

function parseMasterListSheet({ workbook, sheetName }) {
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: "",
  });
  const headerIndex = findMasterListHeader(rows);
  if (headerIndex < 0)
    throw new Error(
      "The selected worksheet does not have the expected master-list headers.",
    );
  const records = rows
    .slice(headerIndex + 1)
    .map((row) => ({
      student_no: String(row[1]).trim(),
      full_name: String(row[2]).trim(),
      gender:
        String(row[3]).trim().toLowerCase() === "female"
          ? "F"
          : String(row[3]).trim().toLowerCase() === "male"
            ? "M"
            : null,
      course: String(row[4]).trim() || null,
      year_level: String(row[5]).trim() || null,
      contact_no: String(row[6]).trim() || null,
      email: String(row[7]).trim() || null,
      ctrl_no: Number(row[0]) || null,
    }))
    .filter((record) => record.student_no && record.full_name);

  if (!records.length)
    throw new Error("No student records were found in the worksheet.");
  return { rows, sheetName, records };
}

export async function importMasterListFile({ file, supabase }) {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  if (workbook.Sheets.Settings) {
    throw new Error(
      "This is a grade sheet. Use Import grade sheet for this file.",
    );
  }
  const sheetsWithMasterListHeaders = workbook.SheetNames.filter((name) => {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], {
      header: 1,
      defval: "",
    });
    return findMasterListHeader(rows) >= 0;
  });
  if (!sheetsWithMasterListHeaders.length) {
    throw new Error(
      "No worksheet with Item and Student ID master-list headers was found.",
    );
  }

  const parsedSheets = sheetsWithMasterListHeaders.map((sheetName) =>
    parseMasterListSheet({ workbook, sheetName }),
  );
  const sections = [];
  for (const sheet of parsedSheets) {
    try {
      const section = await getOrCreateSection({
        rows: sheet.rows,
        sheetName: sheet.sheetName,
        supabase,
      });
      sections.push({ ...sheet, section });
    } catch (error) {
      throw new Error(
        `${sheet.sheetName}: ${error.message ?? "section import failed."}`,
        { cause: error },
      );
    }
  }

  const recordsByStudentNumber = new Map();
  sections.forEach((sheet) =>
    sheet.records.forEach((record) => {
      recordsByStudentNumber.set(record.student_no, record);
    }),
  );
  const { data: existingStudents, error: studentLookupError } = await supabase
    .from("students")
    .select("id, student_no")
    .in("student_no", [...recordsByStudentNumber.keys()]);
  if (studentLookupError) throw studentLookupError;
  const studentsByNumber = new Map(
    (existingStudents ?? []).map((student) => [student.student_no, student]),
  );
  const studentPayload = (record) => ({
    student_no: record.student_no,
    full_name: record.full_name,
    gender: record.gender,
    course: record.course === "N/A" ? null : record.course,
    year_level: record.year_level === "N/A" ? null : record.year_level,
    contact_no: record.contact_no === "N/A" ? null : record.contact_no,
    email: record.email === "N/A" ? null : record.email,
  });
  const updates = [];
  const inserts = [];
  recordsByStudentNumber.forEach((record, studentNo) => {
    const existing = studentsByNumber.get(studentNo);
    if (existing) updates.push({ id: existing.id, ...studentPayload(record) });
    else inserts.push(studentPayload(record));
  });
  if (updates.length) {
    const { error } = await supabase
      .from("students")
      .upsert(updates, { onConflict: "id" });
    if (error) throw error;
  }
  if (inserts.length) {
    const { error } = await supabase.from("students").insert(inserts);
    if (error) throw error;
  }

  // A student may already exist under a differently-formatted name (e.g.
  // created earlier by a grade-sheet import that couldn't find an exact
  // match). Now that the master list — the source of truth — has been
  // written, fold any such duplicates into a single record.
  const dedupSummary = await mergeDuplicateStudentRecords(supabase);

  const { data: importedStudents, error: importedStudentLookupError } =
    await supabase
      .from("students")
      .select("id, student_no")
      .in("student_no", [...recordsByStudentNumber.keys()]);
  if (importedStudentLookupError) throw importedStudentLookupError;
  const importedStudentsByNumber = new Map(
    (importedStudents ?? []).map((student) => [student.student_no, student]),
  );

  const results = [];
  for (const sheet of sections) {
    const { data: existingEnrollments, error: enrollmentLookupError } =
      await supabase
        .from("enrollments")
        .select("student_id")
        .eq("section_id", sheet.section.id);
    if (enrollmentLookupError) throw enrollmentLookupError;
    const enrolledStudentIds = new Set(
      (existingEnrollments ?? []).map((enrollment) => enrollment.student_id),
    );
    const enrollmentPayloads = [];
    const seenStudentIds = new Set();
    sheet.records.forEach((record) => {
      const student = importedStudentsByNumber.get(record.student_no);
      if (!student || enrolledStudentIds.has(student.id) || seenStudentIds.has(student.id)) {
        return;
      }
      seenStudentIds.add(student.id);
      enrollmentPayloads.push({
        section_id: sheet.section.id,
        student_id: student.id,
        ctrl_no: record.ctrl_no,
        status: "active",
      });
    });
    if (enrollmentPayloads.length) {
      const { error } = await supabase
        .from("enrollments")
        .insert(enrollmentPayloads);
      if (error) throw error;
    }
    results.push({
      count: sheet.records.length,
      sheetName: sheet.sheetName,
      sectionId: sheet.section.id,
      subjectCode: sheet.section.subjectCode,
      edpCode: sheet.section.edpCode,
      enrollmentCount: enrollmentPayloads.length,
    });
  }
  return {
    count: results.reduce((total, result) => total + result.count, 0),
    sheetName: `${results.length} worksheets`,
    worksheetCount: results.length,
    sectionId: results[0]?.sectionId ?? null,
    sectionIds: results.map((result) => result.sectionId),
    subjectCode: "all classes",
    edpCode: results.map((result) => result.edpCode).filter(Boolean),
    results,
    dedupSummary,
  };
}