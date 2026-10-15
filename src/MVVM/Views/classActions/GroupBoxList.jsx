import { useMemo } from "react";
import {
  assessmentCategories,
  assessmentPeriods,
  categoryItemPrefixes,
} from "./assessmentConfig";
import { formatSavedDate } from "./groupingUtils";

export function GroupBoxList({
  savedGroups,
  onCreateNew,
  onOpenBox,
  onDeleteGroup,
  deletingId,
}) {
  const sorted = useMemo(
    () =>
      [...savedGroups].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      ),
    [savedGroups],
  );
  return (
    <>
      <p className="mt-[15px] mx-0 mb-0 text-ink-3 text-[10px] leading-[1.5] [.period-settings-list>&]:mt-0 [.period-settings-list>&]:mx-0 [.period-settings-list>&]:mb-1 [.period-settings-list>&]:py-[11px] [.period-settings-list>&]:px-[13px] [.period-settings-list>&]:border [.period-settings-list>&]:border-white/10 [.period-settings-list>&]:rounded-[9px] [.period-settings-list>&]:bg-surface-1 [.action-modal_&]:text-ink-3 [.action-modal_&]:leading-[1.65]">
        Each box is a saved grouping. Open one to score it under any category,
        period, or item.
      </p>
      <div
        className="flex justify-end gap-2 mt-5.5 pt-[17px] border-t border-white/10 max-[760px]:flex-wrap max-[760px]:[&_button]:flex-1 [.assessment-builder_&]:mt-0.5"
        style={{ justifyContent: "flex-start" }}
      >
        <button type="button" className="inline-flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-canvas transition hover:shadow-halo active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50" onClick={onCreateNew}>
          + New grouping
        </button>
      </div>
      {sorted.length ? (
        <div className="[.assessment-manager-editor_&]:max-h-[475px] [.assessment-manager-editor_&]:overflow-auto [.assessment-manager-editor_&]:pt-0.5 [.assessment-manager-editor_&]:px-[3px] [.assessment-manager-editor_&]:pb-[3px] max-[760px]:[.assessment-manager-editor_&]:max-h-[none] flex flex-col gap-[13px]">
          {sorted.map((saved) => {
            const count = Object.keys(saved.assignments || {}).length;
            const type = assessmentCategories.find(
              (item) => item.key === saved.category,
            )?.label;
            const period = assessmentPeriods.find(
              (item) => item.key === saved.period,
            )?.label;
            return (
              <article className="[.assessment-manager-editor_&]:[box-shadow:none] [&_label]:flex [&_label]:flex-col [&_label]:gap-1.5 [&_label]:text-ink-2 [&_label]:text-[10px] [&_label]:font-bold [&_label>span:not(.choice-letter)]:text-ink-3 [&_label>span:not(.choice-letter)]:font-medium p-[17px] border border-white/10 rounded-[14px] bg-surface-1 [box-shadow:0_5px_16px_rgba(0,240,255,0.02)]" key={saved.id}>
                <div className="flex items-start justify-between gap-2.5 mb-[13px] [&_div]:flex [&_div]:flex-col [&_div]:gap-1 [&_span]:text-accent [&_span]:text-[8px] [&_span]:font-extrabold [&_span]:tracking-[1.3px] [&_strong]:text-ink-2 [&_strong]:text-[12px]">
                  <div>
                    <span>{formatSavedDate(saved.createdAt)}</span>
                    <strong>{saved.label}</strong>
                  </div>
                </div>
                <p className="[grid-column:1/-1] m-0 text-ink-3 text-[9px] font-medium">
                  {saved.groupCount} group{saved.groupCount === 1 ? "" : "s"} ·{" "}
                  {count} student{count === 1 ? "" : "s"} assigned
                  {type && period
                    ? ` · ${type} · ${period} · ${categoryItemPrefixes[saved.category] ?? "Q"}${saved.itemNo}`
                    : ""}
                </p>
                <div className="flex justify-end gap-2 mt-5.5 pt-[17px] border-t border-white/10 max-[760px]:flex-wrap max-[760px]:[&_button]:flex-1 [.assessment-builder_&]:mt-0.5">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={deletingId === saved.id}
                    onClick={() => onDeleteGroup(saved.id)}
                  >
                    {deletingId === saved.id ? "Removing…" : "Delete"}
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-canvas transition hover:shadow-halo active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => onOpenBox(saved)}
                  >
                    Score this activity
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="py-8 text-center text-xs text-ink-3">
          No saved groupings yet — create one to get started.
        </div>
      )}
    </>
  );
}
