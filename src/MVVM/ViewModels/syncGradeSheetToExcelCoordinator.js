import * as CFB from "cfb";
import { fillAttendance } from "./syncGradeSheetToExcel/attendance";
import { periodSheets, templateSheetNumbers } from "./syncGradeSheetToExcel/constants";
import { formatFileTime, safeFilePart } from "./syncGradeSheetToExcel/formatters";
import { setMetadata } from "./syncGradeSheetToExcel/metadata";
import { fillMonth } from "./syncGradeSheetToExcel/month";
import {
  buildPeriodDateRanges,
  getActivePeriodCodes,
  periodCodeForRow,
  sessionWithinPeriodRange,
} from "./syncGradeSheetToExcel/periods";
import { fillPeriod } from "./syncGradeSheetToExcel/periodSheets";
import { fillSummary } from "./syncGradeSheetToExcel/summary";
import { validateExportSnapshot } from "./syncGradeSheetToExcel/validate";
import { applySheetPatches, getTemplateFile, unshareFormulas } from "./syncGradeSheetToExcel/xml";

function sortStudents(students) {
  return [...students].sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), undefined, {
      sensitivity: "base",
      numeric: true,
    }),
  );
}

function filterExportData({
  activePeriodSet,
  periodDateRanges,
  assessmentScores,
  assessmentDefinitions,
  attendanceSessions,
  periodsById,
}) {
  return {
    assessmentScores: (assessmentScores ?? []).filter((row) =>
      activePeriodSet.has(periodCodeForRow(row, periodsById)),
    ),
    assessmentDefinitions: (assessmentDefinitions ?? []).filter((item) =>
      activePeriodSet.has(item.period?.code),
    ),
    attendanceSessions: (attendanceSessions ?? []).filter(
      (session) =>
        activePeriodSet.has(session.periodCode) &&
        sessionWithinPeriodRange(session, periodDateRanges),
    ),
  };
}

async function loadTemplate() {
  const response = await fetch("/grade-sheet-template.xlsm");
  if (!response.ok) throw new Error("The Excel grade-sheet template could not be loaded.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  return CFB.read(bytes, { type: "array" });
}

function applyPatchesToWorkbook(cfb, patches) {
  Object.entries(patches).forEach(([sheetName, sheetPatches]) => {
    const file = getTemplateFile(cfb, `sheet${templateSheetNumbers[sheetName]}.xml`);
    const xml = new TextDecoder().decode(file.content);
    const updatedXml = applySheetPatches(unshareFormulas(xml), sheetPatches, sheetName);
    file.content = new TextEncoder().encode(updatedXml);
    file.size = file.content.length;
  });
}

function downloadWorkbook(cfb, section) {
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
    attendanceSessions,
    gradingPeriods,
  });
  const sortedStudents = sortStudents(students);
  const activePeriodCodes = getActivePeriodCodes(gradingPeriods);
  const activePeriodSet = new Set(activePeriodCodes);
  const filteredData = filterExportData({
    activePeriodSet,
    periodDateRanges: buildPeriodDateRanges(gradingPeriods),
    assessmentScores,
    assessmentDefinitions,
    attendanceSessions,
    periodsById,
  });

  const cfb = await loadTemplate();
  const patches = {};
  setMetadata(patches, section);
  fillAttendance(patches, sortedStudents, filteredData.attendanceSessions);
  Object.keys(periodSheets).forEach((periodCode) => {
    fillPeriod(
      patches,
      periodCode,
      sortedStudents,
      filteredData.assessmentScores,
      filteredData.assessmentDefinitions,
      filteredData.attendanceSessions,
      periodsById,
      activePeriodSet.has(periodCode),
    );
  });
  fillSummary(patches, sortedStudents, gradingPeriods);
  fillMonth(patches, section, sortedStudents, filteredData.attendanceSessions);
  applyPatchesToWorkbook(cfb, patches);
  downloadWorkbook(cfb, section);
}
