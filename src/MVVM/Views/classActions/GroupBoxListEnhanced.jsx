import { useMemo, useState } from "react";
import {
  assessmentCategories,
  assessmentPeriods,
  categoryItemPrefixes,
} from "./assessmentConfig";
import { formatSavedDate } from "./groupingUtils";

export function GroupBoxListEnhanced({
  savedGroups,
  onCreateNew,
  onOpenBox,
  onDeleteGroup,
  onUpdateGroup,
  deletingId,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");
  const sorted = useMemo(
    () =>
      [...savedGroups].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      ),
    [savedGroups],
  );
  const beginEdit = (saved) => {
    setError("");
    setEditingId(saved.id);
    setEditingTitle(saved.label);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditingTitle("");
  };
  const saveTitle = async (saved) => {
    const label = editingTitle.trim();
    if (!label) return setError("The activity title cannot be empty.");
    setSavingId(saved.id);
    setError("");
    try {
      await onUpdateGroup?.({ groupId: saved.id, label });
      cancelEdit();
    } catch (saveError) {
      setError(saveError?.message || "The activity title could not be saved.");
    } finally {
      setSavingId(null);
    }
  };
  return (
    <>
      <div className="flex items-center justify-between gap-5 mb-4.5 py-4.5 px-5 border border-white/10 rounded-[15px] bg-surface-2 [&_h3]:mt-[5px] [&_h3]:mx-0 [&_h3]:mb-0 [&_h3]:text-ink-2 [&_h3]:text-[15px] [&_p]:mt-[5px] [&_p]:mx-0 [&_p]:mb-0 [&_p]:text-ink-3 [&_p]:text-[10px] max-[600px]:items-stretch max-[600px]:flex-col group-list-intro">
        <div>
          <span className="text-accent text-[8px] font-extrabold tracking-[1.5px]">GROUP WORKSPACE</span>
          <h3>Organize, rename, and score your activities</h3>
          <p>Open a saved group set to record scores or update its title.</p>
        </div>
        <button type="button" className="inline-flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-canvas transition hover:shadow-halo active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50" onClick={onCreateNew}>
          + New grouping
        </button>
      </div>
      {error && <p className="mt-0 mx-0 mb-3 py-[9px] px-[11px] rounded-[7px] text-[10px] [&.error]:border [&.error]:border-white/10 [&.error]:bg-surface-2 [&.error]:text-rose-300 [&.success]:border [&.success]:border-white/10 [&.success]:bg-surface-2 [&.success]:text-emerald-400 error" role="status">{error}</p>}
      {sorted.length ? (
        <div className="grid flex-col gap-3.5 grid-cols-[repeat(2,_minmax(0,_1fr))] max-[820px]:grid-cols-[1fr]">
          {sorted.map((saved) => {
            const count = Object.keys(saved.assignments || {}).length;
            const type = assessmentCategories.find((item) => item.key === saved.category)?.label;
            const period = assessmentPeriods.find((item) => item.key === saved.period)?.label;
            const isEditing = editingId === saved.id;
            const isSaving = savingId === saved.id;
            return (
              <article className="p-[19px] border border-white/10 rounded-[15px] bg-surface-2 [box-shadow:0_5px_16px_rgba(0,240,255,0.02)] transition relative flex min-h-[205px] flex-col overflow-hidden hover:border-accent/30 hover:[box-shadow:0_9px_22px_rgba(0,240,255,0.04)] hover:[transform:translateY(-1px)] [&::before]:absolute [&::before]:[top:0] [&::before]:[right:0] [&::before]:[left:0] [&::before]:h-[3px] [&::before]:[background:linear-gradient(90deg,_#00F0FF,_#0F172A)] [&::before]:[content:''] [&:nth-child(3n+2)]:bg-surface-2 [&:nth-child(3n+2)::before]:[background:linear-gradient(90deg,_#0F172A,_#00F0FF)] [&:nth-child(3n)]:bg-surface-2 [&:nth-child(3n)::before]:[background:linear-gradient(90deg,_#162032,_#00F0FF)]" key={saved.id}>
                <div className="flex items-start justify-between gap-4 min-h-[62px] max-[600px]:flex-col">
                  <div className="min-w-0 [&_h3]:m-0 [&_h3]:text-ink-2 [&_h3]:text-[14px]">
                    <span className="block mb-[5px] text-accent text-[8px] font-extrabold tracking-[1.2px] uppercase">{formatSavedDate(saved.createdAt)}</span>
                    {isEditing ? (
                      <input
                        className="box-border w-[min(100%,430px)] border border-accent/30 rounded-lg bg-surface-1 text-ink-2 py-[7px] px-[9px] font-bold text-[14px] font-display outline-none [box-shadow:0_0_0_3px_#162032]"
                        value={editingTitle}
                        onChange={(event) => setEditingTitle(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void saveTitle(saved);
                          if (event.key === "Escape") cancelEdit();
                        }}
                        autoFocus
                        disabled={isSaving}
                      />
                    ) : (
                      <h3>{saved.label}</h3>
                    )}
                  </div>
                  <span className="shrink-0 py-1.5 px-[9px] rounded-lg bg-surface-2 text-accent text-[9px] font-extrabold max-[600px]:self-start">{saved.groupCount} groups</span>
                </div>
                <div className="flex items-center flex-wrap gap-[7px] mt-[11px] text-ink-3 text-[9px] min-h-[30px] [align-content:flex-start] [&_i]:w-[3px] [&_i]:h-[3px] [&_i]:rounded-[50%] [&_i]:bg-surface-3">
                  <span>{count} students assigned</span>
                  {type && period && (
                    <>
                      <i /> <span>{type}</span><i /> <span>{period}</span><i />
                      <span>{categoryItemPrefixes[saved.category] ?? "Q"}{saved.itemNo}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center justify-end flex-wrap gap-2 [margin-top:auto] pt-[15px] border-t border-white/10 max-[600px]:justify-start group-box-actions">
                  {isEditing ? (
                    <>
                      <button type="button" className="inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50" onClick={cancelEdit} disabled={isSaving}>Cancel</button>
                      <button type="button" className="inline-flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-canvas transition hover:shadow-halo active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void saveTitle(saved)} disabled={isSaving}>
                        {isSaving ? "Saving..." : "Save title"}
                      </button>
                    </>
                  ) : (
                    <button type="button" className="inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => beginEdit(saved)}>Edit title</button>
                  )}
                  <button type="button" className="inline-flex items-center justify-center gap-2 rounded border border-rose-400/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-rose-300 transition hover:border-rose-400 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50" disabled={deletingId === saved.id || isSaving} onClick={() => onDeleteGroup(saved.id)}>
                    {deletingId === saved.id ? "Removing..." : "Delete"}
                  </button>
                  <button type="button" className="[.group-box-actions_&]:py-[9px] [.group-box-actions_&]:px-3 [.group-box-actions_&]:text-[10px] inline-flex items-center gap-2.5 border border-accent rounded-lg bg-accent text-[11px] font-bold [box-shadow:0_5px_12px_rgba(0,240,255,0.09)] transition [margin-left:auto] text-canvas hover:bg-accent hover:[box-shadow:0_8px_17px_rgba(0,240,255,0.12)] hover:[transform:translateY(-1px)] [&_span]:text-[14px] [&_span]:leading-[1] disabled:cursor-not-allowed disabled:opacity-55 disabled:[transform:none] max-[600px]:ml-0" onClick={() => onOpenBox(saved)} disabled={isEditing || isSaving}>
                    Score activity <span aria-hidden="true">-&gt;</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="py-8 text-center text-xs text-ink-3">No saved groupings yet - create one to get started.</div>
      )}
    </>
  );
}
