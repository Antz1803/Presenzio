import * as XLSX from "xlsx";

const periodSheets = {
  prelim: "Prelim",
  midterm: "Midterm",
  semifinal: "SemiFinal",
  final: "Final",
};

const periodCodes = ["prelim", "midterm", "semifinal", "final"];

const categoryColumns = {
  quiz: { score: [2, 4, 6, 8], point: [3, 5, 7, 9], average: 10 },
  assignment: { score: [11, 13, 15, 17], point: [12, 14, 16, 18], average: 19 },
  activity: { score: [20, 22, 24, 26], point: [21, 23, 25, 27], average: 28 },
};

const transmutationBreakpoints = [
  [0, 5], [1, 4], [6, 3.9], [12, 3.8], [18, 3.7], [24, 3.6],
  [30, 3.5], [36, 3.4], [42, 3.3], [48, 3.2], [54, 3.1], [60, 3],
  [62, 2.9], [64, 2.8], [66, 2.7], [68, 2.6], [70, 2.5], [72, 2.4],
  [74, 2.3], [76, 2.2], [78, 2.1], [80, 2], [82, 1.9], [84, 1.8],
  [86, 1.7], [88, 1.6], [90, 1.5], [92, 1.4], [94, 1.3], [96, 1.2],
  [98, 1.1], [100, 1],
];

function transmutePercentage(value) {
  if (!Number.isFinite(Number(value))) return null;
  const percentage = Math.max(0, Math.min(100, Math.floor(Number(value))));
  let gradePoint = 5;
  transmutationBreakpoints.forEach(([breakpoint, grade]) => {
    if (percentage >= breakpoint) gradePoint = grade;
  });
  return gradePoint;
}

function setCell(sheet, row, column, value) {
  const address = XLSX.utils.encode_cell({ r: row, c: column });
  const next = { ...(sheet[address] ?? {}) };
  delete next.f;
  delete next.w;
  if (value == null || value === "") {
    next.t = "s";
    next.v = "";
  } else if (typeof value === "number" && Number.isFinite(value)) {
    next.t = "n";
    next.v = value;
  } else {
    next.t = "s";
    next.v = String(value);
  }
  sheet[address] = next;
}

function setAddress(sheet, address, value) {
  const decoded = XLSX.utils.decode_cell(address);
  setCell(sheet, decoded.r, decoded.c, value);
}

function clearExisting(sheet, startRow, endRow, startColumn, endColumn) {
  for (let row = startRow; row <= endRow; row += 1) {
    for (let column = startColumn; column <= endColumn; column += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      if (sheet[address]) setCell(sheet, row, column, "");
    }
  }
}

function formatTime(value) {
  if (!value) return "";
  return String(value).slice(0, 5);
}

function formatTimeRange(section) {
  const start = formatTime(section?.time_start);
  const end = formatTime(section?.time_end);
  return start && end ? `${start} - ${end}` : "";
}

function formatFileTime(value) {
  const time = formatTime(value);
  if (!time) return "";
  const [hourValue, minute] = time.split(":").map(Number);
  if (!Number.isFinite(hourValue) || !Number.isFinite(minute)) return "";
  const suffix = hourValue >= 12 ? "PM" : "AM";
  const hour = hourValue % 12 || 12;
  return `${hour}${String(minute).padStart(2, "0")}${suffix}`;
}

function formatDisplayDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  return `${month}/${day}/${year}`;
}

function safeFilePart(value) {
  return String(value || "class")
    .trim()
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, " ");
}

function setSectionMetadata(workbook, section) {
  const settings = workbook.Sheets.Settings;
  const summary = workbook.Sheets.Summary;
  const periodSheetNames = Object.values(periodSheets);
  const metadata = {
    room: section?.room || "",
    days: section?.days || "",
    time: formatTimeRange(section),
    code: section?.subject_code || "",
    title: section?.subject_title || section?.subject_code || "",
    edp: section?.edp_code || "",
    sectionNo: section?.section_no || "",
    year: section?.year_level || "",
    teacher: section?.teacher_name || "Teacher account",
  };

  setAddress(settings, "D1", metadata.year);
  setAddress(settings, "F1", metadata.room);
  setAddress(settings, "F2", metadata.time);
  setAddress(settings, "F3", metadata.days);
  setAddress(settings, "B4", metadata.edp);
  setAddress(settings, "F4", metadata.sectionNo);
  setAddress(settings, "B5", metadata.code);
  setAddress(settings, "B6", metadata.teacher);
  setAddress(settings, "B7", metadata.title);

  setAddress(summary, "B1", metadata.title);
  setAddress(summary, "E1", metadata.room);
  setAddress(summary, "B2", metadata.time);
  setAddress(summary, "E2", metadata.days);
  setAddress(summary, "B3", metadata.code);
  setAddress(summary, "E3", metadata.teacher);
  setAddress(summary, "B4", metadata.title);

  periodSheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    setAddress(sheet, "E2", metadata.room);
    setAddress(sheet, "E3", metadata.days);
    setAddress(sheet, "E4", metadata.teacher);
    setAddress(sheet, "R2", metadata.title);
    setAddress(sheet, "R3", metadata.time);
    setAddress(sheet, "R4", metadata.code);
  });
}

