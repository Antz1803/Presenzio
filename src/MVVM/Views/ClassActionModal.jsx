import { useEffect, useRef, useState } from "react";

const titles = {
  attendance: "Take Attendance",
  "attendance-list": "Attendance List",
  "record-score": "Record Score",
  "create-assessment": "Create Assessment",
  "manage-assessments": "Manage Assessments",
  "show-grades": "Show Grades",
  "grade-summary": "Record Summary",
  "grade-settings": "Grade Sheet Settings",
  "add-student": "Add Student",
};

const gradePeriods = [
  { key: "prelim", label: "Prelim" },
  { key: "midterm", label: "Midterm" },
  { key: "semifinal", label: "Semi-final" },
  { key: "final", label: "Final" },
];

function getGradeRemark(student) {
  // The workbook's Summary remarks are based only on the Final grade. An
  // earlier passing period must not make an unfinished Final appear passed.
  const finalGrade = student.grades?.final;
  if (finalGrade == null || !Number.isFinite(Number(finalGrade))) return "—";
  return Number(finalGrade) <= 3.05
    ? "Passed"
    : "Failed";
}

function formatRecordNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return Number.isInteger(number) ? String(number) : number.toFixed(2);
}

function isDateInPeriodRange(dateValue, periodDates) {
  if (!periodDates?.start && !periodDates?.end) return true;
  const date = String(dateValue ?? "").slice(0, 10);
  if (!date) return false;
  return (
    (!periodDates.start || date >= periodDates.start) &&
    (!periodDates.end || date <= periodDates.end)
  );
}

function formatDisplayDate(dateValue) {
  const date = new Date(`${String(dateValue).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue;
  const months = [
    "Jan.",
    "Feb.",
    "Mar.",
    "Apr.",
    "May",
    "Jun.",
    "Jul.",
    "Aug.",
    "Sep.",
    "Oct.",
    "Nov.",
    "Dec.",
  ];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function getAssessmentItem(
  studentId,
  category,
  itemNo,
  period,
  assessmentScores,
) {
  const record = assessmentScores.find(
    (row) =>
      row.enrollment_id === studentId &&
      row.category === category &&
      Number(row.item_no) === itemNo &&
      row.period?.code === period,
  );
  if (!record) return "0";
  const score = Number(record.score) || 0;
  const maximum = Number(record.max_score);
  return maximum > 0
    ? `${formatRecordNumber(score)}/${formatRecordNumber(maximum)}`
    : formatRecordNumber(score);
}

function getAttendanceTotal(studentId, period, attendanceSessions, periodDates) {
  const hasDateRange = Boolean(periodDates?.start || periodDates?.end);
  const periodSessions = attendanceSessions.filter(
    (session) =>
      hasDateRange
        ? isDateInPeriodRange(session.sessionDate, periodDates)
        : !session.periodCode || session.periodCode === period,
  );
  const attended = periodSessions.filter((session) => {
    const status = session.statuses[studentId];
    return status === "present" || status === "late";
  }).length;
  return `${attended}/${periodSessions.length}`;
}

function ModalShell({ title, section, onClose, children, size = "default" }) {
  return (
    <div
      className="modal-backdrop action-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={`action-modal action-modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-modal-title"
      >
        <header className="action-modal-header">
          <div>
            <p>CLASS ACTION</p>
            <h2 id="action-modal-title">{title}</h2>
            <small>
              {section?.subject_code} · {section?.subject_title}
            </small>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="action-modal-body">{children}</div>
      </section>
    </div>
  );
}

function getSessionTime(section) {
  const hour = Number(String(section?.time_start ?? "").split(":")[0]);
  return Number.isFinite(hour) && hour >= 12 ? "PM" : "AM";
}

function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localDateTimeInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function AttendanceForm({
  section,
  students,
  attendanceSessions,
  onSave,
  onClose,
}) {
  const sessionTime = getSessionTime(section);
  const [date, setDate] = useState(getLocalDateInputValue());
  const statusesForDate = (selectedDate) => {
    const savedSession = attendanceSessions.find(
      (session) =>
        session.sessionDate === selectedDate &&
        (!session.sessionTime || session.sessionTime === sessionTime),
    );
    return Object.fromEntries(
      students.map((student) => [
        student.id,
        savedSession?.statuses?.[student.id] ?? "present",
      ]),
    );
  };
  const [statuses, setStatuses] = useState(() => statusesForDate(date));
  const [saving, setSaving] = useState(false);
  const changeDate = (nextDate) => {
    setDate(nextDate);
    setStatuses(statusesForDate(nextDate));
  };
  const save = async () => {
    setSaving(true);
    await onSave({ date, sessionTime, statuses });
    setSaving(false);
  };
  return (
    <>
      <div className="action-form-grid single">
        <label>
          Date
          <input
            type="date"
            value={date}
            onChange={(event) => changeDate(event.target.value)}
          />
        </label>
      </div>
      <div className="action-roster">
        {students.map((student) => (
          <div className="action-roster-row" key={student.id}>
            <span>
              <b>{student.name}</b>
              <small>{student.number}</small>
            </span>
            <select
              value={statuses[student.id] ?? "present"}
              onChange={(event) =>
                setStatuses({ ...statuses, [student.id]: event.target.value })
              }
            >
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
              <option value="excused">Excused</option>
            </select>
          </div>
        ))}
      </div>
      <div className="action-modal-footer">
        <button className="outline-button" onClick={onClose}>
          Cancel
        </button>
        <button className="primary-button" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save attendance"}
        </button>
      </div>
    </>
  );
}

