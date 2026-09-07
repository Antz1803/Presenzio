import { useCallback, useEffect, useRef, useState } from "react";
import { useDashboardViewModel } from "../../ViewModels/useDashboardViewModel";

export function useStudentAssessmentSession() {
  const viewModel = useDashboardViewModel({ accountScoped: false });
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

  return {
    connectionStatus, accessKey, setAccessKey, studentNumber, setStudentNumber,
    accessState, answers, setAnswers, submitting, message, submittedResult,
    remainingSeconds, securityMessage, currentQuestionIndex, setCurrentQuestionIndex,
    violations, selectedAssessment, selectedStudent, section, sections, students,
    assessmentDefinitions, activeSectionId, activeStudentId, activeAssessmentId,
    setSelectedSectionId, setStudentId, setAssessmentId, selectSection, changeAssessment,
    questions, accessAssessment, submit, startNextAttempt, allAnswered, activeQuestion,
    answeredCount,
  };
}
