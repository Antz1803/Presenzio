/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import { useCallback } from "react";
import { db } from "../../../lib/Firebase";
import * as store from "../../../lib/accountDb";
import {
  countOfflineMutations,
  listOfflineMutations,
  readOfflineSnapshot,
  removeOfflineMutation,
  replayOfflineMutation,
} from "../../../lib/offlineStore";

export function useAttemptActions(context) {
  const {
    accountId,
    currentSectionId,
    queueOfflineChange,
    setAssessmentAttemptGrants,
    setAssessmentDefinitions,
    helpers,
  } = context;
  const { browserIsOffline } = helpers;
  const grantAssessmentAttempt = useCallback(
    async ({ assessmentId, studentId }) => {
      if (!currentSectionId) throw new Error("No active Firebase section.");
      if (!assessmentId || !studentId)
        throw new Error("Select an assessment and student.");
      const payload = {
        assessment_id: assessmentId,
        student_id: studentId,
        section_id: currentSectionId,
      };
      if (browserIsOffline() || !db) {
        await queueOfflineChange("grant-assessment-attempt", payload);
        return { ...payload, extra_attempts: 1, queued: true };
      }
      const grant = await store.grantAttempt(accountId, currentSectionId, assessmentId, studentId);
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
      accountId,
      currentSectionId,
      queueOfflineChange,
      setAssessmentAttemptGrants,
      setAssessmentDefinitions,
    ],
  );
  return { grantAssessmentAttempt };
}