function fillAttendance(workbook, students, attendanceSessions) {
  const sheet = workbook.Sheets.Attendance;
  const sessions = [...attendanceSessions].sort((first, second) =>
    String(first.sessionDate).localeCompare(String(second.sessionDate)),
  );
  clearExisting(sheet, 5, 999, 0, 75);
  setCell(sheet, 5, 0, "CtrlNo.");
  setCell(sheet, 5, 1, "Gender");
  setCell(sheet, 5, 2, "Student's Name");
  setCell(sheet, 4, 4, "Attendance");

  sessions.forEach((session, index) => {
    setCell(sheet, 5, 4 + index, formatDisplayDate(session.sessionDate));
  });
  setCell(sheet, 5, 4 + sessions.length, `TOTAL|${sessions.length}`);

  students.forEach((student, studentIndex) => {
    const row = 6 + studentIndex;
    setCell(sheet, row, 0, student.ctrlNo ?? studentIndex + 1);
    setCell(
      sheet,
      row,
      1,
      student.gender === "M" || student.gender === "F" ? student.gender : "",
    );
    setCell(sheet, row, 2, student.name);
    let attended = 0;
    sessions.forEach((session, sessionIndex) => {
      const status = session.statuses?.[student.id];
      const symbol =
        status === "absent"
          ? "A"
          : status === "late"
            ? "L"
            : status === "excused"
              ? "E"
              : status === "present"
                ? "1"
                : "";
      if (status === "present" || status === "late") attended += 1;
      setCell(sheet, row, 4 + sessionIndex, symbol);
    });
    setCell(sheet, row, 4 + sessions.length, attended);
  });
}

function fillPeriodSheet(workbook, periodCode, students, assessmentScores, attendanceSessions) {
  const sheet = workbook.Sheets[periodSheets[periodCode]];
  const rows = assessmentScores.filter(
    (row) => row.period?.code === periodCode,
  );
  const periodSessions = attendanceSessions.filter(
    (session) => session.periodCode === periodCode,
  );
  const definitions = Object.entries(categoryColumns);

  // Excel row 9 (zero-based row 8) is the hidden HPS definition row. Keep
  // the template labels on row 8 and place real students on Excel row 10.
  clearExisting(sheet, 9, 999, 0, 40);
  definitions.forEach(([category, columns]) => {
    const categoryRows = rows.filter((row) => row.category === category);
    categoryRows.forEach((row) => {
      const itemIndex = Number(row.item_no) - 1;
      if (columns.score[itemIndex] == null) return;
      setCell(sheet, 8, columns.score[itemIndex], Number(row.max_score));
    });
  });

  setCell(sheet, 8, 31, periodSessions.length);

  students.forEach((student, studentIndex) => {
    const rowNumber = 9 + studentIndex;
    setCell(sheet, rowNumber, 0, student.ctrlNo ?? studentIndex + 1);
    setCell(sheet, rowNumber, 1, student.name);

    definitions.forEach(([category, columns]) => {
      const categoryRows = rows.filter(
        (row) => row.category === category && row.enrollment_id === student.id,
      );
      const points = [];
      categoryRows.forEach((row) => {
        const itemIndex = Number(row.item_no) - 1;
        const score = Number(row.score);
        const maxScore = Number(row.max_score);
        if (columns.score[itemIndex] == null || !Number.isFinite(score)) return;
        setCell(sheet, rowNumber, columns.score[itemIndex], score);
        const point = transmutePercentage((score / maxScore) * 100);
        if (Number.isFinite(point)) {
          points.push(point);
          setCell(sheet, rowNumber, columns.point[itemIndex], point);
        }
      });
      if (points.length) {
        setCell(
          sheet,
          rowNumber,
          columns.average,
          points.reduce((sum, point) => sum + point, 0) / points.length,
        );
      }
    });

    if (periodSessions.length) {
      const attended = periodSessions.filter((session) => {
        const status = session.statuses?.[student.id];
        return status === "present" || status === "late";
      }).length;
      setCell(sheet, rowNumber, 31, attended);
      setCell(
        sheet,
        rowNumber,
        32,
        transmutePercentage((attended / periodSessions.length) * 100),
      );
    }

    const exam = rows.find(
      (row) =>
        row.category === "exam" &&
        row.enrollment_id === student.id &&
        Number.isFinite(Number(row.score)),
    );
    if (exam) {
      setCell(sheet, rowNumber, 33, Number(exam.score));
      setCell(
        sheet,
        rowNumber,
        34,
        transmutePercentage((Number(exam.score) / Number(exam.max_score)) * 100),
      );
    }

    const grade = student.grades?.[periodCode];
    if (Number.isFinite(Number(grade))) {
      setCell(sheet, rowNumber, periodCode === "prelim" ? 35 : 36, Number(grade));
    }
  });
}

