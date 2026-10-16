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
        className="inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onBack}
        disabled={saving}
      >
        ← Back to groupings
      </button>
      <div className="grid grid-cols-[repeat(2,1fr)] gap-3 [&.h-single]:grid-cols-[1fr] [&_label]:flex [&_label]:flex-col [&_label]:gap-1.5 [&_label]:text-ink-2 [&_label]:text-[10px] [&_label]:font-semibold [&_input]:w-full [&_input]:box-border [&_input]:border [&_input]:border-white/10 [&_input]:rounded-[7px] [&_input]:bg-surface-1 [&_input]:text-ink-2 [&_input]:p-[9px] [&_input]:text-[11px] [&_input]:outline-none [&_select]:w-full [&_select]:box-border [&_select]:border [&_select]:border-white/10 [&_select]:rounded-[7px] [&_select]:bg-surface-1 [&_select]:text-ink-2 [&_select]:p-[9px] [&_select]:text-[11px] [&_select]:outline-none [&_input:focus]:border-accent/30 [&_input:focus]:[box-shadow:0_0_0_3px_#162032] [&_select:focus]:border-accent/30 [&_select:focus]:[box-shadow:0_0_0_3px_#162032] max-[760px]:grid-cols-[repeat(2,1fr)] [.h-action-modal_&_label]:text-ink-2 [.h-action-modal_&_label]:text-[10px] [.h-action-modal_&_label]:tracking-[.1px] [.h-action-modal_&_input]:border-white/10 [.h-action-modal_&_input]:rounded-[9px] [.h-action-modal_&_input]:bg-surface-1 [.h-action-modal_&_input]:[box-shadow:0_2px_5px_rgba(0,240,255,0.01)] [.h-action-modal_&_input]:transition [.h-action-modal_&_select]:border-white/10 [.h-action-modal_&_select]:rounded-[9px] [.h-action-modal_&_select]:bg-surface-1 [.h-action-modal_&_select]:[box-shadow:0_2px_5px_rgba(0,240,255,0.01)] [.h-action-modal_&_select]:transition [.h-action-modal_&_input:hover]:border-accent/30 [.h-action-modal_&_select:hover]:border-accent/30 [.h-action-modal_&_input:focus]:border-accent/30 [.h-action-modal_&_input:focus]:[box-shadow:0_0_0_3px_#162032] [.h-action-modal_&_select:focus]:border-accent/30 [.h-action-modal_&_select:focus]:[box-shadow:0_0_0_3px_#162032]" style={{ marginTop: "0.75rem" }}>
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
      <p className="mt-[15px] mx-0 mb-0 text-ink-3 text-[10px] leading-[1.5] [.h-period-settings-list>&]:mt-0 [.h-period-settings-list>&]:mx-0 [.h-period-settings-list>&]:mb-1 [.h-period-settings-list>&]:py-[11px] [.h-period-settings-list>&]:px-[13px] [.h-period-settings-list>&]:border [.h-period-settings-list>&]:border-white/10 [.h-period-settings-list>&]:rounded-[9px] [.h-period-settings-list>&]:bg-surface-1 [.h-action-modal_&]:text-ink-3 [.h-action-modal_&]:leading-[1.65]">
        Splits your {students.length} enrolled student
        {students.length === 1 ? "" : "s"} into evenly-sized groups.
      </p>
      <div className="flex flex-col gap-[7px] p-[13px] border border-white/10 rounded-[11px] bg-surface-1 [&>label]:text-ink-2 [&>label]:text-[10px] [&>label]:font-bold [&_textarea]:box-border [&_textarea]:w-full [&_textarea]:[resize:vertical] [&_textarea]:border [&_textarea]:border-white/10 [&_textarea]:rounded-lg [&_textarea]:bg-surface-1 [&_textarea]:text-ink-2 [&_textarea]:p-[9px] [&_textarea]:font-medium [&_textarea]:text-[11px] [&_textarea]:font-display [&_textarea]:outline-none [&_textarea:focus]:border-accent/30 [&_textarea:focus]:[box-shadow:0_0_0_3px_#162032]">
        <label htmlFor="pasted-groups">Paste groups</label>
        <textarea
          id="pasted-groups"
          rows="6"
          value={pastedGroups}
          onChange={(event) => setPastedGroups(event.target.value)}
          placeholder={"Group 1\nMember name\nMember name\n\nGroup 2\nMember name"}
          disabled={saving}
        />
        <div className="flex items-center justify-between gap-3 [&_span]:text-ink-3 [&_span]:text-[9px] h-group-paste-footer">
          <span>Put one enrolled student name on each line under a Group heading.</span>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={applyPastedGroups}
            disabled={saving || !pastedGroups.trim()}
          >
            Use pasted groups
          </button>
        </div>
      </div>
      {error && (
        <p className="mt-0 mx-0 mb-3 py-[9px] px-[11px] rounded-[7px] text-[10px] [&.h-error]:border [&.h-error]:border-white/10 [&.h-error]:bg-surface-2 [&.h-error]:text-rose-300 [&.h-success]:border [&.h-success]:border-white/10 [&.h-success]:bg-surface-2 [&.h-success]:text-emerald-400 h-error" role="status">
          {error}
        </p>
      )}
      {groups.length > 0 && (
        <div className="[.h-assessment-manager-editor_&]:max-h-[475px] [.h-assessment-manager-editor_&]:overflow-auto [.h-assessment-manager-editor_&]:pt-0.5 [.h-assessment-manager-editor_&]:px-[3px] [.h-assessment-manager-editor_&]:pb-[3px] max-[760px]:[.h-assessment-manager-editor_&]:max-h-[none] flex flex-col gap-[13px]">
          {groups.map((group, index) => (
            <article className="[.h-assessment-manager-editor_&]:[box-shadow:none] [&_label]:flex [&_label]:flex-col [&_label]:gap-1.5 [&_label]:text-ink-2 [&_label]:text-[10px] [&_label]:font-bold [&_label>span:not(.h-choice-letter)]:text-ink-3 [&_label>span:not(.h-choice-letter)]:font-medium p-[17px] border border-white/10 rounded-[14px] bg-surface-1 [box-shadow:0_5px_16px_rgba(0,240,255,0.02)]" key={index}>
              <div className="flex items-start justify-between gap-2.5 mb-[13px] [&_div]:flex [&_div]:flex-col [&_div]:gap-1 [&_span]:text-accent [&_span]:text-[8px] [&_span]:font-extrabold [&_span]:tracking-[1.3px] [&_strong]:text-ink-2 [&_strong]:text-[12px]">
                <strong>GROUP {index + 1}</strong>
                <span>
                  {group.length} student{group.length === 1 ? "" : "s"}
                </span>
              </div>
              <p className="[grid-column:1/-1] m-0 text-ink-3 text-[9px] font-medium">
                {group.map((student) => student.name).join(", ")}
              </p>
            </article>
          ))}
        </div>
      )}
      <div className="flex justify-end gap-2 mt-5.5 pt-[17px] border-t border-white/10 max-[760px]:flex-wrap max-[760px]:[&_button]:flex-1 [.h-assessment-builder_&]:mt-0.5">
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onBack}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={randomize}
          disabled={saving}
        >
          {groups.length ? "Shuffle again" : "Randomize groups"}
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-canvas transition hover:shadow-halo active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={save}
          disabled={saving || !groups.length}
        >
          {saving ? "Saving…" : "Save box"}
        </button>
      </div>
    </>
  );
}
