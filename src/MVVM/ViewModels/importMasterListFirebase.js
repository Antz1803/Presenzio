import * as XLSX from "xlsx";
import { newId, patch, read } from "../../lib/accountDb";

function cell(row, index) {
  return String(row?.[index] ?? "").trim();
}

function headerRow(rows) {
  return rows.findIndex(
    (row) =>
      cell(row, 0).toLowerCase() === "item" &&
      cell(row, 1).toLowerCase() === "student id",
  );
}

function labeledValue(rows, label) {
  const row = rows.find((item) => cell(item, 0).toLowerCase() === label.toLowerCase());
  return row ? cell(row, 2) : "";
}

function academicDetails(rows) {
  const text = rows
    .flat()
    .map((value) => String(value ?? "").trim())
    .find((value) => value.toLowerCase().startsWith("class list for the academic year:"));
  const match = text?.match(/academic year:\s*([^,]+),\s*semester:\s*(.+)$/i);
  return {
    label: match?.[1]?.trim() || "Unknown",
    semester: match?.[2]?.trim() || "Unknown",
  };
}

function parseSchedule(value) {
  const match = String(value ?? "").match(
    /^(.+?)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*(AM|PM)$/i,
  );
  if (!match) return { days: value || null, time_start: null, time_end: null };
  const toTime = (time) => {
    const [hour, minute] = time.split(":").map(Number);
    const isPm = match[4].toUpperCase() === "PM";
    const hour24 = isPm ? (hour === 12 ? 12 : hour + 12) : hour === 12 ? 0 : hour;
    return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
  };
  return { days: match[1].trim(), time_start: toTime(match[2]), time_end: toTime(match[3]) };
}

function parseWorksheet(workbook, sheetName) {
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: "",
  });
  const start = headerRow(rows);
  if (start < 0) throw new Error("The selected worksheet does not have the expected master-list headers.");
  const records = rows
    .slice(start + 1)
    .map((row) => ({
      student_no: cell(row, 1),
      full_name: cell(row, 2),
      gender: /^female$/i.test(cell(row, 3)) ? "F" : /^male$/i.test(cell(row, 3)) ? "M" : null,
      course: cell(row, 4) || null,
      year_level: cell(row, 5) || null,
      contact_no: cell(row, 6) || null,
      email: cell(row, 7) || null,
      ctrl_no: Number(row?.[0]) || null,
    }))
    .filter((row) => row.student_no && row.full_name);
  if (!records.length) throw new Error("No student records were found in the worksheet.");
  const academic = academicDetails(rows);
  const edpCode = labeledValue(rows, "EDP Code") || sheetName.split(",")[0].trim();
  const subjectCode = labeledValue(rows, "Subject Code") || "Imported class";
  return {
    sheetName,
    academic,
    section: {
      subject_code: subjectCode,
      subject_title: labeledValue(rows, "Subject Name") || subjectCode,
      edp_code: edpCode || null,
      section_no: sheetName.includes(",") ? sheetName.split(",").slice(1).join(",").trim() : null,
      room: labeledValue(rows, "Room No.") || null,
      ...parseSchedule(labeledValue(rows, "Schedule")),
    },
    records,
  };
}

function normalizeStudent(record) {
  return {
    student_no: record.student_no,
    full_name: record.full_name,
    gender: record.gender,
    course: record.course === "N/A" ? null : record.course,
    year_level: record.year_level === "N/A" ? null : record.year_level,
    contact_no: record.contact_no === "N/A" ? null : record.contact_no,
    email: record.email === "N/A" ? null : record.email,
  };
}

