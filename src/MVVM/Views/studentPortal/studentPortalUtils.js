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

/**
 * Formats full name strings into Title Case.
 * Example: "ENDONA, FATIMA GRACE" -> "Fatima Grace Endona"
 * Short Format (short = true): "ENDONA, FATIMA GRACE" -> "Endona, Fatima G."
 */
export function formatStudentName(nameStr, short = false) {
  if (!nameStr) return "";

  const fixCase = (str) =>
    str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());

  // Handle "LASTNAME, FIRSTNAME" format
  if (nameStr.includes(",")) {
    const [last, first] = nameStr.split(",").map((s) => s.trim());
    const cleanLast = fixCase(last);
    const cleanFirst = fixCase(first);

    if (short) {
      const firstParts = cleanFirst.split(" ");
      const firstInitial = firstParts[0];
      const middleInitial = firstParts[1] ? ` ${firstParts[1].charAt(0)}.` : "";
      return `${cleanLast}, ${firstInitial}${middleInitial}`;
    }

    return `${cleanFirst} ${cleanLast}`;
  }

  // Fallback for standard name formats
  return fixCase(nameStr);
}