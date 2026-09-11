import { useState } from "react";
import { localDateTimeInputValue } from "./actionUtils";
import { ModalShell } from "./ActionModalShell";
import { RichTextEditor } from "./Richtexteditor";

const assessmentCategories = [
  { key: "quiz", label: "Quiz" },
  { key: "assignment", label: "Assignment" },
  { key: "activity", label: "Graded activity" },
  { key: "exam", label: "Exam" },
];

const assessmentPeriods = [
  { key: "prelim", label: "Prelim" },
  { key: "midterm", label: "Midterm" },
  { key: "semifinal", label: "Semi-final" },
  { key: "final", label: "Final" },
];

// Mirrors assessmentItemLimits in useDashboardViewModel.js — keep these in
// sync so the dropdown never offers an item number the backend would reject.
const assessmentItemLimits = {
  quiz: 4,
  assignment: 4,
  activity: 4,
  exam: 1,
};

const categoryItemPrefixes = {
  quiz: "Q",
  assignment: "A",
  activity: "G",
  exam: "E",
};

function itemNoOptions(category) {
  const limit = assessmentItemLimits[category] ?? 4;
  const prefix = categoryItemPrefixes[category] ?? "Q";
  return Array.from({ length: limit }, (_, index) => index + 1).map((number) => ({
    value: String(number),
    label: `${prefix}${number}`,
  }));
}

const codingLanguages = [
  { key: "sql", label: "SQL" },
  { key: "c", label: "C" },
  { key: "cpp", label: "C++" },
  { key: "csharp", label: "C#" },
  { key: "javascript", label: "JavaScript" },
];

const multipleChoiceLetters = ["A", "B", "C", "D"];

function createAssessmentQuestion(type = "multiple_choice") {
  return {
    type,
    prompt: "",
    points: "1",
    choices: ["", "", "", ""],
    correctAnswer: "A",
    language: "sql",
    starterCode: "",
    expectedOutput: "",
    // Coding-question scoring: exact matches always earn full Points. These
    // two knobs control the two other tiers, as a % of Points, instead of
    // the previous fixed 50% near-match / 0% incorrect split.
    nearMatchScorePercent: "50",
    incorrectScorePercent: "0",
  };
}

function parsePastedQuestions(value) {
  const lines = String(value ?? "").replace(/\r/g, "").split("\n");
  const parsed = [];
  let current = null;
  let blankLine = false;

  const finishQuestion = () => {
    if (current?.prompt.trim()) parsed.push(current);
    current = null;
  };

  lines.forEach((line) => {
    const text = line.trim();
    if (!text) {
      blankLine = Boolean(current);
      return;
    }

    const questionMatch = text.match(
      /^(?:question\s*|q\s*)?(\d+)\s*[.):-]\s*(.+)$/i,
    );
    if (questionMatch) {
      finishQuestion();
      current = {
        prompt: questionMatch[2].trim(),
        choices: {},
        correctAnswer: "A",
      };
      blankLine = false;
      return;
    }

    const answerMatch = text.match(
      /^(?:correct\s*)?(?:answer|ans|choice)\s*[:-]?\s*([a-d1-4])\b/i,
    );
    const choiceMatch = text.match(/^([a-d1-4])\s*[.):-]\s*(.+)$/i);
    if (answerMatch) {
      if (current) {
        const answer = answerMatch[1].toUpperCase();
        current.correctAnswer = /[1-4]/.test(answer)
          ? String.fromCharCode(64 + Number(answer))
          : answer;
      }
      blankLine = false;
      return;
    }
    if (choiceMatch) {
      if (!current) current = { prompt: "", choices: {}, correctAnswer: "A" };
      const choice = choiceMatch[1].toUpperCase();
      const choiceLetter = /[1-4]/.test(choice)
        ? String.fromCharCode(64 + Number(choice))
        : choice;
      current.choices[choiceLetter] = choiceMatch[2].trim();
      blankLine = false;
      return;
    }

    if (!current) {
      current = { prompt: text, choices: {}, correctAnswer: "A" };
    } else if (blankLine && Object.keys(current.choices).length >= 2) {
      finishQuestion();
      current = { prompt: text, choices: {}, correctAnswer: "A" };
    } else {
      current.prompt = `${current.prompt} ${text}`.trim();
    }
    blankLine = false;
  });
  finishQuestion();

  return parsed.map((question) => ({
    ...createAssessmentQuestion(),
    prompt: question.prompt,
    choices: multipleChoiceLetters.map((letter) => question.choices[letter] ?? ""),
    correctAnswer: question.correctAnswer,
  }));
}

