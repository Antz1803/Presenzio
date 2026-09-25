/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import { useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  formatDate,
  formatDay,
  formatShortDate,
  resolvePeriodCodeForSession,
  isNetworkError,
  toGradeRows,
} from "./dashboardUtils";
import { buildRoster } from "./dashboardRosterBuilder";
import { buildLiveStats } from "./dashboardStatsBuilder";
import { loadDashboardRecords } from "./dashboardRecordsLoader";

function browserIsOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function useDashboardLiveLoader(context) {
  const {
    accountId,
    accountScoped,
    currentSectionId,
    section,
    students,
    gradingPeriods,
    assessmentScores,
    assessmentDefinitions,
    studentGroups,
    loadOfflineData,
    clearLiveData,
    loadRequestIdRef,
    setSection,
    setSections,
    setStudents,
    setGradeRows,
    setGradingPeriods,
    setAssessmentScores,
    setAssessmentAttempts,
    setAssessmentAttemptGrants,
    setAssessmentViolations,
    setAssessmentDefinitions,
    setStudentGroups,
    setAttendanceSessions,
    setSessions,
    setStats,
    setConnectionStatus,
    setConnectionMessage,
  } = context;
  const loadLiveData = useCallback(
    async (preferredSectionId) => {
      const requestId = ++loadRequestIdRef.current;
      const isStale = () => loadRequestIdRef.current !== requestId;

      if (accountScoped && !accountId) {
        if (!isStale()) {
          clearLiveData();
          setConnectionStatus("connecting");
          setConnectionMessage("Waiting for the account session");
        }
        return null;
      }

      if (browserIsOffline()) {
        return loadOfflineData(preferredSectionId, requestId);
      }
      if (!supabase) {
        if (!isStale()) {
          setConnectionStatus("not-configured");
          setConnectionMessage("Configure Supabase to load records");
        }
        return loadOfflineData(preferredSectionId, requestId);
      }
      if (!isStale()) setConnectionStatus("connecting");
      try {
        let sectionQuery = supabase
          .from("sections")
          .select("*, school_year:school_years(label, semester)");
        if (accountScoped)
          sectionQuery = sectionQuery.eq("teacher_id", accountId);
        let { data: sectionList, error: sectionListError } =
          await sectionQuery.order("id", { ascending: false });
        if (sectionListError) {
          // Older deployments may not expose the relationship in the client
          // schema yet. Keep loading classes, just without the optional
          // school-year metadata used by Excel Settings.
          let fallbackSectionQuery = supabase.from("sections").select("*");
          if (accountScoped)
            fallbackSectionQuery = fallbackSectionQuery.eq(
              "teacher_id",
              accountId,
            );
          const fallback = await fallbackSectionQuery.order("id", {
            ascending: false,
          });
          if (fallback.error) throw sectionListError;
          sectionList = fallback.data;
          sectionListError = null;
        }
        const sectionData =
          sectionList?.find((item) => item.id === preferredSectionId) ??
          sectionList?.[0];
        if (!sectionData) {
          if (!isStale()) {
            clearLiveData();
            setConnectionStatus("live");
            setConnectionMessage("Live · Supabase");
          }
          return;
        }

        const {
          enrollments,
          allStudentsData,
          periods,
          periodGrades,
          combinedAssessmentScoreData,
          liveStudentGroups,
          liveAssessmentDefinitions,
          attemptRows,
          grantRows,
          violationRows,
          classSessions,
        } = await loadDashboardRecords({ sectionData, sectionList });

        const { sessionsData, liveRoster } = buildRoster({
          classSessions,
          periodGrades,
          periods,
          enrollments,
        });

        const { liveStats, liveAttendanceSessions, liveSessions } =
          buildLiveStats({
            allStudentsData,
            sessionsData,
            liveRoster,
            periods,
          });

        if (!isStale()) {
          setSection(sectionData);
          setSections(sectionList ?? []);
          setStudents(liveRoster);
          setGradeRows(toGradeRows(liveRoster));
          setGradingPeriods(periods ?? []);
          setAssessmentScores(combinedAssessmentScoreData);
          setAssessmentAttempts(attemptRows);
          setAssessmentAttemptGrants(grantRows);
          setAssessmentViolations(violationRows);
          setAssessmentDefinitions(liveAssessmentDefinitions);
          setStudentGroups(liveStudentGroups);
          setAttendanceSessions(liveAttendanceSessions);
          setSessions(liveSessions);
          setStats(liveStats);
          setConnectionStatus("live");
          setConnectionMessage(
            "Live · " + (sectionData.subject_code ?? "Supabase"),
          );
        }
        return {
          live: true,
          sectionId: sectionData.id,
          section: sectionData,
          students: liveRoster,
          periods: periods ?? [],
          assessmentScores: combinedAssessmentScoreData,
          assessmentDefinitions: liveAssessmentDefinitions,
          studentGroups: liveStudentGroups,
          attendanceSessions: liveAttendanceSessions,
        };
      } catch (error) {
        if (isNetworkError(error)) {
          return loadOfflineData(preferredSectionId, requestId);
        }
        if (!isStale()) {
          clearLiveData();
          setConnectionStatus("error");
          setConnectionMessage(error.message ?? "Supabase connection failed");
        }
      }
    },
    [accountId, accountScoped, clearLiveData, loadOfflineData],
  );
  return loadLiveData;
}
