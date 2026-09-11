import { useEffect, useMemo, useState } from "react";
import { Icon } from "./DashboardShared";

const printActions = [
  ["prelim", "Print Prelim"],
  ["midterm", "Print Midterm"],
  ["semifinal", "Print Semi-Final"],
  ["final", "Print Final"],
  ["summary", "Print Summary"],
  ["monthly-attendance", "Print Monthly Attendance"],
];

function ClassOptionsModal({
  section,
  onClose,
  onOpenAction,
  onOpenPrint,
  onOpenStudentView,
  onSyncToExcel,
  syncReady,
}) {
  const [syncing, setSyncing] = useState(false);

  const handleSyncToExcel = async () => {
    setSyncing(true);
    try {
      await onSyncToExcel();
      onClose();
    } catch (error) {
      console.error("Excel sync failed:", error);
      window.alert(error?.message || "Excel synchronization failed.");
    } finally {
      setSyncing(false);
    }
  };

  const actions = [
    ["attendance", "Take Attendance"],
    ["attendance-list", "Attendance List"],
    ["create-assessment", "Create Assessment"],
    ["manage-assessments", "Manage Assessments"],
    ["record-score", "Record Score"],
    ["show-grades", "Show Grades"],
    ["grade-summary", "Record Summary"],
    ["grade-settings", "Grade Sheet Settings"],
  ];

  const buttonClass =
    "block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm print:hidden"
      onMouseDown={(event) => event.target === event.currentTarget && !syncing && onClose()}
    >
      <section
        className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="class-options-title"
      >
        <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
          <h2 id="class-options-title" className="text-sm font-extrabold uppercase tracking-wide text-slate-800">
            Class Options
          </h2>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
            disabled={syncing}
            aria-label="Close class options"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="mb-1 rounded-2xl bg-slate-50 p-3.5">
            <h3 className="text-sm font-bold text-slate-800">
              {section?.subject_code || "Class"} - {section?.subject_title || "Class subject"}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {section?.days || "Schedule not set"} · {section?.room || "Room not set"}
            </p>
          </div>

          {actions.map(([type, label]) => (
            <button
              className={buttonClass}
              key={type}
              disabled={syncing}
              onClick={() => onOpenAction(type, section.id)}
            >
              {label}
            </button>
          ))}

          <p className="mb-0.5 mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Print Records
          </p>
          {printActions.map(([type, label]) => (
            <button
              className={buttonClass}
              key={type}
              disabled={syncing}
              onClick={() => onOpenPrint(type, section.id)}
            >
              {label}
            </button>
          ))}

          <button
            className={`${buttonClass} mt-1`}
            disabled={syncing}
            onClick={() => {
              onClose();
              onOpenStudentView(section.id);
            }}
          >
            Open Student View
          </button>

          <button
            className="block w-full rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-2.5 text-left text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition hover:from-indigo-500 hover:to-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!syncReady || syncing}
            onClick={handleSyncToExcel}
          >
            {syncing ? "Syncing to Excel…" : syncReady ? "Sync to Excel" : "Loading class data..."}
          </button>

          <button
            className={buttonClass}
            disabled={syncing}
            onClick={() => onOpenAction("add-student", section.id)}
          >
            Add Student
          </button>
        </div>
      </section>
    </div>
  );
}

function roundedUpGrade(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return (Math.ceil((number - Number.EPSILON) * 10) / 10).toFixed(1);
}

function studentDraft(student) {
  return {
    ctrlNo: String(student.ctrlNo ?? ""),
    student_no: student.number?.startsWith("CTRL-") ? "" : student.number ?? "",
    full_name: student.name ?? "",
    gender: ["M", "F"].includes(student.gender) ? student.gender : "",
    course: student.course ?? "",
    year_level: student.yearLevel ?? "",
    contact_no: student.contactNo ?? "",
    email: student.email ?? "",
    photo_url: student.photoUrl ?? "",
  };
}

