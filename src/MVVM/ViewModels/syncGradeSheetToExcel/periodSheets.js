import {
  categoryColumns,
  gradeColumns,
  periodRosterRows,
  periodSheets,
} from "./constants";
import { clearRange, patchCell, patchFormula, patchLiteral } from "./patches";
import { periodCodeForRow } from "./periods";

const periodFormulaConfig = {
  prelim: {
    attendanceColumn: "U",
    weightColumn: "E",
    weightRow: 12,
  },
  midterm: {
    attendanceColumn: "AM",
    weightColumn: "E",
    weightRow: 21,
  },
  semifinal: {
    attendanceColumn: "BE",
    weightColumn: "H",
    weightRow: 12,
  },
  final: {
    attendanceColumn: "BW",
    weightColumn: "H",
    weightRow: 21,
  },
};

const pointFormulaColumns = [
  ["C", "D"], ["E", "F"], ["G", "H"], ["I", "J"],
  ["L", "M"], ["N", "O"], ["P", "Q"], ["R", "S"],
  ["U", "V"], ["W", "X"], ["Y", "Z"], ["AA", "AB"],
  ["AD", "AE"], ["AH", "AI"],
];

function transmutedScoreFormula(scoreColumn, row) {
  return `IF(AND(B${row}<>""),IF($${scoreColumn}$9<>0,VLOOKUP(${scoreColumn}${row}/$${scoreColumn}$9*100,TRANSMUTATION_TABLE!$A$2:$B$102,2),""),"")`;
}

function averageFormula(columns, row) {
  return `IF(COUNT(${columns.map((column) => `${column}${row}`).join(",")})>0,AVERAGE(${columns.map((column) => `${column}${row}`).join(",")}),"")`;
}

function gradeFormula(periodCode, row) {
  const config = periodFormulaConfig[periodCode];
  const averages = ["K", "T", "AC", "AE", "AI", "AG"];
  const products = averages.map((column, index) =>
    `PRODUCT(${column}${row},IF(Settings!$${config.weightColumn}$${config.weightRow + index}<>0,Settings!$${config.weightColumn}$${config.weightRow + index}/100,0))`,
  );
  return `IF(OR(${averages.map((column) => `${column}${row}<>""`).join(",")}` +
    `),SUM(${products.join(",")}),"")`;
}

function cumulativeFormulas(periodCode, row) {
  if (periodCode === "midterm") {
    return {
      AK: `Prelim!AJ${row}`,
      AL: `IF(Prelim!AJ${row}<>"",IF(AJ${row}<>"",AJ${row}*0.7+Prelim!AJ${row}*0.3,""),"")`,
    };
  }
  if (periodCode === "semifinal") {
    return {
      AK: `Prelim!AJ${row}`,
      AL: `Midterm!AL${row}`,
      AM: `IF(AJ${row}<>"",AVERAGE(Prelim!AJ${row},Midterm!AL${row},SemiFinal!AJ${row}),"")`,
    };
  }
  if (periodCode === "final") {
    return {
      AK: `Prelim!AJ${row}`,
      AL: `Midterm!AL${row}`,
      AM: `SemiFinal!AM${row}`,
      AN: `IF(AJ${row}<>"",AVERAGE(AVERAGE(Prelim!AJ${row},Midterm!AL${row}),AVERAGE(SemiFinal!AM${row},Final!AJ${row})),"")`,
      AO: `IF(AN${row}>3,5,AN${row})`,
    };
  }
  return {};
}

function writeTemplateFormulas(patches, sheetName, periodCode, row, attendanceRow) {
  const config = periodFormulaConfig[periodCode];
  pointFormulaColumns.forEach(([scoreColumn, pointColumn]) => {
    patchFormula(patches, sheetName, row - 1, columnNumber(pointColumn), transmutedScoreFormula(scoreColumn, row));
  });
  patchFormula(patches, sheetName, row - 1, columnNumber("K"), averageFormula(["D", "F", "H", "J"], row));
  patchFormula(patches, sheetName, row - 1, columnNumber("T"), averageFormula(["M", "O", "Q", "S"], row));
  patchFormula(patches, sheetName, row - 1, columnNumber("AC"), averageFormula(["V", "X", "Z", "AB"], row));
  patchFormula(patches, sheetName, row - 1, columnNumber("AF"), `Attendance!${config.attendanceColumn}${attendanceRow}`);
  patchFormula(patches, sheetName, row - 1, columnNumber("AJ"), gradeFormula(periodCode, row));
  Object.entries(cumulativeFormulas(periodCode, row)).forEach(([column, formula]) => {
    patchFormula(patches, sheetName, row - 1, columnNumber(column), formula);
  });
}

