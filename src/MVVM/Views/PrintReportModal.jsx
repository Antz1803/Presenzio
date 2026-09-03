import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  gradePeriods,
  recordSummaryGroups,
  formatDisplayDate,
  getAssessmentItem,
  getAttendanceTotal,
  getGradeRemark,
} from "./ClassActionModal";
import logo from "../../assets/Logo.png";

if (typeof document !== "undefined" && !document.getElementById("print-page-style")) {
  const style = document.createElement("style");
  style.id = "print-page-style";
  style.textContent = `
    @page { margin: 10mm; }
    @media print {
      body > *:not(#print-report-portal) {
        display: none !important;
      }
    }
  `;
  document.head.appendChild(style);
}

const thClass = "border border-slate-300 bg-slate-100 px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-slate-600";
const tdClass = "border border-slate-300 px-2 py-1.5 text-center text-xs text-slate-700";
const nameCellClass = "border border-slate-300 px-2 py-1.5 text-left text-xs font-semibold text-slate-800";

// Turns "Juan Dela Cruz" into "Cruz Juan Dela" so sorting compares last
// names first. Note: for multi-word surnames (e.g. "Dela Cruz"), this only
// uses the final token as the "last name" — it won't group "Dela Cruz" and
// "Dela Torre" the way a true first/last-name split would.
function lastNameSortKey(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/);
  if (parts.length <= 1) return fullName || "";
  const lastName = parts[parts.length - 1];
  const rest = parts.slice(0, -1).join(" ");
  return `${lastName} ${rest}`;
}

function monthKey(dateValue) {
  return String(dateValue ?? "").slice(0, 7); // YYYY-MM
}

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function getMonthlyAttendance(studentId, monthKeyValue, attendanceSessions) {
  const sessionsInMonth = attendanceSessions.filter(
    (session) => monthKey(session.sessionDate) === monthKeyValue,
  );
  const attended = sessionsInMonth.filter((session) => {
    const status = session.statuses[studentId];
    return status === "present" || status === "late";
  }).length;
  return `${attended}/${sessionsInMonth.length}`;
}

