import { useState } from "react";
import { formatDisplayDate } from "./actionUtils";

const scoreCategories = [
  { key: "quiz", label: "Quiz", prefix: "Q", count: 4 },
  { key: "assignment", label: "Assignment", prefix: "A", count: 4 },
  { key: "activity", label: "Graded activity", prefix: "G", count: 4 },
  { key: "exam", label: "Exam", prefix: "E", count: 1 },
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
            name="studentSearch"
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
          name="gradingPeriod"
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
                        name={`max-score-${activeCategory.key}-${itemNo}`}
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
                          name={`score-${category}-${student.id}-${itemNo}`}
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

export { ScoreForm };
