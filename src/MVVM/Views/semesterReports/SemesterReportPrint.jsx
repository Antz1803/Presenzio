import { useEffect } from "react";
import { createPortal } from "react-dom";
import { LOW_ATTENDANCE, PASSING_GRADE, PERIODS, PERIOD_LABELS, STOPPED_AFTER, statusLabel } from "../../../lib/semesterReports";

// Applied only while a semester report is open, so class-record printing keeps
// its own page settings. A zero page margin is what makes the browser leave out
// its date, page title and address header/footer; the spacing is added back
// inside the page (see the repeating spacer rows below).
const PRINT_CSS = `
  @page { margin: 0; }
  @media print {
    body > *:not(#print-report-portal) { display: none !important; }
  }
`;

const TH = "border border-slate-300 bg-slate-100 px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-600";
const TD = "border border-slate-300 px-2 py-1.5 text-xs text-slate-700 align-top";

const TITLES = {
  monitoring: "Student Monitoring Report",
  accomplishment: "Accomplishment Report",
  activities: "Activity Accomplishment Report",
};

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// Set directly on the cell so no other text color class can override it.
const FAILED_STYLE = { color: "#be123c", fontWeight: 700 };

const PERIOD_HEAD = PERIODS.map((code) => PERIOD_LABELS[code]);

// One cell per period; grades above the passing mark are shown in bold red.
function periodCells(row) {
  return PERIODS.map((code) => {
    const grade = row.grades[code];
    const failed = grade != null && grade > PASSING_GRADE;
    return (
      <td key={code} className={TD} style={failed ? FAILED_STYLE : undefined}>{grade == null ? "—" : grade.toFixed(2)}</td>
    );
  });
}

function Table({ head, children, empty }) {
  const rowsList = Array.isArray(children) ? children : [children];
  return (
    <table className="w-full border-collapse [&_tr]:break-inside-avoid">
      <thead>
        <tr>{head.map((label) => <th key={label} className={TH}>{label}</th>)}</tr>
      </thead>
      <tbody>
        {rowsList.filter(Boolean).length ? children : (
          <tr><td className={`${TD} text-center italic text-slate-400`} colSpan={head.length}>{empty}</td></tr>
        )}
      </tbody>
    </table>
  );
}

function Group({ title, note, children }) {
  return (
    <section className="mb-6">
      <h2 className="break-after-avoid text-sm font-bold uppercase tracking-wide text-slate-800">{title}</h2>
      {note && <p className="mb-2 break-after-avoid text-[11px] text-slate-500">{note}</p>}
      {children}
    </section>
  );
}

function MonitoringBody({ data }) {
  const studentCells = (row) => [
    <td key="n" className={TD}>{row.name}<span className="block text-[10px] text-slate-400">{row.studentNo}</span></td>,
    <td key="c" className={TD}>{row.sectionLabel}</td>,
    <td key="y" className={TD}>{[row.course, row.yearLevel].filter(Boolean).join(" · ") || "—"}</td>,
  ];
  const base = ["Student", "Class", "Course / Year"];
  return (
    <>
      <Group title={`1. Students with failing grades (${data.failing.length})`} note={`Any period grade above ${PASSING_GRADE.toFixed(2)}, shown in red. The Final grade is the official pass or fail.`}>
        <Table head={[...base, ...PERIOD_HEAD]} empty="No students with failing grades.">
          {data.failing.map((row) => (
            <tr key={row.key}>{studentCells(row)}{periodCells(row)}</tr>
          ))}
        </Table>
      </Group>
      <Group title={`2. Students who have stopped attending (${data.stopped.length})`} note={`No present or late mark in the last ${STOPPED_AFTER} recorded sessions.`}>
        <Table head={[...base, "Attendance", "Last attended"]} empty="No students flagged.">
          {data.stopped.map((row) => (
            <tr key={row.key}>{studentCells(row)}<td className={TD}>{row.attendanceRate}%</td><td className={TD}>{formatDate(row.lastAttended)}</td></tr>
          ))}
        </Table>
      </Group>
      <Group title={`3. Students with low attendance (${data.lowAttendance.length})`} note={`Attendance below ${LOW_ATTENDANCE}%.`}>
        <Table head={[...base, "Attended", "Rate"]} empty="No students below the attendance threshold.">
          {data.lowAttendance.map((row) => (
            <tr key={row.key}>{studentCells(row)}<td className={TD}>{row.sessionsAttended}/{row.sessionsHeld}</td><td className={TD}>{row.attendanceRate}%</td></tr>
          ))}
        </Table>
      </Group>
      <Group title={`4. Withdrawn, not continuing, or stopped attending (${data.left.length})`}>
        <Table head={[...base, "Status", "Date", "Remarks"]} empty="No students recorded as withdrawn or not continuing.">
          {data.left.map((row) => (
            <tr key={row.key}>{studentCells(row)}<td className={TD}>{statusLabel(row.status)}</td><td className={TD}>{formatDate(row.statusDate)}</td><td className={TD}>{row.statusRemark || "—"}</td></tr>
          ))}
        </Table>
      </Group>
    </>
  );
}

