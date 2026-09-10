import icon from "../../../assets/Icon.png";
import { categoryLabels, periodLabels, letters, formatCountdown, formatStudentName } from "./studentPortalUtils";

export default function StudentAssessment({
  answers, setAnswers, submitting, message, remainingSeconds,
  securityMessage, currentQuestionIndex, setCurrentQuestionIndex, violations,
  selectedAssessment, selectedStudent, section, sections, students, assessmentDefinitions,
  activeSectionId, activeStudentId, activeAssessmentId, setSelectedSectionId,
  setStudentId, setAssessmentId, selectSection, changeAssessment, questions,
  submit, allAnswered, activeQuestion, answeredCount, connectionStatus,
}) {
  return (
    <div className="min-h-screen bg-[#07090e] font-sans text-slate-100 pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-cyan-950/60 bg-[#0b0f17]/90 px-6 py-3.5 backdrop-blur-md">
        <a className="flex items-center gap-2.5 text-lg font-bold text-white transition hover:opacity-80" href="/">
          <img className="h-7 w-7 object-contain" src={icon} alt="Presenzio" />
          <span className="tracking-tight text-cyan-400 font-mono">presenzio</span>
        </a>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-[#121824] px-3 py-1 text-xs font-medium text-slate-300">
            <span
              className={`h-2 w-2 rounded-full ${
                connectionStatus === "live"
                  ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                  : connectionStatus === "offline"
                  ? "bg-rose-500"
                  : "bg-amber-400"
              }`}
            />
            {connectionStatus === "offline"
              ? "Offline"
              : connectionStatus === "live"
              ? "Online"
              : "Connecting..."}
          </div>
          <span className="rounded border border-cyan-900/40 bg-cyan-950/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
            Student View
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pt-6 md:px-6">
        {/* Banner Section */}
        <div className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-800/80 pb-6 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-400 font-mono">
              {section?.subject_code || "ASSESSMENT PORTAL"}
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white md:text-3xl">
              Complete Your Assessment
            </h1>
            <p className="mt-1 text-sm text-slate-400">Read instructions thoroughly before answering questions.</p>
          </div>

          {selectedStudent && (
            <div className="flex min-w-[240px] items-center gap-3 rounded-xl border border-slate-800 bg-[#121824] p-3 shadow-lg">
              {/* Initial Avatar */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-950/50 text-base font-bold text-cyan-300 font-mono">
                {selectedStudent?.name ? selectedStudent.name.replace(/[^a-zA-Z]/g, "").charAt(0).toUpperCase() : "S"}
              </div>

              {/* Student Information */}
              <div className="min-w-0 flex-1 text-left leading-tight">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {section?.subject_code || "Class"}
                </span>
                <strong 
                  className="block truncate text-sm font-bold text-slate-100" 
                  title={formatStudentName(selectedStudent?.name)}
                >
                  {formatStudentName(selectedStudent?.name)}
                </strong>
                <small className="block text-[11px] text-slate-400 font-mono">
                  {selectedStudent?.number}
                </small>
              </div>
            </div>
          )}
        </div>

        {/* Anti-Cheating Guidelines & Security Alert */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-slate-200 shadow-md md:col-span-2">
            <div className="flex items-center gap-2">
              <span className="rounded border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                Mandatory Rules
              </span>
              <h3 className="text-sm font-bold text-amber-200">Exam Integrity Policy</h3>
            </div>
            <ul className="mt-2.5 grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs text-slate-300 sm:grid-cols-2">
              <li className="flex items-center gap-2"><span className="text-amber-400 font-bold">•</span> No tab switching or browser minimization</li>
              <li className="flex items-center gap-2"><span className="text-amber-400 font-bold">•</span> No refreshing or leaving this page</li>
              <li className="flex items-center gap-2"><span className="text-amber-400 font-bold">•</span> No screenshots or screen recording</li>
              <li className="flex items-center gap-2"><span className="text-amber-400 font-bold">•</span> No sharing answers or external aids</li>
            </ul>
          </div>

          <div className="flex flex-col justify-center rounded-xl border border-rose-500/30 bg-rose-950/20 p-4">
            <span className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-300">
              <svg className="h-4 w-4 fill-current text-rose-400" viewBox="0 0 20 20">
                <path d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" />
              </svg>
              Auto-Violation Tracking
            </span>
            <p className="text-xs leading-relaxed text-rose-200/80">
              Unapproved focus switches are recorded live and will auto-submit your exam with penalty flags.
            </p>
          </div>
        </div>

        {/* Section Selectors */}
        {sections.length > 0 && (
          <section className="mb-6 rounded-xl border border-slate-800 bg-[#121824] p-4 shadow-md">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <label className="flex flex-col text-xs font-bold uppercase tracking-wider text-slate-300">
                Class
                <select
                  name="assessmentClass"
                  className="mt-1.5 rounded-lg border border-slate-700 bg-[#0b0f17] px-3 py-2 text-sm font-normal text-slate-100 focus:border-cyan-500 focus:outline-none"
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

              <label className="flex flex-col text-xs font-bold uppercase tracking-wider text-slate-300">
                Your Name
                <select
                  name="assessmentStudent"
                  className="mt-1.5 rounded-lg border border-slate-700 bg-[#0b0f17] px-3 py-2 text-sm font-normal text-slate-100 focus:border-cyan-500 focus:outline-none"
                  value={activeStudentId}
                  onChange={(event) => setStudentId(event.target.value)}
                >
                  {!students.length && <option value="">No students available</option>}
                  {students.map((student) => (
                    <option value={student.id} key={student.id}>
                      {student.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col text-xs font-bold uppercase tracking-wider text-slate-300">
                Assessment
                <select
                  name="assessmentSelection"
                  className="mt-1.5 rounded-lg border border-slate-700 bg-[#0b0f17] px-3 py-2 text-sm font-normal text-slate-100 focus:border-cyan-500 focus:outline-none"
                  value={activeAssessmentId}
                  onChange={(event) => changeAssessment(event.target.value)}
                >
                  {!assessmentDefinitions.length && <option value="">No assessments available</option>}
                  {assessmentDefinitions.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.title} · {categoryLabels[item.category]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        )}

        {/* Assessment Section */}
        {!assessmentDefinitions.length ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-[#121824]/40 py-16 text-center">
            <span className="text-4xl text-cyan-400">✦</span>
            <h2 className="mt-2 text-xl font-bold text-slate-200">No Assessment Available Yet</h2>
            <p className="mt-1 text-sm text-slate-400">Your teacher has not published an assessment for this class.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-6">
            {/* Assessment Meta Header */}
            <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-[#121824] p-6 shadow-xl md:flex-row md:items-start">
              <div className="flex-1">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono">
                  {categoryLabels[selectedAssessment?.category]} · {periodLabels[selectedAssessment?.period?.code] || "Assessment"}
                </span>
                <h2 className="mt-1 text-2xl font-black text-white">{selectedAssessment?.title}</h2>
                
                {/* HTML Instructions Box with Absolute Contrast Rules */}
                {selectedAssessment?.instructions && (
                  <div
                    className="mt-4 overflow-x-auto rounded-xl border border-slate-800 bg-[#0b0f17] p-5 text-sm leading-relaxed text-slate-100
                      [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-lg [&_table]:border [&_table]:border-slate-800
                      [&_th]:border [&_th]:border-slate-800 [&_th]:bg-[#030712] [&_th]:p-3 [&_th]:text-left [&_th]:font-bold [&_th]:!text-black
                      [&_td]:border [&_td]:border-slate-800 [&_td]:bg-[#0b0f17] [&_td]:p-3 [&_td]:text-slate-200
                      [&_p]:my-1.5 [&_a]:text-cyan-400 [&_a]:underline [&_img]:max-w-full [&_img]:rounded-lg"
                    dangerouslySetInnerHTML={{ __html: selectedAssessment.instructions }}
                  />
                )}
              </div>

              {/* Status Side Cards */}
              <div className="flex flex-wrap gap-2 text-xs md:w-48 md:flex-col md:items-stretch shrink-0">
                <div className="flex justify-between items-center rounded-xl border border-slate-700 bg-[#0b0f17] p-3 font-semibold text-slate-300">
                  <span>Questions</span>
                  <strong className="text-base text-white font-mono">{questions.length}</strong>
                </div>
                <div
                  className={`flex justify-between items-center rounded-xl border p-3 font-semibold ${
                    remainingSeconds != null && remainingSeconds < 60
                      ? "animate-pulse border-rose-500/80 bg-rose-950/80 text-rose-200"
                      : "border-slate-700 bg-[#0b0f17] text-cyan-300"
                  }`}
                >
                  <span>Timer</span>
                  <strong className="text-sm font-mono">{remainingSeconds != null ? formatCountdown(remainingSeconds) : "∞"}</strong>
                </div>
                {violations.length > 0 && (
                  <div className="flex justify-between items-center rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 font-bold text-rose-300">
                    <span>Violations</span>
                    <span className="font-mono">{violations.length}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-4">
              {/* Question Navigation Sidebar */}
              <aside className="sticky top-20 rounded-2xl border border-slate-800 bg-[#121824] p-5 shadow-lg lg:col-span-1">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Question Map</h4>
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((q, idx) => {
                    const isAnswered = String(answers[q.id] ?? "").trim() !== "";
                    const isCurrent = idx === currentQuestionIndex;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setCurrentQuestionIndex(idx)}
                        className={`flex h-10 w-full items-center justify-center rounded-lg border text-xs font-bold font-mono transition ${
                          isCurrent
                            ? "border-cyan-400 bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(34,211,238,0.4)] ring-2 ring-cyan-400/30"
                            : isAnswered
                            ? "border-emerald-500/50 bg-emerald-950/60 text-emerald-300"
                            : "border-slate-700/80 bg-[#0b0f17] text-slate-400 hover:border-slate-600 hover:text-slate-100"
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3 text-xs text-slate-400">
                  <span>Progress</span>
                  <span className="font-bold text-slate-200 font-mono">
                    {answeredCount} / {questions.length}
                  </span>
                </div>
              </aside>

              {/* Main Question Focus Container */}
              <div className="space-y-4 lg:col-span-3">
                {activeQuestion && (
                  <article className="rounded-2xl border border-slate-800 bg-[#121824] p-6 shadow-2xl">
                    <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono">
                        QUESTION {currentQuestionIndex + 1} OF {questions.length}
                      </span>
                      <span className="rounded-md border border-slate-700 bg-[#0b0f17] px-2.5 py-1 text-xs font-bold text-slate-300 font-mono">
                        {activeQuestion.points} {Number(activeQuestion.points) === 1 ? "POINT" : "POINTS"}
                      </span>
                    </div>

                    <h3 className="mb-6 text-xl font-bold text-white leading-relaxed">{activeQuestion.prompt}</h3>

                    {activeQuestion.question_type === "multiple_choice" ? (
                      <div className="space-y-3">
                        {(Array.isArray(activeQuestion.choices) ? activeQuestion.choices : []).map(
                          (choice, choiceIndex) => {
                            const letter = letters[choiceIndex];
                            const isSelected = answers[activeQuestion.id] === letter;
                            return (
                              <label
                                key={letter}
                                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                                  isSelected
                                    ? "border-cyan-400 bg-cyan-950/40 text-white ring-1 ring-cyan-400/40"
                                    : "border-slate-800 bg-[#0b0f17] text-slate-200 hover:border-slate-700 hover:bg-[#161d2b]"
                                }`}
                              >
                                <input
                                  type="radio"
                                  className="sr-only"
                                  name={`question-${activeQuestion.id}`}
                                  value={letter}
                                  checked={isSelected}
                                  onChange={(event) =>
                                    setAnswers((current) => ({ ...current, [activeQuestion.id]: event.target.value }))
                                  }
                                />
                                <span
                                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold font-mono ${
                                    isSelected
                                      ? "bg-cyan-400 text-slate-950"
                                      : "border border-slate-700 bg-[#121824] text-slate-400"
                                  }`}
                                >
                                  {letter}
                                </span>
                                <span className="pt-0.5 text-sm font-semibold">{choice}</span>
                              </label>
                            );
                          }
                        )}
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#0b0f17]">
                        <div className="flex items-center justify-between border-b border-slate-800 bg-[#161d2b] px-4 py-2 font-mono text-xs text-slate-300">
                          <b className="text-cyan-400">{String(activeQuestion.language || "code").toUpperCase()}</b>
                          <span>Solution Editor</span>
                        </div>
                        <textarea
                          name={`answer-${activeQuestion.id}`}
                          spellCheck="false"
                          rows={10}
                          className="w-full bg-[#0b0f17] p-4 font-mono text-sm text-emerald-400 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          value={answers[activeQuestion.id] ?? ""}
                          placeholder={activeQuestion.starter_code || "// Write your code solution here..."}
                          onChange={(event) =>
                            setAnswers((current) => ({ ...current, [activeQuestion.id]: event.target.value }))
                          }
                        />
                      </div>
                    )}

                    {/* Navigation Controls */}
                    <div className="mt-8 flex items-center justify-between border-t border-slate-800 pt-5">
                      <button
                        type="button"
                        className="rounded-xl border border-slate-700 bg-[#0b0f17] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-200 transition hover:bg-[#161d2b] disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={currentQuestionIndex === 0}
                        onClick={() => setCurrentQuestionIndex((current) => Math.max(0, current - 1))}
                      >
                        ← Previous
                      </button>

                      {currentQuestionIndex < questions.length - 1 && (
                        <button
                          type="button"
                          className="rounded-xl bg-cyan-500 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-md transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={!String(answers[activeQuestion.id] ?? "").trim()}
                          onClick={() =>
                            setCurrentQuestionIndex((current) => Math.min(questions.length - 1, current + 1))
                          }
                        >
                          Next →
                        </button>
                      )}
                    </div>
                  </article>
                )}

                {/* System Notices */}
                {!allAnswered && (
                  <p className="rounded-xl border border-slate-800 bg-[#121824] p-4 text-xs font-medium text-slate-400">
                    Answer every item before submitting. You have completed {answeredCount} of {questions.length} questions.
                  </p>
                )}
                {message.text && (
                  <div
                    className={`rounded-xl border p-4 text-xs font-bold ${
                      message.status === "error"
                        ? "border-rose-500/50 bg-rose-950/60 text-rose-200"
                        : "border-emerald-500/50 bg-emerald-950/60 text-emerald-200"
                    }`}
                    role="status"
                  >
                    {message.text}
                  </div>
                )}
                {securityMessage && (
                  <div
                    className="rounded-xl border border-amber-500/50 bg-amber-950/60 p-4 text-xs font-bold text-amber-200"
                    role="alert"
                  >
                    {securityMessage}
                  </div>
                )}

                {/* Submission Footer */}
                <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#121824] p-5 shadow-lg sm:flex-row">
                  <span className="text-xs font-medium text-slate-400">
                    {selectedStudent ? `Student Session: ${selectedStudent.name}` : "Select student identity to submit"}
                  </span>

                  {currentQuestionIndex === questions.length - 1 && (
                    <button
                      className="w-full rounded-xl bg-cyan-400 px-8 py-3 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg shadow-cyan-400/20 transition hover:bg-cyan-300 disabled:border disabled:border-slate-800 disabled:bg-[#0b0f17] disabled:text-slate-600 disabled:shadow-none sm:w-auto"
                      disabled={submitting || !allAnswered}
                    >
                      {submitting ? "Submitting Assessment…" : "Submit Assessment"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}