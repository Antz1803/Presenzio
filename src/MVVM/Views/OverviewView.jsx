import { Avatar, Icon } from "./DashboardShared";
import RealtimeCalendar from "./overview/RealtimeCalendar";
import ExpandedInstructorProfileCard from "./overview/InstructorProfileCard";
import { CompactTodayScheduleSection } from "./overview/OverviewSchedule";
import StatCard from "./overview/OverviewStats";

const PANEL =
  "rounded-lg border border-accent/20 bg-surface-1/85 p-4 backdrop-blur-xl";
const EYEBROW =
  "font-mono text-[10px] font-bold uppercase tracking-wider text-accent";
const LINK =
  "flex items-center gap-1 font-mono text-xs font-medium text-accent transition hover:text-accent-4";
const DAY_LABELS = ["M", "T", "W", "T", "F", "M", "T"];

function attendanceTone(value) {
  return Number(value) < 70 ? "text-rose-400" : "text-amber-300";
}

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

  const todayRate = parseFloat(stats.todayAttendance);
  const needsAttention = Number(stats.needsAttention ?? 0);
  const attentionList = students.filter((s) => s.status !== "On track");

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-4">
      {/* Greeting */}
      <header className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-accent/20 bg-surface-1 p-4 shadow-xl shadow-cyan-950/20">
        <div className="pointer-events-none absolute -right-8 -top-8 size-40 rounded-full bg-accent/5 blur-2xl" />
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br from-accent via-sky-600 to-[#0D82FF] text-canvas shadow-lg shadow-accent/30">
          <Icon name="grid" size={20} />
        </div>
        <div className="relative">
          <h1 className="font-display text-lg font-semibold tracking-tight text-ink">
            {timeGreeting}, {instructor?.name || "Teacher"}.
          </h1>
          <p className="text-xs text-ink-2">
            Here&rsquo;s what&rsquo;s happening with your class today.
          </p>
        </div>
      </header>

      {/* Row 1: Agenda + Calendar (left, stacked) | Instructor Profile (right) */}
      <div className="grid grid-cols-12 items-stretch gap-4">
        <div className="col-span-12 flex flex-col gap-4 xl:col-span-7">
          <CompactTodayScheduleSection
            sections={sections}
            onOpenClassOptions={onOpenClassOptions}
            onOpenAction={onOpenAction}
          />
          <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
            <div className="[&>section]:h-full">
              <RealtimeCalendar />
            </div>
            <section
              aria-label="Key statistics"
              className="grid grid-cols-2 grid-rows-2 gap-3"
            >
              <StatCard
                label="Total students"
                value={stats.totalStudents ?? 0}
                note={`${stats.male ?? 0} male · ${stats.female ?? 0} female`}
                icon="users"
                trend="Live"
              />
              <StatCard
                label="Today's attendance"
                value={stats.todayAttendance ?? "0%"}
                note={`${stats.todayPresent ?? 0} present · ${stats.todayAbsent ?? 0} absent`}
                icon="check"
                trend="Live"
                tone={todayRate >= 90 ? "good" : "default"}
              />
              <StatCard
                label="Class average"
                value={stats.classAverage ?? "0.0"}
                note="Passing grade ≤ 3.05"
                icon="trend"
                trend="Live"
              />
              <StatCard
                label="Needs attention"
                value={needsAttention}
                note="Students below 80% attendance"
                icon="alert"
                trend="Review"
                tone={needsAttention > 0 ? "warn" : "default"}
              />
            </section>
          </div>
        </div>
        <div className="col-span-12 xl:col-span-5 [&>div:first-child]:h-full">
          <ExpandedInstructorProfileCard
            instructor={instructor}
            onUpdateInstructor={onUpdateInstructor}
            sections={sections}
          />
        </div>
      </div>

      {/* Row 2: Attendance | Needs attention, equal height */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <section className={`${PANEL} flex h-full flex-col`}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className={EYEBROW}>Attendance</p>
              <h2 className="font-display text-base font-semibold tracking-tight text-ink">
                Attendance overview
              </h2>
            </div>
            <button
              type="button"
              className={LINK}
              onClick={() => setActive?.("classes")}
            >
              Details <Icon name="arrow" size={14} />
            </button>
          </div>

          <div className="my-auto flex items-end justify-between gap-4 py-4">
            <div>
              <strong className="block font-display text-3xl font-bold tracking-tight text-accent">
                {stats.monthAttendance ?? "0%"}
              </strong>
              <p className="mt-1 text-xs text-ink-2">
                Average attendance this month
              </p>
            </div>
            <div className="flex h-20 items-end gap-1.5">
              {bars.map((height, index) => (
                <div key={index} className="flex flex-col items-center gap-1.5">
                  <div className="flex h-full w-3 items-end overflow-hidden rounded-full bg-surface-2 p-0.5">
                    <span
                      className="w-full rounded-full bg-linear-to-t from-accent-2 to-accent transition-all duration-500"
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <small className="font-mono text-[10px] text-ink-3">
                    {DAY_LABELS[index] || ""}
                  </small>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-5 border-t border-white/5 pt-3 text-xs text-ink-2">
            <span>
              Present{" "}
              <b className="font-mono text-accent">{stats.totalPresent ?? 0}</b>
            </span>
            <span>
              Absent{" "}
              <b className="font-mono text-rose-400">{stats.totalAbsent ?? 0}</b>
            </span>
            <span>
              Late{" "}
              <b className="font-mono text-amber-300">{stats.totalLate ?? 0}</b>
            </span>
          </div>
        </section>

        <section className={`${PANEL} h-full`}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className={EYEBROW}>Student check-in</p>
              <h2 className="font-display text-base font-semibold tracking-tight text-ink">
                Needs your attention
              </h2>
            </div>
            <button
              type="button"
              className={LINK}
              onClick={() => setActive?.("classes")}
            >
              See all <Icon name="arrow" size={14} />
            </button>
          </div>

          <div className="space-y-2">
            {attentionList.length === 0 && (
              <p className="rounded-lg border border-dashed border-white/10 p-6 text-center text-xs text-ink-3">
                Everyone is on track.
              </p>
            )}
            {attentionList.slice(0, 3).map((student, idx) => (
              <button
                type="button"
                key={student.id || `attn-student-${idx}`}
                onClick={() => setActive?.("classes")}
                className="group flex w-full items-center justify-between gap-3 rounded-lg border border-white/5 bg-surface-2/60 p-2.5 text-left transition hover:border-accent/30 hover:bg-surface-2"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar
                    initials={student.initials}
                    color={student.color}
                    small
                  />
                  <div className="min-w-0">
                    <b className="block truncate text-xs font-bold uppercase text-ink">
                      {student.name}
                    </b>
                    <p
                      className={`font-mono text-[11px] ${attendanceTone(student.attendance)}`}
                    >
                      {student.attendance}% attendance
                    </p>
                  </div>
                </div>
                <span className="text-ink-3 transition group-hover:text-accent">
                  <Icon name="chevron" size={15} />
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}