function PeriodReportTable({ period, students, assessmentScores, attendanceSessions, gradingPeriods }) {
  const selectedPeriod = gradingPeriods.find((item) => item.code === period);
  const periodDates = {
    start: selectedPeriod?.start_date ?? "",
    end: selectedPeriod?.end_date ?? "",
  };
  const periodLabel = gradePeriods.find((item) => item.key === period)?.label ?? period;

  if (!periodDates.start || !periodDates.end) {
    return (
      <p className="py-12 text-center text-sm text-slate-500">
        No date range has been set for {periodLabel}. Set it in Grade Sheet Settings first.
      </p>
    );
  }

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className={thClass} rowSpan="2">STUDENT NAME</th>
          {recordSummaryGroups.map((group) => (
            <th className={thClass} colSpan={group.count} key={group.key}>{group.label}</th>
          ))}
          <th className={thClass} rowSpan="2">ATTENDANCE</th>
          <th className={thClass} rowSpan="2">GRADE</th>
        </tr>
        <tr>
          {recordSummaryGroups.flatMap((group) =>
            Array.from({ length: group.count }, (_, index) => (
              <th className={thClass} key={`${group.key}-${index + 1}`}>{group.prefix}{index + 1}</th>
            )),
          )}
        </tr>
      </thead>
      <tbody>
        {students.map((student) => (
          <tr className="break-inside-avoid" key={student.id}>
            <td className={nameCellClass}>
              {student.name}
              <span className="mt-0.5 block text-[10px] font-normal text-slate-500">{student.number}</span>
            </td>
            {recordSummaryGroups.flatMap((group) =>
              Array.from({ length: group.count }, (_, index) => (
                <td className={tdClass} key={`${group.key}-${index + 1}`}>
                  {getAssessmentItem(student.id, group.key, index + 1, period, assessmentScores)}
                </td>
              )),
            )}
            <td className={tdClass}>{getAttendanceTotal(student.id, period, attendanceSessions, periodDates)}</td>
            <td className={tdClass}>
            {Number.isFinite(Number(student.grades?.[period]))
                ? Number(student.grades[period]).toFixed(1)
                : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SummaryReportTable({ students }) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className={thClass}>STUDENT NAME</th>
          <th className={thClass}>PRELIM</th>
          <th className={thClass}>MIDTERM</th>
          <th className={thClass}>SEMI-FINAL</th>
          <th className={thClass}>FINAL</th>
          <th className={thClass}>REMARKS</th>
        </tr>
      </thead>
      <tbody>
        {students.map((student) => (
          <tr className="break-inside-avoid" key={student.id}>
            <td className={nameCellClass}>
              {student.name}
              <span className="mt-0.5 block text-[10px] font-normal text-slate-500">{student.number}</span>
            </td>
            {gradePeriods.map((period) => {
            const grade = student.grades?.[period.key];
            return (
                <td className={tdClass} key={period.key}>
                {Number.isFinite(Number(grade)) ? Number(grade).toFixed(1) : "—"}
                </td>
            );
            })}
            <td className={tdClass}>{getGradeRemark(student)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MonthlyAttendanceTable({ students, attendanceSessions }) {
  const months = [...new Set(attendanceSessions.map((session) => monthKey(session.sessionDate)))]
    .filter(Boolean)
    .sort();

  if (!months.length) {
    return (
      <p className="py-12 text-center text-sm text-slate-500">
        No attendance sessions have been recorded yet.
      </p>
    );
  }

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className={thClass}>STUDENT NAME</th>
          {months.map((month) => <th className={thClass} key={month}>{monthLabel(month)}</th>)}
        </tr>
      </thead>
      <tbody>
        {students.map((student) => (
          <tr className="break-inside-avoid" key={student.id}>
            <td className={nameCellClass}>
              {student.name}
              <span className="mt-0.5 block text-[10px] font-normal text-slate-500">{student.number}</span>
            </td>
            {months.map((month) => (
              <td className={tdClass} key={month}>{getMonthlyAttendance(student.id, month, attendanceSessions)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const printTitles = {
  prelim: "Prelim Grade Sheet",
  midterm: "Midterm Grade Sheet",
  semifinal: "Semi-Final Grade Sheet",
  final: "Final Grade Sheet",
  summary: "Grade Summary",
  "monthly-attendance": "Monthly Attendance Report",
};

export default function PrintReportModal({
  type,
  section,
  students,
  assessmentScores,
  attendanceSessions,
  gradingPeriods,
  onClose,
}) {
  const sortedStudents = useMemo(
    () =>
      [...students].sort((a, b) =>
        lastNameSortKey(a.name).localeCompare(lastNameSortKey(b.name), undefined, {
          sensitivity: "base",
        }),
      ),
    [students],
  );

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Smart Student Attendance Monitoring System";

    const timer = setTimeout(() => window.print(), 200);
    const handleAfterPrint = () => {
      document.title = previousTitle;
      onClose();
    };
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      clearTimeout(timer);
      document.title = previousTitle;
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [onClose]);

  const isGradePeriod = ["prelim", "midterm", "semifinal", "final"].includes(type);
  const selectedPeriod = isGradePeriod ? gradingPeriods.find((item) => item.code === type) : null;

  return createPortal(
    <div
      id="print-report-portal"
      className="fixed inset-0 z-[999] overflow-y-auto bg-slate-50 print:static print:inset-auto print:z-auto print:overflow-visible print:bg-white">
      <div className="print:hidden sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {printTitles[type] ?? "Report"} preview
        </p>
        <div className="flex gap-3">
          <button
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            onClick={onClose}
          >
            Close
          </button>
          <button
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500"
            onClick={() => window.print()}
          >
            Print
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl bg-white p-8 print:max-w-none print:p-4">
        <header className="mb-6 flex items-center gap-4 border-b border-slate-200 pb-4 break-after-avoid">
          <img src={logo} alt="Presenzio" className="h-25 w-25 shrink-0 object-contain" />
          <div className="flex-1 text-center">
            <h1 className="text-lg font-extrabold text-slate-900">
              {section?.subject_code} - {section?.subject_title}
            </h1>
            <h2 className="mt-1 text-sm font-semibold text-indigo-600">
              {printTitles[type] ?? "Report"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {section?.days || "—"} · {section?.room ? `Room ${section.room}` : "Room not set"}
            </p>
            {isGradePeriod && selectedPeriod?.start_date && selectedPeriod?.end_date && (
              <p className="mt-0.5 text-xs text-slate-500">
                {formatDisplayDate(selectedPeriod.start_date)} – {formatDisplayDate(selectedPeriod.end_date)}
              </p>
            )}
          </div>
          <div className="h-14 w-14 shrink-0" aria-hidden="true" />
        </header>

        {isGradePeriod && (
          <PeriodReportTable
            period={type}
            students={sortedStudents}
            assessmentScores={assessmentScores}
            attendanceSessions={attendanceSessions}
            gradingPeriods={gradingPeriods}
          />
        )}
        {type === "summary" && <SummaryReportTable students={sortedStudents} />}
        {type === "monthly-attendance" && (
          <MonthlyAttendanceTable students={sortedStudents} attendanceSessions={attendanceSessions} />
        )}
        {!sortedStudents.length && (
          <p className="py-12 text-center text-sm text-slate-500">
            No students are enrolled in this class.
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}