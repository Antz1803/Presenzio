import { useMemo, useState } from "react";
import { ModalShell } from "./ActionModalShell";

function defaultGroupCount(studentCount) {
  return String(Math.max(2, Math.min(6, Math.ceil((studentCount || 1) / 5))));
}

// Fisher-Yates shuffle — returns a new array, never mutates the input.
function shuffle(list) {
  const result = [...list];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

// Turns a shuffled array-of-arrays into the {studentId: groupNumber} shape
// used for saving and for the scoring assignment map.
function toAssignments(groupedLists) {
  const assignments = {};
  groupedLists.forEach((group, index) => {
    group.forEach((student) => {
      assignments[student.id] = index + 1;
    });
  });
  return assignments;
}

function formatSavedDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
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

// Mirrors assessmentItemLimits in useDashboardViewModel.js / AssessmentActions.jsx
// — keep these in sync so this never offers an item number the backend would
// reject.
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

/**
 * Box list — one card per saved grouping. Each box is a self-contained
 * activity: open it and it's already grouped and ready to score, whatever
 * day or grading period that turns out to be.
 */
function GroupBoxList({ savedGroups, onCreateNew, onOpenBox, onDeleteGroup, deletingId }) {
  const sorted = useMemo(
    () => [...savedGroups].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [savedGroups],
  );

  return (
    <>
      <p className="action-help">
        Each box below is a saved grouping for one activity. Open a box any time — the groups are
        already set, you just pick the category, period, and item to score it under.
      </p>
      <div className="action-modal-footer" style={{ justifyContent: "flex-start" }}>
        <button type="button" className="primary-button" onClick={onCreateNew}>
          + New grouping
        </button>
      </div>
      {sorted.length > 0 ? (
        <div className="assessment-question-list">
          {sorted.map((saved) => (
            <article className="assessment-question-card" key={saved.id}>
              <div className="assessment-question-header">
                <div>
                  <span>{formatSavedDate(saved.createdAt)}</span>
                  <strong>{saved.label}</strong>
                </div>
              </div>
             <p className="assessment-field-hint">
                {saved.groupCount} group{saved.groupCount === 1 ? "" : "s"} ·{" "}
                {Object.keys(saved.assignments || {}).length} student
                {Object.keys(saved.assignments || {}).length === 1 ? "" : "s"} assigned
                {saved.category && saved.period && saved.itemNo
                  ? ` · ${assessmentCategories.find((item) => item.key === saved.category)?.label ?? saved.category} · ${
                      assessmentPeriods.find((item) => item.key === saved.period)?.label ?? saved.period
                    } · ${categoryItemPrefixes[saved.category] ?? "Q"}${saved.itemNo}`
                  : ""}
              </p>
              <div className="action-modal-footer">
                <button
                  type="button"
                  className="outline-button"
                  disabled={deletingId === saved.id}
                  onClick={() => onDeleteGroup(saved.id)}
                >
                  {deletingId === saved.id ? "Removing…" : "Delete"}
                </button>
                <button type="button" className="primary-button" onClick={() => onOpenBox(saved)}>
                  Score this activity
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">No saved groupings yet — create one to get started.</div>
      )}
    </>
  );
}

/**
 * Create a new labeled grouping. Randomize (or hand-build via the score
 * view later) then save it as a box for later scoring.
 */
function CreateGroupingView({ students, onBack, onSaveGroup }) {
  const [groupCount, setGroupCount] = useState(() => defaultGroupCount(students.length));
  const [groups, setGroups] = useState([]);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("quiz");
  const [period, setPeriod] = useState("prelim");
  const [itemNo, setItemNo] = useState("1");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const updateCategory = (value) => {
    setCategory(value);
    const limit = assessmentItemLimits[value] ?? 4;
    setItemNo((current) => String(Math.min(Math.max(Number(current || 1), 1), limit)));
  };

  const randomize = () => {
    const count = Number(groupCount);
    if (!Number.isInteger(count) || count < 1) {
      setError("Enter a whole number of groups (1 or more).");
      return;
    }
    if (!students.length) {
      setError("This class has no students to group yet.");
      return;
    }
    setError("");
    const effectiveCount = Math.min(count, students.length);
    const shuffled = shuffle(students);
    const nextGroups = Array.from({ length: effectiveCount }, () => []);
    shuffled.forEach((student, index) => {
      nextGroups[index % effectiveCount].push(student);
    });
    setGroups(nextGroups);
  };

  const save = async () => {
    if (!groups.length) {
      setError("Randomize groups before saving.");
      return;
    }
    if (!label.trim()) {
      setError("Give this grouping a label (e.g. the activity name).");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSaveGroup({
        label: label.trim(),
        groupCount: groups.length,
        assignments: toAssignments(groups),
        category,
        period,
        itemNo: Number(itemNo),
      });
      onBack();
    } catch (err) {
      setError(err?.message || "Grouping could not be saved.");
      setSaving(false);
    }
  };

  return (
    <>
      <button type="button" className="outline-button" onClick={onBack} disabled={saving}>
        ← Back to groupings
      </button>
      <div className="action-form-grid" style={{ marginTop: "0.75rem" }}>
        <label>
          Activity label
          <input
            name="groupLabel"
            type="text"
            placeholder="e.g. Lab Activity 1"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            disabled={saving}
          />
        </label>
        <label>
          Number of groups
          <input
            name="groupCount"
            type="number"
            min="1"
            max={students.length || 1}
            value={groupCount}
            onChange={(event) => setGroupCount(event.target.value)}
            disabled={saving}
          />
        </label>
        <label>
          Type
          <select
            name="groupType"
            value={category}
            onChange={(event) => updateCategory(event.target.value)}
            disabled={saving}
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
          <select
            name="groupItemNo"
            value={itemNo}
            onChange={(event) => setItemNo(event.target.value)}
            disabled={saving}
          >
            {itemNoOptions(category).map((item) => (
              <option value={item.value} key={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Grading period
          <select
            name="groupPeriod"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            disabled={saving}
          >
            {assessmentPeriods.map((item) => (
              <option value={item.key} key={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="action-help">
        Splits your {students.length} enrolled student{students.length === 1 ? "" : "s"} into random,
        evenly-sized groups. Reshuffle as many times as you like before saving.
      </p>
      {error && (
        <p className="record-save-message error" role="status">
          {error}
        </p>
      )}
      {groups.length > 0 && (
        <div className="assessment-question-list">
          {groups.map((group, index) => (
            <article className="assessment-question-card" key={index}>
              <div className="assessment-question-header">
                <div>
                  <span>GROUP {index + 1}</span>
                  <strong>
                    {group.length} student{group.length === 1 ? "" : "s"}
                  </strong>
                </div>
              </div>
              <p className="assessment-field-hint">{group.map((student) => student.name).join(", ")}</p>
            </article>
          ))}
        </div>
      )}
      <div className="action-modal-footer">
        <button type="button" className="outline-button" onClick={onBack} disabled={saving}>
          Cancel
        </button>
        <button type="button" className="outline-button" onClick={randomize} disabled={saving}>
          {groups.length ? "Shuffle again" : "Randomize groups"}
        </button>
        <button type="button" className="primary-button" onClick={save} disabled={saving || !groups.length}>
          {saving ? "Saving…" : "Save box"}
        </button>
      </div>
    </>
  );
}

/**
 * Score view for one saved box. Groups are preloaded from the box's saved
 * assignments — category, period, item, and max score are chosen here at
 * scoring time, independent of when the box was created, so the same box
 * can be opened and scored whenever it's actually graded.
 *
 * saveAssessmentScores (the onSave action this calls) replaces the *entire*
 * category+period score grid on every save, not just one item — it deletes
 * every recorded score in that category+period first, then reinserts
 * whatever's in the `scores` map passed to it. To avoid silently wiping out
 * every other item/student's already-recorded scores, this component
 * pre-loads the existing grid from `assessmentScores` and only overlays the
 * group scores for the specific item being edited on top of it.
 */
function ScoreBoxView({ students, assessmentScores = [], box, onBack, onSave }) {
  const [category, setCategory] = useState(() => box.category || "quiz");
  const [period, setPeriod] = useState(() => box.period || "prelim");
  const [itemNo, setItemNo] = useState(() => (box.itemNo ? String(box.itemNo) : "1"));
  const [maxScore, setMaxScore] = useState("10");
  // studentId -> group number (1-based); seeded from the box, editable.
  const [assignments, setAssignments] = useState(() => ({ ...box.assignments }));
  const [groupCount, setGroupCount] = useState(String(box.groupCount || 1));
  // group number -> score string.
  const [groupScores, setGroupScores] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ status: "", text: "" });
  

  const sortedStudents = useMemo(
    () =>
      [...students].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }),
      ),
    [students],
  );

  const count = Math.max(1, Number(groupCount) || 1);
  const groupNumbers = Array.from({ length: count }, (_, index) => index + 1);
  const groupedCounts = groupNumbers.map(
    (number) => Object.values(assignments).filter((value) => value === number).length,
  );

  const existingGrid = useMemo(() => {
    const scoresByKey = {};
    const maxScoreByItem = {};
    assessmentScores
      .filter((row) => row.category === category && row.period?.code === period)
      .forEach((row) => {
        scoresByKey[`${row.enrollment_id}:${row.item_no}`] = String(row.score ?? "");
        maxScoreByItem[String(row.item_no)] = row.max_score;
      });
    return { scoresByKey, maxScoreByItem };
  }, [assessmentScores, category, period]);

  const updateCategory = (value) => {
    setCategory(value);
    const limit = assessmentItemLimits[value] ?? 4;
    setItemNo((current) => String(Math.min(Math.max(Number(current || 1), 1), limit)));
  };

  const assignStudent = (studentId, value) => {
    setAssignments((current) => ({
      ...current,
      [studentId]: value ? Number(value) : undefined,
    }));
  };

  const updateGroupScore = (groupNumber, value) => {
    setGroupScores((current) => ({ ...current, [groupNumber]: value }));
  };

  const validate = () => {
    const numericMax = Number(maxScore);
    if (!Number.isFinite(numericMax) || numericMax <= 0) {
      return "Enter a maximum score greater than 0.";
    }
    const hasAnyAssignment = Object.values(assignments).some(Boolean);
    if (!hasAnyAssignment) {
      return "This box has no group assignments to score.";
    }
    for (const number of groupNumbers) {
      if (!groupedCounts[number - 1]) continue;
      const rawScore = groupScores[number];
      if (rawScore === undefined || rawScore === "") {
        return `Enter a score for Group ${number}.`;
      }
      const numericScore = Number(rawScore);
      if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > numericMax) {
        return `Group ${number}'s score must be between 0 and ${numericMax}.`;
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
      const scores = { ...existingGrid.scoresByKey };
      Object.entries(assignments).forEach(([studentId, groupNumber]) => {
        if (!groupNumber) return;
        const score = groupScores[groupNumber];
        if (score === undefined || score === "") return;
        scores[`${studentId}:${itemNo}`] = score;
      });
      const maxScores = { ...existingGrid.maxScoreByItem, [itemNo]: Number(maxScore) };
      await onSave({ period, category, scores, maxScores });
      setMessage({ status: "success", text: "Group scores saved." });
    } catch (error) {
      setMessage({ status: "error", text: error?.message || "Group scores could not be saved." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="assessment-builder" onSubmit={save}>
      <button type="button" className="outline-button" onClick={onBack} disabled={saving}>
        ← Back to groupings
      </button>
      <p className="action-help" style={{ marginTop: "0.75rem" }}>
        Scoring <strong>{box.label}</strong> — groups are preloaded from this box. Pick whatever
        category, period, and item you're grading right now.
      </p>
      <div className="action-form-grid assessment-details-grid">
        <label>
          Type
          <select
            name="groupScoringCategory"
            value={category}
            onChange={(event) => updateCategory(event.target.value)}
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
          <select name="groupScoringItemNo" value={itemNo} onChange={(event) => setItemNo(event.target.value)}>
            {itemNoOptions(category).map((item) => (
              <option value={item.value} key={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Grading period
          <select name="groupScoringPeriod" value={period} onChange={(event) => setPeriod(event.target.value)}>
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
            name="groupScoringMaxScore"
            type="number"
            min="0.01"
            step="0.01"
            value={maxScore}
            onChange={(event) => setMaxScore(event.target.value)}
          />
        </label>
        <label>
          Number of groups
          <input
            name="groupScoringGroupCount"
            type="number"
            min="1"
            max={students.length || 1}
            value={groupCount}
            onChange={(event) => setGroupCount(event.target.value)}
          />
        </label>
      </div>

      <div className="assessment-question-list">
        {groupNumbers.map((number) => (
          <article className="assessment-question-card" key={number}>
            <div className="assessment-question-header">
              <div>
                <span>GROUP {number}</span>
                <strong>
                  {groupedCounts[number - 1]} student{groupedCounts[number - 1] === 1 ? "" : "s"}
                </strong>
              </div>
            </div>
            <div className="action-form-grid assessment-question-grid">
              <label>
                Group score
                <input
                  name={`groupScore-${number}`}
                  type="number"
                  min="0"
                  max={maxScore || undefined}
                  step="0.01"
                  value={groupScores[number] ?? ""}
                  placeholder={`out of ${maxScore || "?"}`}
                  disabled={!groupedCounts[number - 1] || saving}
                  onChange={(event) => updateGroupScore(number, event.target.value)}
                />
              </label>
            </div>
            {groupedCounts[number - 1] > 0 && (
              <p className="assessment-field-hint">
                {sortedStudents
                  .filter((student) => assignments[student.id] === number)
                  .map((student) => student.name)
                  .join(", ")}
              </p>
            )}
          </article>
        ))}
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
            {sortedStudents.map((student) => (
              <tr key={student.id}>
                <td>{student.name}</td>
                <td>
                  <select
                    name={`assign-${student.id}`}
                    value={assignments[student.id] ?? ""}
                    disabled={saving}
                    onChange={(event) => assignStudent(student.id, event.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {groupNumbers.map((number) => (
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
        {!sortedStudents.length && <div className="empty-state">No students are enrolled in this class.</div>}
      </div>

      {message.text && (
        <p className={`record-save-message ${message.status}`} role="status">
          {message.text}
        </p>
      )}
      <div className="action-modal-footer">
        <button type="button" className="outline-button" onClick={onBack} disabled={saving}>
          Back
        </button>
        <button type="submit" className="primary-button" disabled={saving}>
          {saving ? "Saving…" : "Save group scores"}
        </button>
      </div>
    </form>
  );
}

/**
 * Entry point: a modal with three internal views —
 *   list   → boxes of saved groupings (the default)
 *   create → build and label a new grouping, saved as a box
 *   score  → open one box, already grouped, ready to score any time
 */
function GroupActivities({ section, students, assessmentScores, savedGroups = [], onSaveGroup, onDeleteGroup, onSave, onClose }) {
  const [view, setView] = useState("list");
  const [activeBox, setActiveBox] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const openBox = (box) => {
    setActiveBox(box);
    setView("score");
  };

  const backToList = () => {
    setActiveBox(null);
    setView("list");
  };

  const deleteBox = async (id) => {
    if (!onDeleteGroup) return;
    setDeletingId(id);
    try {
      await onDeleteGroup(id);
    } finally {
      setDeletingId(null);
    }
  };

  const saveNewBox = async (payload) => onSaveGroup({ sectionId: section?.id, ...payload });

  const title =
    view === "create" ? "New Grouping" : view === "score" ? activeBox?.label || "Score Grouping" : "Group Activities";

  return (
    <ModalShell title={title} section={section} onClose={onClose} size="wide">
      {view === "list" && (
        <GroupBoxList
          savedGroups={savedGroups}
          onCreateNew={() => setView("create")}
          onOpenBox={openBox}
          onDeleteGroup={deleteBox}
          deletingId={deletingId}
        />
      )}
      {view === "create" && (
        <CreateGroupingView students={students} onBack={backToList} onSaveGroup={saveNewBox} />
      )}
      {view === "score" && activeBox && (
        <ScoreBoxView
          students={students}
          assessmentScores={assessmentScores}
          box={activeBox}
          onBack={backToList}
          onSave={onSave}
        />
      )}
    </ModalShell>
  );
}

export { GroupActivities };