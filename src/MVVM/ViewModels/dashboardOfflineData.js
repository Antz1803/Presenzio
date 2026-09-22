import { useCallback } from "react";
import {
  countOfflineMutations,
  readOfflineSnapshot,
} from "../../lib/offlineStore";
import { callLanApi, mergeAssessmentScores } from "./dashboardUtils";
import { emptyStats } from "./dashboardConstants";

export function useDashboardOfflineData(context) {
  const {
    setSection,
    setSections,
    setStudents,
    setGradeRows,
    setGradingPeriods,
    setAssessmentScores,
    setAssessmentDefinitions,
    setStudentGroups,
    setAssessmentAttempts,
    setAssessmentAttemptGrants,
    setAssessmentViolations,
    setAttendanceSessions,
    setSessions,
    setStats,
    setConnectionStatus,
    setConnectionMessage,
    setPendingSyncCount,
    loadRequestIdRef,
  } = context;
  const clearLiveData = useCallback(() => {
    setSection(null);
    setSections([]);
    setStudents([]);
    setGradeRows([]);
    setGradingPeriods([]);
    setAssessmentScores([]);
    setAssessmentDefinitions([]);
    setStudentGroups([]);
    setAssessmentAttempts([]);
    setAssessmentAttemptGrants([]);
    setAssessmentViolations([]);
    setAttendanceSessions([]);
    setSessions([]);
    setStats(emptyStats);
  }, []);

  const applyOfflineSnapshot = useCallback((snapshot, sectionList = []) => {
    if (!snapshot) return false;
    setSection(snapshot.section ?? null);
    setSections(sectionList.length ? sectionList : (snapshot.sections ?? []));
    setStudents(snapshot.students ?? []);
    setGradeRows(snapshot.gradeRows ?? []);
    setGradingPeriods(snapshot.gradingPeriods ?? []);
    setAssessmentScores(snapshot.assessmentScores ?? []);
    setAssessmentDefinitions(snapshot.assessmentDefinitions ?? []);
    setStudentGroups(snapshot.studentGroups ?? []);
    setAssessmentAttempts(snapshot.assessmentAttempts ?? []);
    setAssessmentAttemptGrants(snapshot.assessmentAttemptGrants ?? []);
    setAssessmentViolations(snapshot.assessmentViolations ?? []);
    setAttendanceSessions(snapshot.attendanceSessions ?? []);
    setSessions(snapshot.sessions ?? []);
    setStats(snapshot.stats ?? emptyStats);
    return true;
  }, []);

  const loadOfflineData = useCallback(
    async (preferredSectionId, requestId) => {
      const sectionList = (await readOfflineSnapshot("sections")) ?? [];
      const selectedSectionId =
        sectionList.find((item) => item.id === preferredSectionId)?.id ??
        sectionList[0]?.id;
      const snapshot = selectedSectionId
        ? await readOfflineSnapshot(`section:${selectedSectionId}`)
        : null;
      if (requestId != null && loadRequestIdRef.current !== requestId)
        return snapshot;
      if (!applyOfflineSnapshot(snapshot, sectionList)) {
        clearLiveData();
        setSections(sectionList);
      }
      if (selectedSectionId) {
        const lanScores = await callLanApi(
          `/api/submissions?sectionId=${encodeURIComponent(selectedSectionId)}`,
        );
        if (
          lanScores?.scores?.length &&
          loadRequestIdRef.current === requestId
        ) {
          setAssessmentScores((current) =>
            mergeAssessmentScores(current, lanScores.scores),
          );
        }
      }
      if (requestId == null || loadRequestIdRef.current === requestId) {
        setConnectionStatus("offline");
        setConnectionMessage(
          snapshot
            ? "Offline Ã‚· saved locally"
            : "Offline Ã‚· no cached class data",
        );
        setPendingSyncCount(await countOfflineMutations());
      }
      return snapshot;
    },
    [applyOfflineSnapshot, clearLiveData],
  );
  return { clearLiveData, applyOfflineSnapshot, loadOfflineData };
}
