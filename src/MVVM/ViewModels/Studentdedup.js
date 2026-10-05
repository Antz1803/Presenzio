const NAME_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);
export function normalizeName(value) {
  const cleaned = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const tokens = cleaned
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((token) => !NAME_SUFFIXES.has(token));
  return tokens.sort().join("|");
}
const PROFILE_FIELDS = [
  "gender",
  "student_no",
  "course",
  "year_level",
  "contact_no",
  "email",
];
function filledFieldCount(student) {
  return PROFILE_FIELDS.filter(
    (field) => student?.[field] != null && String(student[field]).trim() !== "",
  ).length;
}
async function moveRows({
  supabase,
  table,
  matchColumn,
  fromValue,
  toValue,
  conflictColumns,
}) {
  const { data: rows, error } = await supabase
    .from(table)
    .select("*")
    .eq(matchColumn, fromValue);
  if (error) throw error;
  if (!rows?.length) return;
  let existingKeys = null;
  if (conflictColumns?.length) {
    const { data: existingRows, error: existingError } = await supabase
      .from(table)
      .select(conflictColumns.join(","))
      .eq(matchColumn, toValue);
    if (existingError) throw existingError;
    existingKeys = new Set(
      (existingRows ?? []).map((row) =>
        conflictColumns.map((column) => row[column]).join("::"),
      ),
    );
  }
  for (const row of rows) {
    const key = conflictColumns?.length
      ? conflictColumns
          .map((column) => (column === matchColumn ? toValue : row[column]))
          .join("::")
      : null;
    if (key && existingKeys.has(key)) {
      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .eq("id", row.id);
      if (deleteError) throw deleteError;
      continue;
    }
    const { error: updateError } = await supabase
      .from(table)
      .update({ [matchColumn]: toValue })
      .eq("id", row.id);
    if (updateError) throw updateError;
    if (key) existingKeys.add(key);
  }
}
async function moveEnrollmentOwnedRecords({
  supabase,
  fromEnrollmentId,
  toEnrollmentId,
}) {
  await moveRows({
    supabase,
    table: "period_grades",
    matchColumn: "enrollment_id",
    fromValue: fromEnrollmentId,
    toValue: toEnrollmentId,
    conflictColumns: ["section_id", "period_id", "enrollment_id"],
  });
  await moveRows({
    supabase,
    table: "assessment_scores",
    matchColumn: "enrollment_id",
    fromValue: fromEnrollmentId,
    toValue: toEnrollmentId,
    conflictColumns: [
      "section_id",
      "period_id",
      "enrollment_id",
      "category",
      "item_no",
    ],
  });
  await moveRows({
    supabase,
    table: "attendance_records",
    matchColumn: "enrollment_id",
    fromValue: fromEnrollmentId,
    toValue: toEnrollmentId,
    conflictColumns: ["session_id", "enrollment_id"],
  });
}
async function moveStudentOwnedRecords({
  supabase,
  fromStudentId,
  toStudentId,
}) {
  await moveRows({
    supabase,
    table: "assessment_attempts",
    matchColumn: "student_id",
    fromValue: fromStudentId,
    toValue: toStudentId,
  });
  await moveRows({
    supabase,
    table: "assessment_attempt_grants",
    matchColumn: "student_id",
    fromValue: fromStudentId,
    toValue: toStudentId,
    conflictColumns: ["assessment_id", "student_id"],
  });
  await moveRows({
    supabase,
    table: "assessment_violations",
    matchColumn: "student_id",
    fromValue: fromStudentId,
    toValue: toStudentId,
  });
}
async function mergeStudentInto({
  supabase,
  canonical,
  duplicate,
  enrollmentsByStudent,
}) {
  const duplicateEnrollments = enrollmentsByStudent.get(duplicate.id) ?? [];
  const canonicalEnrollments = enrollmentsByStudent.get(canonical.id) ?? [];
  for (const duplicateEnrollment of duplicateEnrollments) {
    const canonicalEnrollment = canonicalEnrollments.find(
      (enrollment) => enrollment.section_id === duplicateEnrollment.section_id,
    );
    if (canonicalEnrollment) {
      await moveEnrollmentOwnedRecords({
        supabase,
        fromEnrollmentId: duplicateEnrollment.id,
        toEnrollmentId: canonicalEnrollment.id,
      });
      const { error } = await supabase
        .from("enrollments")
        .delete()
        .eq("id", duplicateEnrollment.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("enrollments")
        .update({ student_id: canonical.id })
        .eq("id", duplicateEnrollment.id);
      if (error) throw error;
      canonicalEnrollments.push({
        ...duplicateEnrollment,
        student_id: canonical.id,
      });
    }
  }
  await moveStudentOwnedRecords({
    supabase,
    fromStudentId: duplicate.id,
    toStudentId: canonical.id,
  });
  const profileUpdate = {};
  PROFILE_FIELDS.forEach((field) => {
    const hasCanonicalValue =
      canonical[field] != null && String(canonical[field]).trim() !== "";
    const duplicateValue = duplicate[field];
    if (
      !hasCanonicalValue &&
      duplicateValue != null &&
      String(duplicateValue).trim() !== ""
    ) {
      profileUpdate[field] = duplicateValue;
    }
  });
  if (Object.keys(profileUpdate).length) {
    const { error } = await supabase
      .from("students")
      .update(profileUpdate)
      .eq("id", canonical.id);
    if (error) throw error;
    Object.assign(canonical, profileUpdate);
  }
  const { error: deleteError } = await supabase
    .from("students")
    .delete()
    .eq("id", duplicate.id);
  if (deleteError) throw deleteError;
}
export async function mergeDuplicateStudentRecords(supabase) {
  const summary = { groupsFound: 0, studentsMerged: 0, errors: [] };
  if (!supabase) return summary;
  const { data: allStudents, error: studentsError } = await supabase
    .from("students")
    .select(
      "id, full_name, gender, student_no, course, year_level, contact_no, email",
    );
  if (studentsError) throw studentsError;
  if (!allStudents?.length) return summary;
  const groups = new Map();
  allStudents.forEach((student) => {
    const key = normalizeName(student.full_name);
    if (!key) return;
    const bucket = groups.get(key) ?? [];
    bucket.push(student);
    groups.set(key, bucket);
  });
  const duplicateGroups = [...groups.values()].filter(
    (group) => group.length > 1,
  );
  if (!duplicateGroups.length) return summary;
  const studentIds = duplicateGroups.flat().map((student) => student.id);
  const { data: enrollmentRows, error: enrollmentsError } = await supabase
    .from("enrollments")
    .select("id, section_id, student_id")
    .in("student_id", studentIds);
  if (enrollmentsError) throw enrollmentsError;
  const enrollmentsByStudent = new Map();
  (enrollmentRows ?? []).forEach((enrollment) => {
    const list = enrollmentsByStudent.get(enrollment.student_id) ?? [];
    list.push(enrollment);
    enrollmentsByStudent.set(enrollment.student_id, list);
  });
  for (const group of duplicateGroups) {
    summary.groupsFound += 1;
    try {
      const ranked = [...group].sort((a, b) => {
        const enrollmentDiff =
          (enrollmentsByStudent.get(b.id)?.length ?? 0) -
          (enrollmentsByStudent.get(a.id)?.length ?? 0);
        if (enrollmentDiff !== 0) return enrollmentDiff;
        return filledFieldCount(b) - filledFieldCount(a);
      });
      const [canonical, ...duplicates] = ranked;
      for (const duplicate of duplicates) {
        await mergeStudentInto({
          supabase,
          canonical,
          duplicate,
          enrollmentsByStudent,
        });
        summary.studentsMerged += 1;
      }
    } catch (error) {
      summary.errors.push({
        name: group[0]?.full_name ?? "Unknown student",
        message: error?.message ?? "Merge failed.",
      });
    }
  }
  return summary;
}
