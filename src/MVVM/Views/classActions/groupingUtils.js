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

function normalizeStudentName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parsePastedGroups(value, students) {
  const groups = [];
  const unmatched = [];
  const duplicates = [];
  const lines = String(value ?? "")
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
    const student = students.find(
      (item) => normalizeStudentName(item.name) === normalizeStudentName(line),
    );
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
