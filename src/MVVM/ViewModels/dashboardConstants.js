export const emptyStats = {
  totalStudents: 0,
  male: 0,
  female: 0,
  todayAttendance: "—",
  todayPresent: 0,
  todayAbsent: 0,
  classAverage: "—",
  needsAttention: 0,
  monthAttendance: "—",
  attendanceBars: [0, 0, 0, 0, 0, 0, 0],
  totalPresent: 0,
  totalAbsent: 0,
  totalLate: 0,
  sessionsHeld: 0,
  sessionsThisWeek: 0,
  mostConsistent: "—",
  excellentCount: 0,
  goodCount: 0,
  needsReviewCount: 0,
  passingRate: "—",
};

// These are the weights and transmutation breakpoints used by the uploaded
// grading workbook. The workbook uses VLOOKUP's approximate-match behavior,
// so each breakpoint applies until the next breakpoint is reached.
export const gradingWeights = {
  quiz: 0.2,
  assignment: 0.1,
  activity: 0.3,
  // The workbook has a sixth spacer component (AD/AE) with a blank/zero
  // weight. Keep it in the model so the calculation mirrors the sheet's
  // six-term SUM(PRODUCT(...)) expression without affecting the result.
  spacer: 0,
  attendance: 0.05,
  exam: 0.35,
};

export const assessmentItemLimits = {
  quiz: 4,
  assignment: 4,
  activity: 4,
  exam: 1,
};

export const transmutationBreakpoints = [
  [0, 5],
  [1, 4],
  [6, 3.9],
  [12, 3.8],
  [18, 3.7],
  [24, 3.6],
  [30, 3.5],
  [36, 3.4],
  [42, 3.3],
  [48, 3.2],
  [54, 3.1],
  [60, 3],
  [62, 2.9],
  [64, 2.8],
  [66, 2.7],
  [68, 2.6],
  [70, 2.5],
  [72, 2.4],
  [74, 2.3],
  [76, 2.2],
  [78, 2.1],
  [80, 2],
  [82, 1.9],
  [84, 1.8],
  [86, 1.7],
  [88, 1.6],
  [90, 1.5],
  [92, 1.4],
  [94, 1.3],
  [96, 1.2],
  [98, 1.1],
  [100, 1],
];
