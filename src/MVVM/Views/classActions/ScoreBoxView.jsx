import { useMemo, useState } from "react";
import {
  assessmentCategories,
  assessmentPeriods,
  assessmentItemLimits,
  itemNoOptions,
} from "./assessmentConfig";
import { parsePastedGroups } from "./groupingUtils";

export function ScoreBoxView({
  students,
  assessmentScores = [],
  box,
  onBack,
  onUpdateGroup,
  onSave,
}) {
  const [category, setCategory] = useState(box.category || "quiz");
  const [period, setPeriod] = useState(box.period || "prelim");
  const [itemNo, setItemNo] = useState(String(box.itemNo || 1));
  const [maxScoreOverrides, setMaxScoreOverrides] = useState({});
  const [assignments, setAssignments] = useState({ ...box.assignments });
  const [groupCount, setGroupCount] = useState(String(box.groupCount || 1));
  const [groupScoreOverrides, setGroupScoreOverrides] = useState({});
  const [additionalGroupPaste, setAdditionalGroupPaste] = useState("");
  const [showAdditionalGroup, setShowAdditionalGroup] = useState(false);
  const [message, setMessage] = useState({ status: "", text: "" });
  const [copying, setCopying] = useState(false);
  const [saving, setSaving] = useState(false);
  const sorted = useMemo(
    () =>
      [...students].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [students],
  );
  const numbers = useMemo(
    () =>
      Array.from(
        { length: Math.max(1, Number(groupCount) || 1) },
        (_, index) => index + 1,
      ),
    [groupCount],
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
  const slotKey = `${category}:${period}:${itemNo}`;
  const savedGroupScores = useMemo(() => {
    const savedGroupScores = {};
    numbers.forEach((number) => {
      const members = Object.entries(assignments)
        .filter(([, group]) => group === number)
        .map(([studentId]) => studentId);
      const savedScore = members
        .map((studentId) => existing.scores[`${studentId}:${itemNo}`])
        .find((score) => score !== undefined);
      if (savedScore !== undefined) savedGroupScores[number] = savedScore;
    });
    return savedGroupScores;
  }, [assignments, existing, itemNo, numbers]);
  const groupScores = {
    ...savedGroupScores,
    ...(groupScoreOverrides[slotKey] ?? {}),
  };
  const maxScore =
    maxScoreOverrides[slotKey] ??
    String(box.maxScore ?? existing.maxScores[String(itemNo)] ?? "10");
  const copyGroups = async () => {
    const text = numbers
      .map((number) => {
        const members = sorted.filter(
          (student) => assignments[student.id] === number,
        );
        return [`Group ${number}`, ...members.map((student) => student.name)].join("\n");
      })
      .join("\n\n");
    try {
      setCopying(true);
      await navigator.clipboard.writeText(text);
      setMessage({ status: "success", text: "Group format copied to the clipboard." });
    } catch {
      setMessage({ status: "error", text: "Could not copy the group format. Check browser clipboard permissions." });
    } finally {
      setCopying(false);
    }
  };
  const saveAssignments = async () => {
    if (!onUpdateGroup || !box.id) return;
    const max = Number(maxScore);
    if (!Number.isFinite(max) || max <= 0) {
      setMessage({
        status: "error",
        text: "Enter a maximum score greater than 0.",
      });
      return;
    }
    setSaving(true);
    setMessage({ status: "", text: "" });
    try {
      await onUpdateGroup({
        groupId: box.id,
        assignments,
        groupCount: Number(groupCount) || 1,
        category,
        period,
        itemNo: Number(itemNo) || 1,
        maxScore: max,
      });
      setMessage({ status: "success", text: "Group assignments saved." });
    } catch (error) {
      setMessage({
        status: "error",
        text: error?.message || "Group assignments could not be saved.",
      });
    } finally {
      setSaving(false);
    }
  };
  const addPastedGroup = () => {
    const value = additionalGroupPaste.trim();
    if (!value) {
      setMessage({ status: "error", text: "Paste at least one student name." });
      return;
    }
    const nextGroup = numbers.length + 1;
    const source = /^group\s+\d+\s*:?$/im.test(value)
      ? value
      : `Group ${nextGroup}\n${value}`;
    const parsed = parsePastedGroups(source, students);
    if (parsed.groups.length !== 1) {
      setMessage({ status: "error", text: "Add one group at a time." });
      return;
    }
    if (parsed.emptyGroups.length || parsed.unmatched.length) {
      setMessage({
        status: "error",
        text: parsed.unmatched.length
          ? `These names were not found in the roster: ${parsed.unmatched.join(", ")}`
          : "The new group has no recognized members.",
      });
      return;
    }
    if (parsed.duplicates.length) {
      setMessage({
        status: "error",
        text: `These students were listed more than once: ${parsed.duplicates.join(", ")}`,
      });
      return;
    }
    const alreadyAssigned = new Set(
      Object.entries(assignments)
        .filter(([, group]) => group)
        .map(([studentId]) => studentId),
    );
    const overlap = parsed.groups[0].filter((student) =>
      alreadyAssigned.has(student.id),
    );
    if (overlap.length) {
      setMessage({
        status: "error",
        text: `These students are already assigned: ${overlap
          .map((student) => student.name)
          .join(", ")}`,
      });
      return;
    }
    setAssignments((current) => ({
      ...current,
      ...Object.fromEntries(parsed.groups[0].map((student) => [student.id, nextGroup])),
    }));
    setGroupCount(String(nextGroup));
    setAdditionalGroupPaste("");
    setShowAdditionalGroup(false);
    setMessage({ status: "success", text: `Group ${nextGroup} added.` });
  };
  const updateCategory = (value) => {
    setCategory(value);
    const limit = assessmentItemLimits[value] ?? 4;
    setItemNo((current) =>
      String(Math.min(Math.max(Number(current || 1), 1), limit)),
    );
  };
  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
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
    setSaving(true);
    setMessage({ status: "", text: "" });
    try {
      await onSave({
        period,
        category,
        scores,
        maxScores: { ...existing.maxScores, [itemNo]: max },
      });
      await onUpdateGroup?.({ groupId: box.id, maxScore: max });
      onBack();
    } catch (error) {
      setMessage({
        status: "error",
        text: error?.message || "Group scores could not be saved.",
      });
      setSaving(false);
    }
  };
  return (
    <form className="flex flex-col gap-4 [&_textarea]:box-border [&_textarea]:w-full [&_textarea]:[resize:vertical] [&_textarea]:border [&_textarea]:border-white/10 [&_textarea]:rounded-[9px] [&_textarea]:bg-surface-1 [&_textarea]:text-ink-2 [&_textarea]:p-2.5 [&_textarea]:font-medium [&_textarea]:text-[11px] [&_textarea]:font-display [&_textarea]:outline-none [&_textarea:focus]:border-accent/30 [&_textarea:focus]:[box-shadow:0_0_0_3px_#162032] h-assessment-builder gap-3.5" onSubmit={save}>
      <div className="sticky [top:10px] z-5 flex items-center justify-between gap-3 py-2.5 px-3 border border-white/10 rounded-[14px] bg-surface-1 [box-shadow:0_10px_24px_rgba(0,240,255,0.05)] [backdrop-filter:blur(12px)] max-[680px]:items-stretch max-[680px]:flex-col max-[680px]:[&>button]:w-full h-score-box-toolbar">
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onBack}
          disabled={saving}
        >
          ← Back to groupings
        </button>
        <div className="flex items-center justify-end gap-2 flex-wrap max-[680px]:[justify-content:stretch] max-[680px]:[&_button]:flex-1">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void copyGroups()}
            disabled={saving || copying}
          >
            {copying ? "Copying..." : "Copy groups"}
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void saveAssignments()}
            disabled={saving || copying}
          >
            {saving ? "Saving..." : "Save assignments & settings"}
          </button>
          <button type="submit" className="inline-flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-canvas transition hover:shadow-halo active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50" disabled={saving || copying}>
            {saving && <span className="inline-block w-[11px] h-[11px] border-2 border-white/10 border-t-white/10 rounded-[50%] [animation:button-spin_.7s_linear_infinite]" aria-hidden="true" />}
            {saving ? "Saving..." : "Save group scores"}
          </button>
        </div>
      </div>
      <button
        type="button"
        className="inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50 hidden!"
        onClick={onBack}
        disabled={saving}
      >
        ← Back to groupings
      </button>
      <p className="mt-[15px] mx-0 mb-0 text-ink-3 text-[10px] leading-[1.5] [.h-period-settings-list>&]:mt-0 [.h-period-settings-list>&]:mx-0 [.h-period-settings-list>&]:mb-1 [.h-period-settings-list>&]:py-[11px] [.h-period-settings-list>&]:px-[13px] [.h-period-settings-list>&]:border [.h-period-settings-list>&]:border-white/10 [.h-period-settings-list>&]:rounded-[9px] [.h-period-settings-list>&]:bg-surface-1 [.h-action-modal_&]:text-ink-3 [.h-action-modal_&]:leading-[1.65]">
        Scoring <strong>{box.label}</strong> — groups are preloaded from this
        box.
      </p>
      <button
        type="button"
        className="inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50 hidden!"
        onClick={() => void copyGroups()}
        disabled={saving || copying}
      >
        {copying ? "Copying..." : "Copy groups"}
      </button>
      <button
        type="button"
        className="inline-flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-canvas transition hover:shadow-halo active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 hidden!"
        onClick={() => void saveAssignments()}
        disabled={saving || copying}
      >
        {saving ? "Saving..." : "Save assignments & settings"}
      </button>
      <div className="grid grid-cols-[repeat(2,1fr)] gap-3 [&.h-single]:grid-cols-[1fr] [&_label]:flex [&_label]:flex-col [&_label]:gap-1.5 [&_label]:text-ink-2 [&_label]:text-[10px] [&_label]:font-semibold [&_input]:w-full [&_input]:box-border [&_input]:border [&_input]:border-white/10 [&_input]:rounded-[7px] [&_input]:bg-surface-1 [&_input]:text-ink-2 [&_input]:p-[9px] [&_input]:text-[11px] [&_input]:outline-none [&_select]:w-full [&_select]:box-border [&_select]:border [&_select]:border-white/10 [&_select]:rounded-[7px] [&_select]:bg-surface-1 [&_select]:text-ink-2 [&_select]:p-[9px] [&_select]:text-[11px] [&_select]:outline-none [&_input:focus]:border-accent/30 [&_input:focus]:[box-shadow:0_0_0_3px_#162032] [&_select:focus]:border-accent/30 [&_select:focus]:[box-shadow:0_0_0_3px_#162032] max-[760px]:grid-cols-[repeat(2,1fr)] [.h-action-modal_&_label]:text-ink-2 [.h-action-modal_&_label]:text-[10px] [.h-action-modal_&_label]:tracking-[.1px] [.h-action-modal_&_input]:border-white/10 [.h-action-modal_&_input]:rounded-[9px] [.h-action-modal_&_input]:bg-surface-1 [.h-action-modal_&_input]:[box-shadow:0_2px_5px_rgba(0,240,255,0.01)] [.h-action-modal_&_input]:transition [.h-action-modal_&_select]:border-white/10 [.h-action-modal_&_select]:rounded-[9px] [.h-action-modal_&_select]:bg-surface-1 [.h-action-modal_&_select]:[box-shadow:0_2px_5px_rgba(0,240,255,0.01)] [.h-action-modal_&_select]:transition [.h-action-modal_&_input:hover]:border-accent/30 [.h-action-modal_&_select:hover]:border-accent/30 [.h-action-modal_&_input:focus]:border-accent/30 [.h-action-modal_&_input:focus]:[box-shadow:0_0_0_3px_#162032] [.h-action-modal_&_select:focus]:border-accent/30 [.h-action-modal_&_select:focus]:[box-shadow:0_0_0_3px_#162032] grid-cols-[minmax(0,2fr)_minmax(130px,1fr)_minmax(130px,1fr)] max-[760px]:grid-cols-[1fr]">
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
                  onChange={(e) =>
                    setMaxScoreOverrides((current) => ({
                      ...current,
                      [slotKey]: e.target.value,
                    }))
                  }
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
      <div className="flex justify-end mt-0.5 mx-0 mb-1 h-score-box-add-group">
        {!showAdditionalGroup ? (
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              setShowAdditionalGroup(true);
              setMessage({ status: "", text: "" });
            }}
            disabled={saving || copying}
          >
            + Add group
          </button>
        ) : (
          <div className="grid gap-2.5 mt-3 p-3.5 border border-white/10 rounded-[14px] bg-surface-1 [&_textarea]:min-h-[92px] [.h-score-box-add-group_&]:w-full">
            <label htmlFor="score-box-additional-group">
              Paste another group
            </label>
            <textarea
              id="score-box-additional-group"
              rows="4"
              value={additionalGroupPaste}
              onChange={(event) => setAdditionalGroupPaste(event.target.value)}
              placeholder={`Group ${numbers.length + 1}\nStudent name\nStudent name`}
              disabled={saving || copying}
            />
            <div className="flex items-center justify-between gap-3 [&_span]:text-ink-3 [&_span]:text-[9px] h-group-paste-footer">
              <span>Paste one student name per line. The new group is saved with the assignments.</span>
              <div className="flex items-center gap-2 flex-wrap max-[680px]:w-full max-[680px]:[&_button]:flex-1 h-group-add-actions">
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => {
                    setShowAdditionalGroup(false);
                    setAdditionalGroupPaste("");
                  }}
                  disabled={saving || copying}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-canvas transition hover:shadow-halo active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={addPastedGroup}
                  disabled={saving || copying || !additionalGroupPaste.trim()}
                >
                  Add this group
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="[.h-assessment-manager-editor_&]:max-h-[475px] [.h-assessment-manager-editor_&]:overflow-auto [.h-assessment-manager-editor_&]:pt-0.5 [.h-assessment-manager-editor_&]:px-[3px] [.h-assessment-manager-editor_&]:pb-[3px] max-[760px]:[.h-assessment-manager-editor_&]:max-h-[none] flex flex-col gap-[13px]">
        {numbers.map((number) => {
          const members = sorted.filter(
            (student) => assignments[student.id] === number,
          );
          return (
            <article className="[.h-assessment-manager-editor_&]:[box-shadow:none] [&_label]:flex [&_label]:flex-col [&_label]:gap-1.5 [&_label]:text-ink-2 [&_label]:text-[10px] [&_label]:font-bold [&_label>span:not(.h-choice-letter)]:text-ink-3 [&_label>span:not(.h-choice-letter)]:font-medium p-[17px] border border-white/10 rounded-[14px] bg-surface-1 [box-shadow:0_5px_16px_rgba(0,240,255,0.02)]" key={number}>
              <div className="flex items-start justify-between gap-2.5 mb-[13px] [&_div]:flex [&_div]:flex-col [&_div]:gap-1 [&_span]:text-accent [&_span]:text-[8px] [&_span]:font-extrabold [&_span]:tracking-[1.3px] [&_strong]:text-ink-2 [&_strong]:text-[12px]">
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
                    setGroupScoreOverrides((current) => ({
                      ...current,
                      [slotKey]: {
                        ...(current[slotKey] ?? {}),
                        [number]: e.target.value,
                      },
                    }))
                  }
                />
              </label>
              <p className="[grid-column:1/-1] m-0 text-ink-3 text-[9px] font-medium">
                {members.map((student) => student.name).join(", ")}
              </p>
            </article>
          );
        })}
      </div>
      <div className="overflow-x-auto [&_table]:[border-collapse:collapse] [&_table]:w-full [&_table]:min-w-[660px] [&_table]:text-left [&_th]:text-ink-3 [&_th]:bg-surface-2 [&_th]:text-[9px] [&_th]:font-semibold [&_th]:tracking-[.6px] [&_th]:py-[11px] [&_th]:px-5 [&_th]:border-b [&_th]:border-white/10 [&_th]:border-b-white/10 [&_td]:text-ink-2 [&_td]:text-[10px] [&_td]:py-3.5 [&_td]:px-5 [&_td]:border-b [&_td]:border-white/10 [&_td]:whitespace-nowrap [&_td]:border-b-white/10 [&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:hover]:bg-surface-1 [.h-action-modal_&_th]:bg-surface-2 [.h-action-modal_&_th]:text-ink-3 [.h-action-modal_&_th]:border-b-white/10 [.h-action-modal_&_th]:text-[9px] [.h-action-modal_&_th]:tracking-[.8px] [.h-action-modal_&_td]:text-ink-2 [.h-action-modal_&_td]:border-b-white/10 [.h-action-modal_&_tbody_tr:nth-child(even)]:bg-surface-1 [.h-action-modal_&_tbody_tr:hover]:bg-surface-2">
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
        <p className={`mt-0 mx-0 mb-3 py-[9px] px-[11px] rounded-[7px] text-[10px] [&.h-error]:border [&.h-error]:border-white/10 [&.h-error]:bg-surface-2 [&.h-error]:text-rose-300 [&.h-success]:border [&.h-success]:border-white/10 [&.h-success]:bg-surface-2 [&.h-success]:text-emerald-400 ${message.status}`} role="status">
          {message.text}
        </p>
      )}
      <div className="flex justify-end gap-2 mt-5.5 pt-[17px] border-t border-white/10 max-[760px]:flex-wrap max-[760px]:[&_button]:flex-1 [.h-assessment-builder_&]:mt-0.5 hidden!">
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onBack}
          disabled={saving}
        >
          Back
        </button>
        <button type="submit" className="inline-flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-canvas transition hover:shadow-halo active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50" disabled={saving}>
          {saving && <span className="inline-block w-[11px] h-[11px] border-2 border-white/10 border-t-white/10 rounded-[50%] [animation:button-spin_.7s_linear_infinite]" aria-hidden="true" />}
          {saving ? "Saving..." : "Save group scores"}
        </button>
      </div>
    </form>
  );
}
