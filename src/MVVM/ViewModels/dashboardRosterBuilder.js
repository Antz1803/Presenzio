import { formatDate, formatDay, formatShortDate, resolvePeriodCodeForSession, average } from "./dashboardUtils";

export function buildRoster({ classSessions, periodGrades, periods, enrollments }) {
      const sessionsData = classSessions ?? [];
      const gradeData = periodGrades ?? [];
      const gradePeriodCodes = ["prelim", "midterm", "semifinal", "final"];
      const gradeByEnrollment = new Map();
      const gradeDetailsByEnrollment = new Map();
      gradeData.forEach((item) => {
        const periodCode =
          item.period?.code ??
          periods?.find((periodItem) => periodItem.id === item.period_id)?.code;
        if (!gradePeriodCodes.includes(periodCode)) return;

        const grades = gradeByEnrollment.get(item.enrollment_id) ?? {};
        const rawGrade =
          periodCode === "prelim"
            ? item.own_period_grade
            : item.cumulative_grade;
        // The Final sheet keeps the raw cumulative grade in AN, but the
        // displayed grade in AO/Summary uses the template's 3.05 cap rule.
        const displayGrade =
          periodCode === "final" && rawGrade != null && Number(rawGrade) > 3.05
            ? 5
            : rawGrade;
        const grade = Number(displayGrade);
        if (displayGrade != null && Number.isFinite(grade)) {
          grades[periodCode] = grade;
        }
        gradeByEnrollment.set(item.enrollment_id, grades);
        const details = gradeDetailsByEnrollment.get(item.enrollment_id) ?? {};
        details[periodCode] = {
          own: item.own_period_grade,
          cumulative: item.cumulative_grade,
        };
        gradeDetailsByEnrollment.set(item.enrollment_id, details);
      });
      const attendanceByEnrollment = new Map();

      sessionsData.forEach((session) =>
        session.attendance_records?.forEach((record) => {
          const current = attendanceByEnrollment.get(record.enrollment_id) ?? {
            attended: 0,
          };
          if (record.status === "present" || record.status === "late")
            current.attended += 1;
          attendanceByEnrollment.set(record.enrollment_id, current);
        }),
      );

      const liveRoster = (enrollments ?? []).map((enrollment, enrollmentIndex) => {
        const student = enrollment.student;
        const attendance = attendanceByEnrollment.get(enrollment.id);
        const attendanceRate = sessionsData.length
          ? Math.round(
              ((attendance?.attended ?? 0) / sessionsData.length) * 100,
            )
          : 0;
        const fullName = student?.full_name ?? "Unnamed student";
        const grades = gradeByEnrollment.get(enrollment.id) ?? {};
        const gradeDetails = gradeDetailsByEnrollment.get(enrollment.id) ?? {};
        return {
          id: enrollment.id,
          studentId: student?.id,
          ctrlNo: enrollment.ctrl_no ?? enrollmentIndex + 1,
          name: fullName,
          initials: fullName
            .split(" ")
            .map((part) => part[0])
            .slice(0, 2)
            .join("")
            .toUpperCase(),
          color:
            ["plum", "blue", "peach", "green", "yellow", "lavender"][
              (enrollment.ctrl_no ?? 0) % 6
            ] ?? "plum",
          number: student?.student_no ?? "CTRL-" + (enrollment.ctrl_no ?? "Ã¢â‚¬”"),
          gender: student?.gender ?? "Ã¢â‚¬”",
          course: student?.course ?? "",
          yearLevel: student?.year_level ?? "",
          contactNo: student?.contact_no ?? "",
          email: student?.email ?? "",
          photoUrl: student?.photo_url ?? "",
          attendance: attendanceRate,
          grades,
          gradeDetails,
          grade: grades.prelim ?? 0,
          status:
            enrollment.status === "active"
              ? attendanceRate < 80
                ? "At risk"
                : "On track"
              : enrollment.status.toUpperCase(),
        };
      });

  return { sessionsData, gradeByEnrollment, gradeDetailsByEnrollment, attendanceByEnrollment, liveRoster };
}