function AssessmentBuilder({ section, assessments = [], onSave, onClose }) {
  const [form, setForm] = useState({
    title: "",
    category: "quiz",
    itemNo: "1",
    period: "prelim",
    instructions: "",
    timeLimitMinutes: "",
    availableFrom: "",
    availableUntil: "",
  });
  const [questions, setQuestions] = useState(() => [createAssessmentQuestion()]);
  const [pastedQuestions, setPastedQuestions] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ status: "", text: "" });
  const [generatorMessage, setGeneratorMessage] = useState({ status: "", text: "" });
  // Set (not just returned) when the user's current title/category/period/item
  // combination collides with an existing assessment. Saving while this is set
  // shows a confirm dialog instead of saving immediately; the actual save only
  // proceeds once the user explicitly confirms the replacement.
  const [pendingReplace, setPendingReplace] = useState(null);
  // Set when the slot has no assessment to replace but does have recorded
  // scores (e.g. entered manually before any assessment existed for that
  // column). There's nothing to delete here, just scores that would be
  // reset to 0 — so this gets its own confirm dialog and resubmits with
  // overwriteScores instead of replaceAssessmentId.
  const [pendingScoreOverwrite, setPendingScoreOverwrite] = useState(false);
  const maximumScore = questions.reduce(
    (total, question) => total + Number(question.points || 0),
    0,
  );

  const conflictingAssessment = assessments.find(
    (item) =>
      item.category === form.category &&
      item.period?.code === form.period &&
      Number(item.item_no) === Number(form.itemNo),
  );

  const updateForm = (key, value) =>
    setForm((current) => {
      if (key === "category") {
        const limit = assessmentItemLimits[value] ?? 4;
        const clampedItemNo = Math.min(Math.max(Number(current.itemNo || 1), 1), limit);
        return { ...current, category: value, itemNo: String(clampedItemNo) };
      }
      return { ...current, [key]: value };
    });
  const updateQuestion = (index, key, value) => {
    setQuestions((current) =>
      current.map((question, questionIndex) =>
        questionIndex === index ? { ...question, [key]: value } : question,
      ),
    );
  };
  const updateChoice = (questionIndex, choiceIndex, value) => {
    setQuestions((current) =>
      current.map((question, index) =>
        index === questionIndex
          ? {
              ...question,
              choices: question.choices.map((choice, choiceIndexValue) =>
                choiceIndexValue === choiceIndex ? value : choice,
              ),
            }
          : question,
      ),
    );
  };
  const changeQuestionType = (index, type) => {
    setQuestions((current) =>
      current.map((question, questionIndex) =>
        questionIndex === index
          ? { ...createAssessmentQuestion(type), prompt: question.prompt, points: question.points }
          : question,
      ),
    );
  };
  const generateQuestions = () => {
    const generatedQuestions = parsePastedQuestions(pastedQuestions);
    if (!generatedQuestions.length) {
      setGeneratorMessage({
        status: "error",
        text: "No questions found. Number each question and add choices such as A. Choice text.",
      });
      return;
    }
    setQuestions(generatedQuestions);
    setGeneratorMessage({
      status: "success",
      text: `${generatedQuestions.length} question${generatedQuestions.length === 1 ? "" : "s"} generated. Review them below before saving.`,
    });
  };
  const validate = () => {
    if (!form.title.trim()) return "Enter an assessment title.";
    if (!questions.length) return "Add at least one question.";
    if (form.timeLimitMinutes && (!Number.isInteger(Number(form.timeLimitMinutes)) || Number(form.timeLimitMinutes) < 1)) {
      return "Time limit must be a whole number of minutes.";
    }
    if (form.availableFrom && form.availableUntil && form.availableFrom >= form.availableUntil) {
      return "The answer window end must be after the start.";
    }
    for (const [index, question] of questions.entries()) {
      if (!question.prompt.trim()) return `Enter the prompt for question ${index + 1}.`;
      if (!Number.isFinite(Number(question.points)) || Number(question.points) <= 0) {
        return `Enter valid points for question ${index + 1}.`;
      }
      if (question.type === "multiple_choice") {
        if (question.choices.some((choice) => !choice.trim())) {
          return `Complete all choices for question ${index + 1}.`;
        }
        if (!question.correctAnswer) return `Select the correct answer for question ${index + 1}.`;
      } else {
        const nearMatch = Number(question.nearMatchScorePercent);
        if (!Number.isFinite(nearMatch) || nearMatch < 0 || nearMatch > 100) {
          return `Enter a near-match score between 0 and 100 for question ${index + 1}.`;
        }
        const incorrect = Number(question.incorrectScorePercent);
        if (!Number.isFinite(incorrect) || incorrect < 0 || incorrect > 100) {
          return `Enter an incorrect score between 0 and 100 for question ${index + 1}.`;
        }
      }
    }
    return "";
  };
  const performSave = async (replaceAssessmentId, overwriteScores) => {
    setSaving(true);
    setMessage({ status: "", text: "" });
    try {
      const savedAssessment = await onSave({
        ...form,
        title: form.title.trim(),
        itemNo: Number(form.itemNo),
        instructions: form.instructions.trim(),
        timeLimitMinutes: form.timeLimitMinutes ? Number(form.timeLimitMinutes) : null,
        availableFrom: form.availableFrom,
        availableUntil: form.availableUntil,
        replaceAssessmentId,
        overwriteScores,
        questions: questions.map((question) => ({
          type: question.type,
          prompt: question.prompt.trim(),
          points: Number(question.points),
          choices: question.type === "multiple_choice" ? question.choices : [],
          correctAnswer: question.type === "multiple_choice" ? question.correctAnswer : null,
          language: question.type === "coding" ? question.language : null,
          starterCode: question.type === "coding" ? question.starterCode : null,
          expectedOutput: question.type === "coding" ? question.expectedOutput : null,
          nearMatchScorePercent: question.type === "coding" ? Number(question.nearMatchScorePercent) : null,
          incorrectScorePercent: question.type === "coding" ? Number(question.incorrectScorePercent) : null,
        })),
      });
      setMessage({
        status: "success",
        text: `Assessment saved. Key ID: ${savedAssessment?.access_key ?? "available in Supabase"}`,
      });
      setForm((current) => ({ ...current, title: "", instructions: "", timeLimitMinutes: "", itemNo: "1" }));
      setQuestions([createAssessmentQuestion()]);
    } catch (error) {
      // The client-side conflictingAssessment check below is based on the
      // `assessments` prop, which can lag a beat behind the live database
      // (e.g. right after creating another assessment in this same slot).
      // When that happens the save reaches the server, which still catches
      // the real conflict and reports back who it collided with — use that
      // to show the same replace-confirmation dialog instead of a dead end.
      if (error?.conflict) {
        setPendingReplace(error.conflict);
      } else if (error?.scoreConflict) {
        // No assessment to replace — the slot just has recorded scores.
        setPendingScoreOverwrite(true);
      } else {
        setMessage({
          status: "error",
          text: error?.message || "Assessment could not be saved.",
        });
      }
    } finally {
      setSaving(false);
    }
  };
  const save = async (event) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setMessage({ status: "error", text: validationError });
      return;
    }
    if (conflictingAssessment) {
      setPendingReplace(conflictingAssessment);
      return;
    }
    await performSave();
  };
  const confirmReplace = async () => {
    if (!pendingReplace) return;
    const replaceAssessmentId = pendingReplace.id;
    setPendingReplace(null);
    await performSave(replaceAssessmentId);
  };
  const confirmScoreOverwrite = async () => {
    setPendingScoreOverwrite(false);
    await performSave(undefined, true);
  };
  return (
    <ModalShell title="Create Assessment" section={section} onClose={onClose} size="wide">
      <form className="assessment-builder" onSubmit={save}>
        <div className="assessment-builder-intro">
          <div>
            <span className="assessment-builder-icon">📝</span>
            <div>
              <h3>Build an assessment</h3>
              <p>Create questions for your class and grading period.</p>
            </div>
          </div>
          <div className="assessment-builder-summary">
            <span className="assessment-builder-count">
              {questions.length} {questions.length === 1 ? "question" : "questions"}
            </span>
            <span className="assessment-builder-max">
              <small>MAXIMUM SCORE</small>
              <strong>{maximumScore.toFixed(2)}</strong>
            </span>
          </div>
        </div>
        <div className="action-form-grid assessment-details-grid">
          <label>
            Assessment title
            <input
              name="assessmentTitle"
              required
              value={form.title}
              placeholder="e.g. Introduction to SQL"
              onChange={(event) => updateForm("title", event.target.value)}
            />
          </label>
          <label>
            Type
            <select name="assessmentCategory" value={form.category} onChange={(event) => updateForm("category", event.target.value)}>
              {assessmentCategories.map((item) => <option value={item.key} key={item.key}>{item.label}</option>)}
            </select>
          </label>
          <label>
            Item number
            <select name="assessmentItemNo" value={form.itemNo} onChange={(event) => updateForm("itemNo", event.target.value)}>
              {itemNoOptions(form.category).map((item) => {
                const occupied = assessments.find(
                  (assessment) =>
                    assessment.category === form.category &&
                    assessment.period?.code === form.period &&
                    Number(assessment.item_no) === Number(item.value),
                );
                return (
                  <option value={item.value} key={item.value}>
                    {item.label}{occupied ? ` — in use: ${occupied.title}` : ""}
                  </option>
                );
              })}
            </select>
          </label>
          <label>
            Grading period
            <select name="assessmentPeriod" value={form.period} onChange={(event) => updateForm("period", event.target.value)}>
              {assessmentPeriods.map((item) => <option value={item.key} key={item.key}>{item.label}</option>)}
            </select>
          </label>
          <label>
            Available from <span>(optional)</span>
            <input name="assessmentAvailableFrom" type="datetime-local" value={form.availableFrom} onChange={(event) => updateForm("availableFrom", event.target.value)} />
          </label>
          <label>
            Available until <span>(optional)</span>
            <input name="assessmentAvailableUntil" type="datetime-local" value={form.availableUntil} onChange={(event) => updateForm("availableUntil", event.target.value)} />
          </label>
          <label>
            Time limit <span>(minutes, optional)</span>
            <input name="assessmentTimeLimit" type="number" min="1" step="1" value={form.timeLimitMinutes} placeholder="e.g. 30" onChange={(event) => updateForm("timeLimitMinutes", event.target.value)} />
          </label>
        </div>
        {conflictingAssessment && (
          <p className="assessment-field-hint assessment-slot-conflict" role="status">
            {itemNoOptions(form.category).find((item) => item.value === form.itemNo)?.label} is currently
            assigned to “{conflictingAssessment.title}”. Saving will ask you to confirm replacing it.
          </p>
        )}
        <p className="action-help">Students can submit once by default. Grant another attempt to an individual student from Manage Assessments.</p>
        <label className="assessment-instructions-field">
          Instructions <span>(optional)</span>
          <RichTextEditor
            value={form.instructions}
            onChange={(html) => updateForm("instructions", html)}
            placeholder="Add instructions for your students..."
            uploadPathPrefix={`assessments/${section?.id ?? "new"}`}
          />
        </label>
        <section className="question-generator">
          <div className="question-generator-heading">
            <div>
              <strong>Generate questions from pasted text</strong>
              <p>Paste numbered questions with A–D choices and optional answer lines.</p>
            </div>
            <span>PASTE &amp; GENERATE</span>
          </div>
          <textarea
            name="questionGeneratorText"
            rows="7"
            value={pastedQuestions}
            placeholder={'Example:\n1. What is 2 + 2?\nA. 3\nB. 4\nC. 5\nD. 6\nAnswer: B'}
            onChange={(event) => setPastedQuestions(event.target.value)}
          />
          <div className="question-generator-footer">
            <small>Generated questions remain editable below.</small>
            <button type="button" className="outline-button" onClick={generateQuestions}>
              Generate questions
            </button>
          </div>
          {generatorMessage.text && (
            <p className={`question-generator-message ${generatorMessage.status}`} role="status">
              {generatorMessage.text}
            </p>
          )}
        </section>
        <div className="assessment-question-list">
          {questions.map((question, index) => (
            <article className="assessment-question-card" key={index}>
              <div className="assessment-question-header">
                <div>
                  <span>QUESTION {index + 1}</span>
                  <strong>{question.type === "multiple_choice" ? "Multiple choice" : "Coding question"}</strong>
                </div>
                {questions.length > 1 && (
                  <button type="button" className="assessment-remove-button" onClick={() => setQuestions((current) => current.filter((_, questionIndex) => questionIndex !== index))}>
                    Remove
                  </button>
                )}
              </div>
              <div className="assessment-question-controls">
                <button type="button" className={question.type === "multiple_choice" ? "active" : ""} onClick={() => changeQuestionType(index, "multiple_choice")}>Multiple choice</button>
                <button type="button" className={question.type === "coding" ? "active" : ""} onClick={() => changeQuestionType(index, "coding")}>Coding</button>
              </div>
              <div className="action-form-grid assessment-question-grid">
                <label className="assessment-prompt-field">
                  Question prompt
                  <textarea name={`question-${index}-prompt`} required rows="3" value={question.prompt} placeholder="Write your question here..." onChange={(event) => updateQuestion(index, "prompt", event.target.value)} />
                </label>
                <label>
                  Points
                  <input name={`question-${index}-points`} type="number" min="0.01" step="0.01" value={question.points} onChange={(event) => updateQuestion(index, "points", event.target.value)} />
                </label>
              </div>
              {question.type === "multiple_choice" ? (
                <div className="assessment-choices-grid">
                  {question.choices.map((choice, choiceIndex) => (
                    <label key={multipleChoiceLetters[choiceIndex]}>
                      <span className="choice-letter">{multipleChoiceLetters[choiceIndex]}</span>
                      <input name={`question-${index}-choice-${choiceIndex}`} required value={choice} placeholder={`Choice ${multipleChoiceLetters[choiceIndex]}`} onChange={(event) => updateChoice(index, choiceIndex, event.target.value)} />
                      <input className="choice-radio" type="radio" name={`correct-answer-${index}`} checked={question.correctAnswer === multipleChoiceLetters[choiceIndex]} onChange={() => updateQuestion(index, "correctAnswer", multipleChoiceLetters[choiceIndex])} aria-label={`Mark choice ${multipleChoiceLetters[choiceIndex]} as correct`} />
                    </label>
                  ))}
                  <p className="assessment-field-hint">Select the radio button beside the correct answer.</p>
                </div>
              ) : (
                <div className="coding-question-fields">
                  <label>
                    Programming language
                    <select name={`question-${index}-language`} value={question.language} onChange={(event) => updateQuestion(index, "language", event.target.value)}>
                      {codingLanguages.map((language) => <option value={language.key} key={language.key}>{language.label}</option>)}
                    </select>
                  </label>
                  <label>
                    Starter code <span>(optional)</span>
                    <textarea name={`question-${index}-starterCode`} rows="4" value={question.starterCode} placeholder="Provide starter code or a code template..." onChange={(event) => updateQuestion(index, "starterCode", event.target.value)} />
                  </label>
                  <label>
                    Expected output / answer criteria <span>(optional)</span>
                    <textarea name={`question-${index}-expectedOutput`} rows="3" value={question.expectedOutput} placeholder="Describe the expected result..." onChange={(event) => updateQuestion(index, "expectedOutput", event.target.value)} />
                  </label>
                  <label>
                    Near-match score <span>(% of points, optional)</span>
                    <input
                      name={`question-${index}-nearMatchScorePercent`}
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={question.nearMatchScorePercent}
                      placeholder="e.g. 50"
                      onChange={(event) => updateQuestion(index, "nearMatchScorePercent", event.target.value)}
                    />
                  </label>
                  <label>
                    Incorrect score <span>(% of points, optional)</span>
                    <input
                      name={`question-${index}-incorrectScorePercent`}
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={question.incorrectScorePercent}
                      placeholder="e.g. 0"
                      onChange={(event) => updateQuestion(index, "incorrectScorePercent", event.target.value)}
                    />
                  </label>
                  <p className="assessment-field-hint">
                    An answer close to the expected output (but not exact) earns the near-match score;
                    anything else earns the incorrect score. Both are a percentage of this question's points.
                  </p>
                </div>
              )}
            </article>
          ))}
        </div>
        <button type="button" className="assessment-add-question" onClick={() => setQuestions((current) => [...current, createAssessmentQuestion()])}>
          + Add another question
        </button>
        {message.text && <p className={`record-save-message ${message.status}`} role="status">{message.text}</p>}
        <div className="action-modal-footer">
          <button type="button" className="outline-button" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save assessment"}</button>
        </div>
      </form>
      {pendingReplace && (
        <div
          className="assessment-confirm-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPendingReplace(null);
          }}
        >
          <section
            className="assessment-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="assessment-replace-title"
          >
            <div className="assessment-confirm-icon">!</div>
            <p>REPLACE ASSESSMENT</p>
            <h3 id="assessment-replace-title">
              {itemNoOptions(form.category).find((item) => item.value === form.itemNo)?.label} is already
              assigned to “{pendingReplace.title}”
            </h3>
            <span>
              Saving will delete “{pendingReplace.title}” (its questions and any recorded scores for this
              item) and put this new assessment in its place. This can't be undone.
            </span>
            <div>
              <button type="button" className="outline-button" onClick={() => setPendingReplace(null)} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="danger-button" onClick={confirmReplace} disabled={saving}>
                {saving ? "Replacing…" : "Replace assessment"}
              </button>
            </div>
          </section>
        </div>
      )}
      {pendingScoreOverwrite && (
        <div
          className="assessment-confirm-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPendingScoreOverwrite(false);
          }}
        >
          <section
            className="assessment-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="assessment-score-overwrite-title"
          >
            <div className="assessment-confirm-icon">!</div>
            <p>EXISTING SCORES FOUND</p>
            <h3 id="assessment-score-overwrite-title">
              {itemNoOptions(form.category).find((item) => item.value === form.itemNo)?.label} already has
              recorded scores
            </h3>
            <span>
              No assessment is attached to this column yet, but scores have already been entered for it.
              Saving will reset those scores to 0 for every student so they line up with this new
              assessment. This can't be undone.
            </span>
            <div>
              <button type="button" className="outline-button" onClick={() => setPendingScoreOverwrite(false)} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="danger-button" onClick={confirmScoreOverwrite} disabled={saving}>
                {saving ? "Saving…" : "Overwrite scores"}
              </button>
            </div>
          </section>
        </div>
      )}
    </ModalShell>
  );
}

