import icon from "../../../assets/Icon.png";

export default function StudentPortalAccess({ accessKey, setAccessKey, studentNumber, setStudentNumber, accessAssessment, connectionStatus, submitting, message }) {
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
                <input name="assessmentAccessKey" autoFocus required value={accessKey} placeholder="e.g. ASM-4A91F2C8D0" onChange={(event) => setAccessKey(event.target.value.toUpperCase())} />
              </label>
              <label>
                Student ID number
                <input name="studentNumber" required value={studentNumber} placeholder="Enter your student ID" onChange={(event) => setStudentNumber(event.target.value)} />
              </label>
          <div className="max-w-xl overflow-hidden rounded-xl border border-red-200 bg-white shadow-sm">
                {/* Header Accent Bar */}
                <div className="bg-red-500 px-5 py-3 text-white">
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5 fill-current" viewBox="0 0 20 20">
                      <path d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 10-2 0 1 1 0 002 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" />
                    </svg>
                    <h3 className="font-bold tracking-wide uppercase text-xs">
                      Important Notice
                    </h3>
                  </div>
                  <p className="mt-0.5 font-semibold text-lg">Read Before Starting</p>
                </div>

                <div className="p-5">
                  {/* Rules List */}
                  <ul className="space-y-2.5 text-sm font-medium text-slate-700">
                    <li className="flex items-center gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs text-red-600">✕</span>
                      <span>No switching tabs or apps during the exam</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs text-red-600">✕</span>
                      <span>No using the Back button or minimizing the browser</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs text-red-600">✕</span>
                      <span>No closing or refreshing this page</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs text-red-600">✕</span>
                      <span>No screenshots or screen recording</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs text-red-600">✕</span>
                      <span>No sharing answers or communicating with others</span>
                    </li>
                  </ul>

                  {/* Violation Warning Box */}
                  <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
                    <p className="font-semibold leading-relaxed">
                      ⚠️ Violations are automatically detected and reported to your teacher. Your exam will be immediately submitted.
                    </p>
                  </div>
                </div>
              </div>
              {message.text && <p className={`record-save-message ${message.status}`} role="alert">{message.text}</p>}
              <button className="primary-button" disabled={submitting}>{submitting ? "Opening assessment…" : "Open assessment"}</button>
            </form>
          </section>
        </main>
      </div>
    );
}
