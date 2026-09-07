export const categoryLabels = {
  quiz: "Quiz",
  assignment: "Assignment",
  activity: "Graded activity",
  exam: "Exam",
};

export const periodLabels = {
  prelim: "Prelim",
  midterm: "Midterm",
  semifinal: "Semi-final",
  final: "Final",
};

export const letters = ["A", "B", "C", "D"];

export function formatCountdown(seconds) {
  if (seconds == null) return "";
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

