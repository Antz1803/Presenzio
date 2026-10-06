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

export function useAssessmentDeleteActions(context) {
  const {
    accountId,
    currentSectionId,
    assessmentDefinitions,
    loadLiveData,
    queueOfflineChange,
    setAssessmentDefinitions,
    setAssessmentScores,
    helpers,
  } = context;
  const { browserIsOffline } = helpers;
  const deleteAssessment = useCallback(
    async (assessmentId) => {
      if (!currentSectionId) throw new Error("No active Firebase section.");
      const target = assessmentDefinitions.find(
        (item) => item.id === assessmentId,
      );
      if (browserIsOffline() || !db) {
        await queueOfflineChange("delete-assessment", {
          assessmentId,
          sectionId: currentSectionId,
        });
        setAssessmentDefinitions((current) =>
          current.filter((item) => item.id !== assessmentId),
        );
        if (target)
          setAssessmentScores((current) =>
            current.filter(
              (row) =>
                !(
                  row.period?.code === target.period?.code &&
                  row.category === target.category &&
                  Number(row.item_no) === Number(target.item_no)
                ),
            ),
          );
        return;
      }
      await store.deleteAssessment(accountId, currentSectionId, assessmentId);
      await loadLiveData(currentSectionId);
    },
    [assessmentDefinitions, currentSectionId, loadLiveData, queueOfflineChange],
  );
  return { deleteAssessment };
}
