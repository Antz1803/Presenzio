import { useCallback } from "react";
import { db } from "../../../lib/Firebase";
import * as store from "../../../lib/accountDb";
import { calculateGradeDetailsFromRecords } from "../gradeCalculation";

export function useGradeCalculationActions(context) {
  const {
    accountId,
    currentSectionId,
    students,
    loadLiveData,
    helpers,
  } = context;
  const { browserIsOffline } = helpers;
  const recalculatePeriodGrades = useCallback(
    async (
      periodId,
      sectionId = currentSectionId,
      roster = students,
      gradeOverrides = {},
    ) => {
      if (!periodId) return;
      const { assessmentRows, sessionRows, periods } =
        await store.getGradingInputs(accountId, sectionId);
      const calculated = calculateGradeDetailsFromRecords({
        students: roster,
        assessmentScores: assessmentRows ?? [],
        attendanceSessions: sessionRows ?? [],
        gradingPeriods: periods,
        gradeOverrides,
      });
      const periodGradeRows = [];
      roster.forEach((student) => {
        const cumulative = calculated.cumulativeByStudent.get(student.id) ?? {};
        periods.forEach((period) => {
          const own = calculated.ownGrades.get(period.code)?.get(student.id) ?? null;
          const cumulativeGrade = cumulative[period.code] ?? null;
          if (own == null && cumulativeGrade == null) return;
          periodGradeRows.push({
            section_id: sectionId,
            period_id: period.id,
            enrollment_id: student.id,
            own_period_grade: own,
            cumulative_grade: cumulativeGrade,
          });
        });
      });
      await store.replacePeriodGrades(accountId, sectionId, periodGradeRows);
    },
    [accountId, currentSectionId, students],
  );

  const refreshGrades = useCallback(
    async (sectionId = currentSectionId) => {
      if (!sectionId || !db || browserIsOffline()) return;
      const loaded = await loadLiveData(sectionId);
      if (!loaded?.students?.length || !loaded.periods?.length) return;
      const gradeOverrides = {};
      loaded.students.forEach((student) => {
        Object.entries(student.gradeDetails ?? {}).forEach(
          ([periodCode, details]) => {
            if (details?.own == null && details?.cumulative == null) return;
            gradeOverrides[periodCode] ??= {};
            gradeOverrides[periodCode][student.id] = details;
          },
        );
      });
      await recalculatePeriodGrades(
        loaded.periods[0].id,
        sectionId,
        loaded.students,
        gradeOverrides,
      );
      await loadLiveData(sectionId);
    },
    [
      browserIsOffline,
      currentSectionId,
      loadLiveData,
      recalculatePeriodGrades,
    ],
  );

  return { recalculatePeriodGrades, refreshGrades };
}
