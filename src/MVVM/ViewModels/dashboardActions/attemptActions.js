/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import { useCallback } from "react";
import { supabase } from "../../../lib/supabaseClient";
import {
  countOfflineMutations,
  listOfflineMutations,
  readOfflineSnapshot,
  removeOfflineMutation,
  replayOfflineMutation,
} from "../../../lib/offlineStore";

export function useAttemptActions(context) {
  const {
    currentSectionId,
    loadLiveData,
    queueOfflineChange,
    setAssessmentAttemptGrants,
    setAssessmentDefinitions,
    helpers,
  } = context;
  const { browserIsOffline } = helpers;
  const grantAssessmentAttempt = useCallback(
    async ({ assessmentId, studentId }) => {
      if (!currentSectionId) throw new Error("No active Supabase section.");
      if (!assessmentId || !studentId)
        throw new Error("Select an assessment and student.");
      const payload = {
        assessment_id: assessmentId,
        student_id: studentId,
        section_id: currentSectionId,
      };
      if (browserIsOffline() || !supabase) {
        await queueOfflineChange("grant-assessment-attempt", payload);
        return { ...payload, extra_attempts: 1, queued: true };
      }
      const { data: existing, error: existingError } = await supabase
        .from("assessment_attempt_grants")
        .select("id, extra_attempts")
        .eq("assessment_id", assessmentId)
        .eq("student_id", studentId)
        .maybeSingle();
      if (existingError) throw existingError;
      const { data: grant, error } = await supabase
        .from("assessment_attempt_grants")
        .upsert(
          {
            id: existing?.id,
            assessment_id: assessmentId,
            student_id: studentId,
            extra_attempts: Number(existing?.extra_attempts || 0) + 1,
          },
          { onConflict: "assessment_id,student_id" },
        )
        .select("id, assessment_id, student_id, extra_attempts, granted_at")
        .single();
      if (error) throw error;
      await loadLiveData(currentSectionId);
      return grant;
    },
    [currentSectionId, loadLiveData, queueOfflineChange],
  );
  return { grantAssessmentAttempt };
}
