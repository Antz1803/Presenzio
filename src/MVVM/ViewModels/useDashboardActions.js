/* eslint-disable react-hooks/exhaustive-deps -- callback dependencies are coordinated by the parent view model. */
import { useCallback } from "react";
import { importMasterListFile } from "./importMasterList";
import { importGradeSheetFile } from "./importRecord";
import { syncGradeSheetToExcel } from "./syncGradeSheetToExcelPreservingTemplate";
import { supabase } from "../../lib/supabaseClient";
import {
  countOfflineMutations,
  listOfflineMutations,
  readOfflineSnapshot,
  removeOfflineMutation,
  replayOfflineMutation,
} from "../../lib/offlineStore";

export function useDashboardActions(context) {
  const {
    accountId, accountScoped, currentSectionId, period, section, sections, students,
    gradingPeriods, assessmentScores, assessmentDefinitions,
    attendanceSessions, loadLiveData, clearLiveData, queueOfflineChange,
    setSection, setSections, setStudents,
    setGradingPeriods, setAssessmentScores, setAssessmentDefinitions,
    setAssessmentAttemptGrants,
    setAttendanceSessions, setConnectionStatus, setConnectionMessage,
    setPendingSyncCount, setImportState, setGradeSheetImportState, helpers,
  } = context;
  const {
    answerSimilarity, assessmentItemLimits, average, browserIsOffline, callLanApi,
    createAssessmentAccessKey, createLocalId, formatShortDate, gradingWeights,
    isNetworkError, serializeAssessmentDate, transmutePercentage,
  } = helpers;

  const selectSection = useCallback(
    (sectionId) => {
      if (sectionId) loadLiveData(sectionId);
    },
    [loadLiveData],
  );

  const saveGradingPeriods = useCallback(
    async (dateRanges) => {
      if (!supabase) throw new Error("Supabase is not configured.");

      const invalidPeriod = Object.entries(dateRanges).find(([, dates]) => {
        const hasStart = Boolean(dates.start);
        const hasEnd = Boolean(dates.end);
        return (
          hasStart !== hasEnd ||
          (hasStart && hasEnd && dates.start > dates.end)
        );
      });
      if (invalidPeriod) {
        throw new Error(
          "Each period needs both dates, and the start date must be before the end date.",
        );
      }

      const rows = Object.entries(dateRanges).map(([code, dates], index) => ({
        code,
        sort_order:
          gradingPeriods.find((periodItem) => periodItem.code === code)
            ?.sort_order ?? index + 1,
        start_date: dates.start || null,
        end_date: dates.end || null,
      }));
      if (browserIsOffline() || !supabase) {
        await queueOfflineChange("save-grading-periods", { rows });
        setGradingPeriods((current) =>
          current.map((currentPeriod) => {
            const next = rows.find((row) => row.code === currentPeriod.code);
            return next
              ? {
                  ...currentPeriod,
                  start_date: next.start_date,
                  end_date: next.end_date,
                }
              : currentPeriod;
          }),
        );
        return;
      }
      const { error } = await supabase
        .from("grading_periods")
        .upsert(rows, { onConflict: "code" });
      if (error) throw error;

      // Keep existing attendance sessions aligned with the date ranges. This
      // repairs sessions that were previously assigned from the selected tab
      // instead of from their actual date.
      const { data: existingSessions, error: existingSessionsError } =
        await supabase
          .from("class_sessions")
          .select("id, session_date")
          .eq("section_id", currentSectionId);
      if (existingSessionsError) throw existingSessionsError;
      for (const session of existingSessions ?? []) {
        const matchingPeriod = rows
          .filter((row) => row.start_date && row.end_date)
          .sort((first, second) => first.sort_order - second.sort_order)
          .find(
            (row) =>
              session.session_date >= row.start_date &&
              session.session_date <= row.end_date,
          );
        if (!matchingPeriod) continue;
        const periodId = gradingPeriods.find(
          (periodItem) => periodItem.code === matchingPeriod.code,
        )?.id;
        if (!periodId) continue;
        const { error: sessionUpdateError } = await supabase
          .from("class_sessions")
          .update({ period_id: periodId })
          .eq("id", session.id);
        if (sessionUpdateError) throw sessionUpdateError;
      }
      await loadLiveData(currentSectionId);
    },
    [currentSectionId, gradingPeriods, loadLiveData, queueOfflineChange],
  );

  const importMasterList = useCallback(
    async (file) => {
      setImportState({ status: "working", message: "Reading master list…" });
      try {
        if (browserIsOffline() || !supabase) {
          await queueOfflineChange("import-master-list", { file });
          setImportState({
            status: "success",
            message: "Master list saved offline and queued for automatic sync.",
          });
          return;
        }
        const result = await importMasterListFile({ file, supabase, userId: accountId });
        const preferredSectionId = result.sectionIds?.includes(currentSectionId)
          ? currentSectionId
          : result.sectionId;
        await loadLiveData(preferredSectionId);
        setImportState({
          status: "success",
          message:
            result.count +
            " student records imported from " +
            result.sheetName +
            "." +
            (result.dedupSummary?.studentsMerged
              ? ` ${result.dedupSummary.studentsMerged} duplicate student record(s) were merged.`
              : "") +
            (result.dedupSummary?.errors?.length
              ? ` ${result.dedupSummary.errors.length} possible duplicate(s) could not be merged automatically.`
              : ""),
        });
      } catch (error) {
        const message = error.message ?? "Master-list import failed.";
        setConnectionStatus(isNetworkError(error) ? "offline" : "error");
        setConnectionMessage(message);
        setImportState({
          status: "error",
          message,
        });
      }
    },
    [accountId, currentSectionId, loadLiveData, queueOfflineChange],
  );

  const syncToExcel = useCallback(async () => {
    if (!section?.id) throw new Error("No active class is selected.");
    if (browserIsOffline() || !supabase) {
      throw new Error(
        "Excel sync requires a live database connection so every record can be included.",
      );
    }
    const fresh = await loadLiveData(section.id);
    if (!fresh?.live || fresh.sectionId !== section.id) {
      throw new Error("The latest class records could not be loaded for Excel sync.");
    }
    await syncGradeSheetToExcel({
      section: fresh.section,
      students: fresh.students,
      assessmentScores: fresh.assessmentScores,
      assessmentDefinitions: fresh.assessmentDefinitions,
      attendanceSessions: fresh.attendanceSessions,
      gradingPeriods: fresh.periods,
    });
   }, [section, loadLiveData]);

  const recalculatePeriodGrades = useCallback(
    async (periodId, sectionId = currentSectionId, roster = students, gradeOverrides = {}) => {
      if (!periodId) return;
      const [
        { data: assessmentRows, error: assessmentError },
        { data: sessionRows, error: sessionError },
        { data: periodRows, error: periodError },
      ] =
        await Promise.all([
          supabase
            .from("assessment_scores")
            .select("period_id, enrollment_id, category, score, max_score")
            .eq("section_id", sectionId),
          supabase
            .from("class_sessions")
            .select("id, period_id, attendance_records(enrollment_id, status)")
            .eq("section_id", sectionId),
          supabase
            .from("grading_periods")
            .select("id, code, sort_order")
            .order("sort_order"),
        ]);
      if (assessmentError) throw assessmentError;
      if (sessionError) throw sessionError;
      if (periodError) throw periodError;

      const periods = (periodRows ?? []).sort(
        (first, second) => first.sort_order - second.sort_order,
      );
      const ownGrades = new Map();
      periods.forEach((period) => {
        const periodSessions = (sessionRows ?? []).filter(
          (session) => session.period_id === period.id,
        );
        const periodStudentGrades = new Map();
        roster.forEach((student) => {
          const categoryGrades = {};
          Object.keys(gradingWeights).forEach((categoryKey) => {
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
            if (itemGrades.length) categoryGrades[categoryKey] = average(itemGrades);
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

          const contributingGrades = Object.entries(gradingWeights).filter(
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
            const overrideOwn = gradeOverrides?.[period.code]?.[student.id]?.own;
            if (Number.isFinite(Number(overrideOwn))) gradePoint = Number(overrideOwn);
          }

          if (gradePoint == null) return;
          periodStudentGrades.set(student.id, gradePoint);
        });
        ownGrades.set(period.code, periodStudentGrades);
      });

      const averageDefined = (values) => {
        const validValues = values.filter((value) => value != null);
        return validValues.length
          ? validValues.reduce((total, value) => total + value, 0) / validValues.length
          : null;
      };
      const periodGradeRows = [];
      roster.forEach((student) => {
        const overrideFor = (code) => gradeOverrides?.[code]?.[student.id]?.cumulative ?? null;
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

  const refreshGrades = useCallback(async (sectionId = currentSectionId) => {
    if (!sectionId || !supabase || browserIsOffline()) return;
    const loaded = await loadLiveData(sectionId);
    if (!loaded?.students?.length || !loaded.periods?.length) return;
    const gradeOverrides = {};
    loaded.students.forEach((student) => {
      Object.entries(student.gradeDetails ?? {}).forEach(([periodCode, details]) => {
        if (details?.own == null && details?.cumulative == null) return;
        gradeOverrides[periodCode] ??= {};
        gradeOverrides[periodCode][student.id] = details;
      });
    });
    await recalculatePeriodGrades(
      loaded.periods[0].id,
      sectionId,
      loaded.students,
      gradeOverrides,
    );
    await loadLiveData(sectionId);
  }, [currentSectionId, loadLiveData, recalculatePeriodGrades]);

  const importGradeSheet = useCallback(
    async (file) => {
      setGradeSheetImportState({
        status: "working",
        message: "Reading grade sheet and finding its class…",
      });
      try {
        if (browserIsOffline() || !supabase) {
          await queueOfflineChange("import-grade-sheet", { file });
          setGradeSheetImportState({
            status: "success",
            message: "Grade sheet saved offline and queued for automatic sync.",
          });
          return;
        }
        const result = await importGradeSheetFile({ file, supabase, userId: accountId });
        // recalculatePeriodGrades always recomputes every grading period for
        // the section in one shot (it ignores which periodId it's passed
        // beyond the empty check below) and replaces the whole
        // period_grades table for this section each time it runs. Calling
        // it once per touched period therefore did the same full
        // delete-and-reinsert 2-4 times in a row for no benefit, and each
        // of those extra writes fired its own realtime change event that
        // could race with (and stale-overwrite) the final reload below.
        // Run it once, right after the scores/attendance are written.
        if (result.periodIds?.length) {
          await recalculatePeriodGrades(
            result.periodIds[0],
            result.sectionId,
            result.students,
            result.gradeOverrides,
          );
        }
        await loadLiveData(result.sectionId);
        setGradeSheetImportState({
          status: "success",
          message:
            result.scoreCount +
            " scores and " +
            result.attendanceCount +
            " attendance records imported into " +
            (result.subjectCode || "the matching class") +
            "." +
            (result.rosterChanges?.createdStudents?.length
              ? ` ${result.rosterChanges.createdStudents.length} missing student(s) were added to the class.`
              : "") +
            (result.unmatchedStudents
              ? ` ${result.unmatchedStudents} student row(s) were not matched.`
              : "") +
            (result.dedupSummary?.studentsMerged
              ? ` ${result.dedupSummary.studentsMerged} duplicate student record(s) were merged.`
              : "") +
            (result.dedupSummary?.errors?.length
              ? ` ${result.dedupSummary.errors.length} possible duplicate(s) could not be merged automatically.`
              : ""),
        });
      } catch (error) {
        const message = error.message ?? "Grade-sheet import failed.";
        if (isNetworkError(error)) {
          setConnectionStatus("offline");
          setConnectionMessage(message);
        }
        setGradeSheetImportState({
          status: "error",
          message,
        });
      }
    },
    [accountId, recalculatePeriodGrades, loadLiveData, queueOfflineChange],
  );

  const saveAttendance = useCallback(
    async ({ date, sessionTime, statuses }) => {
      if (!currentSectionId)
        throw new Error("No active Supabase section.");
      const selectedPeriodCode = period.toLowerCase();
      const datePeriodCode = gradingPeriods
        .filter((periodItem) => periodItem.start_date && periodItem.end_date)
        .sort((first, second) => first.sort_order - second.sort_order)
        .find(
          (periodItem) =>
            date >= periodItem.start_date && date <= periodItem.end_date,
        )?.code;
      const periodCode = datePeriodCode ?? selectedPeriodCode;
      if (browserIsOffline() || !supabase) {
        const existingSession = attendanceSessions.find(
          (session) =>
            session.sessionDate === date &&
            session.sessionTime === sessionTime &&
            session.periodCode === periodCode,
        );
        const sessionId =
          existingSession?.id ??
          createLocalId();
        await queueOfflineChange("save-attendance", {
          sectionId: currentSectionId,
          periodCode,
          date,
          sessionTime,
          statuses,
          sessionId,
        });
        setAttendanceSessions((current) => {
          const existing = current.find(
            (session) =>
              session.sessionDate === date &&
              session.sessionTime === sessionTime &&
              session.periodCode === periodCode,
          );
          const next = {
            id: existing?.id ?? sessionId,
            date: formatShortDate(date),
            sessionDate: date,
            sessionTime,
            periodCode,
            statuses,
          };
          return existing
            ? current.map((session) => (session.id === existing.id ? next : session))
            : [...current, next].sort((first, second) =>
                first.sessionDate.localeCompare(second.sessionDate),
              );
        });
        return;
      }
      const { data: periodRow, error: periodError } = await supabase
        .from("grading_periods")
        .select("id")
        .eq("code", periodCode)
        .single();
      if (periodError) throw periodError;
      let { data: session, error: sessionLookupError } = await supabase
        .from("class_sessions")
        .select("id, period_id")
        .eq("section_id", currentSectionId)
        .eq("session_date", date)
        .eq("session_time", sessionTime)
        .maybeSingle();
      if (sessionLookupError) throw sessionLookupError;
      if (!session) {
        const result = await supabase
          .from("class_sessions")
          .insert({
            section_id: currentSectionId,
            period_id: periodRow.id,
            session_date: date,
            session_time: sessionTime,
          })
          .select("id")
          .single();
        if (result.error) throw result.error;
        session = result.data;
      }
      if (session.period_id !== periodRow.id) {
        const { error } = await supabase
          .from("class_sessions")
          .update({ period_id: periodRow.id })
          .eq("id", session.id);
        if (error) throw error;
      }
      const records = Object.entries(statuses).map(
        ([enrollmentId, status]) => ({
          session_id: session.id,
          enrollment_id: enrollmentId,
          status,
        }),
      );
      if (records.length) {
        const { error } = await supabase
          .from("attendance_records")
          .upsert(records, { onConflict: "session_id,enrollment_id" });
        if (error) throw error;
      }
      await recalculatePeriodGrades(periodRow.id);
      await loadLiveData(currentSectionId);
    },
    [
      currentSectionId,
      loadLiveData,
      period,
      gradingPeriods,
      attendanceSessions,
      queueOfflineChange,
      recalculatePeriodGrades,
    ],
  );

  const saveGrades = useCallback(
    async ({ period, grades }) => {
      if (!currentSectionId)
        throw new Error("No active Supabase section.");
      const periodCode = period.toLowerCase();
      const baseRows = Object.entries(grades)
        .filter(([, value]) => value !== "" && Number.isFinite(Number(value)))
        .map(([enrollmentId, value]) => ({
          section_id: currentSectionId,
          enrollment_id: enrollmentId,
          own_period_grade: Number(value),
          cumulative_grade: Number(value),
        }));
      if (browserIsOffline() || !supabase) {
        await queueOfflineChange("save-grades", {
          sectionId: currentSectionId,
          periodCode,
          rows: baseRows,
        });
        setStudents((current) =>
          current.map((student) => {
            const value = grades[student.id];
            if (value === "" || !Number.isFinite(Number(value))) return student;
            const nextGrades = { ...student.grades, [periodCode]: Number(value) };
            return {
              ...student,
              grades: nextGrades,
              grade: nextGrades.prelim ?? student.grade,
            };
          }),
        );
        return;
      }
      const { data: periodRow, error: periodError } = await supabase
        .from("grading_periods")
        .select("id")
        .eq("code", periodCode)
        .single();
      if (periodError) throw periodError;
      const rows = baseRows.map((row) => ({ ...row, period_id: periodRow.id }));
      if (rows.length) {
        const { error } = await supabase
          .from("period_grades")
          .upsert(rows, { onConflict: "section_id,period_id,enrollment_id" });
        if (error) throw error;
      }
      await loadLiveData(currentSectionId);
    },
    [currentSectionId, loadLiveData, queueOfflineChange],
  );

  const saveAssessmentScores = useCallback(
    async ({ period, category, scores, maxScores }) => {
      if (!currentSectionId)
        throw new Error("No active Supabase section.");
      const periodCode = period.toLowerCase();
      const baseRows = Object.entries(scores)
        .map(([itemNo, value]) => {
          const itemNumber = Number(itemNo.split(":")[1]);
          const itemMaxScore = Number(maxScores?.[String(itemNumber)]);

          if (value === "" && (!Number.isFinite(itemMaxScore) || itemMaxScore <= 0)) {
            return null;
          }
          if (!Number.isFinite(itemMaxScore) || itemMaxScore <= 0) {
            throw new Error(
              "Enter a maximum score for every column that has a score.",
            );
          }
          if (value !== "" && !Number.isFinite(Number(value))) {
            throw new Error("Scores must contain valid numbers.");
          }

          return {
            section_id: currentSectionId,
            enrollment_id: itemNo.split(":")[0],
            category,
            item_no: itemNumber,
            score:
              value === ""
                ? 0
                : Math.max(0, Math.min(Number(value), itemMaxScore)),
            max_score: itemMaxScore,
          };
        })
        .filter(Boolean);

      if (browserIsOffline() || !supabase) {
        await queueOfflineChange("save-assessment-scores", {
          sectionId: currentSectionId,
          periodCode,
          category,
          rows: baseRows,
        });
        setAssessmentScores((current) => [
          ...current.filter(
            (row) =>
              !(
                row.period?.code === periodCode &&
                row.category === category
              ),
          ),
          ...baseRows.map((row) => ({
            ...row,
            period: { code: periodCode },
          })),
        ]);
        return;
      }

      const { data: periodRow, error: periodError } = await supabase
        .from("grading_periods")
        .select("id")
        .eq("code", periodCode)
        .single();
      if (periodError) throw periodError;
      const assessmentRows = baseRows.map((row) => ({
        ...row,
        period_id: periodRow.id,
      }));

      const { error: clearError } = await supabase
        .from("assessment_scores")
        .delete()
        .eq("section_id", currentSectionId)
        .eq("period_id", periodRow.id)
        .eq("category", category);
      if (clearError) throw clearError;

      if (assessmentRows.length) {
        const { error } = await supabase
          .from("assessment_scores")
          .upsert(assessmentRows, {
            onConflict: "section_id,period_id,enrollment_id,category,item_no",
          });
        if (error) throw error;
      }
      await recalculatePeriodGrades(periodRow.id);
      await loadLiveData(currentSectionId);
    },
    [currentSectionId, loadLiveData, queueOfflineChange, recalculatePeriodGrades],
  );

  /**
   * Create a new assessment for a category/period/item-number slot.
   *
   * If `replaceAssessmentId` is provided, the caller has already confirmed
   * (via the UI) that they want to replace the assessment currently sitting
   * in that slot. In that case:
   *   - the conflict check ignores the slot IF it's occupied by exactly
   *     that assessment (any other occupant is still a hard error — the
   *     confirmation the user saw was only for the assessment they were
   *     shown);
   *   - the old assessment row (and its questions, via DB cascade / local
   *     state) is deleted;
   *   - any previously recorded assessment_scores for that section/period/
   *     category/item_no are cleared, since they belonged to the old
   *     assessment's question set and point scale.
   * Everything else behaves exactly like a normal, non-conflicting save.
   */
  const saveAssessment = useCallback(
    async ({
      title,
      category,
      period,
      itemNo: requestedItemNo,
      instructions,
      timeLimitMinutes,
      availableFrom,
      availableUntil,
      questions,
      replaceAssessmentId,
      overwriteScores,
    }) => {
      if (!currentSectionId)
        throw new Error("No active Supabase section.");
      if (!title?.trim()) throw new Error("An assessment title is required.");
      if (!Array.isArray(questions) || !questions.length)
        throw new Error("Add at least one assessment question.");

      const periodRow = gradingPeriods.find((item) => item.code === period);
      if (!periodRow) {
        throw new Error("The selected grading period is not available.");
      }

      if (browserIsOffline() || !supabase) {
        if (replaceAssessmentId) {
          await queueOfflineChange("delete-assessment", {
            assessmentId: replaceAssessmentId,
            sectionId: currentSectionId,
          });
          setAssessmentDefinitions((current) =>
            current.filter((item) => item.id !== replaceAssessmentId),
          );
        }

        const usedByAssessment = new Set(
          assessmentDefinitions
            .filter(
              (item) =>
                item.id !== replaceAssessmentId &&
                item.period?.code === period &&
                item.category === category,
            )
            .map((item) => Number(item.item_no)),
        );
        const usedByScoresOnly = new Set(
          assessmentScores
            .filter(
              (item) =>
                item.period?.code === period &&
                item.category === category &&
                !usedByAssessment.has(Number(item.item_no)),
            )
            .map((item) => Number(item.item_no)),
        );
        const itemLimit = assessmentItemLimits[category] ?? 1;
        let itemNo;
        if (requestedItemNo) {
          const candidate = Number(requestedItemNo);
          if (!Number.isInteger(candidate) || candidate < 1 || candidate > itemLimit) {
            throw new Error(`Item number must be between 1 and ${itemLimit} for this type.`);
          }
          if (usedByAssessment.has(candidate)) {
            // Surface which assessment is actually occupying the slot so the
            // modal can offer a replace-confirmation instead of a dead-end
            // error, even when its own client-side conflict check missed this
            // because its `assessments` prop hadn't caught up yet.
            const occupyingAssessment = assessmentDefinitions.find(
              (item) =>
                item.id !== replaceAssessmentId &&
                item.period?.code === period &&
                item.category === category &&
                Number(item.item_no) === candidate,
            );
            const conflictError = new Error(
              `Item ${candidate} for this type and period is already used by another assessment.`,
            );
            if (occupyingAssessment) {
              conflictError.conflict = { id: occupyingAssessment.id, title: occupyingAssessment.title };
            }
            throw conflictError;
          }
          if (usedByScoresOnly.has(candidate) && !overwriteScores) {
            // No assessment occupies this slot — it just already has recorded
            // scores (e.g. entered manually or imported before any assessment
            // was created for this column). There's nothing to "replace", so
            // this needs a different confirmation: overwrite those scores.
            const scoreConflictError = new Error(
              `Item ${candidate} for this type and period already has recorded scores. Creating this assessment will reset those scores to 0 for every student.`,
            );
            scoreConflictError.scoreConflict = true;
            throw scoreConflictError;
          }
          itemNo = candidate;
        } else {
          itemNo = Array.from(
            { length: itemLimit },
            (_, index) => index + 1,
          ).find((candidate) => !usedByAssessment.has(candidate) && !usedByScoresOnly.has(candidate));
          if (!itemNo) {
            throw new Error(`All ${itemLimit} ${category} score columns are already in use.`);
          }
        }

        if (replaceAssessmentId || overwriteScores) {
          // Either an existing assessment's scores or leftover unassessed
          // scores are sitting in this slot — clear them from local state so
          // the new score rows we're about to add don't end up duplicated
          // alongside them (unlike the online path, this local array isn't
          // deduped by an upsert onConflict key).
          setAssessmentScores((current) =>
            current.filter(
              (row) =>
                !(
                  row.period?.code === period &&
                  row.category === category &&
                  Number(row.item_no) === itemNo
                ),
            ),
          );
        }

        const assessmentId =
          createLocalId();
        const accessKey = createAssessmentAccessKey();
        const questionRows = questions.map((question, index) => ({
          id:
            createLocalId(),
          assessment_id: assessmentId,
          question_no: index + 1,
          question_type: question.type,
          prompt: question.prompt,
          points: Number(question.points),
          choices: question.choices ?? [],
          correct_answer: question.correctAnswer || null,
          language: question.language || null,
          starter_code: question.starterCode || null,
          expected_output: question.expectedOutput || null,
        }));
        const maxScore = questions.reduce(
          (total, question) => total + Number(question.points || 0),
          0,
        );
        const assessment = {
          id: assessmentId,
          section_id: currentSectionId,
          period_id: periodRow.id,
          category,
          item_no: itemNo,
          access_key: accessKey,
          title: title.trim(),
          instructions: instructions?.trim() || null,
          time_limit_minutes: timeLimitMinutes ? Number(timeLimitMinutes) : null,
          available_from: serializeAssessmentDate(availableFrom),
          available_until: serializeAssessmentDate(availableUntil),
        };
        const scoreRows = students.map((student) => ({
          section_id: currentSectionId,
          period_id: periodRow.id,
          enrollment_id: student.id,
          category,
          item_no: itemNo,
          score: 0,
          max_score: maxScore,
        }));
        await queueOfflineChange("save-assessment", {
          assessment,
          questions: questionRows,
          scoreRows,
        });
        setAssessmentDefinitions((current) => [
          {
            ...assessment,
            period: { code: period },
            questions: questionRows,
          },
          ...current,
        ]);
        setAssessmentScores((current) => [
          ...current,
          ...scoreRows.map((row) => ({ ...row, period: { code: period } })),
        ]);
        return { id: assessmentId, access_key: accessKey };
      }

      if (replaceAssessmentId) {
        const { error: deleteAssessmentError } = await supabase
          .from("assessments")
          .delete()
          .eq("id", replaceAssessmentId)
          .eq("section_id", currentSectionId);
        if (deleteAssessmentError) throw deleteAssessmentError;
      }

      const [{ data: existingAssessments, error: existingAssessmentError }, { data: existingScores, error: existingScoreError }] = await Promise.all([
        supabase
          .from("assessments")
          .select("id, item_no, title")
          .eq("section_id", currentSectionId)
          .eq("period_id", periodRow.id)
          .eq("category", category),
        supabase
          .from("assessment_scores")
          .select("item_no")
          .eq("section_id", currentSectionId)
          .eq("period_id", periodRow.id)
          .eq("category", category),
      ]);
      if (existingAssessmentError) throw existingAssessmentError;
      if (existingScoreError) throw existingScoreError;
      const usedByAssessment = new Set(
        (existingAssessments ?? []).map((item) => Number(item.item_no)),
      );
      const usedByScoresOnly = new Set(
        (existingScores ?? [])
          .map((item) => Number(item.item_no))
          .filter((itemNumber) => !usedByAssessment.has(itemNumber)),
      );
      const itemLimit = assessmentItemLimits[category] ?? 1;
      let itemNo;
      if (requestedItemNo) {
        const candidate = Number(requestedItemNo);
        if (!Number.isInteger(candidate) || candidate < 1 || candidate > itemLimit) {
          throw new Error(`Item number must be between 1 and ${itemLimit} for this type.`);
        }
        // Note: when replaceAssessmentId was set, that assessment's own row
        // was already deleted above, so a legitimate replace no longer trips
        // this check — only a *different* assessment occupying the slot will.
        if (usedByAssessment.has(candidate)) {
          // This query reflects the live DB, not the modal's (possibly stale)
          // cached assessments list, so this can fire even when the modal's
          // own client-side conflict check found nothing. Attach who actually
          // occupies the slot so the modal can still offer a replace-confirm
          // dialog instead of a dead-end error.
          const occupyingAssessment = (existingAssessments ?? []).find(
            (item) => Number(item.item_no) === candidate,
          );
          const conflictError = new Error(
            `Item ${candidate} for this type and period is already used by another assessment.`,
          );
          if (occupyingAssessment) {
            conflictError.conflict = { id: occupyingAssessment.id, title: occupyingAssessment.title };
          }
          throw conflictError;
        }
        if (usedByScoresOnly.has(candidate) && !overwriteScores) {
          // No assessment occupies this slot — it just already has recorded
          // scores. There's nothing to "replace", so this needs a different
          // confirmation: overwrite those scores.
          const scoreConflictError = new Error(
            `Item ${candidate} for this type and period already has recorded scores. Creating this assessment will reset those scores to 0 for every student.`,
          );
          scoreConflictError.scoreConflict = true;
          throw scoreConflictError;
        }
        itemNo = candidate;
        if (replaceAssessmentId) {
          const { error: deleteScoresError } = await supabase
            .from("assessment_scores")
            .delete()
            .eq("section_id", currentSectionId)
            .eq("period_id", periodRow.id)
            .eq("category", category)
            .eq("item_no", itemNo);
          if (deleteScoresError) throw deleteScoresError;
        }
      } else {
        itemNo = Array.from({ length: itemLimit }, (_, index) => index + 1).find(
          (candidate) => !usedByAssessment.has(candidate) && !usedByScoresOnly.has(candidate),
        );
        if (!itemNo) {
          throw new Error(`All ${itemLimit} ${category} score columns are already in use.`);
        }
      }

      const { data: assessment, error: assessmentError } = await supabase
        .from("assessments")
        .insert({
          section_id: currentSectionId,
          period_id: periodRow.id,
          category,
          item_no: itemNo,
          access_key: createAssessmentAccessKey(),
          title: title.trim(),
          instructions: instructions?.trim() || null,
          time_limit_minutes: timeLimitMinutes ? Number(timeLimitMinutes) : null,
          available_from: serializeAssessmentDate(availableFrom),
          available_until: serializeAssessmentDate(availableUntil),
        })
        .select("id, access_key")
        .single();
      if (assessmentError) throw assessmentError;

      const questionRows = questions.map((question, index) => ({
        assessment_id: assessment.id,
        question_no: index + 1,
        question_type: question.type,
        prompt: question.prompt,
        points: Number(question.points),
        choices: question.choices ?? [],
        correct_answer: question.correctAnswer || null,
        language: question.language || null,
        starter_code: question.starterCode || null,
        expected_output: question.expectedOutput || null,
      }));
      const { error: questionError } = await supabase
        .from("assessment_questions")
        .insert(questionRows);
      if (questionError) {
        await supabase.from("assessments").delete().eq("id", assessment.id);
        throw questionError;
      }
      const maxScore = questions.reduce(
        (total, question) => total + Number(question.points || 0),
        0,
      );
      const initialScoreRows = students.map((student) => ({
        section_id: currentSectionId,
        period_id: periodRow.id,
        enrollment_id: student.id,
        category,
        item_no: itemNo,
        score: 0,
        max_score: maxScore,
      }));
      if (initialScoreRows.length) {
        const { error: scoreError } = await supabase
          .from("assessment_scores")
          .upsert(initialScoreRows, {
            onConflict: "section_id,period_id,enrollment_id,category,item_no",
          });
        if (scoreError) throw scoreError;
      }
      await loadLiveData(currentSectionId);
      return assessment;
    },
    [
      assessmentDefinitions,
      assessmentScores,
      currentSectionId,
      gradingPeriods,
      loadLiveData,
      queueOfflineChange,
      students,
    ],
  );

  /**
   * Update an existing assessment's details/questions, and optionally move
   * it to a new category/period/item-number slot.
   *
   * This mirrors saveAssessment's replace flow: if the target slot is
   * already occupied by a *different* assessment, the caller must confirm
   * the replacement first (see AssessmentManager's pendingReplace state)
   * and pass that assessment's id as `replaceAssessmentId`. When confirmed:
   *   - the conflict check ignores the slot IF it's occupied by exactly
   *     that assessment (any other occupant is still a hard error — the
   *     confirmation the user saw was only for the assessment they were
   *     shown, and a stale confirmation shouldn't silently apply to a
   *     different occupant);
   *   - the conflicting assessment (and its questions, via DB cascade /
   *     local state) is deleted;
   *   - any previously recorded assessment_scores for that conflicting
   *     assessment's section/period/category/item_no are cleared, since
   *     they belonged to its question set and point scale, not this one's.
   */
  const updateAssessment = useCallback(
    async ({ assessmentId, itemNo, title, category, period, instructions, timeLimitMinutes, availableFrom, availableUntil, questions, replaceAssessmentId }) => {
      if (!currentSectionId)
        throw new Error("No active Supabase section.");
      const periodRow = gradingPeriods.find((item) => item.code === period);
      if (!periodRow) throw new Error("The selected grading period is not available.");
      if (!title?.trim()) throw new Error("An assessment title is required.");
      if (!Array.isArray(questions) || !questions.length)
        throw new Error("Add at least one assessment question.");

      const conflict = assessmentDefinitions.find(
        (item) =>
          item.id !== assessmentId &&
          item.category === category &&
          item.period?.code === period &&
          Number(item.item_no) === Number(itemNo),
      );
      const confirmedReplace = Boolean(conflict) && conflict.id === replaceAssessmentId;
      if (conflict && !confirmedReplace) {
        const conflictError = new Error(
          `Item ${itemNo} for this type and period is already used by another assessment.`,
        );
        conflictError.conflict = { id: conflict.id, title: conflict.title };
        throw conflictError;
      }

      if (browserIsOffline() || !supabase) {
        if (confirmedReplace) {
          await queueOfflineChange("delete-assessment", {
            assessmentId: conflict.id,
            sectionId: currentSectionId,
          });
          setAssessmentDefinitions((current) =>
            current.filter((item) => item.id !== conflict.id),
          );
          setAssessmentScores((current) =>
            current.filter(
              (row) =>
                !(
                  row.period?.code === conflict.period?.code &&
                  row.category === conflict.category &&
                  Number(row.item_no) === Number(conflict.item_no)
                ),
            ),
          );
        }

        const existing = assessmentDefinitions.find((item) => item.id === assessmentId);
        const questionRows = questions.map((question, index) => ({
          id:
            createLocalId(),
          assessment_id: assessmentId,
          question_no: index + 1,
          question_type: question.type,
          prompt: question.prompt,
          points: Number(question.points),
          choices: question.choices ?? [],
          correct_answer: question.correctAnswer || null,
          language: question.language || null,
          starter_code: question.starterCode || null,
          expected_output: question.expectedOutput || null,
        }));
        const maxScore = questions.reduce(
          (total, question) => total + Number(question.points || 0),
          0,
        );
        const assessment = {
          id: assessmentId,
          section_id: currentSectionId,
          period_id: periodRow.id,
          category,
          item_no: Number(itemNo ?? existing?.item_no),
          access_key: existing?.access_key,
          title: title.trim(),
          instructions: instructions?.trim() || null,
          time_limit_minutes: timeLimitMinutes ? Number(timeLimitMinutes) : null,
          available_from: serializeAssessmentDate(availableFrom),
          available_until: serializeAssessmentDate(availableUntil),
        };
        await queueOfflineChange("update-assessment", {
          assessmentId,
          itemNo,
          assessment,
          questions: questionRows,
          maxScore,
        });
        setAssessmentDefinitions((current) =>
          current.map((item) =>
            item.id === assessmentId
              ? { ...assessment, period: { code: period }, questions: questionRows }
              : item,
          ),
        );
        setAssessmentScores((current) =>
          current.map((row) =>
            row.section_id === currentSectionId &&
            row.category === category &&
            Number(row.item_no) === Number(itemNo)
              ? { ...row, max_score: maxScore }
              : row,
          ),
        );
        return { id: assessmentId, access_key: existing?.access_key };
      }

      if (confirmedReplace) {
        const { error: deleteConflictError } = await supabase
          .from("assessments")
          .delete()
          .eq("id", conflict.id)
          .eq("section_id", currentSectionId);
        if (deleteConflictError) throw deleteConflictError;
        const { error: deleteConflictScoresError } = await supabase
          .from("assessment_scores")
          .delete()
          .eq("section_id", currentSectionId)
          .eq("period_id", conflict.period_id)
          .eq("category", conflict.category)
          .eq("item_no", conflict.item_no);
        if (deleteConflictScoresError) throw deleteConflictScoresError;
      }

      const { data: assessment, error: assessmentError } = await supabase
        .from("assessments")
        .update({
          title: title.trim(),
          category,
          period_id: periodRow.id,
          item_no: Number(itemNo),
          instructions: instructions?.trim() || null,
          time_limit_minutes: timeLimitMinutes ? Number(timeLimitMinutes) : null,
          available_from: serializeAssessmentDate(availableFrom),
          available_until: serializeAssessmentDate(availableUntil),
        })
        .eq("id", assessmentId)
        .eq("section_id", currentSectionId)
        .select("id, access_key")
        .single();
      if (assessmentError) throw assessmentError;

      const { error: clearQuestionsError } = await supabase
        .from("assessment_questions")
        .delete()
        .eq("assessment_id", assessmentId);
      if (clearQuestionsError) throw clearQuestionsError;
      const questionRows = questions.map((question, index) => ({
        assessment_id: assessmentId,
        question_no: index + 1,
        question_type: question.type,
        prompt: question.prompt,
        points: Number(question.points),
        choices: question.choices ?? [],
        correct_answer: question.correctAnswer || null,
        language: question.language || null,
        starter_code: question.starterCode || null,
        expected_output: question.expectedOutput || null,
      }));
      const { error: questionError } = await supabase
        .from("assessment_questions")
        .insert(questionRows);
      if (questionError) throw questionError;
      const maxScore = questions.reduce(
        (total, question) => total + Number(question.points || 0),
        0,
      );
      if (itemNo) {
        const { error: scoreMaxError } = await supabase
          .from("assessment_scores")
          .update({ max_score: maxScore })
          .eq("section_id", currentSectionId)
          .eq("period_id", periodRow.id)
          .eq("category", category)
          .eq("item_no", Number(itemNo));
        if (scoreMaxError) throw scoreMaxError;
      }
      await loadLiveData(currentSectionId);
      return assessment;
    },
    [
      assessmentDefinitions,
      currentSectionId,
      gradingPeriods,
      loadLiveData,
      queueOfflineChange,
    ],
  );

  /**
   * Delete an assessment and the assessment_scores rows that belong to it.
   *
   * assessment_scores isn't linked to assessments by a foreign key — it's
   * keyed by (section_id, period_id, category, item_no), the same slot key
   * used for the "Record Score" columns that work even without a formal
   * assessment attached. Deleting the assessments row alone (even with the
   * DB cascade on assessment_questions) therefore left those score rows
   * behind. We look the assessment up first so we know which slot to
   * clear, and clear it in both the online and offline paths.
   */
  const deleteAssessment = useCallback(
    async (assessmentId) => {
      if (!currentSectionId)
        throw new Error("No active Supabase section.");
      const target = assessmentDefinitions.find((item) => item.id === assessmentId);
      if (browserIsOffline() || !supabase) {
        await queueOfflineChange("delete-assessment", {
          assessmentId,
          sectionId: currentSectionId,
        });
        setAssessmentDefinitions((current) =>
          current.filter((item) => item.id !== assessmentId),
        );
        if (target) {
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
        }
        return;
      }
      const { error } = await supabase
        .from("assessments")
        .delete()
        .eq("id", assessmentId)
        .eq("section_id", currentSectionId);
      if (error) throw error;
      if (target) {
        const { error: scoresError } = await supabase
          .from("assessment_scores")
          .delete()
          .eq("section_id", currentSectionId)
          .eq("period_id", target.period_id)
          .eq("category", target.category)
          .eq("item_no", target.item_no);
        if (scoresError) throw scoresError;
      }
      await loadLiveData(currentSectionId);
    },
    [assessmentDefinitions, currentSectionId, loadLiveData, queueOfflineChange],
  );

  const grantAssessmentAttempt = useCallback(
    async ({ assessmentId, studentId }) => {
      if (!currentSectionId) throw new Error("No active Supabase section.");
      if (!assessmentId || !studentId) throw new Error("Select an assessment and student.");
      const payload = {
        assessment_id: assessmentId,
        student_id: studentId,
        section_id: currentSectionId,
      };
      const lanResult = await callLanApi("/api/assessment-attempt-grants", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (lanResult?.grant) {
        const grant = lanResult.grant;
        setAssessmentAttemptGrants((current) => [
          ...current.filter((item) => item.id !== grant.id),
          grant,
        ]);
        setAssessmentDefinitions((current) =>
          current.map((assessment) =>
            assessment.id === assessmentId
              ? {
                  ...assessment,
                  attemptGrants: [
                    ...(assessment.attemptGrants ?? []).filter((item) => item.id !== grant.id),
                    grant,
                  ],
                }
              : assessment,
          ),
        );
        return grant;
      }
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
      await callLanApi("/api/sync", { method: "POST" });
      await loadLiveData(currentSectionId);
      return grant;
    },
    [currentSectionId, loadLiveData, queueOfflineChange],
  );

  const loadStudentAssessment = useCallback(async ({ accessKey, studentNumber }) => {
    const normalizedKey = accessKey?.trim().toUpperCase();
    const normalizedStudentNumber = studentNumber?.trim();
    if (!normalizedKey) throw new Error("Enter the Assessment Key ID.");
    if (!normalizedStudentNumber) throw new Error("Enter your student ID number.");

    const lanResult = await callLanApi(
      `/api/student-assessment?accessKey=${encodeURIComponent(normalizedKey)}&studentNumber=${encodeURIComponent(normalizedStudentNumber)}`,
    );
    if (lanResult) return lanResult;

    if (browserIsOffline() || !supabase) {
      const cachedSections = (await readOfflineSnapshot("sections")) ?? sections;
      const cachedSnapshots = await Promise.all(
        cachedSections.map((item) => readOfflineSnapshot(`section:${item.id}`)),
      );
      const cachedAssessment = cachedSnapshots
        .flatMap((snapshot) => snapshot?.assessmentDefinitions ?? [])
        .find((item) => item.access_key?.toUpperCase() === normalizedKey);
      if (!cachedAssessment) throw new Error("Assessment Key ID not found offline.");
      const cachedSection =
        cachedSections.find((item) => item.id === cachedAssessment.section_id) ??
        cachedAssessment.section;
      const cachedSnapshot =
        cachedSnapshots.find(
          (snapshot) => snapshot?.section?.id === cachedAssessment.section_id,
        ) ?? null;
      const cachedStudent = (cachedSnapshot?.students ?? students).find(
        (item) => String(item.number).trim() === normalizedStudentNumber,
      );
      if (!cachedStudent) throw new Error("Student ID number not found offline.");
      return {
        assessment: {
          ...cachedAssessment,
          section: cachedSection,
        },
        enrollmentId: cachedStudent.id,
        attemptsUsed: 0,
        attemptsRemaining: 1,
        attemptNumber: 1,
        attemptLimit: 1,
        availableFrom: cachedAssessment.available_from || null,
        availableUntil: cachedAssessment.available_until || null,
        serverNow: new Date().toISOString(),
        student: {
          id: cachedStudent.studentId ?? cachedStudent.id,
          number: cachedStudent.number,
          name: cachedStudent.name,
        },
      };
    }

    let { data: assessment, error: assessmentError } = await supabase
      .from("assessments")
      .select(
        "id, section_id, period_id, category, item_no, access_key, title, instructions, time_limit_minutes, available_from, available_until, created_at, period:grading_periods(code), section:sections(id, subject_code, subject_title), questions:assessment_questions(id, question_no, question_type, prompt, points, choices, correct_answer, language, starter_code, expected_output)",
      )
      .eq("access_key", normalizedKey)
      .maybeSingle();
    if (assessmentError) {
      const fallbackAssessment = await supabase
        .from("assessments")
        .select(
          "id, section_id, period_id, category, item_no, access_key, title, instructions, created_at, period:grading_periods(code), section:sections(id, subject_code, subject_title), questions:assessment_questions(id, question_no, question_type, prompt, points, choices, correct_answer, language, starter_code, expected_output)",
        )
        .eq("access_key", normalizedKey)
        .maybeSingle();
      if (fallbackAssessment.error) throw assessmentError;
      assessment = fallbackAssessment.data
        ? { ...fallbackAssessment.data, time_limit_minutes: null, available_from: null, available_until: null }
        : null;
    }
    if (!assessment) throw new Error("Assessment Key ID not found.");

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, student_no, full_name")
      .eq("student_no", normalizedStudentNumber)
      .maybeSingle();
    if (studentError) throw studentError;
    if (!student) throw new Error("Student ID number not found.");

    const { data: enrollment, error: enrollmentError } = await supabase
      .from("enrollments")
      .select("id")
      .eq("section_id", assessment.section_id)
      .eq("student_id", student.id)
      .maybeSingle();
    if (enrollmentError) throw enrollmentError;
    if (!enrollment) throw new Error("This student is not enrolled in the assessment class.");

    const { data: grantRow } = await supabase
      .from("assessment_attempt_grants")
      .select("extra_attempts")
      .eq("assessment_id", assessment.id)
      .eq("student_id", student.id)
      .maybeSingle();
    const grantedAttempts = Math.max(0, Number(grantRow?.extra_attempts || 0));
    assessment = {
      ...assessment,
      attemptGrants: grantRow ? [grantRow] : [],
    };
    const { count: attemptCount, error: attemptCountError } = await supabase
      .from("assessment_attempts")
      .select("id", { count: "exact", head: true })
      .eq("assessment_id", assessment.id)
      .eq("student_id", student.id);
    if (!attemptCountError) {
      const attemptsUsed = attemptCount || 0;
      const attemptLimit = 1 + grantedAttempts;
      if (attemptsUsed >= attemptLimit) {
        throw new Error(`You have used all ${attemptLimit} allowed attempt${attemptLimit === 1 ? "" : "s"}.`);
      }
      const now = Date.now();
      const availableFrom = assessment.available_from ? Date.parse(assessment.available_from) : NaN;
      const availableUntil = assessment.available_until ? Date.parse(assessment.available_until) : NaN;
      if (Number.isFinite(availableFrom) && now < availableFrom) throw new Error("This assessment is not open yet.");
      if (Number.isFinite(availableUntil) && now > availableUntil) throw new Error("The answer time for this assessment has ended.");
      return {
        assessment,
        enrollmentId: enrollment.id,
        attemptsUsed,
        attemptsRemaining: attemptLimit - attemptsUsed,
        attemptNumber: attemptsUsed + 1,
        attemptLimit,
        availableFrom: assessment.available_from || null,
        availableUntil: assessment.available_until || null,
        serverNow: new Date().toISOString(),
        student: { id: student.id, number: student.student_no, name: student.full_name },
      };
    }

    return {
      assessment,
      enrollmentId: enrollment.id,
      attemptsUsed: 0,
      attemptsRemaining: 1 + grantedAttempts,
      attemptNumber: 1,
      attemptLimit: 1 + grantedAttempts,
      availableFrom: assessment.available_from || null,
      availableUntil: assessment.available_until || null,
      serverNow: new Date().toISOString(),
      student: {
        id: student.id,
        number: student.student_no,
        name: student.full_name,
      },
    };
  }, [sections, students]);

  const submitAssessment = useCallback(
    async ({ assessmentId, studentId, answers, assessment: loadedAssessment, enrollmentId, attemptNumber = 1, autoSubmit = false, violations = [] }) => {
      const assessment =
        loadedAssessment ??
        assessmentDefinitions.find((item) => item.id === assessmentId);
      if (!assessment) throw new Error("The selected assessment was not found.");
      const grantedAttempts = Math.max(
        0,
        Number(
          assessment.attemptGrants?.find((grant) => grant.student_id === studentId)
            ?.extra_attempts || 0,
        ),
      );
      const attemptLimit = 1 + grantedAttempts;
      const targetSectionId = currentSectionId ?? assessment.section_id;
      if (!targetSectionId) throw new Error("No active Supabase section.");
      if (!loadedAssessment && !students.some((student) => student.id === studentId))
        throw new Error("Select a valid student before submitting.");
      if (!enrollmentId) throw new Error("The student enrollment could not be identified.");

      const questions = [...(assessment.questions ?? [])].sort(
        (first, second) => Number(first.question_no) - Number(second.question_no),
      );
      const maxScore = questions.reduce(
        (total, question) => total + Number(question.points || 0),
        0,
      );
      const answerRows = questions.map((question) => {
        const answer = String(answers?.[question.id] ?? "");
        const isMultipleChoice = question.question_type === "multiple_choice";
        const hasExpectedCodingAnswer = Boolean(question.expected_output?.trim());
        const codingSimilarity = hasExpectedCodingAnswer
          ? answerSimilarity(answer, question.expected_output)
          : 0;
        const isCorrect = isMultipleChoice
          ? answer === question.correct_answer
          : hasExpectedCodingAnswer && codingSimilarity === 1;
        const isPartial =
          !isMultipleChoice &&
          hasExpectedCodingAnswer &&
          codingSimilarity >= 0.75 &&
          codingSimilarity < 1;
        const pointsMultiplier = isCorrect ? 1 : isPartial ? 0.5 : 0;
        return {
          question_id: question.id,
          answer,
          is_correct: isMultipleChoice || hasExpectedCodingAnswer ? isCorrect : null,
          points_earned: Number(question.points || 0) * pointsMultiplier,
        };
      });
      if (!autoSubmit && answerRows.some((answer) => !answer.answer.trim())) {
        throw new Error("Answer every question before submitting.");
      }
      const score = answerRows.reduce(
        (total, answer) => total + Number(answer.points_earned || 0),
        0,
      );
      const needsReview = questions.some(
        (question) =>
          question.question_type === "coding" &&
          !question.expected_output?.trim(),
      );

      const lanAttemptId = createLocalId();
      const lanResult = await callLanApi("/api/student-assessment/submit", {
        method: "POST",
        body: JSON.stringify({
          attempt: {
            id: lanAttemptId,
            assessment_id: assessmentId,
            student_id: studentId,
            status: needsReview ? "needs_review" : "submitted",
            score,
            max_score: maxScore,
            attempt_no: Number(attemptNumber) || 1,
            submitted_at: new Date().toISOString(),
          },
          answers: answerRows.map((answer) => ({
            ...answer,
            attempt_id: lanAttemptId,
          })),
          violations,
          score: {
            section_id: assessment.section_id,
            period_id: assessment.period_id,
            enrollment_id: enrollmentId,
            category: assessment.category,
            item_no: assessment.item_no,
            score,
            max_score: maxScore,
          },
          periodCode: assessment.period?.code || null,
          autoSubmit,
        }),
      });
      if (lanResult) return lanResult;

      if (browserIsOffline() || !supabase) {
        if (!assessment.item_no) {
          throw new Error("This assessment is missing its Record Score column.");
        }
        const attemptId =
          createLocalId();
        await queueOfflineChange("submit-assessment", {
          attempt: {
            id: attemptId,
            assessment_id: assessmentId,
            student_id: studentId,
            attempt_no: Number(attemptNumber) || 1,
            status: needsReview ? "needs_review" : "submitted",
            score,
            max_score: maxScore,
            submitted_at: new Date().toISOString(),
          },
          answers: answerRows.map((answer) => ({ ...answer, attempt_id: attemptId })),
          violations: violations.map((violation) => ({
            ...violation,
            assessment_id: assessmentId,
            student_id: studentId,
            attempt_no: Number(attemptNumber) || 1,
          })),
          score: {
            section_id: targetSectionId,
            period_id: assessment.period_id,
            enrollment_id: enrollmentId,
            category: assessment.category,
            item_no: assessment.item_no,
            score,
            max_score: maxScore,
          },
        });
        return {
          score,
          maxScore,
          needsReview,
          queued: true,
          attemptNumber: Number(attemptNumber) || 1,
          attemptsRemaining: Math.max(0, attemptLimit - (Number(attemptNumber) || 1)),
          autoSubmitted: autoSubmit,
        };
      }
      const { data: attempt, error: attemptError } = await supabase
        .from("assessment_attempts")
        .insert(
          {
            assessment_id: assessmentId,
            student_id: studentId,
            attempt_no: Number(attemptNumber) || 1,
            status: needsReview ? "needs_review" : "submitted",
            score,
            max_score: maxScore,
            submitted_at: new Date().toISOString(),
          },
        )
        .select("id")
        .single();
      if (attemptError) throw attemptError;

      const { error: clearAnswersError } = await supabase
        .from("assessment_answers")
        .delete()
        .eq("attempt_id", attempt.id);
      if (clearAnswersError) throw clearAnswersError;
      if (answerRows.length) {
        const { error: answerError } = await supabase
          .from("assessment_answers")
          .insert(answerRows.map((answer) => ({ ...answer, attempt_id: attempt.id })));
        if (answerError) throw answerError;
      }
      if (violations.length) {
        const { error: violationError } = await supabase
          .from("assessment_violations")
          .insert(violations.map((violation) => ({
            ...violation,
            assessment_id: assessmentId,
            student_id: studentId,
            attempt_no: Number(attemptNumber) || 1,
          })));
        if (violationError) throw violationError;
      }
      if (!assessment.item_no) {
        throw new Error("This assessment is missing its Record Score column. Re-run the latest schema migration.");
      }
      const { error: scoreError } = await supabase
        .from("assessment_scores")
        .upsert(
          {
            section_id: assessment.section_id,
            period_id: assessment.period_id,
            enrollment_id: enrollmentId,
            category: assessment.category,
            item_no: assessment.item_no,
            score,
            max_score: maxScore,
          },
          { onConflict: "section_id,period_id,enrollment_id,category,item_no" },
        );
      if (scoreError) throw scoreError;
      await loadLiveData(assessment.section_id);
      return {
        score,
        maxScore,
        needsReview,
        attemptNumber: Number(attemptNumber) || 1,
        attemptsRemaining: Math.max(0, attemptLimit - (Number(attemptNumber) || 1)),
        autoSubmitted: autoSubmit,
      };
    },
    [
      assessmentDefinitions,
      currentSectionId,
      loadLiveData,
      queueOfflineChange,
      students,
    ],
  );

  const addStudent = useCallback(
    async (student) => {
      if (!currentSectionId)
        throw new Error("No active Supabase section.");
      if (browserIsOffline() || !supabase) {
        const studentId =
          createLocalId();
        const enrollmentId =
          createLocalId();
        const studentRow = {
          id: studentId,
          ...student,
          gender: student.gender || null,
        };
        const enrollment = {
          id: enrollmentId,
          section_id: currentSectionId,
          student_id: studentId,
          ctrl_no: students.length + 1,
          status: "active",
        };
        await queueOfflineChange("add-student", {
          student: studentRow,
          enrollment,
        });
        const fullName = student.full_name || "Unnamed student";
        setStudents((current) => [
          ...current,
          {
            id: enrollmentId,
            studentId,
            ctrlNo: enrollment.ctrl_no,
            name: fullName,
            initials: fullName
              .split(" ")
              .map((part) => part[0])
              .slice(0, 2)
              .join("")
              .toUpperCase(),
            color: "plum",
            number: student.student_no || `CTRL-${enrollment.ctrl_no}`,
            gender: student.gender || "—",
            attendance: 0,
            grades: {},
            grade: 0,
            status: "On track",
          },
        ]);
        return;
      }
      const { data: createdStudent, error: studentError } = await supabase
        .from("students")
        .insert({ ...student, gender: student.gender || null })
        .select("id")
        .single();
      if (studentError) throw studentError;
      const { error: enrollmentError } = await supabase
        .from("enrollments")
        .insert({
          section_id: currentSectionId,
          student_id: createdStudent.id,
          status: "active",
        });
      if (enrollmentError) throw enrollmentError;
      await loadLiveData(currentSectionId);
    },
    [currentSectionId, loadLiveData, queueOfflineChange, students.length],
  );

  const updateStudent = useCallback(
    async ({ studentId, enrollmentId, sectionId, ctrlNo, ...student }) => {
      if (!studentId || !enrollmentId || !sectionId) {
        throw new Error("Student information is incomplete.");
      }
      const studentPayload = {
        id: studentId,
        student_no: String(student.student_no ?? "").trim() || null,
        full_name: String(student.full_name ?? "").trim(),
        gender: student.gender || null,
        course: String(student.course ?? "").trim() || null,
        year_level: String(student.year_level ?? "").trim() || null,
        contact_no: String(student.contact_no ?? "").trim() || null,
        email: String(student.email ?? "").trim() || null,
        photo_url: student.photo_url || null,
      };
      if (!studentPayload.full_name) throw new Error("Full name is required.");
      const nextCtrlNo = Number(ctrlNo);
      if (!Number.isInteger(nextCtrlNo) || nextCtrlNo < 1) {
        throw new Error("Control number must be a positive whole number.");
      }
      if (browserIsOffline() || !supabase) {
        await queueOfflineChange("update-student", {
          student: studentPayload,
          enrollment: { id: enrollmentId, section_id: sectionId, ctrl_no: nextCtrlNo },
        });
        setStudents((current) => current.map((item) => item.id === enrollmentId
          ? { ...item, ctrlNo: nextCtrlNo, name: studentPayload.full_name, number: studentPayload.student_no || `CTRL-${nextCtrlNo}`, gender: studentPayload.gender || "—", course: studentPayload.course || "", yearLevel: studentPayload.year_level || "", contactNo: studentPayload.contact_no || "", email: studentPayload.email || "", photoUrl: studentPayload.photo_url || "" }
          : item));
        return;
      }
      const { error: studentError } = await supabase
        .from("students")
        .update(studentPayload)
        .eq("id", studentId);
      if (studentError) throw studentError;
      const { error: enrollmentError } = await supabase
        .from("enrollments")
        .update({ ctrl_no: nextCtrlNo })
        .eq("id", enrollmentId)
        .eq("section_id", sectionId);
      if (enrollmentError) throw enrollmentError;
      await loadLiveData(sectionId);
    },
    [browserIsOffline, loadLiveData, queueOfflineChange, setStudents, supabase],
  );

  const updateSection = useCallback(
    async (sectionId, changes) => {
      if (!sectionId) throw new Error("No class was selected for editing.");

      const subjectCode = String(changes?.subject_code ?? "").trim();
      if (!subjectCode) throw new Error("Subject code is required.");

      const sectionChanges = {
        days: String(changes?.days ?? "").trim() || null,
        time_start: changes?.time_start || null,
        time_end: changes?.time_end || null,
        edp_code: String(changes?.edp_code ?? "").trim() || null,
        subject_code: subjectCode,
        subject_title: String(changes?.subject_title ?? "").trim() || null,
        room: String(changes?.room ?? "").trim() || null,
        year_level: String(changes?.year_level ?? "").trim() || null,
        section_no: String(changes?.section_no ?? "").trim() || null,
      };

      if (browserIsOffline() || !supabase) {
        await queueOfflineChange("update-section", {
          sectionId,
          changes: sectionChanges,
        });
        setSections((current) =>
          current.map((item) =>
            item.id === sectionId ? { ...item, ...sectionChanges } : item,
          ),
        );
        setSection((current) =>
          current?.id === sectionId ? { ...current, ...sectionChanges } : current,
        );
        return;
      }

      const { error } = await supabase
        .from("sections")
        .update(sectionChanges)
        .eq("id", sectionId);
      if (error) throw error;
      await loadLiveData(sectionId);
    },
    [loadLiveData, queueOfflineChange],
  );

  const deleteSection = useCallback(
    async (sectionId) => {
      if (!sectionId)
        throw new Error("No class was selected for deletion.");

      if (browserIsOffline() || !supabase) {
        await queueOfflineChange("delete-section", { sectionId });
        setSections((current) => current.filter((item) => item.id !== sectionId));
        if (currentSectionId === sectionId) clearLiveData();
        return;
      }

      const { data: enrollments, error: enrollmentError } = await supabase
        .from("enrollments")
        .select("student_id")
        .eq("section_id", sectionId);
      if (enrollmentError) throw enrollmentError;

      // The database cascades this deletion to enrollments, scores, grades,
      // class sessions, and attendance records.
      const { error: sectionError } = await supabase
        .from("sections")
        .delete()
        .eq("id", sectionId);
      if (sectionError) throw sectionError;

      // Keep shared student profiles, but remove profiles that no longer
      // belong to any class.
      const studentIds = [
        ...new Set((enrollments ?? []).map((enrollment) => enrollment.student_id)),
      ];
      if (studentIds.length) {
        const { data: remainingEnrollments, error: remainingError } = await supabase
          .from("enrollments")
          .select("student_id")
          .in("student_id", studentIds);
        if (!remainingError) {
          const remainingIds = new Set(
            (remainingEnrollments ?? []).map((enrollment) => enrollment.student_id),
          );
          const orphanedStudentIds = studentIds.filter(
            (studentId) => !remainingIds.has(studentId),
          );
          if (orphanedStudentIds.length) {
            await supabase.from("students").delete().in("id", orphanedStudentIds);
          }
        }
      }

      await loadLiveData();
    },
    [clearLiveData, currentSectionId, loadLiveData, queueOfflineChange],
  );

  const flushOfflineMutations = useCallback(async () => {
    if (!accountScoped || !accountId || !supabase || browserIsOffline()) return;
    const mutations = await listOfflineMutations();
    setPendingSyncCount(mutations.length);
    if (!mutations.length) return;

    const affectedSections = new Set();
    try {
      for (const mutation of mutations) {
        const result = await replayOfflineMutation({
          supabase,
          mutation,
          importMasterList: (file) => importMasterListFile({ file, supabase, userId: accountId }),
          importGradeSheet: (file) => importGradeSheetFile({ file, supabase, userId: accountId }),
        });
        if (result?.sectionId) affectedSections.add(result.sectionId);
        await removeOfflineMutation(mutation.id);
        setPendingSyncCount((current) => Math.max(current - 1, 0));
      }

      for (const sectionId of affectedSections) {
        const loaded = await loadLiveData(sectionId);
        if (loaded?.students?.length && loaded.periods?.length) {
          // See the comment in importGradeSheet: recalculatePeriodGrades
          // recomputes every period for the section in one call, so looping
          // over each period here just repeated the same full rewrite.
          await recalculatePeriodGrades(loaded.periods[0].id, sectionId, loaded.students);
          await loadLiveData(sectionId);
        }
      }
      setConnectionStatus("live");
      setConnectionMessage("Online · changes synced");
    } catch (error) {
      if (isNetworkError(error)) {
        setConnectionStatus("offline");
        setConnectionMessage("Offline · changes remain queued");
      } else {
        setConnectionStatus("error");
        setConnectionMessage("Sync paused · " + (error.message ?? "retrying later"));
      }
      setPendingSyncCount(await countOfflineMutations());
    }
  }, [accountId, accountScoped, loadLiveData, recalculatePeriodGrades]);

  return {
    selectSection,
    saveGradingPeriods,
    importMasterList,
    syncToExcel,
    refreshGrades,
    importGradeSheet,
    saveAttendance,
    saveGrades,
    saveAssessmentScores,
    saveAssessment,
    updateAssessment,
    deleteAssessment,
    grantAssessmentAttempt,
    loadStudentAssessment,
    submitAssessment,
    addStudent,
    updateStudent,
    updateSection,
    deleteSection,
    flushOfflineMutations,
  };
}