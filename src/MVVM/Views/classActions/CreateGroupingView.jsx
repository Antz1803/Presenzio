import { useState } from "react";
import {
  assessmentCategories,
  assessmentPeriods,
  assessmentItemLimits,
  itemNoOptions,
} from "./assessmentConfig";
import {
  defaultGroupCount,
  parsePastedGroups,
  shuffle,
  toAssignments,
} from "./groupingUtils";

export function CreateGroupingView({ students, onBack, onSaveGroup }) {
  const [groupCount, setGroupCount] = useState(() =>
    defaultGroupCount(students.length),
  );
  const [groups, setGroups] = useState([]);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("quiz");
  const [period, setPeriod] = useState("prelim");
  const [itemNo, setItemNo] = useState("1");
  const [pastedGroups, setPastedGroups] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const updateCategory = (value) => {
    setCategory(value);
    const limit = assessmentItemLimits[value] ?? 4;
    setItemNo((current) =>
      String(Math.min(Math.max(Number(current || 1), 1), limit)),
    );
  };
  const randomize = () => {
    const count = Number(groupCount);
    if (!Number.isInteger(count) || count < 1)
      return setError("Enter a whole number of groups (1 or more).");
    if (!students.length)
      return setError("This class has no students to group yet.");
    const total = Math.min(count, students.length);
    const next = Array.from({ length: total }, () => []);
    shuffle(students).forEach((student, index) =>
      next[index % total].push(student),
    );
    setError("");
    setGroups(next);
  };
  const applyPastedGroups = () => {
    const parsed = parsePastedGroups(pastedGroups, students);
    if (!parsed.groups.length)
      return setError("Paste groups using headings such as Group 1 and Group 2.");
    if (parsed.emptyGroups.length)
      return setError(
        `Group ${parsed.emptyGroups.join(", ")} has no recognized members.`,
      );
    if (parsed.unmatched.length)
      return setError(
        `These names were not found in the roster: ${parsed.unmatched.join(", ")}`,
      );
    if (parsed.duplicates.length)
      return setError(
        `These students were listed more than once: ${parsed.duplicates.join(", ")}`,
      );
    setGroups(parsed.groups);
    setGroupCount(String(parsed.groups.length));
    setError("");
  };
  const save = async () => {
    if (!groups.length)
      return setError("Paste groups or randomize groups before saving.");
    if (!label.trim())
      return setError("Give this grouping a label (e.g. the activity name).");
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
      <button
        type="button"
        className="outline-button"
        onClick={onBack}
        disabled={saving}
      >
        ← Back to groupings
      </button>
      <div className="action-form-grid" style={{ marginTop: "0.75rem" }}>
        <label>
          Activity label
          <input
            name="groupLabel"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
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
            onChange={(e) => setGroupCount(e.target.value)}
            disabled={saving}
          />
        </label>
        <label>
          Type
          <select
            value={category}
            onChange={(e) => updateCategory(e.target.value)}
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
            value={itemNo}
            onChange={(e) => setItemNo(e.target.value)}
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
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
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
        Splits your {students.length} enrolled student
        {students.length === 1 ? "" : "s"} into evenly-sized groups.
      </p>
      <div className="group-paste-panel">
        <label htmlFor="pasted-groups">Paste groups</label>
        <textarea
          id="pasted-groups"
          rows="6"
          value={pastedGroups}
          onChange={(event) => setPastedGroups(event.target.value)}
          placeholder={"Group 1\nMember name\nMember name\n\nGroup 2\nMember name"}
          disabled={saving}
        />
        <div className="group-paste-footer">
          <span>Put one enrolled student name on each line under a Group heading.</span>
          <button
            type="button"
            className="outline-button"
            onClick={applyPastedGroups}
            disabled={saving || !pastedGroups.trim()}
          >
            Use pasted groups
          </button>
        </div>
      </div>
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
                <strong>GROUP {index + 1}</strong>
                <span>
                  {group.length} student{group.length === 1 ? "" : "s"}
                </span>
              </div>
              <p className="assessment-field-hint">
                {group.map((student) => student.name).join(", ")}
              </p>
            </article>
          ))}
        </div>
      )}
      <div className="action-modal-footer">
        <button
          type="button"
          className="outline-button"
          onClick={onBack}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          className="outline-button"
          onClick={randomize}
          disabled={saving}
        >
          {groups.length ? "Shuffle again" : "Randomize groups"}
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={save}
          disabled={saving || !groups.length}
        >
          {saving ? "Saving…" : "Save box"}
        </button>
      </div>
    </>
  );
}
