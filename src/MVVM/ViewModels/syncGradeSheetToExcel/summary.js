import { summaryPeriodOrder, summaryRosterRows } from "./constants";
import { clearRange, patchCell, patchFormula, patchLiteral } from "./patches";
import { getActivePeriodCodes } from "./periods";

const summaryColumns = { prelim: 2, midterm: 3, semifinal: 4, final: 5 };
const summaryFormulas = {
  prelim: (row) => `IF(Prelim!AJ${row}<>"",Prelim!AJ${row},"")`,
  midterm: (row) => `IF(Midterm!AL${row}<>"",Midterm!AL${row},"")`,
  semifinal: (row) => `IF(SemiFinal!AM${row}<>"",SemiFinal!AM${row},"")`,
  final: (row) => `IF(Final!AN${row}<>"",IF(Final!AN${row}<=3.05,Final!AN${row},5),"")`,
};

// Fixed offsets for the signature block, relative to the LAST student row.
// Adjust ROW_GAP / SIGNATORY_COL if your template places them differently.
const ROW_GAP = 2;          // blank rows between last student and signature block
const SIGNATORY_COL = 3;    // column D — change if "Mary Clarence A. Babatid" sits elsewhere
const OLD_SIGNATURE_ROWS = { start: 62, end: 63 }; // rows 63–64 (1-based) in your sheet, 0-based here

function writePeriodGrades(patches, row, periodRow, student, activeSet) {
  let carriedGrade = null;
  summaryPeriodOrder.forEach((code) => {
    const column = summaryColumns[code];
    if (activeSet.has(code)) {
      patchFormula(patches, "Summary", row, column, summaryFormulas[code](periodRow));
      const grade = Number(student.grades?.[code]);
      if (Number.isFinite(grade)) carriedGrade = grade;
    } else if (carriedGrade != null) {
      patchLiteral(patches, "Summary", row, column, carriedGrade);
    } else {
      patchLiteral(patches, "Summary", row, column, "");
    }
  });
}

export function fillSummary(patches, students, gradingPeriods) {
  clearRange(patches, "Summary", 6, summaryRosterRows + 5, 0, 6);
  ["CtrlNo.", "Student's Name", "PG", "MG", "SF", "FG", "Remarks"].forEach((value, index) => {
    patchCell(patches, "Summary", 5, index, value);
  });

  const activeSet = new Set(getActivePeriodCodes(gradingPeriods));

  students.forEach((student, index) => {
    const row = 6 + index;
    const periodRow = row + 4;
    patchCell(patches, "Summary", row, 0, index + 1);
    patchCell(patches, "Summary", row, 1, student.name);
    writePeriodGrades(patches, row, periodRow, student, activeSet);
    patchFormula(
      patches,
      "Summary",
      row,
      6,
      `IF(F${row + 1}<>"",IF(F${row + 1}<=3.05,"PASSED","FAILED"),"")`,
    );
  });

  // --- Reposition the signature block so it never collides with student rows ---
  const lastStudentRow = 6 + students.length - 1;
  const signatureRow = lastStudentRow + ROW_GAP;

  // Wipe out the old hardcoded signature block first, in case it now falls
  // inside the roster range (this was the actual bug in the screenshot).
  clearRange(patches, "Summary", OLD_SIGNATURE_ROWS.start, OLD_SIGNATURE_ROWS.end, SIGNATORY_COL, SIGNATORY_COL + 1);

  patchCell(patches, "Summary", signatureRow, SIGNATORY_COL, "Mary Clarence A. Babatid");
  patchCell(patches, "Summary", signatureRow + 1, SIGNATORY_COL, "Dean:");
}