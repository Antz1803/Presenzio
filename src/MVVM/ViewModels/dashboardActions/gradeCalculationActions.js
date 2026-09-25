/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import { useCallback } from "react";
import { importMasterListFile } from "../importMasterList";
import { importGradeSheetFile } from "../importRecord";
import { syncGradeSheetToExcel } from "../syncGradeSheetToExcelPreservingTemplate";
import { supabase } from "../../../lib/supabaseClient";
import { getPeriodGradingWeights } from "../dashboardConstants";
import {
  countOfflineMutations,
  listOfflineMutations,
  readOfflineSnapshot,
  removeOfflineMutation,
  replayOfflineMutation,
} from "../../../lib/offlineStore";

export function useGradeCalculationActions(context) {
  const {
    accountId,
    accountScoped,
    currentSectionId,
    period,
    section,
    sections,
    students,
    gradingPeriods,
    assessmentScores,
    assessmentDefinitions,
    studentGroups,
    attendanceSessions,
    loadLiveData,
    clearLiveData,
    queueOfflineChange,
    setSection,
    setSections,
    setStudents,
    setGradingPeriods,
    setAssessmentScores,
    setAssessmentDefinitions,
    setStudentGroups,
    setAssessmentAttemptGrants,
    setAttendanceSessions,
    setConnectionStatus,
    setConnectionMessage,
    setPendingSyncCount,
    setImportState,
    setGradeSheetImportState,
    helpers,
  } = context;
  const {
    answerSimilarity,
    assessmentItemLimits,
    average,
    browserIsOffline,
    createAssessmentAccessKey,
    createLocalId,
    formatShortDate,
    gradingWeights,
    isNetworkError,
    serializeAssessmentDate,
    transmutePercentage,
  } = helpers;
  const recalculatePeriodGrades = useCallback(
    async (
      periodId,
      sectionId = currentSectionId,
      roster = students,
      gradeOverrides = {},
    ) => {
      if (!periodId) return;
      const [
        { data: assessmentRows, error: assessmentError },
        { data: sessionRows, error: sessionError },
        periodResult,
      ] = await Promise.all([
        supabase
          .from("assessment_scores")
          .select("period_id, enrollment_id, category, score, max_score")
          .eq("section_id", sectionId),
        supabase
          .from("class_sessions")
          .select("id, period_id, attendance_records(enrollment_id, status)")
          .eq("section_id", sectionId),
        (async () => {
          const withWeights = await supabase
            .from("grading_periods")
            .select("id, code, sort_order, weights")
            .order("sort_order");
          if (!withWeights.error) return withWeights;
          return supabase
            .from("grading_periods")
            .select("id, code, sort_order")
            .order("sort_order");
        })(),
      ]);
      if (assessmentError) throw assessmentError;
      if (sessionError) throw sessionError;
      if (periodResult.error) throw periodResult.error;

      const periods = (periodResult.data ?? []).sort(
        (first, second) => first.sort_order - second.sort_order,
      );
      const ownGrades = new Map();
      periods.forEach((period) => {
        const periodWeights = getPeriodGradingWeights(period);
        const periodSessions = (sessionRows ?? []).filter(
          (session) => session.period_id === period.id,
        );
        const periodStudentGrades = new Map();
        roster.forEach((student) => {
          const categoryGrades = {};
            Object.keys(periodWeights).forEach((categoryKey) => {
            if (categoryKey === "attendance") return;
            // Excel's point cells are blank for blank raw-score cells, and
            // its category average uses COUNT/AVERAGE. Use only recorded
            // numeric score rows here; an explicit zero is still included.
            const itemGrades = (assessmentRows ?? [])
              .filter(
                (row) =>
                  row.period_id === period.id &&
                  row.enrollment_id === student.id &&
                  row.category === categoryKey &&
                  Number.isFinite(Number(row.score)) &&
                  Number(row.max_score) > 0,
              )
              .map((row) =>
                transmutePercentage(
                  (Number(row.score) / Number(row.max_score)) * 100,
                ),
              )
              .filter((grade) => grade !== null);
            if (itemGrades.length)
              categoryGrades[categoryKey] = average(itemGrades);
          });

          if (periodSessions.length) {
            const records = periodSessions.flatMap(
              (session) => session.attendance_records ?? [],
            );
            const attended = records.filter(
              (record) =>
                record.enrollment_id === student.id &&
                (record.status === "present" || record.status === "late"),
            ).length;
            categoryGrades.attendance = transmutePercentage(
              (attended / periodSessions.length) * 100,
            );
          }

          const contributingGrades = Object.entries(periodWeights).filter(
            ([categoryKey]) => categoryGrades[categoryKey] != null,
          );

          let gradePoint = null;
          if (contributingGrades.length) {
            gradePoint = contributingGrades.reduce(
              (total, [categoryKey, weight]) =>
                total + categoryGrades[categoryKey] * weight,
              0,
            );
          } else {
            const overrideOwn =
              gradeOverrides?.[period.code]?.[student.id]?.own;
            if (Number.isFinite(Number(overrideOwn)))
              gradePoint = Number(overrideOwn);
          }

          if (gradePoint == null) return;
          periodStudentGrades.set(student.id, gradePoint);
        });
        ownGrades.set(period.code, periodStudentGrades);
      });

      const averageDefined = (values) => {
        const validValues = values.filter((value) => value != null);
        return validValues.length
          ? validValues.reduce((total, value) => total + value, 0) /
              validValues.length
          : null;
      };
      const periodGradeRows = [];
      roster.forEach((student) => {
        const overrideFor = (code) =>
          gradeOverrides?.[code]?.[student.id]?.cumulative ?? null;
        const prelim = ownGrades.get("prelim")?.get(student.id) ?? null;
        const midterm = ownGrades.get("midterm")?.get(student.id) ?? null;
        const semifinal = ownGrades.get("semifinal")?.get(student.id) ?? null;
        const final = ownGrades.get("final")?.get(student.id) ?? null;

        const cumulative = { prelim };
        cumulative.midterm =
          prelim != null && midterm != null
            ? midterm * 0.7 + prelim * 0.3
            : overrideFor("midterm");
        cumulative.semifinal =
          semifinal != null
            ? averageDefined([prelim, cumulative.midterm, semifinal])
            : overrideFor("semifinal");
        cumulative.final =
          final != null
            ? averageDefined([
                averageDefined([prelim, cumulative.midterm]),
                averageDefined([cumulative.semifinal, final]),
              ])
            : overrideFor("final");

        periods.forEach((period) => {
          const own = ownGrades.get(period.code)?.get(student.id) ?? null;
          const cumulativeValue = cumulative[period.code] ?? null;
          if (own == null && cumulativeValue == null) return;
          periodGradeRows.push({
            section_id: sectionId,
            period_id: period.id,
            enrollment_id: student.id,
            own_period_grade: own,
            cumulative_grade: cumulativeValue,
          });
        });
      });

      const { error: deleteError } = await supabase
        .from("period_grades")
        .delete()
        .eq("section_id", sectionId);
      if (deleteError) throw deleteError;
      if (periodGradeRows.length) {
        const { error: upsertError } = await supabase
          .from("period_grades")
          .upsert(periodGradeRows, {
            onConflict: "section_id,period_id,enrollment_id",
          });
        if (upsertError) throw upsertError;
      }
    },
    [currentSectionId, students],
  );

  const refreshGrades = useCallback(
    async (sectionId = currentSectionId) => {
      if (!sectionId || !supabase || browserIsOffline()) return;
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
    [currentSectionId, loadLiveData, recalculatePeriodGrades],
  );

  return { recalculatePeriodGrades, refreshGrades };
}