// Strips accents/punctuation and collapses whitespace so "Dela Cruz, Juan"
// and "dela  cruz juan" compare equal — pasted rosters are rarely formatted
// identically to what's already in the roster.
function normalizeNameForMatch(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// A pasted row's two columns could be "Name, ID" or "ID, Name" depending on
// where the person copied from — this looks at which field reads like an ID
// (letters/digits/dashes only, no spaces, at least one digit) to figure out
// which is which, rather than assuming a fixed column order.
function looksLikeStudentId(value) {
  return /\d/.test(value) && /^[A-Za-z0-9-]+$/.test(value);
}

function parseIdPasteRows(text) {
  return String(text ?? "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      // Prefer tab-separated (pasted straight from a spreadsheet), then
      // comma-separated, then fall back to splitting on the last run of
      // whitespace (e.g. "Juan Dela Cruz 2021-00123").
      let parts = line.split("\t").map((part) => part.trim()).filter(Boolean);
      if (parts.length < 2) {
        parts = line.split(",").map((part) => part.trim()).filter(Boolean);
      }
      if (parts.length < 2) {
        const spacedMatch = line.match(/^(.*\S)\s+(\S+)$/);
        parts = spacedMatch ? [spacedMatch[1], spacedMatch[2]] : [line];
      }
      if (parts.length < 2) return { raw: line, name: "", studentId: "" };

      const [first, second] = parts;
      const [name, studentId] =
        looksLikeStudentId(first) && !looksLikeStudentId(second)
          ? [second, first]
          : [first, second];
      return { raw: line, name, studentId };
    });
}