const scoreCategories = [
  { key: "quiz", label: "Quiz", prefix: "Q", count: 4 },
  { key: "assignment", label: "Assignment", prefix: "A", count: 4 },
  { key: "activity", label: "Graded activity", prefix: "G", count: 4 },
  { key: "exam", label: "Exam", prefix: "E", count: 1 },
];

const recordSummaryGroups = [
  { key: "quiz", label: "QUIZ", prefix: "Q", count: 4 },
  { key: "assignment", label: "ASSIGNMENT", prefix: "A", count: 4 },
  { key: "activity", label: "GRADED ACTIVITY", prefix: "GA", count: 4 },
  { key: "exam", label: "EXAM", prefix: "E", count: 1 },
];

const transmutationBreakpoints = [
  [0, 5], [1, 4], [6, 3.9], [12, 3.8], [18, 3.7], [24, 3.6],
  [30, 3.5], [36, 3.4], [42, 3.3], [48, 3.2], [54, 3.1], [60, 3],
  [62, 2.9], [64, 2.8], [66, 2.7], [68, 2.6], [70, 2.5], [72, 2.4],
  [74, 2.3], [76, 2.2], [78, 2.1], [80, 2], [82, 1.9], [84, 1.8],
  [86, 1.7], [88, 1.6], [90, 1.5], [92, 1.4], [94, 1.3], [96, 1.2],
  [98, 1.1], [100, 1],
];

function transmuteScore(value) {
  if (!Number.isFinite(Number(value))) return null;
  // Match the workbook's approximate VLOOKUP: use the greatest breakpoint
  // less than or equal to the percentage, without rounding the input first.
  const percentage = Math.max(0, Math.min(100, Number(value)));
  let gradePoint = 5;
  transmutationBreakpoints.forEach(([breakpoint, grade]) => {
    if (percentage >= breakpoint) gradePoint = grade;
  });
  return gradePoint;
}

function createScoreState(students, assessmentScores, period) {
  const state = Object.fromEntries(
    scoreCategories.map((item) => [
      item.key,
      Object.fromEntries(
        students.flatMap((student) =>
          Array.from({ length: item.count }, (_, index) => [
            student.id + ":" + (index + 1),
            "",
          ]),
        ),
      ),
    ]),
  );

  assessmentScores
    .filter((row) => row.period?.code === period)
    .forEach((row) => {
      const key = row.enrollment_id + ":" + row.item_no;
      if (state[row.category]) {
        state[row.category][key] = row.score === 0 ? "" : String(row.score ?? "");
      }
    });

  return state;
}

function createMaxScoreState(assessmentScores, period, assessmentDefinitions = []) {
  const state = Object.fromEntries(
    scoreCategories.map((item) => [
      item.key,
      Object.fromEntries(
        Array.from({ length: item.count }, (_, index) => [String(index + 1), ""]),
      ),
    ]),
  );

  assessmentScores
    .filter((row) => row.period?.code === period)
    .forEach((row) => {
      if (state[row.category] && row.max_score != null) {
        state[row.category][String(row.item_no)] = String(row.max_score);
      }
    });

  assessmentDefinitions
    .filter((assessment) => assessment.period?.code === period)
    .forEach((assessment) => {
      if (!state[assessment.category] || !assessment.item_no) return;
      const totalPoints = (assessment.questions ?? []).reduce(
        (total, question) => total + Number(question.points || 0),
        0,
      );
      if (totalPoints > 0) {
        state[assessment.category][String(assessment.item_no)] = String(totalPoints);
      }
    });

  return state;
}

