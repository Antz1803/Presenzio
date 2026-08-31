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

// The template reserves fifteen date columns per grading period. The sixteenth
// column is a spacer before the total column (E:S, W:AK, AO:BC, BG:BU).
const maxAttendanceDatesPerPeriod = 15;
// The reference workbook has 70 roster rows on Attendance and period sheets,
// but only 60 rows on Summary. Keep one common limit so every sheet remains
// consistent and none of the footer/signature rows are overwritten.
const maxStudents = 60;
const attendanceRosterRows = 70;
const periodRosterRows = 70;
const summaryRosterRows = 60;

// The reference workbook repeats the monthly attendance report five times.
// Values are zero-based worksheet rows; each block is 63 rows tall and has
// thirty daily rows followed by a total/signature area.
const monthBlocks = [7, 70, 133, 196, 259];
const monthDataOffset = 15;
const monthDataRows = 30;

const categoryColumns = {
  quiz: { score: [2, 4, 6, 8], point: [3, 5, 7, 9], average: 10 },
  assignment: { score: [11, 13, 15, 17], point: [12, 14, 16, 18], average: 19 },
  activity: { score: [20, 22, 24, 26], point: [21, 23, 25, 27], average: 28 },
};

const gradeColumns = {
  prelim: { own: 35 },
  midterm: { own: 35, cumulative: 37 },
  semifinal: { own: 35, cumulative: 38 },
  final: { own: 35, cumulative: 39 },
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

function patchFormula(patches, sheetName, row, column, formula) {
  patchCell(patches, sheetName, row, column, { formula });
}

function patchLiteral(patches, sheetName, row, column, value) {
  patchCell(patches, sheetName, row, column, { literal: value });
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

// Expands shared formulas ("<f t="shared" ref="..." si="N">FORMULA</f>" on
// one master cell, "<f t="shared" si="N"/>" on every other member) into
// fully standalone, self-contained formulas on every cell in the group.
//
// Without this, overwriting a shared-formula MASTER cell (which
// patchLiteral does whenever the grade-fallback columns are used) deletes
// the only copy of the formula text in the XML. Every sibling cell that
// referenced it purely by "si" then points at nothing, Excel can't
// compute those cells, and it silently drops/repairs them on open. That
// was producing repair prompts and missing cells on the Prelim, Midterm,
// SemiFinal, and Final sheets specifically, since those are the sheets
// where patchLiteral can land on a shared-formula master row.
//
// Run this on the raw sheet XML before any cell patching happens, so no
// patch can ever orphan another cell in the same formula group again.
function unshareFormulas(xml) {
  const masters = new Map(); // si -> { formula, anchorAddress }
  const cellPattern = /<c\b[^>]*?\br="([A-Z]+\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g;

  let match;
  while ((match = cellPattern.exec(xml))) {
    const [cellText, address] = match;
    const masterMatch = cellText.match(
      /<f t="shared" ref="[^"]*" si="(\d+)"[^>]*>([^<]*)<\/f>/,
    );
    if (masterMatch) {
      masters.set(masterMatch[1], { formula: masterMatch[2], anchorAddress: address });
    }
  }
  if (!masters.size) return xml;

  function shiftFormula(formula, fromAddress, toAddress) {
    const from = XLSX.utils.decode_cell(fromAddress);
    const to = XLSX.utils.decode_cell(toAddress);
    const rowDelta = to.r - from.r;
    const colDelta = to.c - from.c;
    // Formula text here is already XML-escaped (e.g. "&gt;"); the cell-ref
    // regex only ever matches [A-Z]{1,3}\d+, which entities never contain,
    // so it's safe to rewrite in place without re-escaping.
    return formula.replace(
      /(\$?)([A-Z]{1,3})(\$?)(\d+)/g,
      (whole, colAbs, col, rowAbs, row) => {
        const nextCol = colAbs
          ? col
          : XLSX.utils.encode_col(XLSX.utils.decode_col(col) + colDelta);
        const nextRow = rowAbs ? row : String(Number(row) + rowDelta);
        return `${colAbs}${nextCol}${rowAbs}${nextRow}`;
      },
    );
  }

  cellPattern.lastIndex = 0;
  return xml.replace(cellPattern, (cellText, address) => {
    const sharedMatch = cellText.match(
      /<f t="shared"(?: ref="[^"]*")? si="(\d+)"\s*\/?>(?:([^<]*)<\/f>)?/,
    );
    if (!sharedMatch) return cellText;
    const master = masters.get(sharedMatch[1]);
    if (!master) return cellText;
    const standalone = shiftFormula(master.formula, master.anchorAddress, address);
    return cellText.replace(
      /<f t="shared"(?: ref="[^"]*")? si="\d+"\s*\/?>(?:[^<]*<\/f>)?/,
      `<f>${standalone}</f>`,
    );
  });
}

function cellXml(address, value, original = "") {
  // Keep the template's formulas, including shared-formula members. Clearing
  // one member of a shared formula group can make Excel repair the worksheet.
  // (Belt-and-suspenders: unshareFormulas() above already removes shared
  // formulas from the XML before this runs, so this guard should now only
  // ever see standalone <f> tags. Left in place in case any sheet slips
  // through without being unshared.)
  const isLiteralPatch =
    value &&
    typeof value === "object" &&
    Object.prototype.hasOwnProperty.call(value, "literal");
  if (/<f\b/.test(original) && !isLiteralPatch) return original;
  const cellValue = isLiteralPatch ? value.literal : value;
  const openingEnd = original.indexOf(">");
  let opening = openingEnd >= 0 ? original.slice(0, openingEnd + 1) : `<c r="${address}">`;
  opening = opening
    .replace(/\s+t="[^"]*"/g, "")
    .replace(/\s*\/?>$/, ">");

  if (cellValue && typeof cellValue === "object" && cellValue.formula) {
    return `${opening}<f>${escapeXml(cellValue.formula)}</f><v></v></c>`;
  }

  if (cellValue == null || cellValue === "") return `${opening}</c>`;
  if (typeof cellValue === "number" && Number.isFinite(cellValue)) {
    return `${opening}<v>${cellValue}</v></c>`;
  }
  return `${opening.replace(/>$/, ' t="inlineStr">')}<is><t xml:space="preserve">${escapeXml(cellValue)}</t></is></c>`;
}

function applySheetPatches(xml, patches) {
  const seen = new Set();
  // FIX: the attribute-matching groups must be LAZY ([^>]*?), not greedy
  // ([^>]*). A greedy match doesn't stop before the "/" of a self-closing
  // cell's "/>", so a blank/self-closing cell immediately followed by
  // another cell (extremely common: spacer columns, unused date/score
  // slots) got merged into a single match whose captured address belonged
  // only to the first cell. The second cell was silently absorbed into that
  // match's text, never got marked "seen", and later got re-inserted as a
  // brand-new duplicate <c> node further down the row — leaving the
  // original, untouched (and often stale) cell still sitting there too.
  // Over repeated syncs this produced duplicate cell references, and
  // whichever duplicate a given reader honored decided whether you saw
  // stale data or the field looked blank/missing entirely.
  const cellPattern = /<c\b[^>]*?\br="([A-Z]+\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g;
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

function periodCodeForRow(row, periodsById) {
  return (
    row?.period?.code ??
    periodsById.get(row?.period_id)?.code ??
    ""
  );
}

function validateExportSnapshot({
  students,
  assessmentScores,
  attendanceSessions,
  gradingPeriods,
}) {
  if (!Array.isArray(students) || !students.length) {
    throw new Error("Excel sync stopped: no students were loaded from the database.");
  }
  if (students.length > maxStudents) {
    throw new Error(
      `Excel sync stopped: ${students.length} students exceed the template limit of ${maxStudents}.`,
    );
  }

  const studentIds = new Set();
  students.forEach((student) => {
    if (!student?.id || studentIds.has(student.id)) {
      throw new Error("Excel sync stopped: duplicate or missing enrollment IDs were found.");
    }
    studentIds.add(student.id);
  });

  const periodsById = new Map((gradingPeriods ?? []).map((period) => [period.id, period]));
  const periodCodes = new Set(Object.keys(periodSheets));
  const itemLimits = { quiz: 4, assignment: 4, activity: 4, exam: 1 };
  const invalidScores = (assessmentScores ?? []).filter((row) => {
    const periodCode = periodCodeForRow(row, periodsById);
    return (
      !periodCodes.has(periodCode) ||
      !studentIds.has(row.enrollment_id) ||
      !itemLimits[row.category] ||
      Number(row.item_no) < 1 ||
      Number(row.item_no) > itemLimits[row.category]
    );
  });
  if (invalidScores.length) {
    throw new Error(
      `Excel sync stopped: ${invalidScores.length} assessment record(s) cannot be mapped to the template.`,
    );
  }

  const invalidSessions = (attendanceSessions ?? []).filter(
    (session) => !periodCodes.has(session.periodCode),
  );
  if (invalidSessions.length) {
    throw new Error(
      `Excel sync stopped: ${invalidSessions.length} attendance session(s) have no valid grading period.`,
    );
  }

  const invalidAttendance = (attendanceSessions ?? []).flatMap((session) =>
    Object.keys(session.statuses ?? {}).filter((enrollmentId) => !studentIds.has(enrollmentId)),
  );
  if (invalidAttendance.length) {
    throw new Error(
      `Excel sync stopped: ${invalidAttendance.length} attendance record(s) belong to an unknown enrollment.`,
    );
  }

  return periodsById;
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
  clearRange(patches, "Attendance", 5, 5, 0, 2);
  clearRange(patches, "Attendance", 6, attendanceRosterRows + 5, 0, 2);
  Object.values(attendanceLayout).forEach(({ startColumn, totalColumn }) => {
    clearRange(patches, "Attendance", 5, 5, startColumn, totalColumn);
    clearRange(
      patches,
      "Attendance",
      6,
      attendanceRosterRows + 5,
      startColumn,
      totalColumn,
    );
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
    patchCell(
      patches,
      "Attendance",
      row,
      1,
      student.gender === "M" || student.gender === "F" ? student.gender : "",
    );
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
          // The template totals attendance with SUM(...), so Present must be
          // a numeric 1. A text "1" is displayed but ignored by Excel SUM.
          { present: 1, absent: "A", late: "L", excused: "E" }[status] || "",
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
  attendanceSessions,
  periodsById,
) {
  const sheetName = periodSheets[periodCode];
  const rows = assessmentScores.filter(
    (row) => periodCodeForRow(row, periodsById) === periodCode,
  );
  const periodSessions = attendanceSessions.filter(
    (session) => session.periodCode === periodCode,
  );
  const assessments = assessmentDefinitions.filter(
    (assessment) => assessment.period?.code === periodCode,
  );
  // Excel row 9 (zero-based row 8) is the hidden HPS definition row. Its
  // score cells are referenced absolutely by every student formula, so the
  // roster must begin on Excel row 10 (zero-based row 9).
  clearRange(patches, sheetName, 9, periodRosterRows + 8, 0, 40);
  patchCell(patches, sheetName, 8, 0, "");
  patchCell(patches, sheetName, 8, 1, "");

  Object.entries(categoryColumns).forEach(([category, columns]) => {
    columns.score.forEach((column, index) => {
      const maximum = getAssessmentMaximum(rows, assessments, category, index + 1);
      patchCell(patches, sheetName, 8, column, maximum ?? "");
    });
  });
  const examMaximum = getAssessmentMaximum(rows, assessments, "exam", 1);
  patchCell(patches, sheetName, 8, 33, examMaximum ?? "");
  patchCell(
    patches,
    sheetName,
    8,
    31,
    periodSessions.length,
  );

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

    // A teacher may save a period grade directly without entering itemized
    // scores. In that case the template formula has no source value, so
    // write the saved grade into the appropriate grade cell as a fallback.
    // When raw scores or attendance exist, leave the template formula intact
    // so Excel continues to calculate from the complete record set.
    const hasRawPeriodRecord =
      rows.some(
        (item) =>
          item.enrollment_id === student.id && item.score != null,
      ) ||
      periodSessions.some((session) =>
        Object.prototype.hasOwnProperty.call(session.statuses ?? {}, student.id),
      );
    if (!hasRawPeriodRecord) {
      const details = student.gradeDetails?.[periodCode] ?? {};
      const ownGrade = Number(
        details.own ??
          (periodCode === "prelim" ? student.grades?.[periodCode] : null),
      );
      if (Number.isFinite(ownGrade)) {
        patchLiteral(patches, sheetName, row, gradeColumns[periodCode].own, ownGrade);
      }
      if (gradeColumns[periodCode].cumulative != null) {
        const cumulativeGrade = Number(
          details.cumulative ?? student.grades?.[periodCode],
        );
        if (Number.isFinite(cumulativeGrade)) {
          patchLiteral(
            patches,
            sheetName,
            row,
            gradeColumns[periodCode].cumulative,
            cumulativeGrade,
          );
        }
      }
    }
  });
}

function fillSummary(patches, students) {
  clearRange(patches, "Summary", 6, summaryRosterRows + 5, 0, 6);
  ["CtrlNo.", "Student's Name", "PG", "MG", "SF", "FG", "Remarks"].forEach((value, index) => patchCell(patches, "Summary", 5, index, value));
  students.forEach((student, index) => {
    const row = 6 + index;
    patchCell(patches, "Summary", row, 0, student.ctrlNo ?? index + 1);
    patchCell(patches, "Summary", row, 1, student.name);
    const periodRow = row + 4;
    patchFormula(
      patches,
      "Summary",
      row,
      2,
      `IF(Prelim!AJ${periodRow}<>"",Prelim!AJ${periodRow},"")`,
    );
    patchFormula(
      patches,
      "Summary",
      row,
      3,
      `IF(Midterm!AL${periodRow}<>"",Midterm!AL${periodRow},"")`,
    );
    patchFormula(
      patches,
      "Summary",
      row,
      4,
      `IF(SemiFinal!AM${periodRow}<>"",SemiFinal!AM${periodRow},"")`,
    );
    patchFormula(
      patches,
      "Summary",
      row,
      5,
      `IF(Final!AN${periodRow}<>"",IF(Final!AN${periodRow}<=3.05,Final!AN${periodRow},5),"")`,
    );
    patchFormula(
      patches,
      "Summary",
      row,
      6,
      `IF(F${row + 1}<>"",IF(F${row + 1}<=3.05,"PASSED","FAILED"),"")`,
    );
  });
}

function fillMonth(patches, section, students, attendanceSessions) {
  const sessionsByDate = new Map();
  [...attendanceSessions]
    .sort((a, b) => String(a.sessionDate).localeCompare(String(b.sessionDate)))
    .forEach((session) => {
      if (!session?.sessionDate) return;
      const date = String(session.sessionDate);
      const entry = sessionsByDate.get(date) ?? { date, AM: null, PM: null };
      const time = String(session.sessionTime || "PM").toUpperCase() === "AM" ? "AM" : "PM";
      entry[time] = session;
      sessionsByDate.set(date, entry);
    });

  const monthGroups = new Map();
  [...sessionsByDate.values()].forEach((entry) => {
    const [year, month] = entry.date.split("-").map(Number);
    if (!Number.isInteger(year) || !Number.isInteger(month)) return;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const group = monthGroups.get(key) ?? [];
    group.push(entry);
    monthGroups.set(key, group);
  });
  const monthEntries = [...monthGroups.entries()].sort(([first], [second]) =>
    first.localeCompare(second),
  );
  if (monthEntries.length > monthBlocks.length) {
    throw new Error(
      `Excel sync stopped: ${monthEntries.length} attendance months exceed the template limit of ${monthBlocks.length}.`,
    );
  }

  const male = students.filter((student) => student.gender === "M").length;
  const female = students.filter((student) => student.gender === "F").length;

  monthBlocks.forEach((blockStart, blockIndex) => {
    const monthEntry = monthEntries[blockIndex];
    const monthRows = monthEntry?.[1] ?? [];
    const headerRow = blockStart + 1;
    const dataStart = blockStart + monthDataOffset;
    const dataEnd = dataStart + monthDataRows - 1;

    // Clear only the daily table for this block. The reference workbook's
    // later monthly blocks must retain their headers, totals, and signatures.
    // Literal patches intentionally remove stale cached values/formulas from
    // the daily cells before writing the current attendance snapshot.
    for (let row = dataStart; row <= dataEnd; row += 1) {
      for (let column = 1; column <= 10; column += 1) {
        patchLiteral(patches, "Month", row, column, "");
      }
    }

    const monthLabel = monthEntry
      ? new Date(Date.UTC(Number(monthEntry[0].slice(0, 4)), Number(monthEntry[0].slice(5, 7)) - 1, 1))
          .toLocaleString("en-US", { month: "long", timeZone: "UTC" })
      : "";
    patchCell(patches, "Month", headerRow, 6, monthLabel);
    patchCell(patches, "Month", headerRow + 2, 3, section?.subject_code || "");
    patchCell(patches, "Month", headerRow + 2, 7, section?.subject_title || section?.subject_code || "");
    patchCell(patches, "Month", headerRow + 4, 3, section?.edp_code || "");
    patchCell(patches, "Month", headerRow + 4, 6, formatTimeRange(section));
    patchCell(patches, "Month", headerRow + 4, 10, section?.days || "");
    patchCell(patches, "Month", headerRow + 6, 3, students.length);
    patchCell(patches, "Month", headerRow + 6, 7, male);
    patchCell(patches, "Month", headerRow + 6, 11, female);

    monthRows.slice(0, monthDataRows).forEach((entry, index) => {
      const row = dataStart + index;
      const present = (session, gender) =>
        session
          ? students.filter(
              (student) =>
                student.gender === gender &&
                ["present", "late"].includes(session.statuses?.[student.id]),
            ).length
          : "";
      patchLiteral(patches, "Month", row, 1, entry.date);
      patchLiteral(patches, "Month", row, 2, male);
      patchLiteral(patches, "Month", row, 3, female);
      patchLiteral(patches, "Month", row, 4, present(entry.AM, "M"));
      patchLiteral(patches, "Month", row, 5, present(entry.AM, "F"));
      patchLiteral(patches, "Month", row, 6, present(entry.PM, "M"));
      patchLiteral(patches, "Month", row, 7, present(entry.PM, "F"));
    });

    if (monthRows.length > monthDataRows) {
      throw new Error(
        `Excel sync stopped: ${monthEntry[0]} has more than ${monthDataRows} attendance dates, which the monthly template cannot display.`,
      );
    }
  });
}

export async function syncGradeSheetToExcel({
  section,
  students,
  assessmentScores,
  assessmentDefinitions = [],
  attendanceSessions,
  gradingPeriods = [],
}) {
  const periodsById = validateExportSnapshot({
    students,
    assessmentScores,
    assessmentDefinitions,
    attendanceSessions,
    gradingPeriods,
  });
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
      attendanceSessions,
      periodsById,
    ),
  );
  fillSummary(patches, students);
  fillMonth(patches, section, students, attendanceSessions);

  Object.entries(patches).forEach(([sheetName, sheetPatches]) => {
    const file = getTemplateFile(cfb, `sheet${templateSheetNumbers[sheetName]}.xml`);
    const xml = new TextDecoder().decode(file.content);
    const unshared = unshareFormulas(xml);
    file.content = new TextEncoder().encode(applySheetPatches(unshared, sheetPatches));
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
