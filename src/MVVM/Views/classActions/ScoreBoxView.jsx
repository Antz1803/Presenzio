import { useMemo, useState } from "react";
import {
  assessmentCategories,
  assessmentPeriods,
  assessmentItemLimits,
  itemNoOptions,
} from "./assessmentConfig";

export function ScoreBoxView({
  students,
  assessmentScores = [],
  box,
  onBack,
  onSave,
}) {
  const [category, setCategory] = useState(box.category || "quiz");
  const [period, setPeriod] = useState(box.period || "prelim");
  const [itemNo, setItemNo] = useState(String(box.itemNo || 1));
  const [maxScore, setMaxScore] = useState("10");
  const [assignments, setAssignments] = useState({ ...box.assignments });
  const [groupCount, setGroupCount] = useState(String(box.groupCount || 1));
  const [groupScores, setGroupScores] = useState({});
  const [message, setMessage] = useState({ status: "", text: "" });
  const sorted = useMemo(
    () =>
      [...students].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [students],
  );
  const numbers = Array.from(
    { length: Math.max(1, Number(groupCount) || 1) },
    (_, index) => index + 1,
  );
  const existing = useMemo(() => {
    const scores = {};
    const maxScores = {};
    assessmentScores
      .filter((row) => row.category === category && row.period?.code === period)
      .forEach((row) => {
        scores[`${row.enrollment_id}:${row.item_no}`] = String(row.score ?? "");
        maxScores[String(row.item_no)] = row.max_score;
      });
    return { scores, maxScores };
  }, [assessmentScores, category, period]);
  const updateCategory = (value) => {
    setCategory(value);
    const limit = assessmentItemLimits[value] ?? 4;
    setItemNo((current) =>
      String(Math.min(Math.max(Number(current || 1), 1), limit)),
    );
  };
  const save = async (event) => {
    event.preventDefault();
    const max = Number(maxScore);
    if (!Number.isFinite(max) || max <= 0)
      return setMessage({
        status: "error",
        text: "Enter a maximum score greater than 0.",
      });
    if (!Object.values(assignments).some(Boolean))
      return setMessage({
        status: "error",
        text: "This box has no group assignments to score.",
      });
    for (const number of numbers) {
      const score = groupScores[number];
      if (
        Object.values(assignments).filter((group) => group === number).length &&
        (score === undefined ||
          score === "" ||
          Number(score) < 0 ||
          Number(score) > max)
      ) {
        return setMessage({
          status: "error",
          text: `Group ${number}'s score must be between 0 and ${max}.`,
        });
      }
    }
    const scores = { ...existing.scores };
    Object.entries(assignments).forEach(([studentId, group]) => {
      if (group && groupScores[group] !== undefined)
        scores[`${studentId}:${itemNo}`] = groupScores[group];
    });
    try {
      await onSave({
        period,
        category,
        scores,
        maxScores: { ...existing.maxScores, [itemNo]: max },
      });
      setMessage({ status: "success", text: "Group scores saved." });
    } catch (error) {
      setMessage({
        status: "error",
        text: error?.message || "Group scores could not be saved.",
      });
    }
  };
  return (
    <form className="assessment-builder" onSubmit={save}>
      <button type="button" className="outline-button" onClick={onBack}>
        ← Back to groupings
      </button>
      <p className="action-help">
        Scoring <strong>{box.label}</strong> — groups are preloaded from this
        box.
      </p>
      <div className="action-form-grid assessment-details-grid">
        <label>
          Type
          <select
            value={category}
            onChange={(e) => updateCategory(e.target.value)}
          >
            {assessmentCategories.map((item) => (
              <option value={item.key} key={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Item number
          <select value={itemNo} onChange={(e) => setItemNo(e.target.value)}>
            {itemNoOptions(category).map((item) => (
              <option value={item.value} key={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Grading period
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {assessmentPeriods.map((item) => (
              <option value={item.key} key={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Maximum score
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)}
          />
        </label>
        <label>
          Number of groups
          <input
            type="number"
            min="1"
            value={groupCount}
            onChange={(e) => setGroupCount(e.target.value)}
          />
        </label>
      </div>
      <div className="assessment-question-list">
        {numbers.map((number) => {
          const members = sorted.filter(
            (student) => assignments[student.id] === number,
          );
          return (
            <article className="assessment-question-card" key={number}>
              <div className="assessment-question-header">
                <strong>GROUP {number}</strong>
                <span>
                  {members.length} student{members.length === 1 ? "" : "s"}
                </span>
              </div>
              <label>
                Group score
                <input
                  type="number"
                  min="0"
                  max={maxScore}
                  step="0.01"
                  value={groupScores[number] ?? ""}
                  disabled={!members.length}
                  onChange={(e) =>
                    setGroupScores((current) => ({
                      ...current,
                      [number]: e.target.value,
                    }))
                  }
                />
              </label>
              <p className="assessment-field-hint">
                {members.map((student) => student.name).join(", ")}
              </p>
            </article>
          );
        })}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Group</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((student) => (
              <tr key={student.id}>
                <td>{student.name}</td>
                <td>
                  <select
                    value={assignments[student.id] ?? ""}
                    onChange={(e) =>
                      setAssignments((current) => ({
                        ...current,
                        [student.id]: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      }))
                    }
                  >
                    <option value="">Unassigned</option>
                    {numbers.map((number) => (
                      <option value={number} key={number}>
                        Group {number}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {message.text && (
        <p className={`record-save-message ${message.status}`} role="status">
          {message.text}
        </p>
      )}
      <div className="action-modal-footer">
        <button type="button" className="outline-button" onClick={onBack}>
          Back
        </button>
        <button type="submit" className="primary-button">
          Save group scores
        </button>
      </div>
    </form>
  );
}
