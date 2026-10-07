export function defaultGroupCount(count) {
  return String(Math.max(2, Math.min(6, Math.ceil((count || 1) / 5))));
}

export function shuffle(list) {
  const result = [...list];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export function toAssignments(groups) {
  return Object.fromEntries(
    groups.flatMap((group, index) =>
      group.map((student) => [student.id, index + 1]),
    ),
  );
}

function removeInvisibleFormatting(value) {
  return String(value ?? "")
    .replace(/[\u00a0\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g, " ");
}

function normalizeStudentName(value) {
  return removeInvisibleFormatting(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function studentNameTokens(value) {
  return normalizeStudentName(value)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function namesMatch(rosterName, pastedName) {
  const rosterTokens = studentNameTokens(rosterName);
  const pastedTokens = studentNameTokens(pastedName);
  if (!rosterTokens.length || !pastedTokens.length) return false;
  if (rosterTokens.join(" ") === pastedTokens.join(" ")) return true;

  // Accept a roster with an omitted/extra middle initial, or a surname-first
  // variant, when all meaningful pasted name tokens are present.
  const rosterSet = new Set(rosterTokens);
  const pastedSet = new Set(pastedTokens);
  const shared = pastedTokens.filter((token) => rosterSet.has(token));
  return (
    shared.length >= 2 &&
    (pastedTokens.every((token) => rosterSet.has(token)) ||
      rosterTokens.every((token) => pastedSet.has(token)))
  );
}

export function parsePastedGroups(value, students) {
  const groups = [];
  const unmatched = [];
  const duplicates = [];
  const lines = removeInvisibleFormatting(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const assigned = new Set();
  let currentGroup = null;

  lines.forEach((line) => {
    if (/^group\s+\d+\s*:?$/i.test(line)) {
      currentGroup = [];
      groups.push(currentGroup);
      return;
    }
    if (!currentGroup) {
      unmatched.push(line);
      return;
    }
    const student = students.find((item) => namesMatch(item.name, line));
    if (!student) {
      unmatched.push(line);
    } else if (assigned.has(student.id)) {
      duplicates.push(line);
    } else {
      currentGroup.push(student);
      assigned.add(student.id);
    }
  });

  return {
    groups,
    unmatched,
    duplicates,
    emptyGroups: groups.reduce(
      (result, group, index) =>
        group.length ? result : [...result, index + 1],
      [],
    ),
  };
}

export function formatSavedDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}
