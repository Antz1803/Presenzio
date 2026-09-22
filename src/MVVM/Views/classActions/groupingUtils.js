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
