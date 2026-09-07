import { Avatar, Icon } from "./DashboardShared";
import RealtimeCalendar from "./overview/RealtimeCalendar";
import ExpandedInstructorProfileCard from "./overview/InstructorProfileCard";
import { CompactTodayScheduleSection } from "./overview/OverviewSchedule";
import StatCard from "./overview/OverviewStats";

export default function OverviewView({
  setActive,
  instructor,
  onUpdateInstructor,
  students = [],
  stats = {},
  sections = [],
  onOpenClassOptions,
  onOpenAction,
}) {
  const bars = stats.attendanceBars || [];

  const currentHour = new Date().getHours();
  const timeGreeting =
    currentHour < 12
      ? "Good morning"
      : currentHour < 18
      ? "Good afternoon"
      : "Good evening";

  return (
    <div className="space-y-6">
      {/* Glassmorphic Glossy Header Container */}
      <section className="bg-white/60 backdrop-blur-2xl p-6 sm:p-8 rounded-[36px] border border-white/80 shadow-2xl shadow-indigo-100/40 relative overflow-hidden flex items-center gap-6">
        {/* Shiny Top Gradient Highlight */}
        <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/60 to-transparent pointer-events-none" />
   <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/80 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg shadow-indigo-500/20 backdrop-blur-md">
    <Icon name="grid" size={26} />
    </div>

        {/* Greeting & Header Content */}
        <div className="relative space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {timeGreeting}, {instructor?.name || "Jeorge"}.
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-slate-500">
            Here’s what’s happening with your class today.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CompactTodayScheduleSection sections={sections} onOpenClassOptions={onOpenClassOptions} onOpenAction={onOpenAction} />
        <div className="space-y-6 flex flex-col justify-between">
          <ExpandedInstructorProfileCard instructor={instructor} onUpdateInstructor={onUpdateInstructor} sections={sections} />
          <RealtimeCalendar />
        </div>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total students" value={stats.totalStudents ?? 0} note={`${stats.male ?? 0} male · ${stats.female ?? 0} female`} icon="users" trend="Live" />
        <StatCard label="Today's attendance" value={stats.todayAttendance ?? "0%"} note={`${stats.todayPresent ?? 0} present · ${stats.todayAbsent ?? 0} absent`} icon="calendar" trend="Live" />
        <StatCard label="Class average" value={stats.classAverage ?? "0.0"} note="Passing grade ≤ 3.05" icon="chart" trend="Live" />
        <StatCard label="Needs attention" value={stats.needsAttention ?? 0} note="Students below 80% attendance" icon="alert" trend="Review" />
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl border border-white/60 shadow-xl shadow-slate-200/50">
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ATTENDANCE</p>
              <h2 className="text-lg font-black text-slate-800 tracking-tight">Attendance overview</h2>
            </div>
            <button className="text-indigo-600 hover:text-indigo-700 text-xs font-bold flex items-center gap-1 group" onClick={() => setActive?.("classes")}>
              View details <Icon name="arrow" size={15} />
            </button>
          </div>

          <div className="flex justify-between items-end gap-4 my-6">
            <div>
              <strong className="text-4xl font-black text-slate-900 tracking-tight">{stats.monthAttendance ?? "0%"}</strong>
              <p className="text-xs font-medium text-slate-400 mt-1">Average attendance this month</p>
            </div>
            <div className="flex items-end gap-2 h-24">
              {bars.map((height, index) => (
                <div key={index} className="flex flex-col items-center gap-1.5">
                  <div className="w-3.5 bg-slate-100 h-full rounded-full flex items-end overflow-hidden p-0.5">
                    <span className="w-full bg-gradient-to-t from-indigo-600 to-violet-500 rounded-full transition-all duration-500" style={{ height: `${height}%` }} />
                  </div>
                  <small className="text-[10px] font-bold text-slate-400">{["M", "T", "W", "T", "F", "M", "T"][index] || ""}</small>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4 text-xs font-medium text-slate-500 border-t border-slate-100/80 pt-3">
            <span>Present <b className="text-slate-800">{stats.totalPresent ?? 0}</b></span>
            <span>Absent <b className="text-slate-800">{stats.totalAbsent ?? 0}</b></span>
            <span>Late <b className="text-slate-800">{stats.totalLate ?? 0}</b></span>
          </div>
        </section>

        <section className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl border border-white/60 shadow-xl shadow-slate-200/50">
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">STUDENT CHECK-IN</p>
              <h2 className="text-lg font-black text-slate-800 tracking-tight">Needs your attention</h2>
            </div>
            <button className="text-indigo-600 hover:text-indigo-700 text-xs font-bold flex items-center gap-1 group" onClick={() => setActive?.("classes")}>
              See all <Icon name="arrow" size={15} />
            </button>
          </div>

          <div className="space-y-2.5">
            {students
              .filter((s) => s.status !== "On track")
              .slice(0, 3)
              .map((student, idx) => (
                <div key={student.id || `attn-student-${idx}`} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/80 border border-slate-100/80 hover:bg-slate-100/50 transition-all">
                  <div className="flex items-center gap-3">
                    <Avatar initials={student.initials} color={student.color} small />
                    <div>
                      <b className="text-xs font-bold text-slate-800 block">{student.name}</b>
                      <p className="text-[11px] font-medium text-slate-400">{student.attendance}% attendance</p>
                    </div>
                  </div>
                  <button onClick={() => setActive?.("classes")} className="text-slate-400 hover:text-slate-600 p-1">
                    <Icon name="arrow" size={15} />
                  </button>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