export async function importMasterListFile({ file, userId }) {
  if (!userId) throw new Error("Your account session is not ready. Please sign in again before importing.");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  if (workbook.Sheets.Settings) throw new Error("This is a grade sheet. Use Import grade sheet for this file.");
  const sheetNames = workbook.SheetNames.filter((name) => {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: "" });
    return headerRow(rows) >= 0;
  });
  if (!sheetNames.length) throw new Error("No worksheet with Item and Student ID master-list headers was found.");

  const worksheets = sheetNames.map((sheetName) => parseWorksheet(workbook, sheetName));
  const [schoolYears, sections, students, enrollments] = await Promise.all([
    read(userId, "schoolYears"),
    read(userId, "sections"),
    read(userId, "students"),
    read(userId, "enrollments"),
  ]);
  const schoolYearMap = schoolYears ?? {};
  const sectionMap = sections ?? {};
  const studentMap = students ?? {};
  const enrollmentMap = enrollments ?? {};
  const updates = {};
  const results = [];
  const studentByNumber = new Map(
    Object.entries(studentMap)
      .filter(([, value]) => value?.student_no)
      .map(([id, value]) => [String(value.student_no), { id, ...value }]),
  );

  for (const worksheet of worksheets) {
    let schoolYearId = Object.entries(schoolYearMap).find(
      ([, value]) => value?.label === worksheet.academic.label && value?.semester === worksheet.academic.semester,
    )?.[0];
    if (!schoolYearId) {
      schoolYearId = newId();
      schoolYearMap[schoolYearId] = {
        label: worksheet.academic.label,
        semester: worksheet.academic.semester,
      };
      updates[`schoolYears/${schoolYearId}`] = schoolYearMap[schoolYearId];
    }

    const existingSection = Object.entries(sectionMap).find(([, value]) =>
      value?.school_year_id === schoolYearId &&
      (worksheet.section.edp_code
        ? value.edp_code === worksheet.section.edp_code
        : value.subject_code === worksheet.section.subject_code && value.section_no === worksheet.section.section_no),
    );
    const sectionId = existingSection?.[0] ?? newId();
    const section = {
      ...(existingSection?.[1] ?? {}),
      ...worksheet.section,
      school_year_id: schoolYearId,
      teacher_id: userId,
      created_at: existingSection?.[1]?.created_at ?? new Date().toISOString(),
    };
    sectionMap[sectionId] = section;
    updates[`sections/${sectionId}`] = section;

    const existingEnrollments = enrollmentMap[sectionId] ?? {};
    const usedControls = new Set(
      Object.values(existingEnrollments).map((value) => Number(value?.ctrl_no)).filter(Number.isFinite),
    );
    let nextControl = Math.max(0, ...usedControls) + 1;
    let enrollmentCount = 0;
    for (const record of worksheet.records) {
      const profile = normalizeStudent(record);
      let student = studentByNumber.get(record.student_no);
      if (student) {
        student = { ...student, ...profile };
        studentMap[student.id] = student;
        updates[`students/${student.id}`] = student;
      } else {
        const studentId = newId();
        student = { id: studentId, ...profile, created_at: new Date().toISOString() };
        studentByNumber.set(record.student_no, student);
        studentMap[studentId] = student;
        updates[`students/${studentId}`] = student;
      }
      const alreadyEnrolled = Object.values(existingEnrollments).some(
        (value) => value?.student_id === student.id,
      );
      if (alreadyEnrolled) continue;
      let ctrlNo = Number(record.ctrl_no);
      if (!Number.isInteger(ctrlNo) || ctrlNo < 1 || usedControls.has(ctrlNo)) {
        while (usedControls.has(nextControl)) nextControl += 1;
        ctrlNo = nextControl;
      }
      usedControls.add(ctrlNo);
      const enrollmentId = newId();
      existingEnrollments[enrollmentId] = {
        student_id: student.id,
        ctrl_no: ctrlNo,
        status: "active",
        enrolled_on: new Date().toISOString().slice(0, 10),
      };
      updates[`enrollments/${sectionId}/${enrollmentId}`] = existingEnrollments[enrollmentId];
      enrollmentCount += 1;
    }
    results.push({
      count: worksheet.records.length,
      sheetName: worksheet.sheetName,
      sectionId,
      subjectCode: section.subject_code,
      edpCode: section.edp_code,
      enrollmentCount,
    });
  }

  await patch(userId, updates);
  return {
    count: results.reduce((total, result) => total + result.count, 0),
    sheetName: `${results.length} worksheets`,
    worksheetCount: results.length,
    sectionId: results[0]?.sectionId ?? null,
    sectionIds: results.map((result) => result.sectionId),
    subjectCode: "all classes",
    edpCode: results.map((result) => result.edpCode).filter(Boolean),
    results,
    dedupSummary: { groupsFound: 0, studentsMerged: 0, errors: [] },
  };
}