function AccomplishmentBody({ data }) {
  const totals = data.stats.reduce(
    (sum, item) => ({ enrolled: sum.enrolled + item.enrolled, sessions: sum.sessions + item.sessions }),
    { enrolled: 0, sessions: 0 },
  );
  const leftAll = data.stats.flatMap((item) => item.leftList.map((row) => ({ ...row, className: item.label })));
  const failingAll = data.stats.flatMap((item) => item.failingList.map((row) => ({ ...row, className: item.label })));
  return (
    <>
      <Group title="1. Class summary" note={`${data.stats.length} class(es) · ${totals.enrolled} enrolled student(s) · ${totals.sessions} session(s) held in this period.`}>
        <Table head={["Class", "Enrolled", "Left", "Sessions", "Attendance", "Passed", "Failed (Final)", "Failing (any period)", "Class avg."]} empty="No classes found.">
          {data.stats.map((item) => (
            <tr key={item.label}>
              <td className={TD}>{item.label}<span className="block text-[10px] text-slate-400">{item.title}</span></td>
              <td className={TD}>{item.enrolled}</td>
              <td className={TD}>{item.left}</td>
              <td className={TD}>{item.sessions}</td>
              <td className={TD}>{item.attendance == null ? "—" : `${item.attendance}%`}</td>
              <td className={TD}>{item.passed}</td>
              <td className={TD} style={item.failed ? FAILED_STYLE : undefined}>{item.failed}</td>
              <td className={TD} style={item.failingAny ? FAILED_STYLE : undefined}>{item.failingAny}</td>
              <td className={TD}>{item.average ?? "—"}</td>
            </tr>
          ))}
        </Table>
      </Group>
      <Group title={`2. Students who left (${leftAll.length})`} note="Withdrawn, not continuing, or stopped attending.">
        <Table head={["Student", "Class", "Status", "Date", "Remarks"]} empty="No students have left.">
          {leftAll.map((row) => (
            <tr key={row.key}>
              <td className={TD}>{row.name}<span className="block text-[10px] text-slate-400">{row.studentNo}</span></td>
              <td className={TD}>{row.className}</td>
              <td className={TD}>{statusLabel(row.status)}</td>
              <td className={TD}>{formatDate(row.date)}</td>
              <td className={TD}>{row.remark || "—"}</td>
            </tr>
          ))}
        </Table>
      </Group>
      <Group title={`3. Failing students (${failingAll.length})`} note={`Any period grade above ${PASSING_GRADE.toFixed(2)}, shown in red. The Final grade is the official pass or fail.`}>
        <Table head={["Student", "Class", ...PERIOD_HEAD]} empty="No failing students.">
          {failingAll.map((row) => (
            <tr key={row.key}>
              <td className={TD}>{row.name}<span className="block text-[10px] text-slate-400">{row.studentNo}</span></td>
              <td className={TD}>{row.className}</td>
              {periodCells(row)}
            </tr>
          ))}
        </Table>
      </Group>
      <Group title="4. Accomplishments and deliverables">
        <Table head={["Date", "Accomplishment", "Details"]} empty="No accomplishments recorded for this period.">
          {data.items.map((item) => (
            <tr key={item.id}><td className={`${TD} whitespace-nowrap`}>{formatDate(item.date)}</td><td className={TD}>{item.title}</td><td className={TD}>{item.description || "—"}</td></tr>
          ))}
        </Table>
      </Group>
    </>
  );
}