function columnNumber(column) {
  return column.split("").reduce((total, character) => total * 26 + character.charCodeAt(0) - 64, 0) - 1;
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

function writeMaximums(patches, sheetName, rows, assessments, sessionCount) {
  Object.entries(categoryColumns).forEach(([category, columns]) => {
    columns.score.forEach((column, index) => {
      const maximum = getAssessmentMaximum(rows, assessments, category, index + 1);
      patchCell(patches, sheetName, 8, column, maximum ?? "");
    });
  });
  patchCell(patches, sheetName, 8, 33, getAssessmentMaximum(rows, assessments, "exam", 1) ?? "");
  patchCell(patches, sheetName, 8, 31, sessionCount);
}

function writeScores(patches, sheetName, row, student, rows) {
  Object.entries(categoryColumns).forEach(([category, columns]) => {
    rows
      .filter((item) => item.category === category && item.enrollment_id === student.id)
      .forEach((item) => {
        const slot = Number(item.item_no) - 1;
        const score = Number(item.score);
        if (columns.score[slot] == null || !Number.isFinite(score)) return;
        patchCell(patches, sheetName, row, columns.score[slot], score);
      });
  });

  const exam = rows.find(
    (item) =>
      item.category === "exam" &&
      item.enrollment_id === student.id &&
      Number.isFinite(Number(item.score)),
  );
  if (exam) patchCell(patches, sheetName, row, 33, Number(exam.score));
}

function hasRawPeriodRecord(student, rows, periodSessions) {
  return (
    rows.some((item) => item.enrollment_id === student.id && item.score != null) ||
    periodSessions.some((session) =>
      Object.prototype.hasOwnProperty.call(session.statuses ?? {}, student.id),
    )
  );
}

function writeGradeFallback(patches, sheetName, row, student, periodCode, hasRawRecord) {
  if (hasRawRecord) return;
  const details = student.gradeDetails?.[periodCode] ?? {};
  const ownGrade = Number(
    details.own ?? (periodCode === "prelim" ? student.grades?.[periodCode] : null),
  );
  if (Number.isFinite(ownGrade)) {
    patchLiteral(patches, sheetName, row, gradeColumns[periodCode].own, ownGrade);
  }

  const cumulativeColumn = gradeColumns[periodCode].cumulative;
  if (cumulativeColumn != null) {
    const cumulativeGrade = Number(details.cumulative ?? student.grades?.[periodCode]);
    if (Number.isFinite(cumulativeGrade)) {
      patchLiteral(patches, sheetName, row, cumulativeColumn, cumulativeGrade);
    }
  }
}

export function fillPeriod(
  patches,
  periodCode,
  students,
  assessmentScores,
  assessmentDefinitions,
  attendanceSessions,
  periodsById,
  allowGradeFallback = true,
) {
  const sheetName = periodSheets[periodCode];
  const rows = assessmentScores.filter((row) => periodCodeForRow(row, periodsById) === periodCode);
  const periodSessions = attendanceSessions.filter((session) => session.periodCode === periodCode);
  const assessments = assessmentDefinitions.filter(
    (assessment) => assessment.period?.code === periodCode,
  );

  clearRange(patches, sheetName, 9, periodRosterRows + 8, 0, 40);
  patchCell(patches, sheetName, 8, 0, "");
  patchCell(patches, sheetName, 8, 1, "");
  writeMaximums(patches, sheetName, rows, assessments, periodSessions.length);

  students.forEach((student, studentIndex) => {
    const row = 9 + studentIndex;
    writeTemplateFormulas(patches, sheetName, periodCode, row + 1, 7 + studentIndex);
    patchCell(patches, sheetName, row, 0, studentIndex + 1);
    patchCell(patches, sheetName, row, 1, student.name);
    writeScores(patches, sheetName, row, student, rows);
    writeGradeFallback(
      patches,
      sheetName,
      row,
      student,
      periodCode,
      !allowGradeFallback || hasRawPeriodRecord(student, rows, periodSessions),
    );
  });
}

export function clearPeriodSheet(patches, periodCode) {
  const sheetName = periodSheets[periodCode];
  clearRange(patches, sheetName, 9, periodRosterRows + 8, 0, 40);
  patchCell(patches, sheetName, 8, 0, "");
  patchCell(patches, sheetName, 8, 1, "");
  Object.values(categoryColumns).forEach((columns) => {
    columns.score.forEach((column) => patchCell(patches, sheetName, 8, column, ""));
  });
  patchCell(patches, sheetName, 8, 33, "");
  patchCell(patches, sheetName, 8, 31, "");
}
