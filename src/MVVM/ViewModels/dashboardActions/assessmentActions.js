import { useCallback } from "react";
import { db } from "../../../lib/Firebase";
import { saveAssessmentOffline } from "./saveAssessmentOffline";
import { saveAssessmentOnline } from "./saveAssessmentOnline";

export function useAssessmentActions(context) {
  const {
    currentSectionId,
    gradingPeriods,
    queueOfflineChange,
    loadLiveData,
    helpers,
  } = context;
  const { browserIsOffline, assessmentItemLimits, serializeAssessmentDate } =
    helpers;
  const saveAssessment = useCallback(
    async (input) => {
      const { title, period, questions } = input;
      if (!currentSectionId) throw new Error("No active Firebase section.");
      if (!title?.trim()) throw new Error("An assessment title is required.");
      if (!Array.isArray(questions) || !questions.length)
        throw new Error("Add at least one assessment question.");
      const periodRow = gradingPeriods.find((item) => item.code === period);
      if (!periodRow)
        throw new Error("The selected grading period is not available.");
      const args = { ...input, assessmentItemLimits, serializeAssessmentDate };
      if (browserIsOffline() || !db)
        return saveAssessmentOffline(
          { ...context, queueOfflineChange },
          args,
          periodRow,
        );
      return saveAssessmentOnline(
        { ...context, loadLiveData },
        args,
        periodRow,
      );
    },
    [
      assessmentItemLimits,
      browserIsOffline,
      context,
      currentSectionId,
      gradingPeriods,
      loadLiveData,
      queueOfflineChange,
      serializeAssessmentDate,
    ],
  );
  return { saveAssessment };
}