function ActivitiesBody({ data }) {
  if (!data.items.length) return <p className="text-xs italic text-slate-400">No activities recorded for this period.</p>;
  return data.items.map((item, index) => (
    <section key={item.id} className="mb-6 break-inside-avoid-page">
      <h2 className="text-sm font-bold text-slate-800">{index + 1}. {item.title}</h2>
      <p className="text-[11px] text-slate-500">
        {formatDate(item.date)}{item.venue ? ` · ${item.venue}` : ""}{item.participants ? ` · ${item.participants} participant(s)` : ""}
      </p>
      {item.description && <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-700">{item.description}</p>}
      {(item.photos?.length ?? 0) > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {item.photos.map((src, photoIndex) => <img key={photoIndex} src={src} alt={`${item.title} documentation ${photoIndex + 1}`} className="h-40 w-full rounded border border-slate-200 object-cover" />)}
        </div>
      )}
      {(item.sheets?.length ?? 0) > 0 && (
        <>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Attendance sheet</p>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {item.sheets.map((src, sheetIndex) => <img key={sheetIndex} src={src} alt={`${item.title} attendance sheet ${sheetIndex + 1}`} className="w-full rounded border border-slate-200" />)}
          </div>
        </>
      )}
    </section>
  ));
}

export default function SemesterReportPrint({ kind, data, periodLabel, instructorName, instructorPosition, deanName, leftLogo, rightLogo, onClose }) {
  useEffect(() => {
    const previous = document.title;
    const style = document.createElement("style");
    style.id = "semester-print-style";
    style.textContent = PRINT_CSS;
    document.head.appendChild(style);
    document.title = `${TITLES[kind] ?? "Report"} - ${periodLabel}`;
    const timer = setTimeout(() => window.print(), 400);
    const done = () => onClose();
    window.addEventListener("afterprint", done);
    return () => {
      clearTimeout(timer);
      style.remove();
      document.title = previous;
      window.removeEventListener("afterprint", done);
    };
  }, [kind, periodLabel, onClose]);

  return createPortal(
    <div id="print-report-portal" className="fixed inset-0 z-[999] overflow-y-auto bg-slate-50 print:static print:inset-auto print:z-auto print:overflow-visible print:bg-white">
      <div className="print:hidden sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{TITLES[kind]} preview</p>
        <div className="flex gap-3">
          <button type="button" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50" onClick={onClose}>Close</button>
          <button type="button" className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500" onClick={() => window.print()}>Print</button>
        </div>
      </div>
      <div className="mx-auto max-w-5xl bg-white p-8 text-slate-800 print:max-w-none print:px-[12mm] print:py-0">
        <table className="w-full border-collapse">
          <thead className="hidden print:table-header-group"><tr><td><div className="h-[12mm]" /></td></tr></thead>
          <tfoot className="hidden print:table-footer-group"><tr><td><div className="h-[12mm]" /></td></tr></tfoot>
          <tbody><tr><td className="align-top">
        <header className="mb-6 flex items-center gap-4 border-b border-slate-200 pb-4">
          {leftLogo && <img src={leftLogo} alt="" className="h-14 w-auto max-w-[8rem] object-contain" />}
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold uppercase tracking-wide">{TITLES[kind]}</h1>
            <p className="text-xs text-slate-500">{periodLabel} · Prepared by {instructorName || "Instructor"}</p>
          </div>
          {rightLogo && <img src={rightLogo} alt="" className="h-14 w-auto max-w-[8rem] object-contain" />}
        </header>
        {kind === "monitoring" && <MonitoringBody data={data} />}
        {kind === "accomplishment" && <AccomplishmentBody data={data} />}
        {kind === "activities" && <ActivitiesBody data={data} />}
        <footer className="mt-14 grid grid-cols-2 gap-16 text-center text-xs text-slate-600 break-inside-avoid">
          <div>
            <div className="pb-1 text-sm font-bold text-slate-900">{instructorName || "\u00A0"}</div>
            <div className="border-t-2 border-slate-800 pt-1.5">{instructorPosition || "Instructor"}</div>
          </div>
          <div>
            <div className="pb-1 text-sm font-bold text-slate-900">{deanName || "\u00A0"}</div>
            <div className="border-t-2 border-slate-800 pt-1.5">Dean</div>
          </div>
        </footer>
          </td></tr></tbody>
        </table>
      </div>
    </div>,
    document.body,
  );
}
