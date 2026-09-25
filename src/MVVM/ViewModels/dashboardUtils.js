import { transmutationBreakpoints } from "./dashboardConstants";
export function transmutePercentage(value) {
  if (!Number.isFinite(Number(value))) return null;
  // Match Excel's approximate VLOOKUP against the transmutation table.
  const percentage = Math.max(0, Math.min(100, Number(value)));
  let gradePoint = transmutationBreakpoints[0][1];
  transmutationBreakpoints.forEach(([breakpoint, grade]) => {
    if (percentage >= breakpoint) gradePoint = grade;
  });
  return gradePoint;
}

export function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value + "T00:00:00"));
}
export function formatDay(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
    new Date(value + "T00:00:00"),
  );
}
export function formatShortDate(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).split("-");
  return `${month}-${day}-${String(year).slice(-2)}`;
}
export function resolvePeriodCodeForSession({
  sessionDate,
  periodId,
  periods,
}) {
  const dateMatch = (periods ?? [])
    .filter((periodItem) => periodItem.start_date && periodItem.end_date)
    .sort((first, second) => first.sort_order - second.sort_order)
    .find(
      (periodItem) =>
        sessionDate >= periodItem.start_date &&
        sessionDate <= periodItem.end_date,
    );
  if (dateMatch) return dateMatch.code;
  return (
    (periods ?? []).find((periodItem) => periodItem.id === periodId)?.code ?? ""
  );
}
export function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  return valid.length
    ? valid.reduce((sum, value) => sum + value, 0) / valid.length
    : 0;
}
export function toGradeRows(roster) {
  return roster.map((student) => ({
    student: student.name,
    initials: student.initials,
    color: student.color,
    q1: "",
    q2: "",
    q3: "",
    q4: "",
    average: Number(student.grade ?? 0),
  }));
}

export function createAssessmentAccessKey() {
  const randomPart =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `ASM-${randomPart.replaceAll("-", "").slice(0, 10).toUpperCase()}`;
}

export function browserIsOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function createLocalId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    (character) => {
      const random = (Math.random() * 16) | 0;
      const value = character === "x" ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    },
  );
}

export function isNetworkError(error) {
  return (
    browserIsOffline(error) ||
    error?.status === 0 ||
    error?.name === "TypeError"
  );
}

export function normalizeSubmittedAnswer(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function serializeAssessmentDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function answerSimilarity(firstValue, secondValue) {
  const first = normalizeSubmittedAnswer(firstValue);
  const second = normalizeSubmittedAnswer(secondValue);
  if (!first || !second) return 0;
  if (first === second) return 1;
  const maxLength = Math.max(first.length, second.length);
  if (maxLength > 2000) return 0;
  let previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
    const current = [firstIndex];
    for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
      current[secondIndex] = Math.min(
        current[secondIndex - 1] + 1,
        previous[secondIndex] + 1,
        previous[secondIndex - 1] +
          (first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return 1 - previous[second.length] / maxLength;
}
