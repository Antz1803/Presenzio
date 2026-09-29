import { useMemo, useState } from "react";
import {
  assessmentCategories,
  assessmentPeriods,
  categoryItemPrefixes,
} from "./assessmentConfig";
import { formatSavedDate } from "./groupingUtils";
import "./GroupBoxListEnhanced.css";

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
      <div className="group-list-intro">
        <div>
          <span className="group-list-kicker">GROUP WORKSPACE</span>
          <h3>Organize, rename, and score your activities</h3>
          <p>Open a saved group set to record scores or update its title.</p>
        </div>
        <button type="button" className="primary-button" onClick={onCreateNew}>
          + New grouping
        </button>
      </div>
      {error && <p className="record-save-message error" role="status">{error}</p>}
      {sorted.length ? (
        <div className="group-box-list">
          {sorted.map((saved) => {
            const count = Object.keys(saved.assignments || {}).length;
            const type = assessmentCategories.find((item) => item.key === saved.category)?.label;
            const period = assessmentPeriods.find((item) => item.key === saved.period)?.label;
            const isEditing = editingId === saved.id;
            const isSaving = savingId === saved.id;
            return (
              <article className="group-box-card" key={saved.id}>
                <div className="group-box-card-top">
                  <div className="group-box-title-wrap">
                    <span className="group-box-date">{formatSavedDate(saved.createdAt)}</span>
                    {isEditing ? (
                      <input
                        className="group-box-title-input"
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
                  <span className="group-box-count">{saved.groupCount} groups</span>
                </div>
                <div className="group-box-meta">
                  <span>{count} students assigned</span>
                  {type && period && (
                    <>
                      <i /> <span>{type}</span><i /> <span>{period}</span><i />
                      <span>{categoryItemPrefixes[saved.category] ?? "Q"}{saved.itemNo}</span>
                    </>
                  )}
                </div>
                <div className="group-box-actions">
                  {isEditing ? (
                    <>
                      <button type="button" className="outline-button" onClick={cancelEdit} disabled={isSaving}>Cancel</button>
                      <button type="button" className="primary-button" onClick={() => void saveTitle(saved)} disabled={isSaving}>
                        {isSaving ? "Saving..." : "Save title"}
                      </button>
                    </>
                  ) : (
                    <button type="button" className="outline-button" onClick={() => beginEdit(saved)}>Edit title</button>
                  )}
                  <button type="button" className="danger-outline-button" disabled={deletingId === saved.id || isSaving} onClick={() => onDeleteGroup(saved.id)}>
                    {deletingId === saved.id ? "Removing..." : "Delete"}
                  </button>
                  <button type="button" className="group-score-button" onClick={() => onOpenBox(saved)} disabled={isEditing || isSaving}>
                    Score activity <span aria-hidden="true">-&gt;</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">No saved groupings yet - create one to get started.</div>
      )}
    </>
  );
}