function ScoreForm({
  students,
  assessmentScores,
  assessmentDefinitions,
  gradingPeriods,
  onSave,
  onAutoSave,
  onClose,
}) {
  const [period, setPeriod] = useState("prelim");
  const [category, setCategory] = useState("quiz");
  const [maxScores, setMaxScores] = useState(() =>
    createMaxScoreState(assessmentScores, period, assessmentDefinitions),
  );
  const [scores, setScores] = useState(() =>
    createScoreState(students, assessmentScores, period),
  );
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState({ status: "", text: "" });
  const [studentQuery, setStudentQuery] = useState("");
  const selectedPeriod = gradingPeriods.find((item) => item.code === period);
  const periodDates = {
    start: selectedPeriod?.start_date ?? "",
    end: selectedPeriod?.end_date ?? "",
  };
  const activeCategory = scoreCategories.find((item) => item.key === category);
  const activeMaxScores = maxScores[category];
  const visibleStudents = students.filter((student) => {
    const query = studentQuery.trim().toLowerCase();
    return (
      !query ||
      student.name.toLowerCase().includes(query) ||
      String(student.number).toLowerCase().includes(query)
    );
  });
  const usedItemNumbers = Array.from(
    { length: activeCategory.count },
    (_, index) => index + 1,
  ).filter((itemNo) =>
    Object.entries(scores[category]).some(
      ([key, value]) =>
        key.endsWith(`:${itemNo}`) &&
        value !== "" &&
        Number.isFinite(Number(value)),
    ),
  );
  const hasValidMaxScores = usedItemNumbers.every(
    (itemNo) => Number(activeMaxScores[String(itemNo)]) > 0,
  );
  const hasConfiguredMaxScores = Object.values(activeMaxScores).some(
    (value) => Number(value) > 0,
  );
  const autoSaveCurrentCategory = async () => {
    if (!hasValidMaxScores) {
      setSaveMessage({
        status: "error",
        text: "Enter a maximum score for every column that has a score before switching.",
      });
      return false;
    }
    setAutoSaving(true);
    setSaveMessage({
      status: "",
      text: `Saving ${activeCategory.label} scores...`,
    });
    try {
      await onAutoSave({
        period,
        category,
        scores: scores[category],
        maxScores: activeMaxScores,
      });
      setSaveMessage({
        status: "success",
        text: `${activeCategory.label} scores auto-saved.`,
      });
      return true;
    } catch (error) {
      setSaveMessage({
        status: "error",
        text:
          error?.message ||
          `${activeCategory.label} scores could not be saved.`,
      });
      return false;
    } finally {
      setAutoSaving(false);
    }
  };
  const changeCategory = (nextCategory) => {
    if (nextCategory === category || saving) return;
    setCategory(nextCategory);
    void autoSaveCurrentCategory();
  };
  const changePeriod = (nextPeriod) => {
    if (nextPeriod === period || saving) return;
    void autoSaveCurrentCategory();
    setPeriod(nextPeriod);
    setMaxScores(createMaxScoreState(assessmentScores, nextPeriod, assessmentDefinitions));
    setScores(createScoreState(students, assessmentScores, nextPeriod));
  };
  const updateScore = (studentId, itemNo, value) => {
    if (value === "") {
      setScores({
        ...scores,
        [category]: { ...scores[category], [studentId + ":" + itemNo]: "" },
      });
      return;
    }
    const numericValue = Number(value);
    const max = Number(activeMaxScores[String(itemNo)]);
    const safeValue = Number.isFinite(numericValue)
      ? Math.max(0, max > 0 ? Math.min(numericValue, max) : numericValue)
      : "";
    setScores({
      ...scores,
      [category]: {
        ...scores[category],
        [studentId + ":" + itemNo]: safeValue,
      },
    });
  };
  const updateMaxScore = (itemNo, value) =>
    setMaxScores({
      ...maxScores,
      [category]: { ...maxScores[category], [String(itemNo)]: value },
    });
  const average = (student) => {
    const values = Array.from(
      { length: activeCategory.count },
      (_, index) => scores[category][student.id + ":" + (index + 1)],
    )
      .filter((value) => value !== "")
      .map(Number)
      .filter(Number.isFinite);
    return values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
  };
  const save = async () => {
    if (!hasValidMaxScores) {
      setSaveMessage({
        status: "error",
        text: "Enter a maximum score for every column that has a score.",
      });
      return;
    }
    setSaving(true);
    setSaveMessage({ status: "", text: "" });
    try {
      await onSave({
        period,
        category,
        scores: scores[category],
        maxScores: activeMaxScores,
      });
      setSaveMessage({ status: "success", text: "Scores saved successfully." });
    } catch (error) {
      setSaveMessage({
        status: "error",
        text: error?.message || "Scores could not be saved to Supabase.",
      });
    } finally {
      setSaving(false);
    }
  };
  const normalizedAverage = (student) => {
    if (!hasValidMaxScores) return 0;
    const gradePoints = Array.from(
      { length: activeCategory.count },
      (_, index) => {
        const rawScore = scores[category][student.id + ":" + (index + 1)];
        const max = Number(activeMaxScores[String(index + 1)]);
        if (!Number.isFinite(max) || max <= 0) return null;
        // Excel leaves a blank transmuted cell blank, so COUNT/AVERAGE
        // excludes it. An explicit numeric 0 remains a real score.
        if (rawScore === "") return null;
        const score = Number(rawScore);
        return Number.isFinite(score)
          ? transmuteScore((score / max) * 100)
          : null;
      },
    ).filter((value) => value !== null);
    return gradePoints.length
      ? gradePoints.reduce((sum, value) => sum + value, 0) / gradePoints.length
      : 0;
  };
  return (
    <div className="record-score-panel">
      <div className="record-score-toolbar">
        <label className="record-score-search">
          <span>Search student</span>
          <input
            type="search"
            value={studentQuery}
            placeholder="Search name..."
            aria-label="Search student name"
            onChange={(event) => setStudentQuery(event.target.value)}
          />
        </label>
        <div className="category-tabs">
          {scoreCategories.map((item) => (
            <button
              key={item.key}
              className={category === item.key ? "active" : ""}
              onClick={() => changeCategory(item.key)}
              disabled={saving}
            >
              {item.label}
              <span>{item.count}</span>
            </button>
          ))}
        </div>
        <select
          className="record-period-select"
          value={period}
          disabled={saving}
          onChange={(event) => changePeriod(event.target.value)}
        >
          <option value="prelim">Prelim</option>
          <option value="midterm">Midterm</option>
          <option value="semifinal">Semi-final</option>
          <option value="final">Final</option>
        </select>
        <span className="record-period-range">
          {periodDates.start && periodDates.end
            ? `${formatDisplayDate(periodDates.start)} – ${formatDisplayDate(periodDates.end)}`
            : "No date range set"}
        </span>
      </div>
      {saveMessage.text && (
        <p className={`record-save-message ${saveMessage.status}`} role="status">
          {saveMessage.text}
        </p>
      )}
      <div className="table-wrap record-score-table">
        <table>
          <thead>
            <tr>
              <th className="record-student-col">STUDENT</th>
              {Array.from({ length: activeCategory.count }, (_, index) => {
                const itemNo = index + 1;
                const itemLabel =
                  activeCategory.key === "exam"
                    ? activeCategory.prefix
                    : `${activeCategory.prefix}${itemNo}`;
                return (
                  <th key={itemNo}>
                    <div className="record-score-heading">
                      <span>{itemLabel} /</span>
                      <input
                        className="record-max-input"
                        aria-label={
                          activeCategory.label + " " + itemNo + " maximum score"
                        }
                        type="number"
                        min="1"
                        step="0.01"
                        value={activeMaxScores[String(itemNo)]}
                        onChange={(event) =>
                          updateMaxScore(itemNo, event.target.value)
                        }
                      />
                    </div>
                  </th>
                );
              })}
              <th>AVERAGE</th>
              <th>GRADE POINT</th>
            </tr>
          </thead>
          <tbody>
            {visibleStudents.map((student) => {
              const currentAverage = average(student);
              const gradePoint =
                hasConfiguredMaxScores && hasValidMaxScores && Number.isFinite(currentAverage)
                  ? normalizedAverage(student).toFixed(2)
                  : "—";
              return (
                <tr key={student.id}>
                  <td>
                    <div className="table-student">
                      <span className="record-avatar">{student.initials}</span>
                      <span>{student.name}</span>
                    </div>
                  </td>
                  {Array.from({ length: activeCategory.count }, (_, index) => {
                    const itemNo = index + 1;
                    const itemMax = Number(activeMaxScores[String(itemNo)]);
                    return (
                      <td key={itemNo}>
                        <input
                          aria-label={student.name + " item " + itemNo}
                          type="number"
                          min="0"
                          max={itemMax > 0 ? itemMax : undefined}
                          step="0.01"
                          value={scores[category][student.id + ":" + itemNo]}
                          disabled={!itemMax}
                          onChange={(event) =>
                            updateScore(student.id, itemNo, event.target.value)
                          }
                        />
                      </td>
                    );
                  })}
                  <td className="record-average">
                    {currentAverage.toFixed(1)}
                  </td>
                  <td>
                    <span className="record-grade-pill">{gradePoint}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!students.length && (
          <div className="empty-state">
            No students are enrolled in this class.
          </div>
        )}
        {students.length > 0 && !visibleStudents.length && (
          <div className="empty-state">No students match your search.</div>
        )}
      </div>
      <div className="action-modal-footer">
        <button className="outline-button" onClick={onClose}>
          Cancel
        </button>
        <button
          className="primary-button"
          onClick={save}
          disabled={saving || autoSaving}
        >
          {saving || autoSaving ? "Saving…" : "Save scores"}
        </button>
      </div>
    </div>
  );
}

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

function AssessmentBuilder({ section, onSave, onClose }) {
  const [form, setForm] = useState({
    title: "",
    category: "quiz",
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
  const maximumScore = questions.reduce(
    (total, question) => total + Number(question.points || 0),
    0,
  );

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));
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
      }
    }
    return "";
  };
  const save = async (event) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setMessage({ status: "error", text: validationError });
      return;
    }
    setSaving(true);
    setMessage({ status: "", text: "" });
    try {
      const savedAssessment = await onSave({
        ...form,
        title: form.title.trim(),
        instructions: form.instructions.trim(),
        timeLimitMinutes: form.timeLimitMinutes ? Number(form.timeLimitMinutes) : null,
        availableFrom: form.availableFrom,
        availableUntil: form.availableUntil,
        questions: questions.map((question) => ({
          type: question.type,
          prompt: question.prompt.trim(),
          points: Number(question.points),
          choices: question.type === "multiple_choice" ? question.choices : [],
          correctAnswer: question.type === "multiple_choice" ? question.correctAnswer : null,
          language: question.type === "coding" ? question.language : null,
          starterCode: question.type === "coding" ? question.starterCode : null,
          expectedOutput: question.type === "coding" ? question.expectedOutput : null,
        })),
      });
      setMessage({
        status: "success",
        text: `Assessment saved. Key ID: ${savedAssessment?.access_key ?? "available in Supabase"}`,
      });
      setForm((current) => ({ ...current, title: "", instructions: "", timeLimitMinutes: "" }));
      setQuestions([createAssessmentQuestion()]);
    } catch (error) {
      setMessage({
        status: "error",
        text: error?.message || "Assessment could not be saved.",
      });
    } finally {
      setSaving(false);
    }
  };
  return (
    <ModalShell title="Create Assessment" section={section} onClose={onClose} size="wide">
      <form className="assessment-builder" onSubmit={save}>
        <div className="assessment-builder-intro">
          <div>
            <span className="assessment-builder-icon">✦</span>
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
              required
              value={form.title}
              placeholder="e.g. Introduction to SQL"
              onChange={(event) => updateForm("title", event.target.value)}
            />
          </label>
          <label>
            Type
            <select value={form.category} onChange={(event) => updateForm("category", event.target.value)}>
              {assessmentCategories.map((item) => <option value={item.key} key={item.key}>{item.label}</option>)}
            </select>
          </label>
          <label>
            Grading period
            <select value={form.period} onChange={(event) => updateForm("period", event.target.value)}>
              {assessmentPeriods.map((item) => <option value={item.key} key={item.key}>{item.label}</option>)}
            </select>
          </label>
          <label>
            Available from <span>(optional)</span>
            <input type="datetime-local" value={form.availableFrom} onChange={(event) => updateForm("availableFrom", event.target.value)} />
          </label>
          <label>
            Available until <span>(optional)</span>
            <input type="datetime-local" value={form.availableUntil} onChange={(event) => updateForm("availableUntil", event.target.value)} />
          </label>
          <label>
            Time limit <span>(minutes, optional)</span>
            <input type="number" min="1" step="1" value={form.timeLimitMinutes} placeholder="e.g. 30" onChange={(event) => updateForm("timeLimitMinutes", event.target.value)} />
          </label>
        </div>
        <p className="action-help">Students can submit once by default. Grant another attempt to an individual student from Manage Assessments.</p>
        <label className="assessment-instructions-field">
          Instructions <span>(optional)</span>
          <textarea
            rows="2"
            value={form.instructions}
            placeholder="Add instructions for your students..."
            onChange={(event) => updateForm("instructions", event.target.value)}
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
                  <textarea required rows="3" value={question.prompt} placeholder="Write your question here..." onChange={(event) => updateQuestion(index, "prompt", event.target.value)} />
                </label>
                <label>
                  Points
                  <input type="number" min="0.01" step="0.01" value={question.points} onChange={(event) => updateQuestion(index, "points", event.target.value)} />
                </label>
              </div>
              {question.type === "multiple_choice" ? (
                <div className="assessment-choices-grid">
                  {question.choices.map((choice, choiceIndex) => (
                    <label key={multipleChoiceLetters[choiceIndex]}>
                      <span className="choice-letter">{multipleChoiceLetters[choiceIndex]}</span>
                      <input required value={choice} placeholder={`Choice ${multipleChoiceLetters[choiceIndex]}`} onChange={(event) => updateChoice(index, choiceIndex, event.target.value)} />
                      <input className="choice-radio" type="radio" name={`correct-answer-${index}`} checked={question.correctAnswer === multipleChoiceLetters[choiceIndex]} onChange={() => updateQuestion(index, "correctAnswer", multipleChoiceLetters[choiceIndex])} aria-label={`Mark choice ${multipleChoiceLetters[choiceIndex]} as correct`} />
                    </label>
                  ))}
                  <p className="assessment-field-hint">Select the radio button beside the correct answer.</p>
                </div>
              ) : (
                <div className="coding-question-fields">
                  <label>
                    Programming language
                    <select value={question.language} onChange={(event) => updateQuestion(index, "language", event.target.value)}>
                      {codingLanguages.map((language) => <option value={language.key} key={language.key}>{language.label}</option>)}
                    </select>
                  </label>
                  <label>
                    Starter code <span>(optional)</span>
                    <textarea rows="4" value={question.starterCode} placeholder="Provide starter code or a code template..." onChange={(event) => updateQuestion(index, "starterCode", event.target.value)} />
                  </label>
                  <label>
                    Expected output / answer criteria <span>(optional)</span>
                    <textarea rows="3" value={question.expectedOutput} placeholder="Describe the expected result..." onChange={(event) => updateQuestion(index, "expectedOutput", event.target.value)} />
                  </label>
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
    </ModalShell>
  );
}

function assessmentToDraft(assessment) {
  return {
    itemNo: assessment.item_no,
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
  const selectedAssessment = assessments.find((item) => item.id === selectedId);
  const selectAssessment = (assessment) => {
    setSelectedId(assessment.id);
    setDraft(assessmentToDraft(assessment));
    setMessage({ status: "", text: "" });
  };
  const updateDraft = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
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
  const save = async (event) => {
    event.preventDefault();
    if (!draft || !selectedAssessment) return;
    if (!draft.title.trim()) {
      setMessage({ status: "error", text: "Enter an assessment title." });
      return;
    }
    if (draft.timeLimitMinutes && (!Number.isInteger(Number(draft.timeLimitMinutes)) || Number(draft.timeLimitMinutes) < 1)) {
      setMessage({ status: "error", text: "Time limit must be a whole number of minutes." });
      return;
    }
    if (draft.availableFrom && draft.availableUntil && draft.availableFrom >= draft.availableUntil) {
      setMessage({ status: "error", text: "The answer window end must be after the start." });
      return;
    }
    if (!draft.questions.length || draft.questions.some((question) => !question.prompt.trim())) {
      setMessage({ status: "error", text: "Every question needs a prompt." });
      return;
    }
    if (draft.questions.some((question) => question.type === "multiple_choice" && question.choices.some((choice) => !choice.trim()))) {
      setMessage({ status: "error", text: "Complete all multiple-choice options." });
      return;
    }
    setSaving(true);
    setMessage({ status: "", text: "" });
    try {
      const saved = await onUpdate({ assessmentId: selectedAssessment.id, ...draft, title: draft.title.trim(), instructions: draft.instructions.trim() });
      setMessage({ status: "success", text: `Assessment updated. Key ID: ${saved?.access_key ?? selectedAssessment.access_key}` });
    } catch (error) {
      setMessage({ status: "error", text: error?.message || "Assessment could not be updated." });
    } finally {
      setSaving(false);
    }
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
            <div className="assessment-manager-editor-heading"><div><span>EDIT ASSESSMENT</span><h3>{selectedAssessment?.title}</h3></div><code>{selectedAssessment?.access_key}</code></div>
            <div className="action-form-grid assessment-details-grid">
              <label>Assessment title<input required value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} /></label>
              <label>Type<select value={draft.category} onChange={(event) => updateDraft("category", event.target.value)}>{assessmentCategories.map((item) => <option value={item.key} key={item.key}>{item.label}</option>)}</select></label>
              <label>Grading period<select value={draft.period} onChange={(event) => updateDraft("period", event.target.value)}>{assessmentPeriods.map((item) => <option value={item.key} key={item.key}>{item.label}</option>)}</select></label>
              <label>Available from <span>(optional)</span><input type="datetime-local" value={draft.availableFrom} onChange={(event) => updateDraft("availableFrom", event.target.value)} /></label>
              <label>Available until <span>(optional)</span><input type="datetime-local" value={draft.availableUntil} onChange={(event) => updateDraft("availableUntil", event.target.value)} /></label>
              <label>Time limit <span>(minutes, optional)</span><input type="number" min="1" step="1" value={draft.timeLimitMinutes} placeholder="e.g. 30" onChange={(event) => updateDraft("timeLimitMinutes", event.target.value)} /></label>
            </div>
            <label className="assessment-instructions-field">Instructions <span>(optional)</span><textarea rows="2" value={draft.instructions} onChange={(event) => updateDraft("instructions", event.target.value)} /></label>
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
                {(selectedAssessment?.violations ?? []).length ? selectedAssessment.violations.map((violation) => {
                  const student = students.find((item) => item.studentId === violation.student_id);
                  return (
                    <div className="assessment-violation-row" key={violation.id}>
                      <div><strong>{student?.name ?? "Unknown student"}</strong><small>{student?.number ?? violation.student_id} · Attempt {violation.attempt_no}</small></div>
                      <div><b>{String(violation.violation_type || "security event").replaceAll("_", " ")}</b><small>{violation.details || "Detected by student portal"} · {new Date(violation.occurred_at).toLocaleString()}</small></div>
                    </div>
                  );
                }) : <p className="assessment-field-hint">No violations recorded for this assessment.</p>}
              </div>
            </section>
            <div className="assessment-question-list">
              {draft.questions.map((question, index) => (
                <article className="assessment-question-card" key={index}>
                  <div className="assessment-question-header"><div><span>QUESTION {index + 1}</span><strong>{question.type === "multiple_choice" ? "Multiple choice" : "Coding question"}</strong></div>{draft.questions.length > 1 && <button type="button" className="assessment-remove-button" onClick={() => updateDraft("questions", draft.questions.filter((_, questionIndex) => questionIndex !== index))}>Remove</button>}</div>
                  <div className="assessment-question-controls"><button type="button" className={question.type === "multiple_choice" ? "active" : ""} onClick={() => changeQuestionType(index, "multiple_choice")}>Multiple choice</button><button type="button" className={question.type === "coding" ? "active" : ""} onClick={() => changeQuestionType(index, "coding")}>Coding</button></div>
                  <div className="action-form-grid assessment-question-grid"><label className="assessment-prompt-field">Question prompt<textarea required rows="3" value={question.prompt} onChange={(event) => updateQuestion(index, "prompt", event.target.value)} /></label><label>Points<input type="number" min="0.01" step="0.01" value={question.points} onChange={(event) => updateQuestion(index, "points", event.target.value)} /></label></div>
                  {question.type === "multiple_choice" ? <div className="assessment-choices-grid">{question.choices.map((choice, choiceIndex) => <label key={multipleChoiceLetters[choiceIndex]}><span className="choice-letter">{multipleChoiceLetters[choiceIndex]}</span><input required value={choice} onChange={(event) => updateChoice(index, choiceIndex, event.target.value)} /><input className="choice-radio" type="radio" name={`edit-correct-${index}`} checked={question.correctAnswer === multipleChoiceLetters[choiceIndex]} onChange={() => updateQuestion(index, "correctAnswer", multipleChoiceLetters[choiceIndex])} aria-label={`Mark ${multipleChoiceLetters[choiceIndex]} correct`} /></label>)}</div> : <div className="coding-question-fields"><label>Programming language<select value={question.language} onChange={(event) => updateQuestion(index, "language", event.target.value)}>{codingLanguages.map((language) => <option value={language.key} key={language.key}>{language.label}</option>)}</select></label><label>Starter code<textarea rows="4" value={question.starterCode} onChange={(event) => updateQuestion(index, "starterCode", event.target.value)} /></label><label>Expected output<textarea rows="3" value={question.expectedOutput} onChange={(event) => updateQuestion(index, "expectedOutput", event.target.value)} /></label></div>}
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
              <select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
                {students.map((student) => <option value={student.id} key={student.id}>{student.name} · {student.number}</option>)}
              </select>
            </label>
            <label>
              Assessment
              <select value={assessmentId} onChange={(event) => changeAssessment(event.target.value)}>
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
                {assessment.instructions && <p>{assessment.instructions}</p>}
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
                    <textarea rows="8" spellCheck="false" value={answers[question.id] ?? ""} placeholder={question.starter_code || "Write your code here..."} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} />
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

function AddStudentForm({ onSave, onClose }) {
  const [form, setForm] = useState({
    student_no: "",
    full_name: "",
    gender: "",
    course: "",
    year_level: "",
  });
  const [saving, setSaving] = useState(false);
  const update = (key, value) => setForm({ ...form, [key]: value });
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };
  return (
    <form onSubmit={save}>
      <div className="action-form-grid">
        <label>
          Student ID
          <input
            required
            value={form.student_no}
            onChange={(event) => update("student_no", event.target.value)}
          />
        </label>
        <label>
          Full name
          <input
            required
            value={form.full_name}
            onChange={(event) => update("full_name", event.target.value)}
          />
        </label>
        <label>
          Gender
          <select
            value={form.gender}
            onChange={(event) => update("gender", event.target.value)}
          >
            <option value="">Select</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </label>
        <label>
          Course
          <input
            value={form.course}
            onChange={(event) => update("course", event.target.value)}
          />
        </label>
        <label>
          Year level
          <input
            value={form.year_level}
            onChange={(event) => update("year_level", event.target.value)}
          />
        </label>
      </div>
      <div className="action-modal-footer">
        <button type="button" className="outline-button" onClick={onClose}>
          Cancel
        </button>
        <button className="primary-button" disabled={saving}>
          {saving ? "Saving…" : "Add student"}
        </button>
      </div>
    </form>
  );
}

function attendanceSymbol(status) {
  return {
    present: "1",
    absent: "A",
    late: "L",
    excused: "E",
  }[status] ?? "—";
}

function AttendanceMatrix({ students, attendanceSessions, gradingPeriods }) {
  const [period, setPeriod] = useState("prelim");
  const selectedPeriod = gradingPeriods.find((item) => item.code === period);
  const periodDates = {
    start: selectedPeriod?.start_date ?? "",
    end: selectedPeriod?.end_date ?? "",
  };
  const visibleAttendanceSessions = attendanceSessions.filter((session) =>
    isDateInPeriodRange(session.sessionDate, periodDates),
  );
  const copy = async (text) => {
    if (navigator.clipboard) await navigator.clipboard.writeText(text);
  };

  const copyDateColumn = (session) =>
    copy(
      students
        .map((student) => attendanceSymbol(session.statuses[student.id]))
        .join("\n"),
    );

  return (
    <div className="attendance-matrix-wrap">
      <div className="record-summary-toolbar attendance-list-toolbar">
        <div className="period-pills" role="tablist" aria-label="Grading period">
          {gradePeriods.map((item) => (
            <button
              key={item.key}
              className={period === item.key ? "active" : ""}
              onClick={() => setPeriod(item.key)}
              role="tab"
              aria-selected={period === item.key}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="record-period-range">
          {periodDates.start && periodDates.end
            ? `${formatDisplayDate(periodDates.start)} – ${formatDisplayDate(periodDates.end)}`
            : "No date range set"}
        </span>
      </div>
      {periodDates.start && periodDates.end ? (
        <div className="table-wrap attendance-matrix-table">
          <table>
            <thead>
              <tr>
                <th className="attendance-name-column">
                  <span>STUDENT NAME</span>
                  <button
                    className="copy-button"
                    onClick={() => copy(students.map((student) => student.name).join("\n"))}
                  >
                    Copy
                  </button>
                </th>
                {visibleAttendanceSessions.map((session) => (
                  <th key={session.id}>
                    <span>
                      {session.sessionDate
                        ? formatDisplayDate(session.sessionDate)
                        : session.date}
                    </span>
                    <button className="copy-button" onClick={() => copyDateColumn(session)}>
                      Copy
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td className="attendance-student-name">
                    <span>{student.name}</span>
                    <button className="copy-button" onClick={() => copy(student.name)}>
                      Copy
                    </button>
                  </td>
                  {visibleAttendanceSessions.map((session) => (
                    <td key={session.id}>
                      {attendanceSymbol(session.statuses[student.id])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!students.length && (
            <div className="empty-state">No students are enrolled in this class.</div>
          )}
          {!visibleAttendanceSessions.length && students.length > 0 && (
            <div className="empty-state">No attendance dates in this period.</div>
          )}
        </div>
      ) : (
        <div className="empty-state record-summary-date-empty">
          Please set a start date and end date for {gradePeriods.find((item) => item.key === period)?.label}
          in Grade Sheet Settings.
        </div>
      )}
    </div>
  );
}

function RecordSummary({
  students,
  assessmentScores,
  attendanceSessions,
  gradingPeriods,
  section,
  onClose,
}) {
  const [period, setPeriod] = useState("prelim");
  const selectedPeriod = gradingPeriods.find((item) => item.code === period);
  const periodDates = {
    start: selectedPeriod?.start_date ?? "",
    end: selectedPeriod?.end_date ?? "",
  };

  return (
    <ModalShell
      title="Record Summary"
      section={section}
      onClose={onClose}
      size="wide"
    >
      <div className="record-summary-toolbar">
        <div className="period-pills" role="tablist" aria-label="Grading period">
          {gradePeriods.map((item) => (
            <button
              key={item.key}
              className={period === item.key ? "active" : ""}
              onClick={() => setPeriod(item.key)}
              role="tab"
              aria-selected={period === item.key}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="record-period-range">
          {periodDates.start && periodDates.end
            ? `${formatDisplayDate(periodDates.start)} – ${formatDisplayDate(periodDates.end)}`
            : "No date range set"}
        </span>
      </div>
      {periodDates.start && periodDates.end ? (
        <div className="table-wrap record-summary-table">
          <table>
            <thead>
              <tr>
                <th rowSpan="2">STUDENT NAME</th>
                {recordSummaryGroups.map((group) => (
                  <th colSpan={group.count} key={group.key}>
                    {group.label}
                  </th>
                ))}
                <th rowSpan="2">TOTAL ATTENDANCE</th>
              </tr>
              <tr>
                {recordSummaryGroups.flatMap((group) =>
                  Array.from({ length: group.count }, (_, index) => (
                    <th key={`${group.key}-${index + 1}`}>
                      {group.prefix}{index + 1}
                    </th>
                  )),
                )}
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
                {recordSummaryGroups.flatMap((group) =>
                  Array.from({ length: group.count }, (_, index) => (
                    <td key={`${group.key}-${index + 1}`}>
                      {getAssessmentItem(
                        student.id,
                        group.key,
                        index + 1,
                        period,
                        assessmentScores,
                      )}
                    </td>
                  )),
                )}
                <td>{getAttendanceTotal(student.id, period, attendanceSessions, periodDates)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!students.length && (
          <div className="empty-state">No students are enrolled in this class.</div>
        )}
        </div>
      ) : (
        <div className="empty-state record-summary-date-empty">
          Please set a start date and end date for {gradePeriods.find((item) => item.key === period)?.label}
          in Grade Sheet Settings.
        </div>
      )}
    </ModalShell>
  );
}

function createDateRangeState(savedPeriods) {
  return Object.fromEntries(
    gradePeriods.map((item) => {
      const saved = savedPeriods.find((period) => period.code === item.key);
      return [
        item.key,
        {
          start: saved?.start_date ?? "",
          end: saved?.end_date ?? "",
        },
      ];
    }),
  );
}

function GradeSettings({ gradingPeriods, section, onSave, onClose }) {
  const [dateRanges, setDateRanges] = useState(() =>
    createDateRangeState(gradingPeriods),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ status: "", text: "" });

  const updateDate = (period, field, value) => {
    setDateRanges((current) => ({
      ...current,
      [period]: { ...current[period], [field]: value },
    }));
    setMessage({ status: "", text: "" });
  };

  const save = async () => {
    const invalidPeriod = gradePeriods.find(({ key }) => {
      const dates = dateRanges[key];
      return (
        Boolean(dates.start) !== Boolean(dates.end) ||
        (dates.start && dates.end && dates.start > dates.end)
      );
    });
    if (invalidPeriod) {
      setMessage({
        status: "error",
        text: `${invalidPeriod.label} needs a valid start and end date.`,
      });
      return;
    }

    setSaving(true);
    setMessage({ status: "", text: "" });
    try {
      await onSave(dateRanges);
      setMessage({ status: "success", text: "Period dates saved successfully." });
    } catch (error) {
      setMessage({
        status: "error",
        text: error.message ?? "Period dates could not be saved.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Grade Sheet Settings" section={section} onClose={onClose}>
      <div className="period-settings-list">
        <p className="action-help">
          Set the date range for each grading period. Record Summary will only
          include scores and attendance recorded within the selected range.
        </p>
        {gradePeriods.map((item) => (
          <div className="period-settings-row" key={item.key}>
            <strong>{item.label}</strong>
            <label>
              Start date
              <input
                type="date"
                value={dateRanges[item.key].start}
                onChange={(event) => updateDate(item.key, "start", event.target.value)}
                disabled={saving}
              />
            </label>
            <label>
              End date
              <input
                type="date"
                value={dateRanges[item.key].end}
                onChange={(event) => updateDate(item.key, "end", event.target.value)}
                disabled={saving}
              />
            </label>
          </div>
        ))}
        <div className="action-form-grid period-weight-grid">
          <label>
            Quiz weight
            <input type="number" defaultValue="20" min="0" max="100" />
          </label>
          <label>
            Assignment weight
            <input type="number" defaultValue="10" min="0" max="100" />
          </label>
          <label>
            Activity weight
            <input type="number" defaultValue="30" min="0" max="100" />
          </label>
          <label>
            Attendance weight
            <input type="number" defaultValue="5" min="0" max="100" />
          </label>
          <label>
            Exam weight
            <input type="number" defaultValue="35" min="0" max="100" />
          </label>
        </div>
        <p className="action-help">
          Workbook grading: Quiz 20%, Assignment 10%, Activity 30%, Attendance
          5%, Exam 35%, with transmutation from 1.00 to 5.00.
        </p>
      </div>
      {message.text && (
        <p className={`record-save-message ${message.status}`} role="status">
          {message.text}
        </p>
      )}
      <div className="action-modal-footer">
        <button className="outline-button" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="primary-button" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </ModalShell>
  );
}

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
                        {Number.isFinite(Number(grade)) ? Number(grade).toFixed(2) : "—"}
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
          <input type="number" defaultValue="20" min="0" max="100" />
        </label>
        <label>
          Assignment weight
          <input type="number" defaultValue="10" min="0" max="100" />
        </label>
        <label>
          Activity weight
          <input type="number" defaultValue="30" min="0" max="100" />
        </label>
        <label>
          Attendance weight
          <input type="number" defaultValue="5" min="0" max="100" />
        </label>
        <label>
          Exam weight
          <input type="number" defaultValue="35" min="0" max="100" />
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
