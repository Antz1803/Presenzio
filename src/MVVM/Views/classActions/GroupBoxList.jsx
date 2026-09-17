import { useMemo } from "react";
import { assessmentCategories, assessmentPeriods, categoryItemPrefixes } from "./assessmentConfig";
import { formatSavedDate } from "./groupingUtils";

export function GroupBoxList({ savedGroups, onCreateNew, onOpenBox, onDeleteGroup, deletingId }) {
  const sorted = useMemo(
    () => [...savedGroups].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [savedGroups],
  );
  return (
    <>
      <p className="action-help">Each box is a saved grouping. Open one to score it under any category, period, or item.</p>
      <div className="action-modal-footer" style={{ justifyContent: "flex-start" }}>
        <button type="button" className="primary-button" onClick={onCreateNew}>+ New grouping</button>
      </div>
      {sorted.length ? <div className="assessment-question-list">
        {sorted.map((saved) => {
          const count = Object.keys(saved.assignments || {}).length;
          const type = assessmentCategories.find((item) => item.key === saved.category)?.label;
          const period = assessmentPeriods.find((item) => item.key === saved.period)?.label;
          return <article className="assessment-question-card" key={saved.id}>
            <div className="assessment-question-header"><div><span>{formatSavedDate(saved.createdAt)}</span><strong>{saved.label}</strong></div></div>
            <p className="assessment-field-hint">{saved.groupCount} group{saved.groupCount === 1 ? "" : "s"} · {count} student{count === 1 ? "" : "s"} assigned{type && period ? ` · ${type} · ${period} · ${categoryItemPrefixes[saved.category] ?? "Q"}${saved.itemNo}` : ""}</p>
            <div className="action-modal-footer">
              <button type="button" className="outline-button" disabled={deletingId === saved.id} onClick={() => onDeleteGroup(saved.id)}>{deletingId === saved.id ? "Removing…" : "Delete"}</button>
              <button type="button" className="primary-button" onClick={() => onOpenBox(saved)}>Score this activity</button>
            </div>
          </article>;
        })}
      </div> : <div className="empty-state">No saved groupings yet — create one to get started.</div>}
    </>
  );
}
