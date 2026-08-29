import * as XLSX from "xlsx";
import * as CFB from "cfb";

const periodSheets = {
  prelim: "Prelim",
  midterm: "Midterm",
  semifinal: "SemiFinal",
  final: "Final",
};

const templateSheetNumbers = {
  Settings: 1,
  Attendance: 2,
  Prelim: 3,
  Midterm: 4,
  SemiFinal: 5,
  Final: 6,
  Summary: 7,
  Month: 8,
};

const attendanceLayout = {
  prelim: { startColumn: 4, totalColumn: 20 },
  midterm: { startColumn: 22, totalColumn: 38 },
  semifinal: { startColumn: 40, totalColumn: 56 },
  final: { startColumn: 58, totalColumn: 74 },
};

const maxAttendanceDatesPerPeriod = 16;

const categoryColumns = {
  quiz: { score: [2, 4, 6, 8], point: [3, 5, 7, 9], average: 10 },
  assignment: { score: [11, 13, 15, 17], point: [12, 14, 16, 18], average: 19 },
  activity: { score: [20, 22, 24, 26], point: [21, 23, 25, 27], average: 28 },
};

function cellAddress(row, column) {
  return XLSX.utils.encode_cell({ r: row, c: column });
}

function patchCell(patches, sheetName, row, column, value) {
  patches[sheetName] ??= new Map();
  patches[sheetName].set(cellAddress(row, column), value);
}

function patchAddress(patches, sheetName, address, value) {
  patches[sheetName] ??= new Map();
  patches[sheetName].set(address, value);
}

