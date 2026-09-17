import { formatDate, formatDay, formatShortDate, resolvePeriodCodeForSession, average } from "./dashboardUtils";
export function buildLiveStats({ allStudentsData, sessionsData, liveRoster, periods }) {
       const totalStudentsCount = allStudentsData?.length ?? liveRoster.length;
      const male = allStudentsData
        ? allStudentsData.filter((student) => student.gender === "M").length
        : liveRoster.filter((student) => student.gender === "M").length;
      const female = allStudentsData
        ? allStudentsData.filter((student) => student.gender === "F").length
        : liveRoster.filter((student) => student.gender === "F").length;
      const todayRecords = sessionsData[0]?.attendance_records ?? [];
      const todayPresent = todayRecords.filter(
        (record) => record.status === "present" || record.status === "late",
      ).length;
      const allRecords = sessionsData.flatMap(
        (session) => session.attendance_records ?? [],
      );
      const totalPresent = allRecords.filter(
        (record) => record.status === "present",
      ).length;
      const totalLate = allRecords.filter(
        (record) => record.status === "late",
      ).length;
      const totalAbsent = Math.max(
        liveRoster.length * sessionsData.length - allRecords.length,
        0,
      );
      const classAverage = average(
        liveRoster.map((student) => student.grade).filter((grade) => grade > 0),
      );
      const gradedStudents = liveRoster.filter((student) => student.grade > 0);
      const attendanceRates = sessionsData.slice(0, 7).map((session) => {
        const records = session.attendance_records ?? [];
        return records.length && liveRoster.length
          ? Math.round(
              (records.filter(
                (record) =>
                  record.status === "present" || record.status === "late",
              ).length /
                liveRoster.length) *
                100,
            )
          : 0;
      });
      const currentWeek = new Date();
      const sessionsThisWeek = sessionsData.filter((session) => {
        const date = new Date(session.session_date + "T00:00:00");
        return (currentWeek - date) / 86400000 < 7;
      }).length;
      const mostConsistent =
        [...liveRoster].sort((a, b) => b.attendance - a.attendance)[0]?.name ??
        "Ã¢â‚¬”";

      const liveAttendanceSessions = [...sessionsData]
        .sort((first, second) => first.session_date.localeCompare(second.session_date))
        .map((session) => ({
          id: session.id,
          date: formatShortDate(session.session_date),
          sessionDate: session.session_date,
          sessionTime: session.session_time,
          periodCode: resolvePeriodCodeForSession({
            sessionDate: session.session_date,
            periodId: session.period_id,
            periods: periods ?? [],
          }),
          statuses: Object.fromEntries(
            (session.attendance_records ?? []).map((record) => [
              record.enrollment_id,
              record.status,
            ]),
          ),
        }));

      const liveSessions = sessionsData.map((session) => {
        const records = session.attendance_records ?? [];
        const present = records.filter(
          (record) => record.status === "present",
        ).length;
        const absent = Math.max(liveRoster.length - records.length, 0);
        const late = records.filter(
          (record) => record.status === "late",
        ).length;
        const rate = liveRoster.length
          ? ((present + late) / liveRoster.length) * 100
          : 0;
        return [
          formatDate(session.session_date),
          formatDay(session.session_date),
          String(present),
          String(absent),
          String(late),
          rate.toFixed(1) + "%",
        ];
      });

      const liveStats = {
        totalStudents: totalStudentsCount,
        male,
        female,
        todayAttendance: liveRoster.length
          ? ((todayPresent / liveRoster.length) * 100).toFixed(1) + "%"
          : "Ã¢â‚¬”",
        todayPresent,
        todayAbsent: Math.max(liveRoster.length - todayPresent, 0),
        classAverage: classAverage ? classAverage.toFixed(2) : "Ã¢â‚¬”",
        needsAttention: liveRoster.filter((student) => student.attendance < 80)
          .length,
        monthAttendance: liveRoster.length
          ? average(liveRoster.map((student) => student.attendance)).toFixed(
              1,
            ) + "%"
          : "Ã¢â‚¬”",
        attendanceBars: attendanceRates,
        totalPresent,
        totalAbsent,
        totalLate,
        sessionsHeld: sessionsData.length,
        sessionsThisWeek,
        mostConsistent,
        excellentCount: gradedStudents.filter((student) => student.grade <= 2)
          .length,
        goodCount: gradedStudents.filter(
          (student) => student.grade > 2 && student.grade <= 3.05,
        ).length,
        needsReviewCount: gradedStudents.filter(
          (student) => student.grade > 3.05,
        ).length,
        passingRate: gradedStudents.length
          ? (
              (gradedStudents.filter((student) => student.grade <= 3.05)
                .length /
                gradedStudents.length) *
              100
            ).toFixed(1) + "%"
          : "Ã¢â‚¬”",
      };

  return { liveStats, liveAttendanceSessions, liveSessions };
}

