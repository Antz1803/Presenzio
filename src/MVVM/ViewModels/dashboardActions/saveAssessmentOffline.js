/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import { importMasterListFile } from "../importMasterList";
import { importGradeSheetFile } from "../importRecord";
import { syncGradeSheetToExcel } from "../syncGradeSheetToExcelPreservingTemplate";
import { supabase } from "../../../lib/supabaseClient";
import { countOfflineMutations, listOfflineMutations, readOfflineSnapshot, removeOfflineMutation, replayOfflineMutation } from "../../../lib/offlineStore";

export async function saveAssessmentOffline(context, input, periodRow) {
  const { currentSectionId, students, gradingPeriods, assessmentScores, assessmentDefinitions, setAssessmentDefinitions, setAssessmentScores, queueOfflineChange, helpers } = context;
  const { assessmentItemLimits, createAssessmentAccessKey, createLocalId, serializeAssessmentDate } = helpers;
  const { title, category, period, itemNo: requestedItemNo, instructions, timeLimitMinutes, availableFrom, availableUntil, questions, replaceAssessmentId, overwriteScores } = input;
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
          near_match_score_percent:
            question.type === "coding"
              ? Math.max(0, Math.min(100, Number(question.nearMatchScorePercent) || 0))
              : null,
          incorrect_score_percent:
            question.type === "coding"
              ? Math.max(0, Math.min(100, Number(question.incorrectScorePercent) || 0))
              : null,
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


}
