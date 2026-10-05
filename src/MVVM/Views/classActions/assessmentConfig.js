export const assessmentCategories = [
  { key: "quiz", label: "Quiz" },
  { key: "assignment", label: "Assignment" },
  { key: "activity", label: "Graded activity" },
  { key: "exam", label: "Exam" },
];

export const assessmentPeriods = [
  { key: "prelim", label: "Prelim" },
  { key: "midterm", label: "Midterm" },
  { key: "semifinal", label: "Semi-final" },
  { key: "final", label: "Final" },
];

export const assessmentItemLimits = {
  quiz: 4,
  assignment: 4,
  activity: 4,
  exam: 1,
};
export const categoryItemPrefixes = {
  quiz: "Q",
  assignment: "A",
  activity: "G",
  exam: "E",
};

export function itemNoOptions(category) {
  const limit = assessmentItemLimits[category] ?? 4;
  const prefix = categoryItemPrefixes[category] ?? "Q";
  return Array.from({ length: limit }, (_, index) => ({
    value: String(index + 1),
    label: `${prefix}${index + 1}`,
  }));
}
