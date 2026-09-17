/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import { useCallback } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { countOfflineMutations, listOfflineMutations, readOfflineSnapshot, removeOfflineMutation, replayOfflineMutation } from "../../../lib/offlineStore";

export function useAssessmentDeleteActions(context) {
  const {
    currentSectionId, assessmentDefinitions, loadLiveData, queueOfflineChange,
    setAssessmentDefinitions, setAssessmentScores, helpers,
  } = context;
  const { browserIsOffline } = helpers;
  const deleteAssessment = useCallback(async (assessmentId) => {
    if (!currentSectionId) throw new Error("No active Supabase section.");
    const target = assessmentDefinitions.find((item) => item.id === assessmentId);
    if (browserIsOffline() || !supabase) {
      await queueOfflineChange("delete-assessment", { assessmentId, sectionId: currentSectionId });
      setAssessmentDefinitions((current) => current.filter((item) => item.id !== assessmentId));
      if (target) setAssessmentScores((current) => current.filter((row) => !(
        row.period?.code === target.period?.code && row.category === target.category &&
        Number(row.item_no) === Number(target.item_no)
      )));
      return;
    }
    const { error } = await supabase.from("assessments").delete()
      .eq("id", assessmentId).eq("section_id", currentSectionId);
    if (error) throw error;
    if (target) {
      const { error: scoresError } = await supabase.from("assessment_scores").delete()
        .eq("section_id", currentSectionId).eq("period_id", target.period_id)
        .eq("category", target.category).eq("item_no", target.item_no);
      if (scoresError) throw scoresError;
    }
    await loadLiveData(currentSectionId);
  }, [assessmentDefinitions, currentSectionId, loadLiveData, queueOfflineChange]);
  return { deleteAssessment };
}
