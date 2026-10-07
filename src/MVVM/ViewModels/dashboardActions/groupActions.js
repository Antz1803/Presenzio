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
      maxScore,
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
            max_score: group.maxScore,
          },
        });
        setStudentGroups((current) => [group, ...current]);
        return group;
      }
      const group = await store.saveStudentGroup(accountId, targetSectionId, {
        label: label.trim(), groupCount, assignments, category, period, itemNo, maxScore,
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
    async ({ groupId, sectionId, label, assignments, groupCount, category, period, itemNo, maxScore }) => {
      const targetSectionId = sectionId ?? currentSectionId;
      const nextLabel = label?.trim();
      if (!groupId) throw new Error("No grouping selected.");
      if (!nextLabel && assignments === undefined)
        throw new Error("A grouping title or assignment is required.");
      if (!targetSectionId) throw new Error("No active Firebase section.");
      const changes = {
        ...(nextLabel !== undefined ? { label: nextLabel } : {}),
        ...(assignments !== undefined ? { assignments } : {}),
        ...(groupCount !== undefined ? { groupCount } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(period !== undefined ? { period } : {}),
        ...(itemNo !== undefined ? { itemNo } : {}),
        ...(maxScore !== undefined ? { maxScore } : {}),
      };

      if (browserIsOffline() || !db) {
        await queueOfflineChange("update-student-group", {
          groupId,
          sectionId: targetSectionId,
          ...changes,
        });
        const previousGroup = studentGroups.find((group) => group.id === groupId);
        const oldSlot = {
          period: previousGroup?.period,
          category: previousGroup?.category,
          itemNo: previousGroup?.itemNo,
        };
        const nextSlot = {
          period: changes.period ?? oldSlot.period,
          category: changes.category ?? oldSlot.category,
          itemNo: changes.itemNo ?? oldSlot.itemNo,
        };
        const completeSlot = (slot) =>
          slot.period && slot.category && slot.itemNo !== null && slot.itemNo !== undefined;
        const slotChanged =
          completeSlot(oldSlot) &&
          completeSlot(nextSlot) &&
          (oldSlot.period !== nextSlot.period ||
            oldSlot.category !== nextSlot.category ||
            Number(oldSlot.itemNo) !== Number(nextSlot.itemNo));
        if (completeSlot(oldSlot) && (slotChanged || changes.maxScore !== undefined)) {
          setAssessmentScores((current) =>
            current.map((row) => {
              const matchesOldSlot =
                row.period?.code === oldSlot.period &&
                row.category === oldSlot.category &&
                Number(row.item_no) === Number(oldSlot.itemNo);
              if (!matchesOldSlot) return row;
              return {
                ...row,
                period_id: nextSlot.period,
                period: { ...(row.period ?? {}), code: nextSlot.period },
                category: nextSlot.category,
                item_no: Number(nextSlot.itemNo),
                ...(changes.maxScore !== undefined
                  ? { max_score: changes.maxScore }
                  : {}),
              };
            }),
          );
        }
        setStudentGroups((current) =>
          current.map((group) =>
            group.id === groupId ? { ...group, ...changes } : group,
          ),
        );
        return;
      }

      await store.updateStudentGroup(accountId, targetSectionId, groupId, changes);
      await loadLiveData(targetSectionId);
    },
    [currentSectionId, loadLiveData, queueOfflineChange, setStudentGroups],
  );
  return { saveStudentGroup, deleteStudentGroup, updateStudentGroup };
}
