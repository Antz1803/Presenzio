import { ensureGradingPeriods, listSections, newId, patch, read, rows, sec } from "./accountDb";

export const PASSING_GRADE = 3.05;
export const LOW_ATTENDANCE = 80;
// A student is flagged as "stopped attending" after this many recorded
// sessions in a row without a present/late mark.
export const STOPPED_AFTER = 3;

// Statuses a teacher can assign (the ones the semester-end memo asks for).
export const ENROLLMENT_STATUSES = [
  { value: "withdrawn", label: "Withdrawn" },
  { value: "not_continuing", label: "Not continuing" },
  { value: "stopped_attending", label: "Stopped attending" },
];

// "dropped" is no longer offered but may exist on records saved earlier.
const STATUS_LABELS = {
  active: "Enrolled",
  dropped: "Dropped",
  ...Object.fromEntries(ENROLLMENT_STATUSES.map((item) => [item.value, item.label])),
};

export const statusLabel = (value) => STATUS_LABELS[value] ?? String(value || "Enrolled");

export function sectionLabel(section) {
  if (!section) return "";
  const code = section.subject_code || "Class";
  const number = section.section_no ? ` · Sec ${section.section_no}` : "";
  return `${code}${number}`;
}

export const PERIODS = ["prelim", "midterm", "semifinal", "final"];
export const PERIOD_LABELS = { prelim: "Prelim", midterm: "Midterm", semifinal: "Semi-final", final: "Final" };

// Grade of every period for one student, read the way the class record reads
// it: Prelim uses its own period grade, later periods the cumulative grade,
// and Final grades above the passing mark display as 5.
function gradesOf(periodGrades, eid) {
  const grades = {};
  PERIODS.forEach((code) => {
    const row = periodGrades?.[`${code}:${eid}`];
    const raw = code === "prelim" ? row?.own_period_grade : row?.cumulative_grade;
    const value = Number(raw);
    grades[code] = raw == null || raw === "" || !Number.isFinite(value) ? null : code === "final" && value > PASSING_GRADE ? 5 : value;
  });
  return grades;
}

export const failedPeriodsOf = (grades) => PERIODS.filter((code) => grades[code] != null && grades[code] > PASSING_GRADE);

const dateOf = (session) => String(session?.session_date ?? "").slice(0, 10);
const attended = (status) => status === "present" || status === "late";

// Loads every class of the signed-in teacher once and derives the rows the
// semester-end reports need. Nothing here writes to the database.
export async function loadSemesterData(uid) {
  const [sections, students, enrollments, periods] = await Promise.all([
    listSections(uid),
    read(uid, "students"),
    read(uid, "enrollments"),
    ensureGradingPeriods(uid),
  ]);
  const perSection = await Promise.all(
    sections.map(async (section) => ({ section, data: (await read(uid, sec(section.id))) ?? {} })),
  );

  const records = [];
  const classes = [];
  perSection.forEach(({ section, data }) => {
    const attendance = data.attendance ?? {};
    // A session counts once attendance was taken for it; a student with no mark
    // in such a session is absent, which is how the class record counts it.
    const sessions = rows(data.sessions)
      .filter((item) => dateOf(item) && Object.keys(attendance?.[item.id] ?? {}).length > 0)
      .sort((a, b) => dateOf(a).localeCompare(dateOf(b)));
    const sectionEnrollments = Object.entries(enrollments?.[section.id] ?? {});
    const classRows = sectionEnrollments.map(([eid, enrollment]) => {
      const student = students?.[enrollment?.student_id] ?? {};
      const held = sessions.map((session) => ({
        date: dateOf(session),
        status: attendance?.[session.id]?.[eid] || "absent",
      }));
      const present = held.filter((mark) => attended(mark.status));
      const lastMarks = held.slice(-STOPPED_AFTER);
      const grades = gradesOf(data.periodGrades, eid);
      const grade = grades.final;
      return {
        key: `${section.id}:${eid}`,
        sectionId: section.id,
        sectionLabel: sectionLabel(section),
        enrollmentId: eid,
        name: student.full_name || student.name || "Unnamed student",
        studentNo: student.student_no || student.number || "",
        course: student.course || "",
        yearLevel: student.year_level || "",
        status: enrollment?.status || "active",
        statusDate: enrollment?.status_date || "",
        statusRemark: enrollment?.status_remark || "",
        grade,
        grades,
        failedPeriods: failedPeriodsOf(grades),
        sessionsHeld: held.length,
        sessionsAttended: present.length,
        attendanceRate: held.length ? Math.round((present.length / held.length) * 100) : null,
        lastAttended: present.length ? present[present.length - 1].date : "",
        stoppedAttending:
          held.length >= STOPPED_AFTER &&
          lastMarks.length === STOPPED_AFTER &&
          lastMarks.every((mark) => !attended(mark.status)),
        marks: held,
      };
    });
    records.push(...classRows);
    classes.push({
      section,
      label: sectionLabel(section),
      title: section.subject_title || "",
      sessionDates: sessions.map(dateOf),
      rows: classRows,
    });
  });
  return { classes, records, periods };
}

