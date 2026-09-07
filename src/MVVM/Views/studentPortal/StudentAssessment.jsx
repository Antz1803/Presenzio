import icon from "../../../assets/Icon.png";
import { categoryLabels, periodLabels, letters, formatCountdown } from "./studentPortalUtils";

export default function StudentAssessment({
  answers, setAnswers, submitting, message, remainingSeconds,
  securityMessage, currentQuestionIndex, setCurrentQuestionIndex, violations,
  selectedAssessment, selectedStudent, section, sections, students, assessmentDefinitions,
  activeSectionId, activeStudentId, activeAssessmentId, setSelectedSectionId,
  setStudentId, setAssessmentId, selectSection, changeAssessment, questions,
  submit, allAnswered, activeQuestion, answeredCount, connectionStatus,
}) {
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
          <div className="max-w-lg rounded-xl border-l-4 border-l-red-500 border-y border-r border-slate-200 bg-slate-50 p-5 text-slate-800 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700">
                Mandatory
              </span>
              <h3 className="font-bold text-slate-900 text-base">
                Exam Rules & Restrictions
              </h3>
            </div>

            <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-slate-600">
              <li>No switching tabs or apps during the exam</li>
              <li>No using the Back button or minimizing the browser</li>
              <li>No closing or refreshing this page</li>
              <li>No screenshots or screen recording</li>
              <li>No sharing answers or communicating with others</li>
            </ul>

            <div className="mt-4 rounded-md bg-amber-100/80 p-3 text-xs font-medium text-amber-900 border border-amber-200">
              <strong>Warning:</strong> Violations are automatically detected and reported to your teacher. Your exam will be immediately submitted.
            </div>
          </div>
        <section className="student-portal-card">
          <div className="student-portal-identity">
            <div><span>CLASS</span><strong>{section?.subject_code} · {section?.subject_title}</strong></div>
            <div><span>STUDENT</span><strong>{selectedStudent?.name}</strong><small>{selectedStudent?.number}</small></div>     
          </div>
          {sections.length > 0 && <div className="student-portal-selects">
            <label>
              Class
              <select
                name="assessmentClass"
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
              <select name="assessmentStudent" value={activeStudentId} onChange={(event) => setStudentId(event.target.value)}>
                {!students.length && <option value="">No students available</option>}
                {students.map((student) => (
                  <option value={student.id} key={student.id}>{student.name}</option>
                ))}
              </select>
            </label>
            <label>
              Assessment
              <select name="assessmentSelection" value={activeAssessmentId} onChange={(event) => changeAssessment(event.target.value)}>
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
                          <textarea name={`answer-${activeQuestion.id}`} spellCheck="false" rows="9" value={answers[activeQuestion.id] ?? ""} placeholder={activeQuestion.starter_code || "Write your code here..."} onChange={(event) => setAnswers((current) => ({ ...current, [activeQuestion.id]: event.target.value }))} />
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
