import { useState } from "react";
import { useDashboardViewModel } from "../ViewModels/useDashboardViewModel";
import ClassActionModal from "./ClassActionModal";
import { navItems } from "../Models/dashboardModel";
import logo from "../../assets/Logo.png";
import "../../App.css";

function Icon({ name, size = 18 }) {
  const icons = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
    chart: (
      <>
        <path d="M4 19V5M4 19h17" />
        <path d="m7 15 4-4 3 2 5-7" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    file: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M8 13h8M8 17h6" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.41 1.41-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20h-2v-.49a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.41-1.41.06-.06A1.7 1.7 0 0 0 9.44 15a1.7 1.7 0 0 0-1.56-1.03H7v-2h.88A1.7 1.7 0 0 0 9.44 11a1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.41-1.41.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 13.42 6.5V6h2v.5A1.7 1.7 0 0 0 16.45 8a1.7 1.7 0 0 0 1.88-.34l.06-.06 1.41 1.41-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 20.96 12H21v2h-.04A1.7 1.7 0 0 0 19.4 15z" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16M10 11v6M14 11v6" />
        <path d="M9 7V4h6v3M6 7l1 14h10l1-14" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    alert: (
      <>
        <path d="M10.3 3.6 2.4 17a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z" />
        <path d="M12 9v4M12 17h.01" />
      </>
    ),
  };
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name]}
    </svg>
  );
}
function Avatar({ initials, color = "plum", small = false }) {
  return (
    <span className={`avatar avatar-${color} ${small ? "avatar-small" : ""}`}>
      {initials}
    </span>
  );
}
function StatCard({ label, value, note, icon, tone, trend }) {
  return (
    <article className={`stat-card stat-${tone}`}>
      <div className="stat-top">
        <span className="stat-icon">
          <Icon name={icon} size={17} />
        </span>
        <span className="stat-trend">{trend}</span>
      </div>
      <p className="stat-label">{label}</p>
      <strong>{value}</strong>
      <p className="stat-note">{note}</p>
    </article>
  );
}