export function buildMonitoring(records) {
  const enrolled = records.filter((row) => row.status === "active");
  const sortByName = (a, b) => a.sectionLabel.localeCompare(b.sectionLabel) || a.name.localeCompare(b.name);
  return {
    failing: enrolled.filter((row) => row.failedPeriods.length > 0).sort(sortByName),
    lowAttendance: enrolled
      .filter((row) => row.attendanceRate != null && row.attendanceRate < LOW_ATTENDANCE)
      .sort(sortByName),
    stopped: enrolled.filter((row) => row.stoppedAttending).sort(sortByName),
    left: records.filter((row) => row.status !== "active").sort(sortByName),
  };
}

const inRange = (date, start, end) => {
  const value = String(date ?? "").slice(0, 10);
  return Boolean(value) && (!start || value >= start) && (!end || value <= end);
};

// Per-class statistics for a date range (a month or the whole semester).
export function buildAccomplishmentStats(classes, start, end) {
  return classes.map((entry) => {
    const active = entry.rows.filter((row) => row.status === "active");
    const sessionsInRange = entry.sessionDates.filter((date) => inRange(date, start, end));
    let possible = 0;
    let present = 0;
    active.forEach((row) => {
      row.marks.forEach((mark) => {
        if (mark.status === "" || !inRange(mark.date, start, end)) return;
        possible += 1;
        if (attended(mark.status)) present += 1;
      });
    });
    const graded = active.filter((row) => row.grade != null);
    const passed = graded.filter((row) => row.grade <= PASSING_GRADE).length;
    const byName = (a, b) => a.name.localeCompare(b.name);
    const failingList = active
      .filter((row) => row.failedPeriods.length > 0)
      .sort(byName)
      .map((row) => ({ key: row.key, name: row.name, studentNo: row.studentNo, grades: row.grades, failedPeriods: row.failedPeriods }));
    return {
      label: entry.label,
      title: entry.title,
      failingList,
      failingAny: failingList.length,
      leftList: entry.rows
        .filter((row) => row.status !== "active")
        .sort(byName)
        .map((row) => ({ key: row.key, name: row.name, studentNo: row.studentNo, status: row.status, date: row.statusDate, remark: row.statusRemark })),
      enrolled: active.length,
      left: entry.rows.length - active.length,
      sessions: sessionsInRange.length,
      attendance: possible ? Math.round((present / possible) * 100) : null,
      graded: graded.length,
      passed,
      failed: graded.length - passed,
      average: graded.length
        ? (graded.reduce((sum, row) => sum + row.grade, 0) / graded.length).toFixed(2)
        : null,
    };
  });
}

export function setEnrollmentStatus(uid, sectionId, enrollmentId, { status, remark }) {
  const path = `enrollments/${sectionId}/${enrollmentId}`;
  const isActive = status === "active";
  return patch(uid, {
    [`${path}/status`]: status,
    [`${path}/status_date`]: isActive ? null : new Date().toISOString().slice(0, 10),
    [`${path}/status_remark`]: isActive ? null : String(remark ?? "").trim().slice(0, 200) || null,
  });
}

/* ---------- manual accomplishments & activities ---------- */

export async function listAccomplishments(uid) {
  return rows(await read(uid, "accomplishments")).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export async function saveAccomplishment(uid, item) {
  const id = item.id || newId();
  const { id: ignored, ...fields } = item;
  void ignored;
  await patch(uid, { [`accomplishments/${id}`]: { ...fields, updated_at: new Date().toISOString() } });
  return id;
}

export const deleteAccomplishment = (uid, id) => patch(uid, { [`accomplishments/${id}`]: null });

export async function listActivities(uid) {
  return rows(await read(uid, "activities")).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export async function saveActivity(uid, item) {
  const id = item.id || newId();
  const { id: ignored, ...fields } = item;
  void ignored;
  await patch(uid, { [`activities/${id}`]: { ...fields, updated_at: new Date().toISOString() } });
  return id;
}

export const deleteActivity = (uid, id) => patch(uid, { [`activities/${id}`]: null });

// Photos are stored inside the database (no file storage is configured), so
// they are shrunk first to keep each activity small.
export function compressImage(file, maxSide = 1000, quality = 0.72) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith("image/")) {
      reject(new Error("Please choose an image file."));
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That image could not be read."));
    };
    image.src = url;
  });
}