function assessmentToDraft(assessment) {
  return {
    itemNo: String(assessment.item_no ?? "1"),
    title: assessment.title ?? "",
    category: assessment.category ?? "quiz",
    period: assessment.period?.code ?? "prelim",
    instructions: assessment.instructions ?? "",
    timeLimitMinutes: assessment.time_limit_minutes ? String(assessment.time_limit_minutes) : "",
    availableFrom: localDateTimeInputValue(assessment.available_from),
    availableUntil: localDateTimeInputValue(assessment.available_until),
    questions: [...(assessment.questions ?? [])]
      .sort((first, second) => Number(first.question_no) - Number(second.question_no))
      .map((question) => ({
        type: question.question_type,
        prompt: question.prompt ?? "",
        points: String(question.points ?? "1"),
        choices: Array.isArray(question.choices) ? question.choices : ["", "", "", ""],
        correctAnswer: question.correct_answer ?? "A",
        language: question.language ?? "sql",
        starterCode: question.starter_code ?? "",
        expectedOutput: question.expected_output ?? "",
        nearMatchScorePercent: String(question.near_match_score_percent ?? "50"),
        incorrectScorePercent: String(question.incorrect_score_percent ?? "0"),
      })),
  };
}

function AssessmentManager({ section, assessments, students, onUpdate, onDelete, onGrantAttempt, onClose }) {
  const [selectedId, setSelectedId] = useState(assessments[0]?.id ?? "");
  const [draft, setDraft] = useState(() =>
    assessments[0] ? assessmentToDraft(assessments[0]) : null,
  );
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [confirmingAssessment, setConfirmingAssessment] = useState(null);
  const [notification, setNotification] = useState("");
  const [message, setMessage] = useState({ status: "", text: "" });
  const [grantingStudentId, setGrantingStudentId] = useState("");
  // Set (not just returned) when the draft's current category/period/item
  // combination collides with a *different* assessment. Saving while this is
  // set shows a confirm dialog instead of saving immediately, mirroring the
  // same replace-with-confirmation flow AssessmentBuilder uses for create.
  const [pendingReplace, setPendingReplace] = useState(null);
  const selectedAssessment = assessments.find((item) => item.id === selectedId);
  const conflictingAssessment = draft
    ? assessments.find(
        (item) =>
          item.id !== selectedAssessment?.id &&
          item.category === draft.category &&
          item.period?.code === draft.period &&
          Number(item.item_no) === Number(draft.itemNo),
      )
    : null;
  const selectAssessment = (assessment) => {
    setSelectedId(assessment.id);
    setDraft(assessmentToDraft(assessment));
    setMessage({ status: "", text: "" });
  };
  const updateDraft = (key, value) =>
    setDraft((current) => {
      if (key === "category") {
        const limit = assessmentItemLimits[value] ?? 4;
        const clampedItemNo = Math.min(Math.max(Number(current.itemNo || 1), 1), limit);
        return { ...current, category: value, itemNo: String(clampedItemNo) };
      }
      return { ...current, [key]: value };
    });
  const updateQuestion = (index, key, value) => {
    setDraft((current) => ({
      ...current,
      questions: current.questions.map((question, questionIndex) =>
        questionIndex === index ? { ...question, [key]: value } : question,
      ),
    }));
  };
  const updateChoice = (questionIndex, choiceIndex, value) => {
    setDraft((current) => ({
      ...current,
      questions: current.questions.map((question, index) =>
        index === questionIndex
          ? { ...question, choices: question.choices.map((choice, choiceIndexValue) => choiceIndexValue === choiceIndex ? value : choice) }
          : question,
      ),
    }));
  };
  const changeQuestionType = (index, type) => {
    setDraft((current) => ({
      ...current,
      questions: current.questions.map((question, questionIndex) =>
        questionIndex === index
          ? { ...createAssessmentQuestion(type), prompt: question.prompt, points: question.points }
          : question,
      ),
    }));
  };
  const validateDraft = () => {
    if (!draft || !selectedAssessment) return "Select an assessment to edit.";
    if (!draft.title.trim()) return "Enter an assessment title.";
    if (draft.timeLimitMinutes && (!Number.isInteger(Number(draft.timeLimitMinutes)) || Number(draft.timeLimitMinutes) < 1)) {
      return "Time limit must be a whole number of minutes.";
    }
    if (draft.availableFrom && draft.availableUntil && draft.availableFrom >= draft.availableUntil) {
      return "The answer window end must be after the start.";
    }
    if (!draft.questions.length || draft.questions.some((question) => !question.prompt.trim())) {
      return "Every question needs a prompt.";
    }
    if (draft.questions.some((question) => question.type === "multiple_choice" && question.choices.some((choice) => !choice.trim()))) {
      return "Complete all multiple-choice options.";
    }
    for (const question of draft.questions) {
      if (question.type === "multiple_choice") continue;
      const nearMatch = Number(question.nearMatchScorePercent);
      if (!Number.isFinite(nearMatch) || nearMatch < 0 || nearMatch > 100) {
        return "Enter a near-match score between 0 and 100 for every coding question.";
      }
      const incorrect = Number(question.incorrectScorePercent);
      if (!Number.isFinite(incorrect) || incorrect < 0 || incorrect > 100) {
        return "Enter an incorrect score between 0 and 100 for every coding question.";
      }
    }
    return "";
  };
  const performSave = async (replaceAssessmentId) => {
    setSaving(true);
    setMessage({ status: "", text: "" });
    try {
      const saved = await onUpdate({
        assessmentId: selectedAssessment.id,
        ...draft,
        itemNo: Number(draft.itemNo),
        title: draft.title.trim(),
        instructions: draft.instructions.trim(),
        replaceAssessmentId,
      });
      setMessage({ status: "success", text: `Assessment updated. Key ID: ${saved?.access_key ?? selectedAssessment.access_key}` });
    } catch (error) {
      // Same fallback as AssessmentBuilder: if the client-side
      // conflictingAssessment check (based on the `assessments` prop) missed
      // a conflict that the server caught, use the server's reported
      // occupant to show the replace-confirmation dialog instead of leaving
      // the user stuck on a plain error.
      if (error?.conflict) {
        setPendingReplace(error.conflict);
      } else {
        setMessage({ status: "error", text: error?.message || "Assessment could not be updated." });
      }
    } finally {
      setSaving(false);
    }
  };
  const save = async (event) => {
    event.preventDefault();
    const validationError = validateDraft();
    if (validationError) {
      setMessage({ status: "error", text: validationError });
      return;
    }
    if (conflictingAssessment) {
      setPendingReplace(conflictingAssessment);
      return;
    }
    await performSave();
  };
  const confirmReplace = async () => {
    if (!pendingReplace) return;
    const replaceAssessmentId = pendingReplace.id;
    setPendingReplace(null);
    await performSave(replaceAssessmentId);
  };
  const grantAttempt = async (student) => {
    const studentId = student.studentId;
    if (!studentId || !onGrantAttempt) return;
    setGrantingStudentId(studentId);
    setMessage({ status: "", text: "" });
    try {
      const grant = await onGrantAttempt({ assessmentId: selectedAssessment.id, studentId });
      setMessage({
        status: "success",
        text: `${student.name} can now take this assessment again (${grant.extra_attempts} extra attempt${Number(grant.extra_attempts) === 1 ? "" : "s"}).`,
      });
    } catch (error) {
      setMessage({ status: "error", text: error?.message || "The extra attempt could not be granted." });
    } finally {
      setGrantingStudentId("");
    }
  };
  const requestRemove = (event, assessment) => {
    event.stopPropagation();
    setConfirmingAssessment(assessment);
  };
  const remove = async () => {
    if (!confirmingAssessment) return;
    const assessment = confirmingAssessment;
    setConfirmingAssessment(null);
    setDeletingId(assessment.id);
    setMessage({ status: "", text: "" });
    try {
      await onDelete(assessment.id);
      const remaining = assessments.filter((item) => item.id !== assessment.id);
      const next = remaining[0];
      setSelectedId(next?.id ?? "");
      setDraft(next ? assessmentToDraft(next) : null);
      setMessage({ status: "success", text: "Assessment deleted successfully." });
      setNotification(`“${assessment.title}” was deleted successfully.`);
    } catch (error) {
      setMessage({ status: "error", text: error?.message || "Assessment could not be deleted." });
    } finally {
      setDeletingId("");
    }
  };
  if (!assessments.length) {
    return (
      <ModalShell title="Manage Assessments" section={section} onClose={onClose}>
        <div className="student-viewer-empty"><span className="assessment-builder-icon">✦</span><h3>No assessments created yet</h3><p>Create an assessment first, then edit its questions here.</p></div>
      </ModalShell>
    );
  }
  return (
    <ModalShell title="Manage Assessments" section={section} onClose={onClose} size="wide">
      <div className="assessment-manager">
        <aside className="assessment-manager-list">
          <div className="assessment-manager-list-heading"><span>YOUR ASSESSMENTS</span><strong>{assessments.length}</strong></div>
          {assessments.map((assessment) => (
            <div className={`assessment-manager-item ${assessment.id === selectedId ? "selected" : ""}`} key={assessment.id}>
              <button type="button" onClick={() => selectAssessment(assessment)} disabled={deletingId === assessment.id}>
                <strong>{assessment.title}</strong>
                <span>{assessmentCategories.find((item) => item.key === assessment.category)?.label} · {assessment.period?.code ? assessmentPeriods.find((item) => item.key === assessment.period.code)?.label : "Assessment"}</span>
                <small>Key: {assessment.access_key}</small>
              </button>
              <button type="button" className="assessment-delete-button" aria-label={`Delete ${assessment.title}`} disabled={deletingId === assessment.id} onClick={(event) => requestRemove(event, assessment)}>×</button>
            </div>
          ))}
        </aside>
        {draft && (
          <form className="assessment-manager-editor" onSubmit={save}>
         <div className="assessment-manager-editor-heading">
              <div>
                <span>EDIT ASSESSMENT</span>
                <h3>{selectedAssessment?.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <code>{selectedAssessment?.access_key}</code>
                {selectedAssessment?.access_key && (
                  <button
                    type="button"
                    title="Copy key"
                    aria-label="Copy key"
                    className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    onClick={(e) => {
                      navigator.clipboard.writeText(selectedAssessment.access_key);
                      const btn = e.currentTarget;
                      btn.classList.add("text-emerald-600");
                      setTimeout(() => btn.classList.remove("text-emerald-600"), 1000);
                    }}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <div className="action-form-grid assessment-details-grid">
              <label>Assessment title<input name="editAssessmentTitle" required value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} /></label>
              <label>Type<select name="editAssessmentCategory" value={draft.category} onChange={(event) => updateDraft("category", event.target.value)}>{assessmentCategories.map((item) => <option value={item.key} key={item.key}>{item.label}</option>)}</select></label>
              <label>Item number<select name="editAssessmentItemNo" value={draft.itemNo} onChange={(event) => updateDraft("itemNo", event.target.value)}>{itemNoOptions(draft.category).map((item) => {
                const occupied = assessments.find(
                  (assessment) =>
                    assessment.id !== selectedAssessment?.id &&
                    assessment.category === draft.category &&
                    assessment.period?.code === draft.period &&
                    Number(assessment.item_no) === Number(item.value),
                );
                return (
                  <option value={item.value} key={item.value}>
                    {item.label}{occupied ? ` — in use: ${occupied.title}` : ""}
                  </option>
                );
              })}</select></label>
              <label>Grading period<select name="editAssessmentPeriod" value={draft.period} onChange={(event) => updateDraft("period", event.target.value)}>{assessmentPeriods.map((item) => <option value={item.key} key={item.key}>{item.label}</option>)}</select></label>
              <label>Available from <span>(optional)</span><input name="editAssessmentAvailableFrom" type="datetime-local" value={draft.availableFrom} onChange={(event) => updateDraft("availableFrom", event.target.value)} /></label>
              <label>Available until <span>(optional)</span><input name="editAssessmentAvailableUntil" type="datetime-local" value={draft.availableUntil} onChange={(event) => updateDraft("availableUntil", event.target.value)} /></label>
              <label>Time limit <span>(minutes, optional)</span><input name="editAssessmentTimeLimit" type="number" min="1" step="1" value={draft.timeLimitMinutes} placeholder="e.g. 30" onChange={(event) => updateDraft("timeLimitMinutes", event.target.value)} /></label>
            </div>
            {conflictingAssessment && (
              <p className="assessment-field-hint assessment-slot-conflict" role="status">
                {itemNoOptions(draft.category).find((item) => item.value === draft.itemNo)?.label} is currently
                assigned to “{conflictingAssessment.title}”. Saving will ask you to confirm replacing it.
              </p>
            )}
            <label className="assessment-instructions-field">
              Instructions <span>(optional)</span>
              <RichTextEditor
                value={draft.instructions}
                onChange={(html) => updateDraft("instructions", html)}
                uploadPathPrefix={`assessments/${selectedAssessment?.id ?? "edit"}`}
              />
            </label>
            <section className="assessment-retry-panel">
              <div>
                <span>INDIVIDUAL RETRY ACCESS</span>
                <h4>Allow another attempt for a specific student</h4>
                <p>Students get one attempt by default. Use the button beside a student to add one more attempt for that student only.</p>
              </div>
              <div className="assessment-retry-list">
                {students.length ? students.map((student) => {
                  const used = (selectedAssessment?.attempts ?? []).filter((attempt) => attempt.student_id === student.studentId).length;
                  const extra = Number((selectedAssessment?.attemptGrants ?? []).find((grant) => grant.student_id === student.studentId)?.extra_attempts || 0);
                  return (
                    <div className="assessment-retry-row" key={student.studentId}>
                      <div><strong>{student.name}</strong><small>{student.number} · {used} used · {extra} extra granted</small></div>
                      <button type="button" className="outline-button" disabled={grantingStudentId === student.studentId} onClick={() => grantAttempt(student)}>
                        {grantingStudentId === student.studentId ? "Granting…" : "Allow another"}
                      </button>
                    </div>
                  );
                }) : <p className="assessment-field-hint">No students are enrolled in this class.</p>}
              </div>
            </section>
            <section className="assessment-violation-panel">
                  <div>
                    <span>VIOLATION LIST</span>
                    <h4>Student security events</h4>
                    <p>These events are recorded with the student attempt. Pressing Escape automatically submits the attempt.</p>
                  </div>
                  <div className="assessment-violation-list">
                    {(() => {
                      const violations = selectedAssessment?.violations ?? [];
                      if (!violations.length) {
                        return <p className="assessment-field-hint">No violations recorded for this assessment.</p>;
                      }

                      // Group violations by student_id
                      const groupedViolations = violations.reduce((acc, violation) => {
                        const id = violation.student_id;
                        if (!acc[id]) acc[id] = [];
                        acc[id].push(violation);
                        return acc;
                      }, {});

                      return Object.entries(groupedViolations).map(([studentId, studentViolations]) => {
                        const student = students.find((item) => item.studentId === studentId);
                        return (
                          <div className="assessment-violation-group" key={studentId}>
                            <div className="assessment-violation-student-header">
                              <strong>{student?.name ?? "Unknown student"}</strong>
                              <small>{student?.number ?? studentId} · {studentViolations.length} total violation(s)</small>
                            </div>
                            <div className="assessment-violation-details-list">
                              {studentViolations.map((violation) => (
                                <div className="assessment-violation-row" key={violation.id}>
                                  <b>{String(violation.violation_type || "security event").replaceAll("_", " ")}</b>
                                  <small>Attempt {violation.attempt_no} · {violation.details || "Detected by student portal"} · {new Date(violation.occurred_at).toLocaleString()}</small>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </section>
            <div className="assessment-question-list">
              {draft.questions.map((question, index) => (
                <article className="assessment-question-card" key={index}>
                  <div className="assessment-question-header"><div><span>QUESTION {index + 1}</span><strong>{question.type === "multiple_choice" ? "Multiple choice" : "Coding question"}</strong></div>{draft.questions.length > 1 && <button type="button" className="assessment-remove-button" onClick={() => updateDraft("questions", draft.questions.filter((_, questionIndex) => questionIndex !== index))}>Remove</button>}</div>
                  <div className="assessment-question-controls"><button type="button" className={question.type === "multiple_choice" ? "active" : ""} onClick={() => changeQuestionType(index, "multiple_choice")}>Multiple choice</button><button type="button" className={question.type === "coding" ? "active" : ""} onClick={() => changeQuestionType(index, "coding")}>Coding</button></div>
                  <div className="action-form-grid assessment-question-grid"><label className="assessment-prompt-field">Question prompt<textarea name={`edit-question-${index}-prompt`} required rows="3" value={question.prompt} onChange={(event) => updateQuestion(index, "prompt", event.target.value)} /></label><label>Points<input name={`edit-question-${index}-points`} type="number" min="0.01" step="0.01" value={question.points} onChange={(event) => updateQuestion(index, "points", event.target.value)} /></label></div>
                  {question.type === "multiple_choice" ? <div className="assessment-choices-grid">{question.choices.map((choice, choiceIndex) => <label key={multipleChoiceLetters[choiceIndex]}><span className="choice-letter">{multipleChoiceLetters[choiceIndex]}</span><input name={`edit-question-${index}-choice-${choiceIndex}`} required value={choice} onChange={(event) => updateChoice(index, choiceIndex, event.target.value)} /><input className="choice-radio" type="radio" name={`edit-correct-${index}`} checked={question.correctAnswer === multipleChoiceLetters[choiceIndex]} onChange={() => updateQuestion(index, "correctAnswer", multipleChoiceLetters[choiceIndex])} aria-label={`Mark ${multipleChoiceLetters[choiceIndex]} correct`} /></label>)}</div> : <div className="coding-question-fields"><label>Programming language<select name={`edit-question-${index}-language`} value={question.language} onChange={(event) => updateQuestion(index, "language", event.target.value)}>{codingLanguages.map((language) => <option value={language.key} key={language.key}>{language.label}</option>)}</select></label><label>Starter code<textarea name={`edit-question-${index}-starterCode`} rows="4" value={question.starterCode} onChange={(event) => updateQuestion(index, "starterCode", event.target.value)} /></label><label>Expected output<textarea name={`edit-question-${index}-expectedOutput`} rows="3" value={question.expectedOutput} onChange={(event) => updateQuestion(index, "expectedOutput", event.target.value)} /></label><label>Near-match score <span>(% of points)</span><input name={`edit-question-${index}-nearMatchScorePercent`} type="number" min="0" max="100" step="1" value={question.nearMatchScorePercent} placeholder="e.g. 50" onChange={(event) => updateQuestion(index, "nearMatchScorePercent", event.target.value)} /></label><label>Incorrect score <span>(% of points)</span><input name={`edit-question-${index}-incorrectScorePercent`} type="number" min="0" max="100" step="1" value={question.incorrectScorePercent} placeholder="e.g. 0" onChange={(event) => updateQuestion(index, "incorrectScorePercent", event.target.value)} /></label></div>}
                </article>
              ))}
            </div>
            <button type="button" className="assessment-add-question" onClick={() => updateDraft("questions", [...draft.questions, createAssessmentQuestion()])}>+ Add another question</button>
            {message.text && <p className={`record-save-message ${message.status}`} role="status">{message.text}</p>}
            <div className="action-modal-footer"><button type="button" className="outline-button" onClick={onClose} disabled={saving}>Close</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></div>
          </form>
        )}
      </div>
      {notification && (
        <div className="assessment-toast" role="status">
          <span>✓</span>
          <div><strong>Assessment deleted</strong><small>{notification}</small></div>
          <button type="button" aria-label="Dismiss notification" onClick={() => setNotification("")}>×</button>
        </div>
      )}
      {confirmingAssessment && (
        <div className="assessment-confirm-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmingAssessment(null); }}>
          <section className="assessment-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="assessment-delete-title">
            <div className="assessment-confirm-icon">!</div>
            <p>DELETE ASSESSMENT</p>
            <h3 id="assessment-delete-title">Delete “{confirmingAssessment.title}”?</h3>
            <span>This will permanently remove the assessment, its questions, and all student submissions.</span>
            <div><button type="button" className="outline-button" onClick={() => setConfirmingAssessment(null)}>Cancel</button><button type="button" className="danger-button" onClick={remove}>Delete assessment</button></div>
          </section>
        </div>
      )}
      {pendingReplace && (
        <div
          className="assessment-confirm-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPendingReplace(null);
          }}
        >
          <section
            className="assessment-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="assessment-manager-replace-title"
          >
            <div className="assessment-confirm-icon">!</div>
            <p>REPLACE ASSESSMENT</p>
            <h3 id="assessment-manager-replace-title">
              {draft && itemNoOptions(draft.category).find((item) => item.value === draft.itemNo)?.label} is
              already assigned to “{pendingReplace.title}”
            </h3>
            <span>
              Saving will delete “{pendingReplace.title}” (its questions and any recorded scores for this
              item) and put this assessment in its place. This can't be undone.
            </span>
            <div>
              <button type="button" className="outline-button" onClick={() => setPendingReplace(null)} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="danger-button" onClick={confirmReplace} disabled={saving}>
                {saving ? "Replacing…" : "Replace assessment"}
              </button>
            </div>
          </section>
        </div>
      )}
    </ModalShell>
  );
}

function StudentViewer({ section, students, assessments, onSubmit, onClose }) {
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [assessmentId, setAssessmentId] = useState(assessments[0]?.id ?? "");
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ status: "", text: "" });
  const assessment = assessments.find((item) => item.id === assessmentId);
  const questions = [...(assessment?.questions ?? [])].sort(
    (first, second) => Number(first.question_no) - Number(second.question_no),
  );
  const categoryLabel = assessmentCategories.find(
    (item) => item.key === assessment?.category,
  )?.label;
  const periodLabel = assessmentPeriods.find(
    (item) => item.key === assessment?.period?.code,
  )?.label;
  const changeAssessment = (nextId) => {
    setAssessmentId(nextId);
    setAnswers({});
    setMessage({ status: "", text: "" });
  };
  const submit = async (event) => {
    event.preventDefault();
    if (!studentId || !assessmentId) {
      setMessage({ status: "error", text: "Select a student and assessment." });
      return;
    }
    setSaving(true);
    setMessage({ status: "", text: "" });
    try {
      const result = await onSubmit({ assessmentId, studentId, answers });
      setMessage({
        status: "success",
        text: result.needsReview
          ? "Answer submitted. Your coding response is waiting for review."
          : `Answer submitted. Score: ${result.score}/${result.maxScore}.`,
      });
    } catch (error) {
      setMessage({ status: "error", text: error?.message || "Answer could not be submitted." });
    } finally {
      setSaving(false);
    }
  };
  return (
    <ModalShell title="Student Viewer" section={section} onClose={onClose} size="wide">
      {!assessments.length ? (
        <div className="student-viewer-empty">
          <span className="assessment-builder-icon">✦</span>
          <h3>No assessments available</h3>
          <p>Create a quiz, assignment, graded activity, or exam first.</p>
        </div>
      ) : (
        <form className="student-viewer" onSubmit={submit}>
          <div className="student-viewer-toolbar">
            <label>
              Student
              <select name="viewerStudent" value={studentId} onChange={(event) => setStudentId(event.target.value)}>
                {students.map((student) => <option value={student.id} key={student.id}>{student.name} · {student.number}</option>)}
              </select>
            </label>
            <label>
              Assessment
              <select name="viewerAssessment" value={assessmentId} onChange={(event) => changeAssessment(event.target.value)}>
                {assessments.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.title} · {assessmentCategories.find((category) => category.key === item.category)?.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {assessment && (
            <div className="student-assessment-heading">
              <div>
                <span>{categoryLabel} · {periodLabel || "Assessment"}</span>
                <h3>{assessment.title}</h3>
                {assessment.instructions && (
                  <div
                    className="student-assessment-instructions"
                    dangerouslySetInnerHTML={{ __html: assessment.instructions }}
                  />
                )}
              </div>
              <strong>{questions.length} {questions.length === 1 ? "question" : "questions"}</strong>
            </div>
          )}
          <div className="student-question-list">
            {questions.map((question, index) => (
              <article className="student-question-card" key={question.id}>
                <div className="student-question-meta">
                  <span>QUESTION {index + 1}</span>
                  <small>{question.points} {Number(question.points) === 1 ? "point" : "points"}</small>
                </div>
                <h4>{question.prompt}</h4>
                {question.question_type === "multiple_choice" ? (
                  <div className="student-choice-list">
                    {(Array.isArray(question.choices) ? question.choices : []).map((choice, choiceIndex) => {
                      const letter = multipleChoiceLetters[choiceIndex];
                      return (
                        <label className={answers[question.id] === letter ? "selected" : ""} key={letter}>
                          <input type="radio" name={`answer-${question.id}`} value={letter} checked={answers[question.id] === letter} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} />
                          <span className="choice-letter">{letter}</span>
                          <span>{choice}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="student-code-answer">
                    <div className="student-code-label"><span>{codingLanguages.find((language) => language.key === question.language)?.label || "Code"}</span><small>Write your solution below</small></div>
                    <textarea name={`viewer-answer-${question.id}`} rows="8" spellCheck="false" value={answers[question.id] ?? ""} placeholder={question.starter_code || "Write your code here..."} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} />
                  </div>
                )}
              </article>
            ))}
          </div>
          {message.text && <p className={`record-save-message ${message.status}`} role="status">{message.text}</p>}
          <div className="action-modal-footer">
            <button type="button" className="outline-button" onClick={onClose} disabled={saving}>Close</button>
            <button type="submit" className="primary-button" disabled={saving || !questions.length}>{saving ? "Submitting…" : "Submit answers"}</button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}

export { AssessmentBuilder, AssessmentManager, StudentViewer };