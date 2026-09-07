import {
  monthBlocks,
  monthDataOffset,
  monthDataRows,
} from "./constants";
import { formatTimeRange } from "./formatters";
import { patchLiteral, patchCell } from "./patches";

function groupSessionsByDate(attendanceSessions) {
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
  return sessionsByDate;
}

function groupSessionsByMonth(attendanceSessions) {
  const monthGroups = new Map();
  [...groupSessionsByDate(attendanceSessions).values()].forEach((entry) => {
    const [year, month] = entry.date.split("-").map(Number);
    if (!Number.isInteger(year) || !Number.isInteger(month)) return;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const group = monthGroups.get(key) ?? [];
    group.push(entry);
    monthGroups.set(key, group);
  });
  return [...monthGroups.entries()].sort(([first], [second]) => first.localeCompare(second));
}

function countPresent(session, gender, students) {
  if (!session) return "";
  return students.filter(
    (student) =>
      student.gender === gender &&
      ["present", "late"].includes(session.statuses?.[student.id]),
  ).length;
}

function clearMonthData(patches, dataStart, dataEnd) {
  for (let row = dataStart; row <= dataEnd; row += 1) {
    for (let column = 1; column <= 10; column += 1) {
      patchLiteral(patches, "Month", row, column, "");
    }
  }
}

function writeMonthHeader(patches, section, students, blockStart, monthKey) {
  const headerRow = blockStart + 1;
  const monthLabel = monthKey
    ? new Date(Date.UTC(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)) - 1, 1))
        .toLocaleString("en-US", { month: "long", timeZone: "UTC" })
    : "";
  const male = students.filter((student) => student.gender === "M").length;
  const female = students.filter((student) => student.gender === "F").length;
  patchCell(patches, "Month", headerRow, 6, monthLabel);
  patchCell(patches, "Month", headerRow + 2, 3, section?.subject_code || "");
  patchCell(patches, "Month", headerRow + 2, 7, section?.subject_title || section?.subject_code || "");
  patchCell(patches, "Month", headerRow + 4, 3, section?.edp_code || "");
  patchCell(patches, "Month", headerRow + 4, 6, formatTimeRange(section));
  patchCell(patches, "Month", headerRow + 4, 10, section?.days || "");
  patchCell(patches, "Month", headerRow + 6, 3, students.length);
  patchCell(patches, "Month", headerRow + 6, 7, male);
  patchCell(patches, "Month", headerRow + 6, 11, female);
}

function writeMonthRows(patches, entries, dataStart, students) {
  const male = students.filter((student) => student.gender === "M").length;
  const female = students.filter((student) => student.gender === "F").length;
  entries.slice(0, monthDataRows).forEach((entry, index) => {
    const row = dataStart + index;
    patchLiteral(patches, "Month", row, 1, entry.date);
    patchLiteral(patches, "Month", row, 2, male);
    patchLiteral(patches, "Month", row, 3, female);
    patchLiteral(patches, "Month", row, 4, countPresent(entry.AM, "M", students));
    patchLiteral(patches, "Month", row, 5, countPresent(entry.AM, "F", students));
    patchLiteral(patches, "Month", row, 6, countPresent(entry.PM, "M", students));
    patchLiteral(patches, "Month", row, 7, countPresent(entry.PM, "F", students));
  });
}

export function fillMonth(patches, section, students, attendanceSessions) {
  const monthEntries = groupSessionsByMonth(attendanceSessions);
  if (monthEntries.length > monthBlocks.length) {
    throw new Error(
      `Excel sync stopped: ${monthEntries.length} attendance months exceed the template limit of ${monthBlocks.length}.`,
    );
  }

  monthBlocks.forEach((blockStart, blockIndex) => {
    const monthEntry = monthEntries[blockIndex];
    const monthRows = monthEntry?.[1] ?? [];
    const dataStart = blockStart + monthDataOffset;
    const dataEnd = dataStart + monthDataRows - 1;
    clearMonthData(patches, dataStart, dataEnd);
    writeMonthHeader(patches, section, students, blockStart, monthEntry?.[0]);
    writeMonthRows(patches, monthRows, dataStart, students);
    if (monthRows.length > monthDataRows) {
      throw new Error(
        `Excel sync stopped: ${monthEntry[0]} has more than ${monthDataRows} attendance dates, which the monthly template cannot display.`,
      );
    }
  });
}
