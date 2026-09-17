import { useState } from "react";
import { ModalShell } from "./ActionModalShell";
import { GroupBoxList } from "./GroupBoxList";
import { CreateGroupingView } from "./CreateGroupingView";
import { ScoreBoxView } from "./ScoreBoxView";

export function GroupActivities({ section, students, assessmentScores, savedGroups = [], onSaveGroup, onDeleteGroup, onSave, onClose }) {
  const [view, setView] = useState("list");
  const [activeBox, setActiveBox] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const openBox = (box) => { setActiveBox(box); setView("score"); };
  const backToList = () => { setActiveBox(null); setView("list"); };
  const deleteBox = async (id) => {
    if (!onDeleteGroup) return;
    setDeletingId(id);
    try { await onDeleteGroup(id); } finally { setDeletingId(null); }
  };
  const title = view === "create" ? "New Grouping" : view === "score" ? activeBox?.label || "Score Grouping" : "Group Activities";
  return <ModalShell title={title} section={section} onClose={onClose} size="wide">
    {view === "list" && <GroupBoxList savedGroups={savedGroups} onCreateNew={() => setView("create")} onOpenBox={openBox} onDeleteGroup={deleteBox} deletingId={deletingId} />}
    {view === "create" && <CreateGroupingView students={students} onBack={backToList} onSaveGroup={(payload) => onSaveGroup({ sectionId: section?.id, ...payload })} />}
    {view === "score" && activeBox && <ScoreBoxView students={students} assessmentScores={assessmentScores} box={activeBox} onBack={backToList} onSave={onSave} />}
  </ModalShell>;
}