function fillSummary(workbook, students) {
  const sheet = workbook.Sheets.Summary;
  clearExisting(sheet, 6, 999, 0, 6);
  setCell(sheet, 5, 0, "CtrlNo.");
  setCell(sheet, 5, 1, "Student's Name");
  setCell(sheet, 5, 2, "PG");
  setCell(sheet, 5, 3, "MG");
  setCell(sheet, 5, 4, "SF");
  setCell(sheet, 5, 5, "FG");
  setCell(sheet, 5, 6, "Remarks");
  students.forEach((student, index) => {
    const row = 6 + index;
    const grades = student.grades ?? {};
    setCell(sheet, row, 0, student.ctrlNo ?? index + 1);
    setCell(sheet, row, 1, student.name);
    setCell(sheet, row, 2, grades.prelim);
    setCell(sheet, row, 3, grades.midterm);
    setCell(sheet, row, 4, grades.semifinal);
    setCell(sheet, row, 5, grades.final);
    // Summary remarks are based only on the final cumulative grade. Earlier
    // period grades must not be treated as a final result.
    const finalGrade = grades.final;
    setCell(
      sheet,
      row,
      6,
      Number.isFinite(Number(finalGrade))
        ? Number(finalGrade) <= 3.05
          ? "PASSED"
          : "FAILED"
        : "",
    );
  });
}

function fillMonth(workbook, section, students, attendanceSessions) {
  const sheet = workbook.Sheets.Month;
  clearExisting(sheet, 22, 999, 1, 10);
  setAddress(sheet, "D11", section?.subject_code || "");
  setAddress(sheet, "H11", section?.subject_title || section?.subject_code || "");
  setAddress(sheet, "D13", section?.edp_code || "");
  setAddress(sheet, "G13", formatTimeRange(section));
  setAddress(sheet, "K13", section?.days || "");
  setAddress(sheet, "D15", students.length);

  const sessions = [...attendanceSessions].sort((first, second) =>
    String(first.sessionDate).localeCompare(String(second.sessionDate)),
  );
  const male = students.filter((student) => student.gender === "M").length;
  const female = students.filter((student) => student.gender === "F").length;
  sessions.forEach((session, index) => {
    const row = 22 + index;
    const malePresent = students.filter(
      (student) =>
        student.gender === "M" &&
        ["present", "late"].includes(session.statuses?.[student.id]),
    ).length;
    const femalePresent = students.filter(
      (student) =>
        student.gender === "F" &&
        ["present", "late"].includes(session.statuses?.[student.id]),
    ).length;
    setCell(sheet, row, 1, session.sessionDate);
    setCell(sheet, row, 2, male);
    setCell(sheet, row, 3, female);
    if (session.sessionTime === "AM") {
      setCell(sheet, row, 4, malePresent);
      setCell(sheet, row, 5, femalePresent);
    } else {
      setCell(sheet, row, 6, malePresent);
      setCell(sheet, row, 7, femalePresent);
    }
  });
}

export async function syncGradeSheetToExcel({
  section,
  students,
  assessmentScores,
  attendanceSessions,
}) {
  const response = await fetch("/grade-sheet-template.xlsm");
  if (!response.ok) throw new Error("The Excel grade-sheet template could not be loaded.");
  const workbook = XLSX.read(await response.arrayBuffer(), {
    type: "array",
    cellFormula: true,
    cellStyles: true,
    bookVBA: true,
  });

  setSectionMetadata(workbook, section);
  fillAttendance(workbook, students, attendanceSessions);
  periodCodes.forEach((periodCode) =>
    fillPeriodSheet(workbook, periodCode, students, assessmentScores, attendanceSessions),
  );
  fillSummary(workbook, students);
  fillMonth(workbook, section, students, attendanceSessions);

  const subjectCode = safeFilePart(section?.subject_code);
  const days = safeFilePart(section?.days || "Schedule");
  const startTime = formatFileTime(section?.time_start);
  const endTime = formatFileTime(section?.time_end);
  const time = startTime && endTime ? `${startTime}${endTime}` : "Time";
  const fileName = `${subjectCode}-${days}-${time}.xlsm`;
  XLSX.writeFile(workbook, fileName, {
    bookType: "xlsm",
    bookVBA: true,
    compression: true,
  });
}
