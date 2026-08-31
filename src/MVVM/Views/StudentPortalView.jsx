import { useCallback, useEffect, useRef, useState } from "react";
import { useDashboardViewModel } from "../ViewModels/useDashboardViewModel";
import icon from "../../assets/Icon.png";
import "../../App.css";

const categoryLabels = {
  quiz: "Quiz",
  assignment: "Assignment",
  activity: "Graded activity",
  exam: "Exam",
};

const periodLabels = {
  prelim: "Prelim",
  midterm: "Midterm",
  semifinal: "Semi-final",
  final: "Final",
};

const letters = ["A", "B", "C", "D"];

function formatCountdown(seconds) {
  if (seconds == null) return "";
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function StudentPortalView() {
  const viewModel = useDashboardViewModel();
  const { submitAssessment, loadStudentAssessment, connectionStatus } = viewModel;
  const [accessKey, setAccessKey] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [accessState, setAccessState] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ status: "", text: "" });
  const [submittedResult, setSubmittedResult] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [securityMessage, setSecurityMessage] = useState("");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [violations, setViolations] = useState([]);
  const violationsRef = useRef([]);
  const autoSubmitStarted = useRef(false);
  const selectedAssessment = accessState?.assessment;
  const selectedStudent = accessState?.student;
  const section = selectedAssessment?.section;
  // The assessment is selected only by the key and student ID. These values
  // keep the legacy hidden JSX harmless while the student is in the exam.
  const sections = [];
  const students = selectedStudent ? [selectedStudent] : [];
  const assessmentDefinitions = selectedAssessment ? [selectedAssessment] : [];
  const activeSectionId = section?.id ?? "";
  const activeStudentId = selectedStudent?.id ?? "";
  const activeAssessmentId = selectedAssessment?.id ?? "";
  const setSelectedSectionId = () => {};
  const setStudentId = () => {};
  const setAssessmentId = () => {};
  const selectSection = () => {};
  const changeAssessment = () => {};
  const questions = [...(selectedAssessment?.questions ?? [])].sort(
    (first, second) => Number(first.question_no) - Number(second.question_no),
  );
  const recordViolation = useCallback((violationType, details) => {
    const violation = {
      violation_type: violationType,
      details: details || null,
      occurred_at: new Date().toISOString(),
    };
    violationsRef.current = [...violationsRef.current, violation];
    setViolations(violationsRef.current);
    return violation;
  }, []);
  const enterFullscreen = () => {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };
  const accessAssessment = async (event) => {
    event.preventDefault();
    enterFullscreen();
    setSubmitting(true);
    setMessage({ status: "", text: "" });
    try {
      const result = await loadStudentAssessment({ accessKey, studentNumber });
      const startedAt = result.startedAt || new Date().toISOString();
      const timeLimitMinutes = Number(result.assessment?.time_limit_minutes || 0);
      const sessionExpiresAt = result.sessionExpiresAt || (timeLimitMinutes > 0
        ? new Date(Date.parse(startedAt) + timeLimitMinutes * 60 * 1000).toISOString()
        : null);
      setAccessState({ ...result, startedAt, sessionExpiresAt });
      setAnswers({});
      setCurrentQuestionIndex(0);
      violationsRef.current = [];
      setViolations([]);
      setRemainingSeconds(null);
      setSubmittedResult(null);
      setSecurityMessage("");
      autoSubmitStarted.current = false;
    } catch (error) {
      setMessage({ status: "error", text: error?.message || "Assessment could not be opened." });
    } finally {
      setSubmitting(false);
    }
  };
  const submit = useCallback(async (event, autoSubmit = false, violationOverride = null) => {
    event?.preventDefault();
    if (!selectedStudent || !selectedAssessment) {
      setMessage({ status: "error", text: "Open an assessment before submitting." });
      return;
    }
    setSubmitting(true);
    setMessage({ status: "", text: "" });
    if (autoSubmit) autoSubmitStarted.current = true;
    try {
      const result = await submitAssessment({
        assessmentId: selectedAssessment.id,
        studentId: selectedStudent.id,
        enrollmentId: accessState.enrollmentId,
        assessment: selectedAssessment,
        answers,
        attemptNumber: accessState.attemptNumber,
        autoSubmit,
        violations: violationOverride ?? violationsRef.current,
      });
      setMessage({
        status: "success",
        text: result.queued
          ? `Score: ${result.score}/${result.maxScore}. Your answers were saved on the LAN computer${result.needsReview ? " and are waiting for review" : ""}. They will sync to Supabase when internet is available.`
          : result.needsReview
          ? "Your answers were submitted. Your coding response is waiting for review."
          : `Your answers were submitted. Score: ${result.score}/${result.maxScore}.`,
      });
      setSubmittedResult(result);
      setAccessState((current) => current ? {
        ...current,
        attemptsUsed: (current.attemptsUsed || 0) + 1,
        attemptsRemaining: result.attemptsRemaining ?? Math.max(0, (current.attemptsRemaining || 1) - 1),
        attemptNumber: (current.attemptNumber || 1) + 1,
      } : current);
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    } catch (error) {
      setMessage({ status: "error", text: error?.message || "Submission failed." });
    } finally {
      setSubmitting(false);
    }
  }, [accessState, answers, selectedAssessment, selectedStudent, submitAssessment]);

  useEffect(() => {
    if (!accessState || submittedResult) {
      return undefined;
    }
    const timeLimitMinutes = Number(accessState.assessment?.time_limit_minutes || 0);
    const startedAt = Date.parse(accessState.startedAt || "");
    const durationDeadline = timeLimitMinutes > 0 && Number.isFinite(startedAt)
      ? startedAt + timeLimitMinutes * 60 * 1000
      : NaN;
    const availabilityDeadline = accessState.availableUntil ? Date.parse(accessState.availableUntil) : NaN;
    const deadlines = [durationDeadline, availabilityDeadline].filter(Number.isFinite);
    if (!deadlines.length) {
      return undefined;
    }
    const deadline = Math.min(...deadlines);
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining <= 0 && !autoSubmitStarted.current) void submit(null, true);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [accessState, submittedResult, submit]);

  useEffect(() => {
    if (!accessState || submittedResult) return undefined;
    const blockClipboard = (event) => {
      event.preventDefault();
      recordViolation(event.type, "Clipboard or context-menu action was blocked.");
    };
    const blockShortcuts = (event) => {
      const key = String(event.key || "").toLowerCase();
      if (event.key === "Escape") {
        event.preventDefault();
        recordViolation("escape_pressed", "Escape key pressed; assessment auto-submitted.");
        if (!autoSubmitStarted.current) void submit(null, true, violationsRef.current);
        return;
      }
      if (event.key === "F12" || ((event.ctrlKey || event.metaKey) && ["a", "c", "v", "x", "p", "s", "u"].includes(key)) || (event.ctrlKey && event.shiftKey && ["i", "j", "c"].includes(key))) {
        event.preventDefault();
        recordViolation("keyboard_shortcut", `${event.key} shortcut was blocked.`);
      }
    };
    const warnOnBlur = () => {
      recordViolation("window_blur", "The assessment window lost focus.");
      setSecurityMessage("Please stay on the assessment screen. Fullscreen mode cannot block Windows Alt+Tab.");
    };
    const submitOnHidden = () => {
      if (document.hidden && !autoSubmitStarted.current) {
        recordViolation("tab_hidden", "The assessment tab was hidden or another tab was opened.");
        void submit(null, true, violationsRef.current);
      }
    };
    document.addEventListener("copy", blockClipboard);
    document.addEventListener("cut", blockClipboard);
    document.addEventListener("paste", blockClipboard);
    document.addEventListener("contextmenu", blockClipboard);
    document.addEventListener("keydown", blockShortcuts);
    document.addEventListener("visibilitychange", submitOnHidden);
    window.addEventListener("blur", warnOnBlur);
    return () => {
      document.removeEventListener("copy", blockClipboard);
      document.removeEventListener("cut", blockClipboard);
      document.removeEventListener("paste", blockClipboard);
      document.removeEventListener("contextmenu", blockClipboard);
      document.removeEventListener("keydown", blockShortcuts);
      document.removeEventListener("visibilitychange", submitOnHidden);
      window.removeEventListener("blur", warnOnBlur);
    };
  }, [accessState, recordViolation, submittedResult, submit]);

  const startNextAttempt = () => {
    const startedAt = new Date().toISOString();
    const timeLimitMinutes = Number(selectedAssessment?.time_limit_minutes || 0);
    setSubmittedResult(null);
    setAnswers({});
    setCurrentQuestionIndex(0);
    setAccessState((current) => current ? {
      ...current,
      startedAt,
      sessionExpiresAt: timeLimitMinutes > 0
        ? new Date(Date.parse(startedAt) + timeLimitMinutes * 60 * 1000).toISOString()
        : null,
    } : current);
    violationsRef.current = [];
    setViolations([]);
    setRemainingSeconds(null);
    setMessage({ status: "", text: "" });
    setSecurityMessage("");
    autoSubmitStarted.current = false;
    enterFullscreen();
  };
  const allAnswered = questions.length > 0 && questions.every(
    (question) => String(answers[question.id] ?? "").trim(),
  );
  const activeQuestion = questions[currentQuestionIndex];
  const answeredCount = questions.filter((question) => String(answers[question.id] ?? "").trim()).length;

  if (submittedResult && accessState) {
    const attemptsRemaining = Number(submittedResult.attemptsRemaining ?? accessState.attemptsRemaining ?? 0);
    return (
      <div className="student-portal-shell student-assessment-locked">
        <header className="student-portal-header">
          <a className="student-portal-brand" href="/">
            <img className="brand-icon" src={icon} alt="Presenzio" />
            <span>presenzio</span>
          </a>
          <span className="student-portal-lock">Assessment submitted</span>
        </header>
        <main className="student-portal-main student-access-main">
          <section className="student-access-card student-result-card">
            <div className="student-access-icon">✓</div>
            <p className="eyebrow">ASSESSMENT COMPLETE</p>
            <h1>Thank you for answering.</h1>
            <div className="student-result-score">
              <small>Your score</small>
              <strong>{submittedResult.score}/{submittedResult.maxScore}</strong>
            </div>
            <p>Your submission has been recorded. You cannot submit again unless your teacher allows another attempt.</p>
            {submittedResult.autoSubmitted && <p className="student-result-timeout">Time ended, so your answers were submitted automatically.</p>}
            {attemptsRemaining > 0 && (
              <button type="button" className="primary-button student-result-next" onClick={startNextAttempt}>
                Start attempt {Number(accessState.attemptNumber || 1)}
              </button>
            )}
          </section>
        </main>
      </div>
    );
  }

  if (!accessState) {
    return (
      <div className="student-portal-shell">
        <header className="student-portal-header">
          <a className="student-portal-brand" href="/">
            <img className="brand-icon" src={icon} alt="Presenzio" />
            <span>presenzio</span>
          </a>
          <div className="student-portal-status">
            <span className={connectionStatus === "live" ? "live-dot" : ""} />
            {connectionStatus === "offline"
              ? "Offline"
              : connectionStatus === "live"
                ? "Online"
                : "Connecting..."}
          </div>
        </header>
        <main className="student-portal-main student-access-main">
          <section className="student-access-card">
            <div className="student-access-icon">⌁</div>
            <p className="eyebrow">STUDENT PORTAL</p>
            <h1>Enter your assessment key</h1>
            <p>Use the key provided by your teacher, then enter your student ID to open your assessment.</p>
            <form className="student-access-form" onSubmit={accessAssessment}>
              <label>
                Assessment Key ID
                <input autoFocus required value={accessKey} placeholder="e.g. ASM-4A91F2C8D0" onChange={(event) => setAccessKey(event.target.value.toUpperCase())} />
              </label>
              <label>
                Student ID number
                <input required value={studentNumber} placeholder="Enter your student ID" onChange={(event) => setStudentNumber(event.target.value)} />
              </label>
              <p className="student-access-instructions"><strong>Important instruction</strong>
              <p>🚫 Exam Rules — Read Before Starting</p>
               <p>📵 No switching tabs or apps during the exam</p>
                <p>🔙 No using the Back button or minimizing the browser</p>
                 <p>❌ No closing or refreshing this page</p>
                  <p>📸 No screenshots or screen recording</p>
                  <p>🤝 No sharing answers or communicating with others</p>
                  <p>⚠️ Violations are automatically detected and reported to your teacher. Your exam will be immediately submitted.</p>
              </p>
              {message.text && <p className={`record-save-message ${message.status}`} role="alert">{message.text}</p>}
              <button className="primary-button" disabled={submitting}>{submitting ? "Opening assessment…" : "Open assessment"}</button>
            </form>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="student-portal-shell">
      <header className="student-portal-header">
        <a className="student-portal-brand" href="/">
          <img className="brand-icon" src={icon} alt="Presenzio" />
          <span>presenzio</span>
        </a>
        <div className="student-portal-status">
          <span className={connectionStatus === "live" ? "live-dot" : ""} />
          {connectionStatus === "offline"
            ? "Offline"
            : connectionStatus === "live"
              ? "Online"
              : "Connecting..."}
        </div>
      </header>
      <main className="student-portal-main">
        <div className="student-portal-heading">
          <div>
            <p className="eyebrow">STUDENT PORTAL</p>
            <h1>Complete your assessment</h1>
            <p>Answer the assessment assigned to your student ID.</p>
          </div>
          <span className="student-portal-lock">Student view</span>
        </div>

        <section className="student-portal-card">
          <div className="student-portal-identity">
            <div><span>CLASS</span><strong>{section?.subject_code} · {section?.subject_title}</strong></div>
            <div><span>STUDENT</span><strong>{selectedStudent?.name}</strong><small>{selectedStudent?.number}</small></div>
            <button type="button" className="student-change-assessment" onClick={() => { setAccessState(null); setAnswers({}); setCurrentQuestionIndex(0); violationsRef.current = []; setViolations([]); setMessage({ status: "", text: "" }); }}>Use another key</button>
          </div>
          {sections.length > 0 && <div className="student-portal-selects">
            <label>
              Class
              <select
                value={activeSectionId}
                onChange={(event) => {
                  const nextId = event.target.value;
                  setSelectedSectionId(nextId);
                  setAssessmentId("");
                  setAnswers({});
                  selectSection(nextId);
                }}
              >
                {!sections.length && <option value="">No classes available</option>}
                {sections.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.subject_code} · {item.subject_title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Your name
              <select value={activeStudentId} onChange={(event) => setStudentId(event.target.value)}>
                {!students.length && <option value="">No students available</option>}
                {students.map((student) => (
                  <option value={student.id} key={student.id}>{student.name}</option>
                ))}
              </select>
            </label>
            <label>
              Assessment
              <select value={activeAssessmentId} onChange={(event) => changeAssessment(event.target.value)}>
                {!assessmentDefinitions.length && <option value="">No assessments available</option>}
                {assessmentDefinitions.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.title} · {categoryLabels[item.category]}
                  </option>
                ))}
              </select>
            </label>
          </div>}

          {!assessmentDefinitions.length ? (
            <div className="student-portal-empty">
              <span>✦</span>
              <h2>No assessment is available yet</h2>
              <p>Your teacher has not published an assessment for this class.</p>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div className="student-portal-assessment-header">
                <div>
                  <span>{categoryLabels[selectedAssessment?.category]} · {periodLabels[selectedAssessment?.period?.code] || "Assessment"}</span>
                  <h2>{selectedAssessment?.title}</h2>
                  {selectedAssessment?.instructions && <p>{selectedAssessment.instructions}</p>}
                </div>
                <div className="student-portal-assessment-status">
                  <strong>{questions.length} {questions.length === 1 ? "question" : "questions"}</strong>
                  <strong aria-live="polite" className={remainingSeconds != null && remainingSeconds < 60 ? "student-timer urgent" : "student-timer"}>
                    {remainingSeconds != null ? `Time remaining ${formatCountdown(remainingSeconds)}` : "No time limit"}
                  </strong>
                  {violations.length > 0 && <strong className="student-violation-count">Violations: {violations.length}</strong>}
                </div>
              </div>
              {!allAnswered && <p className="student-required-message">Answer every question before submitting. You have answered {answeredCount} of {questions.length}.</p>}
              {activeQuestion && (
                <>
                  <div className="student-question-progress"><span>Question {currentQuestionIndex + 1} of {questions.length}</span><strong>{answeredCount} answered</strong></div>
                  <div className="student-portal-questions">
                    <article className="student-portal-question" key={activeQuestion.id}>
                      <div className="student-portal-question-meta">
                        <span>QUESTION {currentQuestionIndex + 1}</span>
                        <small>{activeQuestion.points} {Number(activeQuestion.points) === 1 ? "point" : "points"}</small>
                      </div>
                      <h3>{activeQuestion.prompt}</h3>
                      {activeQuestion.question_type === "multiple_choice" ? (
                        <div className="student-portal-options">
                          {(Array.isArray(activeQuestion.choices) ? activeQuestion.choices : []).map((choice, choiceIndex) => {
                            const letter = letters[choiceIndex];
                            return (
                              <label className={answers[activeQuestion.id] === letter ? "selected" : ""} key={letter}>
                                <input type="radio" name={`question-${activeQuestion.id}`} value={letter} checked={answers[activeQuestion.id] === letter} onChange={(event) => setAnswers((current) => ({ ...current, [activeQuestion.id]: event.target.value }))} />
                                <span className="choice-letter">{letter}</span>
                                <span>{choice}</span>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="student-portal-code">
                          <div><b>{String(activeQuestion.language || "code").toUpperCase()}</b><span>Write your solution</span></div>
                          <textarea spellCheck="false" rows="9" value={answers[activeQuestion.id] ?? ""} placeholder={activeQuestion.starter_code || "Write your code here..."} onChange={(event) => setAnswers((current) => ({ ...current, [activeQuestion.id]: event.target.value }))} />
                        </div>
                      )}
                    </article>
                  </div>
                  <div className="student-question-nav">
                    <button type="button" className="outline-button" disabled={currentQuestionIndex === 0} onClick={() => setCurrentQuestionIndex((current) => Math.max(0, current - 1))}>Previous</button>
                    {currentQuestionIndex < questions.length - 1 && (
                      <button type="button" className="outline-button" disabled={!String(answers[activeQuestion.id] ?? "").trim()} onClick={() => setCurrentQuestionIndex((current) => Math.min(questions.length - 1, current + 1))}>Next</button>
                    )}
                  </div>
                </>
              )}
              {message.text && <p className={`record-save-message ${message.status}`} role="status">{message.text}</p>}
              {securityMessage && <p className="student-security-message" role="alert">{securityMessage}</p>}
              <div className="student-portal-footer">
                <span>{selectedStudent ? `Submitting as ${selectedStudent.name}` : "Select your name to continue"}</span>
                {currentQuestionIndex === questions.length - 1 && <button className="primary-button" disabled={submitting || !allAnswered}>{submitting ? "Submitting…" : "Submit assessment"}</button>}
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}

export default StudentPortalView;