function clearRange(patches, sheetName, startRow, endRow, startColumn, endColumn) {
  for (let row = startRow; row <= endRow; row += 1) {
    for (let column = startColumn; column <= endColumn; column += 1) {
      patchCell(patches, sheetName, row, column, "");
    }
  }
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cellXml(address, value, original = "") {
  // Keep the template's formulas, including shared-formula members. Clearing
  // one member of a shared formula group can make Excel repair the worksheet.
  if (/<f\b/.test(original)) return original;
  const openingEnd = original.indexOf(">");
  let opening = openingEnd >= 0 ? original.slice(0, openingEnd + 1) : `<c r="${address}">`;
  opening = opening
    .replace(/\s+t="[^"]*"/g, "")
    .replace(/\s*\/?>$/, ">");

  if (value == null || value === "") return `${opening}</c>`;
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${opening}<v>${value}</v></c>`;
  }
  return `${opening.replace(/>$/, ' t="inlineStr">')}<is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function applySheetPatches(xml, patches) {
  const seen = new Set();
  const cellPattern = /<c\b[^>]*\br="([A-Z]+\d+)"[^>]*(?:\/>|>[\s\S]*?<\/c>)/g;
  const rowPattern = /<row\b[^>]*\br="(\d+)"[^>]*>[\s\S]*?<\/row>/g;
  const updated = xml.replace(rowPattern, (rowXml, rowNumber) => {
    const row = Number(rowNumber);
    let nextRow = rowXml.replace(cellPattern, (original, address) => {
      if (!patches.has(address)) return original;
      seen.add(address);
      return cellXml(address, patches.get(address), original);
    });
    const missing = [];
    patches.forEach((value, address) => {
      if (!seen.has(address) && XLSX.utils.decode_cell(address).r + 1 === row) {
        seen.add(address);
        missing.push({
          address,
          column: XLSX.utils.decode_cell(address).c,
          xml: cellXml(address, value),
        });
      }
    });
    missing.sort((first, second) => first.column - second.column);
    missing.forEach(({ column, xml: missingCell }) => {
      const existingCells = [...nextRow.matchAll(cellPattern)];
      const nextCell = existingCells.find((match) => {
        const existingAddress = match[1];
        return XLSX.utils.decode_cell(existingAddress).c > column;
      });
      const extensionPoint = nextRow.indexOf("<extLst");
      const insertionPoint =
        nextCell?.index ??
        (extensionPoint >= 0 ? extensionPoint : nextRow.lastIndexOf("</row>"));
      nextRow = `${nextRow.slice(0, insertionPoint)}${missingCell}${nextRow.slice(insertionPoint)}`;
    });
    return nextRow;
  });
  return updated;
}

function getTemplateFile(cfb, name) {
  const file = cfb.FileIndex.find((item) => item.name === name);
  if (!file) throw new Error(`Template sheet file ${name} was not found.`);
  return file;
}

function setMetadata(patches, section) {
  const time = formatTimeRange(section);
  const metadata = {
    room: section?.room || "",
    days: section?.days || "",
    time,
    code: section?.subject_code || "",
    title: section?.subject_title || section?.subject_code || "",
    edp: section?.edp_code || "",
    sectionNo: section?.section_no || "",
    year: section?.year_level || "",
    teacher: section?.teacher_name || "Jeorge Rey Mancilla",
  };
  const settings = [
    ["D1", metadata.year], ["F1", metadata.room], ["F2", metadata.time],
    ["F3", metadata.days], ["B4", metadata.edp], ["F4", metadata.sectionNo],
    ["B5", metadata.code], ["B6", metadata.teacher], ["B7", metadata.title],
  ];
  settings.forEach(([address, value]) => patchAddress(patches, "Settings", address, value));
  [
    ["B1", metadata.title], ["E1", metadata.room], ["B2", metadata.time],
    ["E2", metadata.days], ["B3", metadata.code], ["E3", metadata.teacher],
    ["B4", metadata.title],
  ].forEach(([address, value]) => patchAddress(patches, "Summary", address, value));
  Object.values(periodSheets).forEach((sheetName) => {
    [["E2", metadata.room], ["E3", metadata.days], ["E4", metadata.teacher],
      ["R2", metadata.title], ["R3", metadata.time], ["R4", metadata.code]]
      .forEach(([address, value]) => patchAddress(patches, sheetName, address, value));
  });
}

function formatTime(value) {
  return value ? String(value).slice(0, 5) : "";
}

function formatTimeRange(section) {
  const start = formatTime(section?.time_start);
  const end = formatTime(section?.time_end);
  return start && end ? `${start} - ${end}` : "";
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  return `${month}/${day}/${year}`;
}

function formatFileTime(value) {
  const time = formatTime(value);
  if (!time) return "";
  const [hourValue, minute] = time.split(":").map(Number);
  if (!Number.isFinite(hourValue) || !Number.isFinite(minute)) return "";
  return `${hourValue % 12 || 12}${String(minute).padStart(2, "0")}${hourValue >= 12 ? "PM" : "AM"}`;
}

function safeFilePart(value) {
  return String(value || "class").trim().replace(/[<>:"/\\|?*]+/g, "-").replace(/\s+/g, " ");
}

function fillAttendance(patches, students, attendanceSessions) {
  const sessionsByPeriod = Object.fromEntries(
    Object.keys(attendanceLayout).map((periodCode) => [periodCode, []]),
  );
  attendanceSessions.forEach((session) => {
    if (sessionsByPeriod[session.periodCode]) {
      sessionsByPeriod[session.periodCode].push(session);
    }
  });
  Object.entries(sessionsByPeriod).forEach(([periodCode, sessions]) => {
    sessions.sort((a, b) =>
      String(a.sessionDate).localeCompare(String(b.sessionDate)),
    );
    if (sessions.length > maxAttendanceDatesPerPeriod) {
      throw new Error(
        `${periodCode} has more than ${maxAttendanceDatesPerPeriod} attendance dates, which the Excel template cannot display.`,
      );
    }
  });
  clearRange(patches, "Attendance", 5, 80, 0, 2);
  Object.values(attendanceLayout).forEach(({ startColumn, totalColumn }) => {
    clearRange(patches, "Attendance", 5, 80, startColumn, totalColumn);
  });
  patchCell(patches, "Attendance", 5, 0, "CtrlNo.");
  patchCell(patches, "Attendance", 5, 1, "Gender");
  patchCell(patches, "Attendance", 5, 2, "Student's Name");
  Object.entries(attendanceLayout).forEach(([periodCode, layout]) => {
    const sessions = sessionsByPeriod[periodCode];
    sessions.forEach((session, index) =>
      patchCell(
        patches,
        "Attendance",
        5,
        layout.startColumn + index,
        formatDate(session.sessionDate),
      ),
    );
    patchCell(
      patches,
      "Attendance",
      5,
      layout.totalColumn,
      `TOTAL|${sessions.length}`,
    );
  });
  students.forEach((student, index) => {
    const row = 6 + index;
    patchCell(patches, "Attendance", row, 0, student.ctrlNo ?? index + 1);
    patchCell(patches, "Attendance", row, 1, student.gender === "—" ? "" : student.gender);
    patchCell(patches, "Attendance", row, 2, student.name);
    Object.entries(attendanceLayout).forEach(([periodCode, layout]) => {
      const sessions = sessionsByPeriod[periodCode];
      let attended = 0;
      sessions.forEach((session, sessionIndex) => {
        const status = session.statuses?.[student.id];
        if (status === "present" || status === "late") attended += 1;
        patchCell(
          patches,
          "Attendance",
          row,
          layout.startColumn + sessionIndex,
          { present: "1", absent: "A", late: "L", excused: "E" }[status] || "",
        );
      });
      patchCell(patches, "Attendance", row, layout.totalColumn, attended);
    });
  });
}

function getAssessmentMaximum(rows, assessments, category, itemNo) {
  const scoreRow = rows.find(
    (row) => row.category === category && Number(row.item_no) === itemNo,
  );
  if (Number(scoreRow?.max_score) > 0) return Number(scoreRow.max_score);
  const assessment = assessments.find(
    (item) => item.category === category && Number(item.item_no) === itemNo,
  );
  const maximum = (assessment?.questions ?? []).reduce(
    (total, question) => total + Number(question.points || 0),
    0,
  );
  return maximum > 0 ? maximum : null;
}

function fillPeriod(
  patches,
  periodCode,
  students,
  assessmentScores,
  assessmentDefinitions,
) {
  const sheetName = periodSheets[periodCode];
  const rows = assessmentScores.filter((row) => row.period?.code === periodCode);
  const assessments = assessmentDefinitions.filter(
    (assessment) => assessment.period?.code === periodCode,
  );
  clearRange(patches, sheetName, 8, 80, 0, 40);
  patchCell(patches, sheetName, 8, 0, "No.");
  patchCell(patches, sheetName, 8, 1, "Student's Name");

  Object.entries(categoryColumns).forEach(([category, columns]) => {
    columns.score.forEach((column, index) => {
      const maximum = getAssessmentMaximum(rows, assessments, category, index + 1);
      if (maximum != null) patchCell(patches, sheetName, 8, column, maximum);
    });
  });
  const examMaximum = getAssessmentMaximum(rows, assessments, "exam", 1);
  if (examMaximum != null) patchCell(patches, sheetName, 8, 33, examMaximum);

  students.forEach((student, studentIndex) => {
    const row = 9 + studentIndex;
    patchCell(patches, sheetName, row, 0, student.ctrlNo ?? studentIndex + 1);
    patchCell(patches, sheetName, row, 1, student.name);
    Object.entries(categoryColumns).forEach(([category, columns]) => {
      rows.filter((item) => item.category === category && item.enrollment_id === student.id).forEach((item) => {
        const slot = Number(item.item_no) - 1;
        const score = Number(item.score);
        if (columns.score[slot] == null || !Number.isFinite(score)) return;
        patchCell(patches, sheetName, row, columns.score[slot], score);
      });
    });
    const exam = rows.find((item) => item.category === "exam" && item.enrollment_id === student.id && Number.isFinite(Number(item.score)));
    if (exam) {
      patchCell(patches, sheetName, row, 33, Number(exam.score));
    }
  });
}

function fillSummary(patches, students) {
  clearRange(patches, "Summary", 6, 80, 0, 6);
  ["CtrlNo.", "Student's Name", "PG", "MG", "SF", "FG", "Remarks"].forEach((value, index) => patchCell(patches, "Summary", 5, index, value));
  students.forEach((student, index) => {
    const row = 6 + index;
    patchCell(patches, "Summary", row, 0, student.ctrlNo ?? index + 1);
    patchCell(patches, "Summary", row, 1, student.name);
  });
}

function fillMonth(patches, section, students, attendanceSessions) {
  clearRange(patches, "Month", 22, 120, 1, 10);
  patchAddress(patches, "Month", "D11", section?.subject_code || "");
  patchAddress(patches, "Month", "H11", section?.subject_title || section?.subject_code || "");
  patchAddress(patches, "Month", "D13", section?.edp_code || "");
  patchAddress(patches, "Month", "G13", formatTimeRange(section));
  patchAddress(patches, "Month", "K13", section?.days || "");
  patchAddress(patches, "Month", "D15", students.length);
  const sessions = [...attendanceSessions].sort((a, b) => String(a.sessionDate).localeCompare(String(b.sessionDate)));
  const male = students.filter((student) => student.gender === "M").length;
  const female = students.filter((student) => student.gender === "F").length;
  sessions.forEach((session, index) => {
    const row = 22 + index;
    const present = (gender) => students.filter((student) => student.gender === gender && ["present", "late"].includes(session.statuses?.[student.id])).length;
    patchCell(patches, "Month", row, 1, session.sessionDate);
    patchCell(patches, "Month", row, 2, male);
    patchCell(patches, "Month", row, 3, female);
    patchCell(patches, "Month", row, session.sessionTime === "AM" ? 4 : 6, present("M"));
    patchCell(patches, "Month", row, session.sessionTime === "AM" ? 5 : 7, present("F"));
  });
}

export async function syncGradeSheetToExcel({
  section,
  students,
  assessmentScores,
  assessmentDefinitions = [],
  attendanceSessions,
}) {
  const response = await fetch("/grade-sheet-template.xlsm");
  if (!response.ok) throw new Error("The Excel grade-sheet template could not be loaded.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  const cfb = CFB.read(bytes, { type: "array" });
  const patches = {};
  setMetadata(patches, section);
  fillAttendance(patches, students, attendanceSessions);
  Object.keys(periodSheets).forEach((periodCode) =>
    fillPeriod(
      patches,
      periodCode,
      students,
      assessmentScores,
      assessmentDefinitions,
    ),
  );
  fillSummary(patches, students);
  fillMonth(patches, section, students, attendanceSessions);

  Object.entries(patches).forEach(([sheetName, sheetPatches]) => {
    const file = getTemplateFile(cfb, `sheet${templateSheetNumbers[sheetName]}.xml`);
    const xml = new TextDecoder().decode(file.content);
    file.content = new TextEncoder().encode(applySheetPatches(xml, sheetPatches));
    file.size = file.content.length;
  });

  const output = CFB.write(cfb, { type: "array", fileType: "zip" });
  const start = formatFileTime(section?.time_start);
  const end = formatFileTime(section?.time_end);
  const time = start && end ? `${start}${end}` : "Time";
  const filename = `${safeFilePart(section?.subject_code)}-${safeFilePart(section?.days || "Schedule")}-${time}.xlsm`;
  const blob = new Blob([output], { type: "application/vnd.ms-excel.sheet.macroEnabled.12" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
