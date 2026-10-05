import "../../App.css";
import { useStudentAssessmentSession } from "./studentPortal/useStudentAssessmentSession";
import StudentPortalAccess from "./studentPortal/StudentPortalAccess";
import StudentPortalResult from "./studentPortal/StudentPortalResult";
import StudentAssessment from "./studentPortal/StudentAssessment";

export default function StudentPortalView() {
  const session = useStudentAssessmentSession();

  if (session.submittedResult && session.accessState) {
    return <StudentPortalResult {...session} />;
  }

  if (!session.accessState) {
    return <StudentPortalAccess {...session} />;
  }

  return <StudentAssessment {...session} />;
}
