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

export function useGroupActions(context) {
  const {
    accountId,
    currentSectionId,
    studentGroups,
    loadLiveData,
    queueOfflineChange,
    setStudentGroups,
    setAssessmentScores,
    recalculatePeriodGrades,
    helpers,
  } = context;
  const { browserIsOffline, createLocalId } = helpers;
  const saveStudentGroup = useCallback(
    async ({
      sectionId,
      label,
      groupCount,
      assignments,
      category,
      period,
      itemNo,
    }) => {
      const targetSectionId = sectionId ?? currentSectionId;
      if (!targetSectionId) throw new Error("No active Firebase section.");
      if (!label?.trim()) throw new Error("A grouping label is required.");
      if (browserIsOffline() || !db) {
        const group = {
          id: createLocalId(),
          label: label.trim(),
          groupCount,
          assignments,
          category: category || null,
          period: period || null,
          itemNo: itemNo ?? null,
          createdAt: new Date().toISOString(),
        };
        await queueOfflineChange("save-student-group", {
          sectionId: targetSectionId,
          group: {
            id: group.id,
            section_id: targetSectionId,
            label: group.label,
            group_count: group.groupCount,
            assignments: group.assignments,
            category: group.category,
            period_code: group.period,
            item_no: group.itemNo,
          },
        });
        setStudentGroups((current) => [group, ...current]);
        return group;
      }
      const group = await store.saveStudentGroup(accountId, targetSectionId, {
        label: label.trim(), groupCount, assignments, category, period, itemNo,
      });
      await loadLiveData(currentSectionId);
      return group;
    },
    [currentSectionId, loadLiveData, queueOfflineChange],
  );
  const deleteStudentGroup = useCallback(
    async (groupId) => {
      if (!groupId) throw new Error("No grouping selected.");
      const target = studentGroups.find((item) => item.id === groupId);
      const hasScoringSlot = Boolean(
        target?.category && target?.period && target?.itemNo,
      );
      if (browserIsOffline() || !db) {
        await queueOfflineChange("delete-student-group", {
          groupId,
          sectionId: currentSectionId,
          clearScores: hasScoringSlot
            ? {
                category: target.category,
                periodCode: target.period,
                itemNo: target.itemNo,
              }
            : null,
        });
        setStudentGroups((current) =>
          current.filter((item) => item.id !== groupId),
        );
        if (hasScoringSlot)
          setAssessmentScores((current) =>
            current.filter(
              (row) =>
                !(
                  row.period?.code === target.period &&
                  row.category === target.category &&
                  Number(row.item_no) === Number(target.itemNo)
                ),
            ),
          );
        return;
      }
      await store.deleteStudentGroup(
        accountId, currentSectionId, groupId,
        hasScoringSlot ? { periodId: target.period, category: target.category, itemNo: target.itemNo } : null,
      );
      if (hasScoringSlot) await recalculatePeriodGrades(target.period);
      await loadLiveData(currentSectionId);
    },
    [
      currentSectionId,
      loadLiveData,
      queueOfflineChange,
      recalculatePeriodGrades,
      studentGroups,
    ],
  );
  const updateStudentGroup = useCallback(
    async ({ groupId, sectionId, label }) => {
      const targetSectionId = sectionId ?? currentSectionId;
      const nextLabel = label?.trim();
      if (!groupId) throw new Error("No grouping selected.");
      if (!nextLabel) throw new Error("A grouping title is required.");
      if (!targetSectionId) throw new Error("No active Firebase section.");

      if (browserIsOffline() || !db) {
        await queueOfflineChange("update-student-group", {
          groupId,
          sectionId: targetSectionId,
          label: nextLabel,
        });
        setStudentGroups((current) =>
          current.map((group) =>
            group.id === groupId ? { ...group, label: nextLabel } : group,
          ),
        );
        return;
      }

      await store.updateStudentGroup(accountId, targetSectionId, groupId, nextLabel);
      await loadLiveData(targetSectionId);
    },
    [currentSectionId, loadLiveData, queueOfflineChange, setStudentGroups],
  );
  return { saveStudentGroup, deleteStudentGroup, updateStudentGroup };
}
