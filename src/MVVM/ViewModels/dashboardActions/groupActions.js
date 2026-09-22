/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import { useCallback } from "react";
import { supabase } from "../../../lib/supabaseClient";
import {
  countOfflineMutations,
  listOfflineMutations,
  readOfflineSnapshot,
  removeOfflineMutation,
  replayOfflineMutation,
} from "../../../lib/offlineStore";

export function useGroupActions(context) {
  const {
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
      if (!targetSectionId) throw new Error("No active Supabase section.");
      if (!label?.trim()) throw new Error("A grouping label is required.");
      if (browserIsOffline() || !supabase) {
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
      const { data, error } = await supabase
        .from("student_groups")
        .insert({
          section_id: targetSectionId,
          label: label.trim(),
          group_count: groupCount,
          assignments,
          category: category || null,
          period_code: period || null,
          item_no: itemNo ?? null,
        })
        .select(
          "id, label, group_count, assignments, category, period_code, item_no, created_at",
        )
        .single();
      if (error) throw error;
      await loadLiveData(currentSectionId);
      return {
        id: data.id,
        label: data.label,
        groupCount: data.group_count,
        assignments: data.assignments,
        category: data.category,
        period: data.period_code,
        itemNo: data.item_no,
        createdAt: data.created_at,
      };
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
      if (browserIsOffline() || !supabase) {
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
      const { error } = await supabase
        .from("student_groups")
        .delete()
        .eq("id", groupId);
      if (error) throw error;
      if (hasScoringSlot) {
        const { data: periodRow, error: periodError } = await supabase
          .from("grading_periods")
          .select("id")
          .eq("code", target.period)
          .single();
        if (periodError) throw periodError;
        const { error: scoresError } = await supabase
          .from("assessment_scores")
          .delete()
          .eq("section_id", currentSectionId)
          .eq("period_id", periodRow.id)
          .eq("category", target.category)
          .eq("item_no", target.itemNo);
        if (scoresError) throw scoresError;
        await recalculatePeriodGrades(periodRow.id);
      }
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
  return { saveStudentGroup, deleteStudentGroup };
}
