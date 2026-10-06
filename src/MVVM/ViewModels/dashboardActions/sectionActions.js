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

export function useSectionActions(context) {
  const {
    accountId,
    accountScoped,
    currentSectionId,
    loadLiveData,
    clearLiveData,
    queueOfflineChange,
    setSection,
    setSections,
    helpers,
  } = context;
  const { browserIsOffline } = helpers;
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
      if (browserIsOffline() || !db) {
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
          current?.id === sectionId
            ? { ...current, ...sectionChanges }
            : current,
        );
        return;
      }
      await store.updateSection(accountId, sectionId, sectionChanges);
      await loadLiveData(sectionId);
    },
    [loadLiveData, queueOfflineChange],
  );
  const deleteSection = useCallback(
    async (sectionId) => {
      if (!sectionId) throw new Error("No class was selected for deletion.");
      if (browserIsOffline() || !db) {
        await queueOfflineChange("delete-section", { sectionId });
        setSections((current) =>
          current.filter((item) => item.id !== sectionId),
        );
        if (currentSectionId === sectionId) clearLiveData();
        return;
      }
      await store.deleteSection(accountId, sectionId);
      await loadLiveData();
    },
    [clearLiveData, currentSectionId, loadLiveData, queueOfflineChange],
  );
  return { updateSection, deleteSection };
}