function Overview({ setActive, students, stats }) {
  const bars = stats.attendanceBars;
  return (
    <>
      <section className="welcome-row">
        <div>
          <p className="eyebrow">
            {new Intl.DateTimeFormat("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            }).format(new Date())}
          </p>
          <h1>Good morning, Jeorge.</h1>
          <p className="welcome-copy">
            Here’s what’s happening with your class today.
          </p>
        </div>
        <button
          className="primary-button"
            onClick={() => setActive("classes")}
        >
          <Icon name="plus" size={17} /> Mark attendance
        </button>
      </section>
      <section className="stats-grid">
        <StatCard
          label="Total students"
          value={stats.totalStudents}
          note={stats.male + " male · " + stats.female + " female"}
          icon="users"
          tone="plum"
          trend="Live"
        />
        <StatCard
          label="Today's attendance"
          value={stats.todayAttendance}
          note={
            stats.todayPresent + " present · " + stats.todayAbsent + " absent"
          }
          icon="calendar"
          tone="blue"
          trend="Live"
        />
        <StatCard
          label="Class average"
          value={stats.classAverage}
          note="Passing grade ≤ 3.05"
          icon="chart"
          tone="green"
          trend="Live"
        />
        <StatCard
          label="Needs attention"
          value={stats.needsAttention}
          note="Students below 80% attendance"
          icon="alert"
          tone="peach"
          trend="Review"
        />
      </section>
      <div className="dashboard-grid">
        <section className="card attendance-card">
          <div className="card-heading">
            <div>
              <p className="section-kicker">ATTENDANCE</p>
              <h2>Attendance overview</h2>
            </div>
            <button
              className="text-button"
              onClick={() => setActive("classes")}
            >
              View details <Icon name="arrow" size={15} />
            </button>
          </div>
          <div className="attendance-content">
            <div className="attendance-total">
              <strong>{stats.monthAttendance}</strong>
              <span className="positive">Live</span>
              <p>Average attendance this month</p>
            </div>
            <div className="bar-chart" aria-label="Weekly attendance chart">
              {bars.map((height, index) => (
                <div className="bar-column" key={index}>
                  <div className="bar-track">
                    <span style={{ height: `${height}%` }} />
                  </div>
                  <small>{["M", "T", "W", "T", "F", "M", "T"][index]}</small>
                </div>
              ))}
            </div>
          </div>
          <div className="attendance-legend">
            <span>
              <i className="dot present" /> Present <b>{stats.totalPresent}</b>
            </span>
            <span>
              <i className="dot absent" /> Absent <b>{stats.totalAbsent}</b>
            </span>
            <span>
              <i className="dot late" /> Late <b>{stats.totalLate}</b>
            </span>
          </div>
        </section>
        <section className="card performance-card">
          <div className="card-heading">
            <div>
              <p className="section-kicker">PERFORMANCE</p>
              <h2>Grade distribution</h2>
            </div>
            <button className="select-button">
              All periods <span>⌄</span>
            </button>
          </div>
          <div className="performance-body">
            <div className="donut">
              <div className="donut-center">
                <strong>{stats.classAverage}</strong>
                <small>average</small>
              </div>
            </div>
            <div className="distribution">
              <div>
                <span>
                  <i className="dot excellent" /> Excellent
                </span>
                <b>
                  {stats.excellentCount} <small>students</small>
                </b>
              </div>
              <div>
                <span>
                  <i className="dot good" /> Good
                </span>
                <b>
                  {stats.goodCount} <small>students</small>
                </b>
              </div>
              <div>
                <span>
                  <i className="dot watch" /> Needs review
                </span>
                <b>
                  {stats.needsReviewCount} <small>students</small>
                </b>
              </div>
            </div>
          </div>
          <div className="performance-footer">
            <span>Passing rate</span>
            <strong>{stats.passingRate}</strong>
            <span className="positive">Live</span>
          </div>
        </section>
        <section className="card activity-card">
          <div className="card-heading">
            <div>
              <p className="section-kicker">RECENT ACTIVITY</p>
              <h2>Latest updates</h2>
            </div>
          </div>
          <div className="activity-list">
            <div className="empty-state">No recent activity yet.</div>
          </div>
        </section>
        <section className="card attention-card">
          <div className="card-heading">
            <div>
              <p className="section-kicker">STUDENT CHECK-IN</p>
              <h2>Needs your attention</h2>
            </div>
            <button
              className="text-button"
              onClick={() => setActive("students")}
            >
              See all <Icon name="arrow" size={15} />
            </button>
          </div>
          <div className="attention-list">
            {students
              .filter((student) => student.status !== "On track")
              .slice(0, 3)
              .map((student) => (
                <div className="student-row" key={student.id}>
                  <Avatar
                    initials={student.initials}
                    color={student.color}
                    small
                  />
                  <div className="student-info">
                    <b>{student.name}</b>
                    <small>{student.attendance}% attendance</small>
                  </div>
                  <span
                    className={`status status-${student.status.toLowerCase().replace(" ", "-")}`}
                  >
                    {student.status}
                  </span>
                  <button
                    className="row-arrow"
                    onClick={() => setActive("students")}
                  >
                    <Icon name="arrow" size={15} />
                  </button>
                </div>
              ))}
          </div>
        </section>
      </div>
    </>
  );
}

function Reports() {
  return (
    <div className="page-view">
      <section className="page-heading">
        <div>
          <p className="eyebrow">DOCUMENT CENTER</p>
          <h1>Reports</h1>
          <p>Generate official class records and monthly attendance reports.</p>
        </div>
        <button className="primary-button">
          <Icon name="file" size={17} /> New report
        </button>
      </section>
      <section className="reports-grid">
        <article className="card report-feature">
          <span className="report-icon report-icon-plum">
            <Icon name="file" size={20} />
          </span>
          <h2>Class record</h2>
          <p>
            Official period grade sheet with student scores, transmuted grades,
            and signatures.
          </p>
          <button className="outline-button">
            Generate report <Icon name="arrow" size={15} />
          </button>
        </article>
        <article className="card report-feature">
          <span className="report-icon report-icon-blue">
            <Icon name="calendar" size={20} />
          </span>
          <h2>Monthly attendance</h2>
          <p>
            AM/PM daily attendance by gender, enrollment totals, and monthly
            percentages.
          </p>
          <button className="outline-button">
            Generate report <Icon name="arrow" size={15} />
          </button>
        </article>
        <article className="card recent-reports">
          <div className="card-heading">
            <div>
              <p className="section-kicker">HISTORY</p>
              <h2>Recent reports</h2>
            </div>
          </div>
          <div className="empty-state">No reports have been generated yet.</div>
        </article>
      </section>
    </div>
  );
}

function formatClassTime(value) {
  if (!value) return "—";
  const [hour, minute] = String(value).split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function ClassOptionsModal({
  section,
  onClose,
  onOpenAction,
  onOpenStudentView,
  onSyncToExcel,
  syncReady,
}) {
  const schedule = `${section?.days || "Schedule not set"} | ${formatClassTime(section?.time_start)} - ${formatClassTime(section?.time_end)} | ${section?.room || "Room not set"}`;
  return (
    <div
      className="modal-backdrop class-options-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="class-options-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="class-options-title"
      >
        <div className="class-options-header">
          <h2 id="class-options-title">CLASS OPTIONS</h2>
          <button
            className="modal-close class-options-close"
            onClick={onClose}
            aria-label="Close class options"
          >
            ×
          </button>
        </div>
        <div className="class-options-body">
          <div className="class-option-summary">
            <div>
              <h3>
                {section?.subject_code || "Class"} -{" "}
                {section?.subject_title || "Class subject"}
              </h3>
              <p>{schedule}</p>
            </div>
            <span className="class-target">◉</span>
          </div>
          <button
            className="class-option-button"
            onClick={() => {
              onClose();
              onOpenAction("attendance", section.id);
            }}
          >
            Take Attendance
          </button>
          <button
            className="class-option-button"
            onClick={() => {
              onClose();
              onOpenAction("attendance-list", section.id);
            }}
          >
            Attendance List
          </button>
          <div className="class-option-spacer" />
          <button
            className="class-option-button"
            onClick={() => {
              onClose();
              onOpenAction("create-assessment", section.id);
            }}
          >
            Create Assessment
          </button>
          <button
            className="class-option-button"
            onClick={() => {
              onClose();
              onOpenAction("manage-assessments", section.id);
            }}
          >
            Manage Assessments
          </button>
          <button
            className="class-option-button"
            onClick={() => {
              onClose();
              onOpenStudentView(section.id);
            }}
          >
            Open Student View
          </button>
          <button
            className="class-option-button"
            onClick={() => {
              onClose();
              onOpenAction("record-score", section.id);
            }}
          >
            Record Score
          </button>
          <button
            className="class-option-button"
            onClick={() => {
              onClose();
              onOpenAction("show-grades", section.id);
            }}
          >
            Show Grades
          </button>
          <button
            className="class-option-button"
            onClick={() => {
              onClose();
              onOpenAction("grade-summary", section.id);
            }}
          >
            Record Summary
          </button>
          <button
            className="class-option-button"
            onClick={() => {
              onClose();
              onOpenAction("grade-settings", section.id);
            }}
          >
            Grade Sheet Settings
          </button>
          <button
            className="class-option-button"
            disabled={!syncReady}
            onClick={() => {
              onClose();
              onSyncToExcel().catch((error) => {
                window.alert(error?.message || "Excel sync failed.");
              });
            }}
          >
            {syncReady ? "Sync to Excel" : "Loading class data..."}
          </button>
          <button
            className="class-option-button"
            onClick={() => {
              onClose();
              onOpenAction("add-student", section.id);
            }}
          >
            Add Student
          </button>
        </div>
      </section>
    </div>
  );
}

function StudentModal({ section, students, loading, onClose }) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="student-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-modal-title"
      >
        <div className="student-modal-header">
          <div>
            <p className="eyebrow">CLASS ROSTER</p>
            <h2 id="student-modal-title">
              {section?.subject_code ?? "Students"}
            </h2>
            <p>{section?.subject_title ?? "Students enrolled in this class"}</p>
          </div>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Close students"
          >
            ×
          </button>
        </div>
        {loading ? (
          <div className="empty-state">Loading students…</div>
        ) : (
          <div className="table-wrap student-modal-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>STUDENT ID</th>
                  <th>NAME</th>
                  <th>GENDER</th>
                  <th>ATTENDANCE</th>
                  <th>GRADE</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, index) => (
                  <tr key={student.id}>
                    <td>{index + 1}</td>
                    <td>{student.number}</td>
                    <td>{student.name}</td>
                    <td>
                      {student.gender === "F"
                        ? "Female"
                        : student.gender === "M"
                          ? "Male"
                          : "—"}
                    </td>
                    <td>{student.attendance}%</td>
                    <td>{student.grade.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!students.length && (
              <div className="empty-state">
                No students have been imported for this class.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function DeleteClassModal({ section, deleting, error, onClose, onConfirm }) {
  return (
    <div
      className="modal-backdrop delete-confirm-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !deleting) onClose();
      }}
    >
      <section
        className="delete-confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-class-title"
        aria-describedby="delete-class-description"
      >
        <div className="delete-confirm-icon">
          <Icon name="trash" size={22} />
        </div>
        <p className="delete-confirm-kicker">PERMANENT ACTION</p>
        <h2 id="delete-class-title">Delete this class?</h2>
        <p id="delete-class-description">
          This will delete <strong>{section?.subject_code || "this class"}</strong>,
          its students’ enrollments, scores, grades, attendance sessions, and
          attendance records.
        </p>
        {error && <p className="delete-confirm-error">{error}</p>}
        <div className="delete-confirm-actions">
          <button className="outline-button" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button className="danger-button" onClick={onConfirm} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete class"}
          </button>
        </div>
      </section>
    </div>
  );
}

function Classes({ sections, section, importMasterList, importGradeSheet, importState, gradeSheetImportState, connectionStatus, pendingSyncCount, onOpenStudents, onOpenClassOptions, onDeleteClass }) {
  return (
    <div className="page-view classes-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">CLASS MANAGEMENT</p>
          <h1>Classes</h1>
          <p>All classes imported from your master lists.</p>
        </div>
        <div className="class-import-actions">
          <label className="primary-button import-button">
            <Icon name="plus" size={17} /> Import master list
            <input
              type="file"
              accept=".xls,.xlsx"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) importMasterList(file);
                event.target.value = "";
              }}
            />
          </label>
          <label className="outline-button import-button">
            <Icon name="file" size={17} /> Import grade sheet
            <input
              type="file"
              accept=".xls,.xlsx,.xlsm"
              disabled={gradeSheetImportState?.status === "working"}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) importGradeSheet(file);
                event.target.value = "";
              }}
            />
          </label>
        </div>
      </section>
      {importState?.message && (
        <p className={`import-feedback import-${importState.status}`} role="status">
          {importState.message}
        </p>
      )}
      {gradeSheetImportState?.message && (
        <p className={`import-feedback import-${gradeSheetImportState.status}`} role="status">
          {gradeSheetImportState.message}
        </p>
      )}
      <section className="card class-list-card">
        <div className="class-list-toolbar">
          <strong>{sections.length} classes</strong> 
          <span>
            {connectionStatus === "offline"
              ? `Offline${pendingSyncCount ? ` · ${pendingSyncCount} pending` : ""}`
              : connectionStatus === "live"
                ? "Online"
                : "Connecting..."}
          </span>
        </div>
        <div className="table-wrap">
          <table className="class-list-table">
            <thead>
              <tr>
                <th>DAYS</th>
                <th>
                  TIME <span className="sort-label">ASC</span>
                </th>
                <th>EDP CODE</th>
                <th>SUBJECT CODE</th>
                <th>SUBJECT NAME</th>
                <th>ROOM</th>
                <th>YEAR</th>
                <th>SECTION</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((item, index) => (
                <tr
                  className={item.id === section?.id ? "selected-class" : ""}
                  key={item.id}
                >
                  <td>
                    <span className="days-badge">{item.days || "—"}</span>
                  </td>
                  <td>
                    {formatClassTime(item.time_start)} -{" "}
                    {formatClassTime(item.time_end)}
                  </td>
                  <td>{item.edp_code || "—"}</td>
                  <td>
                    <span className={`subject-dot subject-dot-${index % 6}`} />
                    {item.subject_code || "—"}
                  </td>
                  <td>{item.subject_title || "—"}</td>
                  <td>{item.room || "—"}</td>
                  <td>{item.year_level || "—"}</td>
                  <td>{item.section_no || "—"}</td>
                  <td>
                    <div className="class-actions">
                      <button
                        title="Class options"
                        onClick={() => onOpenClassOptions(item.id)}
                      >
                        <Icon name="grid" size={16} />
                      </button>
                      
                      <button
                        title="View students"
                        onClick={() => onOpenStudents(item.id)}
                      >
                        <Icon name="users" size={16} />
                      </button>
                      <button
                        title="Delete"
                        onClick={() => onDeleteClass(item)}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!sections.length && (
            <div className="empty-state">
              Import a master list to create your first class.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function DashboardView() {
  const viewModel = useDashboardViewModel();
  const [studentModalId, setStudentModalId] = useState(null);
  const [classOptionsId, setClassOptionsId] = useState(null);
  const [actionModal, setActionModal] = useState(null);
  const [deleteClass, setDeleteClass] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deletingClass, setDeletingClass] = useState(false);
  const {
    active,
    setActive,
    mobileNav,
    setMobileNav,
    students,
    assessmentScores,
    assessmentDefinitions,
    attendanceSessions,
    stats,
    sessions,
    section,
    sections,
    gradingPeriods,
    selectSection,
    importMasterList,
    importGradeSheet,
    importState,
    gradeSheetImportState,
    connectionStatus,
    pendingSyncCount,
    syncToExcel,
    saveAttendance,
    saveAssessmentScores,
    saveAssessment,
    updateAssessment,
    grantAssessmentAttempt,
    deleteAssessment,
    submitAssessment,
    saveGradingPeriods,
    addStudent,
    deleteSection,
  } = viewModel;
  const openStudentModal = (sectionId) => {
    selectSection(sectionId);
    setStudentModalId(sectionId);
  };
  const openClassOptions = (sectionId) => {
    selectSection(sectionId);
    setClassOptionsId(sectionId);
  };
  const openClassAction = (type, sectionId) => {
    selectSection(sectionId);
    setActionModal({ type, sectionId });
  };
  const openStudentView = (sectionId) => {
    const studentUrl = `${window.location.origin}/?view=student&section=${encodeURIComponent(sectionId)}`;
    window.open(studentUrl, "_blank", "noopener,noreferrer");
  };
  const closeClassAction = () => {
    const sectionId = actionModal?.sectionId;
    setActionModal(null);
    if (sectionId) setClassOptionsId(sectionId);
  };
  const openDeleteClass = (classItem) => {
    setDeleteError("");
    setDeleteClass(classItem);
  };
  const confirmDeleteClass = async () => {
    if (!deleteClass) return;
    setDeletingClass(true);
    setDeleteError("");
    try {
      await deleteSection(deleteClass.id);
      setDeleteClass(null);
      setClassOptionsId(null);
      setStudentModalId(null);
      setActionModal(null);
    } catch (error) {
      setDeleteError(error.message ?? "The class could not be deleted.");
    } finally {
      setDeletingClass(false);
    }
  };
  const modalSection = sections.find((item) => item.id === studentModalId);
  const optionsSection = sections.find((item) => item.id === classOptionsId);
  const actionSection = sections.find(
    (item) => item.id === actionModal?.sectionId,
  );
  const actionReady = section?.id === actionModal?.sectionId;
  const modalReady = section?.id === studentModalId;
  const page =
    active === "classes" ? (
      <Classes
        sections={sections}
        section={section}
        importMasterList={importMasterList}
        importGradeSheet={importGradeSheet}
        importState={importState}
        gradeSheetImportState={gradeSheetImportState}
        connectionStatus={connectionStatus}
        pendingSyncCount={pendingSyncCount}
        onOpenStudents={openStudentModal}
        onOpenClassOptions={openClassOptions}
        onDeleteClass={openDeleteClass}
      />
    ) : active === "reports" ? (
      <Reports />
    ) : (
      <Overview setActive={setActive} students={students} stats={stats} />
    );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand">
          <img className="brand-logo" src={logo} alt="Presenzio" />
        </div>
        <div className="sidebar-section">
          <p className="nav-label">WORKSPACE</p>
          <nav>
            {navItems.map((item) => (
              <button
                key={item.id}
                className={active === item.id ? "nav-item active" : "nav-item"}
                onClick={() => {
                  setActive(item.id);
                  setMobileNav(false);
                }}
              >
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="sidebar-bottom">
          <button className="nav-item">
            <Icon name="settings" size={18} />
            <span>Settings</span>
          </button>
          <div className="profile">
            <Avatar initials="JM" color="blue" small />
            <span>
              <b>Jeorge Mancilla</b>
              <small>Teacher account</small>
            </span>
            <button className="profile-more">
              <Icon name="more" size={16} />
            </button>
          </div>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setMobileNav(!mobileNav)}
          >
            <span />
            <span />
            <span />
          </button>
          <div className="breadcrumb">
            <span>Classes</span>
            <b>/</b>
            <strong>{section?.subject_code ?? "No section"}</strong>
          </div>
          <div className="topbar-actions">
            <div className="search-box">
              <Icon name="search" size={17} />
              <input placeholder="Search anything..." />
            </div>
            <button className="notification-button">
              <Icon name="bell" size={19} />
              <i />
            </button>
            <div className="top-avatar">
              <Avatar initials="JM" color="blue" small />
            </div>
          </div>
        </header>
        <div className="content-wrap">{page}</div>
      </main>
      {studentModalId && (
        <StudentModal
          section={modalSection}
          students={modalReady ? students : []}
          loading={!modalReady}
          onClose={() => setStudentModalId(null)}
        />
      )}
      {classOptionsId && (
        <ClassOptionsModal
          section={optionsSection}
          onClose={() => setClassOptionsId(null)}
          onOpenAction={openClassAction}
          onOpenStudentView={openStudentView}
          onSyncToExcel={syncToExcel}
          syncReady={section?.id === optionsSection?.id}
        />
      )}
      {deleteClass && (
        <DeleteClassModal
          section={deleteClass}
          deleting={deletingClass}
          error={deleteError}
          onClose={() => {
            if (!deletingClass) setDeleteClass(null);
          }}
          onConfirm={confirmDeleteClass}
        />
      )}
      {actionModal && (
        <ClassActionModal
          type={actionModal.type}
          section={actionSection}
          students={actionReady ? students : []}
          assessmentScores={actionReady ? assessmentScores : []}
          assessmentDefinitions={actionReady ? assessmentDefinitions : []}
          attendanceSessions={actionReady ? attendanceSessions : []}
          gradingPeriods={actionReady ? gradingPeriods : []}
          sessions={actionReady ? sessions : []}
          stats={
            actionReady
              ? stats
              : {
                  sessionsHeld: 0,
                  monthAttendance: "—",
                  classAverage: "—",
                  passingRate: "—",
                  excellentCount: 0,
                  needsReviewCount: 0,
                }
          }
          loading={!actionReady}
          onClose={closeClassAction}
          onSaveAttendance={async (payload) => {
            await saveAttendance(payload);
            setActionModal(null);
          }}
          onSaveAssessmentScores={async (payload) => {
            await saveAssessmentScores(payload);
            setActionModal(null);
          }}
          onAutoSaveAssessmentScores={async (payload) => {
            await saveAssessmentScores(payload);
          }}
          onSaveAssessment={saveAssessment}
          onUpdateAssessment={updateAssessment}
          onGrantAssessmentAttempt={grantAssessmentAttempt}
          onDeleteAssessment={deleteAssessment}
          onSubmitAssessment={submitAssessment}
          onSaveGradingPeriods={async (dateRanges) => {
            await saveGradingPeriods(dateRanges);
            setActionModal(null);
          }}
          onAddStudent={async (payload) => {
            await addStudent(payload);
            setActionModal(null);
          }}
        />
      )}
    </div>
  );
}
export default DashboardView;
