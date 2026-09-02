// Shared name-matching + duplicate-student-merging logic used by both the
// master-list importer and the grade-sheet importer. Keeping this in one
// place means a student is matched the same way no matter which import path
// created (or re-encountered) their record.

const NAME_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

// Produces a match key that's insensitive to punctuation, accents, casing,
// and word order — e.g. "Juan Dela Cruz" and "Dela Cruz, Juan" (or
// "Juan  Dela Cruz Jr.") all normalize to the same key. This is the fix for
// duplicate student rows being created when the same name is written
// differently across a master list and a grade sheet.
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

const PROFILE_FIELDS = ["gender", "student_no", "course", "year_level", "contact_no", "email"];

function filledFieldCount(student) {
  return PROFILE_FIELDS.filter(
    (field) => student?.[field] != null && String(student[field]).trim() !== "",
  ).length;
}

// Moves every row in `table` that references `fromValue` in `matchColumn`
// over to `toValue`, preserving each row's own id (so nothing that
// references a row by its id, e.g. assessment_answers -> assessment_attempts,
// is ever broken by this merge). If `conflictColumns` names a real unique
// constraint and moving a row would collide with a row the canonical
// student already has, the duplicate's row is dropped instead of
// overwriting the canonical one.
async function moveRows({ supabase, table, matchColumn, fromValue, toValue, conflictColumns }) {
  const { data: rows, error } = await supabase.from(table).select("*").eq(matchColumn, fromValue);
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
      (existingRows ?? []).map((row) => conflictColumns.map((column) => row[column]).join("::")),
    );
  }

  for (const row of rows) {
    const key = conflictColumns?.length
      ? conflictColumns.map((column) => (column === matchColumn ? toValue : row[column])).join("::")
      : null;

    if (key && existingKeys.has(key)) {
      // The canonical student already has an equivalent row (same section,
      // period, category, etc.) — keep that one and discard the duplicate's
      // conflicting copy rather than overwrite it.
      const { error: deleteError } = await supabase.from(table).delete().eq("id", row.id);
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

async function moveEnrollmentOwnedRecords({ supabase, fromEnrollmentId, toEnrollmentId }) {
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
    conflictColumns: ["section_id", "period_id", "enrollment_id", "category", "item_no"],
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

async function moveStudentOwnedRecords({ supabase, fromStudentId, toStudentId }) {
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

async function mergeStudentInto({ supabase, canonical, duplicate, enrollmentsByStudent }) {
  const duplicateEnrollments = enrollmentsByStudent.get(duplicate.id) ?? [];
  const canonicalEnrollments = enrollmentsByStudent.get(canonical.id) ?? [];

  for (const duplicateEnrollment of duplicateEnrollments) {
    const canonicalEnrollment = canonicalEnrollments.find(
      (enrollment) => enrollment.section_id === duplicateEnrollment.section_id,
    );

    if (canonicalEnrollment) {
      // Both records are enrolled in the same class — fold the duplicate's
      // grades/scores/attendance into the canonical enrollment, then drop
      // the now-empty duplicate enrollment row.
      await moveEnrollmentOwnedRecords({
        supabase,
        fromEnrollmentId: duplicateEnrollment.id,
        toEnrollmentId: canonicalEnrollment.id,
      });
      const { error } = await supabase.from("enrollments").delete().eq("id", duplicateEnrollment.id);
      if (error) throw error;
    } else {
      // Canonical isn't enrolled in this section yet — just repoint the
      // enrollment row itself, so every score/grade/attendance row keyed by
      // this enrollment_id keeps working untouched.
      const { error } = await supabase
        .from("enrollments")
        .update({ student_id: canonical.id })
        .eq("id", duplicateEnrollment.id);
      if (error) throw error;
      canonicalEnrollments.push({ ...duplicateEnrollment, student_id: canonical.id });
    }
  }

  await moveStudentOwnedRecords({ supabase, fromStudentId: duplicate.id, toStudentId: canonical.id });

  const profileUpdate = {};
  PROFILE_FIELDS.forEach((field) => {
    const hasCanonicalValue = canonical[field] != null && String(canonical[field]).trim() !== "";
    const duplicateValue = duplicate[field];
    if (!hasCanonicalValue && duplicateValue != null && String(duplicateValue).trim() !== "") {
      profileUpdate[field] = duplicateValue;
    }
  });
  if (Object.keys(profileUpdate).length) {
    const { error } = await supabase.from("students").update(profileUpdate).eq("id", canonical.id);
    if (error) throw error;
    Object.assign(canonical, profileUpdate);
  }

  const { error: deleteError } = await supabase.from("students").delete().eq("id", duplicate.id);
  if (deleteError) throw deleteError;
}

// Scans every student row in the database, groups the ones whose names
// match (ignoring punctuation, accents, case, and word order), and merges
// each group down to a single record — the one with the most enrollments
// (ties broken by whichever profile has more fields filled in). All related
// records (enrollments, grades, scores, attendance, assessment attempts,
// attempt grants, violations) are moved onto the surviving record before the
// duplicate row is deleted.
export async function mergeDuplicateStudentRecords(supabase) {
  const summary = { groupsFound: 0, studentsMerged: 0, errors: [] };
  if (!supabase) return summary;

  const { data: allStudents, error: studentsError } = await supabase
    .from("students")
    .select("id, full_name, gender, student_no, course, year_level, contact_no, email");
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

  const duplicateGroups = [...groups.values()].filter((group) => group.length > 1);
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
        await mergeStudentInto({ supabase, canonical, duplicate, enrollmentsByStudent });
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