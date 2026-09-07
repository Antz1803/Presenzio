import icon from "../../../assets/Icon.png";

export default function StudentPortalResult({ accessState, submittedResult, startNextAttempt }) {
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
