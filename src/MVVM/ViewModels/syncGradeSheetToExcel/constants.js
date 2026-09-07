export const periodSheets = {
  prelim: "Prelim",
  midterm: "Midterm",
  semifinal: "SemiFinal",
  final: "Final",
};

export const templateSheetNumbers = {
  Settings: 1,
  Attendance: 2,
  Prelim: 3,
  Midterm: 4,
  SemiFinal: 5,
  Final: 6,
  Summary: 7,
  Month: 8,
};

export const attendanceLayout = {
  prelim: { startColumn: 4, totalColumn: 20 },
  midterm: { startColumn: 22, totalColumn: 38 },
  semifinal: { startColumn: 40, totalColumn: 56 },
  final: { startColumn: 58, totalColumn: 74 },
};

export const maxAttendanceDatesPerPeriod = 15;
export const maxStudents = 75;
export const attendanceRosterRows = 75;
export const periodRosterRows = 75;
export const summaryRosterRows = 75;
export const monthBlocks = [7, 70, 133, 196, 259];
export const monthDataOffset = 15;
export const monthDataRows = 30;

export const categoryColumns = {
  quiz: { score: [2, 4, 6, 8], point: [3, 5, 7, 9], average: 10 },
  assignment: { score: [11, 13, 15, 17], point: [12, 14, 16, 18], average: 19 },
  activity: { score: [20, 22, 24, 26], point: [21, 23, 25, 27], average: 28 },
};

export const gradeColumns = {
  prelim: { own: 35 },
  midterm: { own: 35, cumulative: 37 },
  semifinal: { own: 35, cumulative: 38 },
  final: { own: 35, cumulative: 39 },
};

export const summaryPeriodOrder = ["prelim", "midterm", "semifinal", "final"];
