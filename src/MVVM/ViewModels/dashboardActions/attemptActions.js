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
      // Update only the grant locally. Reloading the whole dashboard here can
      // replace already-loaded assessment answers while the refresh settles.
      setAssessmentAttemptGrants((currentGrants) => [
        ...currentGrants.filter(
          (item) =>
            !(
              String(item.assessment_id) === String(assessmentId) &&
              String(item.student_id) === String(studentId)
            ),
        ),
        grant,
      ]);
      setAssessmentDefinitions((currentAssessments) =>
        currentAssessments.map((assessment) => {
          if (String(assessment.id) !== String(assessmentId)) {
            return assessment;
          }
          const existingGrants = (assessment.attemptGrants ?? []).filter(
            (item) => String(item.student_id) !== String(studentId),
          );
          return {
            ...assessment,
            attemptGrants: [...existingGrants, grant],
          };
        }),
      );
      return grant;
    },
    [
      currentSectionId,
      queueOfflineChange,
      setAssessmentAttemptGrants,
      setAssessmentDefinitions,
    ],
  );
  return { grantAssessmentAttempt };
}
