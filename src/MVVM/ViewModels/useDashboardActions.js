import { useSetupActions } from "./dashboardActions/setupActions";
import { useTransferActions } from "./dashboardActions/transferActions";
import { useGradeCalculationActions } from "./dashboardActions/gradeCalculationActions";
import { useGradeImportActions } from "./dashboardActions/gradeImportActions";
import { useAttendanceActions } from "./dashboardActions/attendanceActions";
import { useGradeActions } from "./dashboardActions/gradeActions";
import { useScoreActions } from "./dashboardActions/scoreActions";
import { useAssessmentActions } from "./dashboardActions/assessmentActions";
import { useAssessmentUpdateActions } from "./dashboardActions/assessmentUpdateActions";
import { useAssessmentDeleteActions } from "./dashboardActions/assessmentDeleteActions";
import { useGroupActions } from "./dashboardActions/groupActions";
import { useAttemptActions } from "./dashboardActions/attemptActions";
import { useStudentAssessmentActions } from "./dashboardActions/studentAssessmentActions";
import { useAssessmentSubmitActions } from "./dashboardActions/assessmentSubmitActions";
import { useStudentActions } from "./dashboardActions/studentActions";
import { useSectionActions } from "./dashboardActions/sectionActions";
import { useOfflineActions } from "./dashboardActions/offlineActions";

export function useDashboardActions(context) {
  const gradeCalculationActions = useGradeCalculationActions(context);
  const contextWithGradeCalculation = {
    ...context,
    recalculatePeriodGrades: gradeCalculationActions.recalculatePeriodGrades,
  };
  const gradeImportActions = useGradeImportActions(contextWithGradeCalculation);
  return {
    ...useSetupActions(context),
    ...useTransferActions(context),
    ...gradeCalculationActions,
    ...gradeImportActions,
    ...useAttendanceActions(contextWithGradeCalculation),
    ...useGradeActions(context),
    ...useScoreActions(contextWithGradeCalculation),
    ...useAssessmentActions(context),
    ...useAssessmentUpdateActions(context),
    ...useAssessmentDeleteActions(context),
    ...useGroupActions(contextWithGradeCalculation),
    ...useAttemptActions(context),
    ...useStudentAssessmentActions(context),
    ...useAssessmentSubmitActions(context),
    ...useStudentActions(context),
    ...useSectionActions(context),
    ...useOfflineActions(contextWithGradeCalculation),
  };
}
