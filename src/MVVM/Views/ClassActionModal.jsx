/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef } from "react";
import { ModalShell } from "./classActions/ActionModalShell";
import { AttendanceForm, AttendanceMatrix } from "./classActions/AttendanceActions";
import { ScoreForm } from "./classActions/ScoreActions";
import { AssessmentBuilder, AssessmentManager, StudentViewer } from "./classActions/AssessmentActions";
import { AddStudentForm } from "./classActions/StudentActions";
import { GradeSettings, RecordSummary } from "./classActions/SummaryActions";
import { titles, gradePeriods, getGradeRemark } from "./classActions/actionUtils";

export { gradePeriods, recordSummaryGroups, formatDisplayDate, getAssessmentItem, getAttendanceTotal, getGradeRemark } from "./classActions/actionUtils";

export default function ClassActionModal({
  type,
  section,
  students,
  assessmentScores,
  assessmentDefinitions,
  sessions,
  attendanceSessions,
  gradingPeriods,
  stats,
  loading,
  onClose,
  onSaveAttendance,
  onSaveAssessmentScores,
  onAutoSaveAssessmentScores,
  onSaveAssessment,
  onUpdateAssessment,
  onGrantAssessmentAttempt,
  onDeleteAssessment,
  onSubmitAssessment,
  onSaveGradingPeriods,
  onAddStudent,
  onRefreshGrades,
}) {
  const previousType = useRef(null);

  useEffect(() => {
    const wasShowingGrades = previousType.current === "show-grades";
    previousType.current = type;
    if (type !== "show-grades" || wasShowingGrades || !onRefreshGrades) return;
    void onRefreshGrades().catch(() => {});
  }, [onRefreshGrades, type]);

  if (loading)
    return (
      <ModalShell title={titles[type]} section={section} onClose={onClose}>
        <div className="empty-state">Loading class data…</div>
      </ModalShell>
    );
  if (type === "attendance")
    return (
      <ModalShell title={titles[type]} section={section} onClose={onClose}>
        <AttendanceForm
          section={section}
          students={students}
          attendanceSessions={attendanceSessions}
          onSave={onSaveAttendance}
          onClose={onClose}
        />
      </ModalShell>
    );
  if (type === "record-score")
    return (
      <ModalShell
        title={titles[type]}
        section={section}
        onClose={onClose}
        size="wide"
      >
        <ScoreForm
          students={students}
          assessmentScores={assessmentScores}
          assessmentDefinitions={assessmentDefinitions}
          gradingPeriods={gradingPeriods}
          onSave={onSaveAssessmentScores}
          onAutoSave={onAutoSaveAssessmentScores}
          onClose={onClose}
        />
      </ModalShell>
    );
  if (type === "create-assessment")
    return (
      <AssessmentBuilder
        section={section}
        onSave={onSaveAssessment}
        onClose={onClose}
      />
    );
  if (type === "manage-assessments")
    return (
      <AssessmentManager
        section={section}
        assessments={assessmentDefinitions}
        students={students}
        onUpdate={onUpdateAssessment}
        onDelete={onDeleteAssessment}
        onGrantAttempt={onGrantAssessmentAttempt}
        onClose={onClose}
      />
    );
  if (type === "student-viewer")
    return (
      <StudentViewer
        section={section}
        students={students}
        assessments={assessmentDefinitions}
        onSubmit={onSubmitAssessment}
        onClose={onClose}
      />
    );
  if (type === "add-student")
    return (
      <ModalShell title={titles[type]} section={section} onClose={onClose}>
        <AddStudentForm onSave={onAddStudent} onClose={onClose} />
      </ModalShell>
    );
  if (type === "attendance-list")
    return (
      <ModalShell
        title={titles[type]}
        section={section}
        onClose={onClose}
        size="wide"
      >
        <AttendanceMatrix
          students={students}
          attendanceSessions={attendanceSessions}
          gradingPeriods={gradingPeriods}
        />
      </ModalShell>
    );
  if (type === "attendance-list-legacy")
    return (
      <ModalShell title={titles[type]} section={section} onClose={onClose}>
        <div className="action-summary-grid">
          <strong>
            {stats.sessionsHeld}
            <small>Sessions held</small>
          </strong>
          <strong>
            {stats.monthAttendance}
            <small>Average attendance</small>
          </strong>
        </div>
        <div className="action-list">
          {sessions.map((row) => (
            <div key={row[0]}>
              <b>{row[0]}</b>
              <span>
                {row[2]} present · {row[3]} absent · {row[4]} late
              </span>
              <em>{row[5]}</em>
            </div>
          ))}
        </div>
        {!sessions.length && (
          <div className="empty-state">No attendance sessions yet.</div>
        )}
      </ModalShell>
    );
  if (type === "show-grades")
    return (
      <ModalShell
        title={titles[type]}
        section={section}
        onClose={onClose}
        size="wide"
      >
        <div className="table-wrap grades-table">
          <table>
            <thead>
              <tr>
                <th>STUDENT</th>
                <th>PRELIM</th>
                <th>MIDTERM</th>
                <th>SEMI-FINAL</th>
                <th>FINAL</th>
                <th>REMARKS</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td>
                    <div className="table-student">
                      <span className="record-avatar">{student.initials}</span>
                      <span>
                        <b>{student.name}</b>
                        <small>{student.number}</small>
                      </span>
                    </div>
                  </td>
                  {gradePeriods.map((period) => {
                    const grade = student.grades?.[period.key];
                    return (
                      <td className="grade-period-cell" key={period.key}>
                        {Number.isFinite(Number(grade)) ? Number(grade).toFixed(1) : "—"}
                      </td>
                    );
                  })}
                  <td className={`grade-remark ${getGradeRemark(student).toLowerCase()}`}>
                    {getGradeRemark(student)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!students.length && (
            <div className="empty-state">No students are enrolled in this class.</div>
          )}
        </div>
      </ModalShell>
    );
  if (type === "grade-summary")
    return <RecordSummary
      students={students}
      assessmentScores={assessmentScores}
      attendanceSessions={attendanceSessions}
      gradingPeriods={gradingPeriods}
      section={section}
      onClose={onClose}
    />;
  if (type === "grade-settings")
    return (
      <GradeSettings
        gradingPeriods={gradingPeriods}
        section={section}
        onSave={onSaveGradingPeriods}
        onClose={onClose}
      />
    );
  return (
    <ModalShell title={titles[type]} section={section} onClose={onClose}>
      <div className="action-form-grid">
        <label>
          Quiz weight
          <input name="quizWeight" type="number" defaultValue="20" min="0" max="100" />
        </label>
        <label>
          Assignment weight
          <input name="assignmentWeight" type="number" defaultValue="10" min="0" max="100" />
        </label>
        <label>
          Activity weight
          <input name="activityWeight" type="number" defaultValue="30" min="0" max="100" />
        </label>
        <label>
          Attendance weight
          <input name="attendanceWeight" type="number" defaultValue="5" min="0" max="100" />
        </label>
        <label>
          Exam weight
          <input name="examWeight" type="number" defaultValue="35" min="0" max="100" />
        </label>
      </div>
      <p className="action-help">
        Workbook grading: Quiz 20%, Assignment 10%, Activity 30%, Attendance
        5%, Exam 35%, with transmutation from 1.00 to 5.00.
      </p>
      <div className="action-modal-footer">
        <button className="outline-button" onClick={onClose}>
          Cancel
        </button>
        <button className="primary-button" onClick={onClose}>
          Save settings
        </button>
      </div>
    </ModalShell>
  );
}