function StudentModal({ section, students, onClose, onUpdateStudent }) {
  const [editingStudent, setEditingStudent] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ status: "", text: "" });
  const [showIdPaste, setShowIdPaste] = useState(false);
  const [idPasteText, setIdPasteText] = useState("");
  const [applyingIds, setApplyingIds] = useState(false);
  const [idResultMessage, setIdResultMessage] = useState({ status: "", text: "" });
  const sortedStudents = useMemo(
    () =>
      [...students].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", undefined, {
          sensitivity: "base",
        }),
      ),
    [students],
  );

  // Matches each pasted row to exactly one student by name. Rows that match
  // more than one student (e.g. two students sharing a first name) are
  // flagged "ambiguous" rather than guessed at, so nothing gets applied to
  // the wrong person.
  const idPreview = useMemo(() => {
    if (!idPasteText.trim()) return [];
    return parseIdPasteRows(idPasteText).map((row) => {
      if (!row.name || !row.studentId) {
        return { ...row, status: "unparsed" };
      }
      const normalized = normalizeNameForMatch(row.name);
      const exactMatches = students.filter(
        (student) => normalizeNameForMatch(student.name) === normalized,
      );
      if (exactMatches.length === 1) {
        return { ...row, status: "matched", student: exactMatches[0], fuzzy: false };
      }
      if (exactMatches.length > 1) {
        return { ...row, status: "ambiguous", candidates: exactMatches };
      }
      const fuzzyMatches = students.filter((student) => {
        const studentNormalized = normalizeNameForMatch(student.name);
        return (
          studentNormalized.includes(normalized) || normalized.includes(studentNormalized)
        );
      });
      if (fuzzyMatches.length === 1) {
        return { ...row, status: "matched", student: fuzzyMatches[0], fuzzy: true };
      }
      if (fuzzyMatches.length > 1) {
        return { ...row, status: "ambiguous", candidates: fuzzyMatches };
      }
      return { ...row, status: "unmatched" };
    });
  }, [idPasteText, students]);

  const matchedRows = idPreview.filter((row) => row.status === "matched");

  const applyIdUpdates = async () => {
    if (!onUpdateStudent || !matchedRows.length) return;
    setApplyingIds(true);
    setIdResultMessage({ status: "", text: "" });
    let succeeded = 0;
    let failed = 0;
    for (const row of matchedRows) {
      try {
        await onUpdateStudent({
          studentId: row.student.studentId,
          enrollmentId: row.student.id,
          sectionId: section?.id,
          ...studentDraft(row.student),
          student_no: row.studentId,
        });
        succeeded += 1;
      } catch {
        failed += 1;
      }
    }
    setApplyingIds(false);
    const leftoverCount = idPreview.length - matchedRows.length;
    setIdResultMessage({
      status: failed ? "error" : "success",
      text:
        `${succeeded} student ID${succeeded === 1 ? "" : "s"} updated.` +
        (failed ? ` ${failed} failed to save — try those again.` : "") +
        (leftoverCount
          ? ` ${leftoverCount} row(s) weren't matched or were ambiguous — review them below.`
          : ""),
    });
    if (!failed && !leftoverCount) setIdPasteText("");
  };

  const startEditing = (student) => {
    setEditingStudent(student);
    setDraft(studentDraft(student));
    setMessage({ status: "", text: "" });
  };
  const updateDraft = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const handlePhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ status: "error", text: "Profile photos must be 2 MB or smaller." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updateDraft("photo_url", String(reader.result || ""));
    reader.readAsDataURL(file);
  };
  const saveStudent = async (event) => {
    event.preventDefault();
    if (!editingStudent || !draft || !onUpdateStudent) return;
    setSaving(true);
    setMessage({ status: "", text: "" });
    try {
      await onUpdateStudent({
        studentId: editingStudent.studentId,
        enrollmentId: editingStudent.id,
        sectionId: section?.id,
        ...draft,
      });
      setMessage({ status: "success", text: "Student profile updated." });
      setEditingStudent(null);
      setDraft(null);
    } catch (error) {
      setMessage({ status: "error", text: error?.message || "Student profile could not be updated." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm print:hidden"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-modal-title"
      >
        <div className="mb-5 flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Class Students</p>
            <h2 id="student-modal-title" className="mt-1 text-lg font-bold text-slate-900">
              {section?.subject_code || "Students"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {section?.subject_title || "Students enrolled in this class"}
            </p>
          </div>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
            aria-label="Close students"
          >
            ×
          </button>
        </div>

        <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Bulk update</p>
              <h3 className="mt-0.5 text-sm font-bold text-slate-800">Update Student IDs by pasting a list</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Paste rows of a name and a Student ID (straight from Excel/Sheets works) — each row is
                matched to a student here by name, so nothing saves until you review the matches below.
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
              onClick={() => setShowIdPaste((current) => !current)}
            >
              {showIdPaste ? "Hide" : "Open"}
            </button>
          </div>
          {showIdPaste && (
            <div className="mt-3">
              <textarea
                rows="6"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                placeholder={"Juan Dela Cruz\t2021-00123\nMaria Santos\t2021-00124\n(paste directly from a spreadsheet, or use commas)"}
                value={idPasteText}
                onChange={(event) => setIdPasteText(event.target.value)}
                disabled={applyingIds}
              />

              {idPreview.length > 0 && (
                <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        <th className="py-2 px-3">Pasted name</th>
                        <th className="py-2 px-3">New ID</th>
                        <th className="py-2 px-3">Matched student</th>
                        <th className="py-2 px-3">Current ID</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {idPreview.map((row, index) => (
                        <tr key={index}>
                          <td className="py-1.5 px-3 text-slate-700">
                            {row.name || <span className="text-rose-500">Couldn't parse this line</span>}
                          </td>
                          <td className="py-1.5 px-3 text-slate-700">{row.studentId || "—"}</td>
                          <td className="py-1.5 px-3 text-slate-700">
                            {row.status === "matched"
                              ? row.student.name
                              : row.status === "ambiguous"
                                ? `${row.candidates.length} possible matches`
                                : "—"}
                          </td>
                          <td className="py-1.5 px-3 text-slate-500">
                            {row.status === "matched" ? row.student.number || "—" : "—"}
                          </td>
                          <td className="py-1.5 px-3">
                            {row.status === "matched" && (
                              <span className={`font-semibold ${row.fuzzy ? "text-amber-600" : "text-emerald-600"}`}>
                                {row.fuzzy ? "Matched (verify)" : "Matched"}
                              </span>
                            )}
                            {row.status === "ambiguous" && (
                              <span className="font-semibold text-amber-600">Ambiguous</span>
                            )}
                            {row.status === "unmatched" && (
                              <span className="font-semibold text-rose-500">No match</span>
                            )}
                            {row.status === "unparsed" && (
                              <span className="font-semibold text-rose-500">Unparsed row</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {idResultMessage.text && (
                <p
                  className={`mt-3 rounded-xl px-3 py-2 text-xs ${idResultMessage.status === "error" ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700"}`}
                  role="status"
                >
                  {idResultMessage.text}
                </p>
              )}

              <div className="mt-3 flex items-center justify-between">
                <p className="text-[11px] text-slate-500">
                  {matchedRows.length} of {idPreview.length} row{idPreview.length === 1 ? "" : "s"} matched
                  and ready to update.
                </p>
                <button
                  type="button"
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
                  disabled={!matchedRows.length || applyingIds}
                  onClick={applyIdUpdates}
                >
                  {applyingIds
                    ? "Updating…"
                    : `Update ${matchedRows.length || ""} matched student ID${matchedRows.length === 1 ? "" : "s"}`}
                </button>
              </div>
            </div>
          )}
        </div>

        {draft && editingStudent && (
          <form className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4" onSubmit={saveStudent}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Edit student profile</p>
                <p className="mt-0.5 text-xs text-slate-500">Update the complete record for {editingStudent.name}.</p>
              </div>
              <button type="button" className="text-xs font-semibold text-slate-500 hover:text-slate-800" onClick={() => { setEditingStudent(null); setDraft(null); }}>Cancel</button>
            </div>
            <div className="mb-4 flex items-center gap-3">
              {draft.photo_url ? <img src={draft.photo_url} alt="" className="h-16 w-16 rounded-2xl object-cover ring-2 ring-white" /> : <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-lg font-bold text-indigo-600">{editingStudent.name?.slice(0, 1) || "?"}</div>}
              <label className="text-xs font-semibold text-slate-600">Profile photo<input type="file" accept="image/*" onChange={handlePhoto} disabled={saving} className="mt-1 block w-full text-[11px] text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-white file:px-2.5 file:py-1.5 file:text-[11px] file:font-semibold file:text-indigo-600" /></label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[['student_no', 'Student ID'], ['full_name', 'Full name'], ['course', 'Course'], ['year_level', 'Year level'], ['contact_no', 'Contact number'], ['email', 'Email']].map(([key, label]) => <label className="text-xs font-semibold text-slate-600" key={key}>{label}<input name={key} type={key === "email" ? "email" : "text"} value={draft[key]} onChange={(event) => updateDraft(key, event.target.value)} disabled={saving} required={key === "full_name"} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" /></label>)}
              <label className="text-xs font-semibold text-slate-600">Gender<select name="gender" value={draft.gender} onChange={(event) => updateDraft("gender", event.target.value)} disabled={saving} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"><option value="">Select</option><option value="M">Male</option><option value="F">Female</option></select></label>
            </div>
            {message.text && <p className={`mt-3 rounded-xl px-3 py-2 text-xs ${message.status === "error" ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700"}`} role="status">{message.text}</p>}
            <div className="mt-4 flex justify-end"><button type="submit" disabled={saving} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60">{saving ? "Saving..." : "Save student"}</button></div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Student ID</th>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Gender</th>
                <th className="py-2 pr-3">Attendance</th>
                <th className="py-2 pr-3">Grade</th>
                <th className="py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedStudents.map((student, index) => (
                <tr key={student.id}>
                  <td className="py-2 pr-3 text-slate-500">{index + 1}</td>
                  <td className="py-2 pr-3 text-slate-700">{student.number}</td>
                  <td className="py-2 pr-3 font-medium text-slate-800">{student.name}</td>
                  <td className="py-2 pr-3 text-slate-600">
                    {student.gender === "F" ? "Female" : student.gender === "M" ? "Male" : "—"}
                  </td>
                  <td className="py-2 pr-3 text-slate-600">{student.attendance}%</td>
                  <td className="py-2 pr-3 text-slate-600">{roundedUpGrade(student.grade)}</td>
                  <td className="py-2 text-right"><button type="button" className="rounded-lg border border-indigo-200 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50" onClick={() => startEditing(student)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>

          {!sortedStudents.length && (
            <div className="py-10 text-center text-sm text-slate-500">
              No students have been imported for this class.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function DeleteClassModal({ section, deleting, error, onClose, onConfirm }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm print:hidden"
      onMouseDown={(event) => event.target === event.currentTarget && !deleting && onClose()}
    >
      <section
        className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-2xl"
        role="alertdialog"
        aria-modal="true"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-500">
          <Icon name="trash" size={22} />
        </div>

        <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Permanent Action</p>
        <h2 className="mt-1 text-lg font-bold text-slate-900">Delete this class?</h2>
        <p className="mt-2 text-sm text-slate-500">
          This will delete <strong>{section?.subject_code || "this class"}</strong>, including
          its students, scores, grades, and attendance records.
        </p>

        {error && <p className="mt-3 text-xs font-medium text-rose-600">{error}</p>}

        <div className="mt-6 flex justify-center gap-3">
          <button
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            onClick={onClose}
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:opacity-60"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete class"}
          </button>
        </div>
      </section>
    </div>
  );
}

function LiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const day = now.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="hidden sm:flex items-center gap-2.5 pl-3 pr-4 py-1.5 rounded-full bg-slate-900 text-white">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
      </span>
      <span className="text-xs font-mono font-semibold tracking-wide tabular-nums">{time}</span>
      <span className="w-px h-3 bg-white/20" />
      <span className="text-[11px] font-medium text-slate-300">{day}</span>
    </div>
  );
}

export { ClassOptionsModal, DeleteClassModal, LiveClock, StudentModal };