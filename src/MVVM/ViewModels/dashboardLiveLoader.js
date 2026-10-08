/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import { useCallback } from "react";
import { db } from "../../lib/Firebase";
import { listSections } from "../../lib/accountDb";
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
      if (!db) {
        if (!isStale()) {
          setConnectionStatus("not-configured");
          setConnectionMessage("Configure Firebase to load records");
        }
        return loadOfflineData(preferredSectionId, requestId);
      }
      if (!isStale()) setConnectionStatus("connecting");
      try {
        const sectionList = await listSections(accountId);
        const sectionData =
          sectionList?.find((item) => item.id === preferredSectionId) ??
          sectionList?.[0];
        if (!sectionData) {
          if (!isStale()) {
            clearLiveData();
            setConnectionStatus("live");
            setConnectionMessage("Live · Firebase");
          }
          return;
        }

        const {
          enrollments,
          allStudentsData,
          studentNamesBySection,
          periods,
          periodGrades,
          combinedAssessmentScoreData,
          liveStudentGroups,
          liveAssessmentDefinitions,
          attemptRows,
          grantRows,
          violationRows,
          classSessions,
        } = await loadDashboardRecords({ uid: accountId, sectionData, sectionList });

        // Saving a Record Score can trigger a refresh while the answer query
        // is briefly incomplete. Keep answer rows that were already loaded
        // so editing a manual score cannot make View answers appear empty.
        const assessmentDefinitionsWithAnswerCache =
          liveAssessmentDefinitions.map((assessment) => {
            const previousAssessment = (assessmentDefinitions ?? []).find(
              (item) => String(item.id) === String(assessment.id),
            );
            if (!previousAssessment) return assessment;
            return {
              ...assessment,
              attempts: (assessment.attempts ?? []).map((attempt) => {
                const previousAttempt = (previousAssessment.attempts ?? []).find(
                  (item) => String(item.id) === String(attempt.id),
                );
                if (
                  (attempt.answers ?? []).length === 0 &&
                  (previousAttempt?.answers ?? []).length > 0
                ) {
                  return { ...attempt, answers: previousAttempt.answers };
                }
                return attempt;
              }),
            };
          });

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
          const sectionsWithStudentNames = (sectionList ?? []).map((item) => ({
            ...item,
            student_names: studentNamesBySection?.[item.id] ?? [],
          }));
          setSection({
            ...sectionData,
            student_names: studentNamesBySection?.[sectionData.id] ?? [],
          });
          setSections(sectionsWithStudentNames);
          setStudents(liveRoster);
          setGradeRows(toGradeRows(liveRoster));
          setGradingPeriods(periods ?? []);
          setAssessmentScores(combinedAssessmentScoreData);
          setAssessmentAttempts(attemptRows);
          setAssessmentAttemptGrants(grantRows);
          setAssessmentViolations(violationRows);
          setAssessmentDefinitions(assessmentDefinitionsWithAnswerCache);
          setStudentGroups(liveStudentGroups);
          setAttendanceSessions(liveAttendanceSessions);
          setSessions(liveSessions);
          setStats(liveStats);
          setConnectionStatus("live");
          setConnectionMessage(
            "Live · " + (sectionData.subject_code ?? "Firebase"),
          );
        }
        return {
          live: true,
          sectionId: sectionData.id,
          section: sectionData,
          students: liveRoster,
          periods: periods ?? [],
          assessmentScores: combinedAssessmentScoreData,
          assessmentDefinitions: assessmentDefinitionsWithAnswerCache,
          studentGroups: liveStudentGroups,
          attendanceSessions: liveAttendanceSessions,
        };
      } catch (error) {
        console.error("[loadLiveData] failed:", error);
        if (isNetworkError(error)) {
          return loadOfflineData(preferredSectionId, requestId);
        }
        if (!isStale()) {
          clearLiveData();
          setConnectionStatus("error");
          setConnectionMessage(error.message ?? "Firebase connection failed");
        }
      }
    },
    [accountId, accountScoped, clearLiveData, loadOfflineData],
  );
  return loadLiveData;
}
