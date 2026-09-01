import { useState, useMemo, useEffect } from "react";
import { Avatar, Icon } from "./DashboardShared";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayTokenPattern = /T[Hh]|T[Uu]|S[Uu]|S[Aa]|M|T|W|F|S/gi;

const dayCodeMap = {
  SU: 0, Su: 0, su: 0,
  M: 1, m: 1,
  T: 2, t: 2, TU: 2, Tu: 2, tu: 2,
  W: 3, w: 3,
  TH: 4, Th: 4, th: 4,
  F: 5, f: 5,
  S: 6, s: 6, SA: 6, Sa: 6, sa: 6,
};

function parseDayCodes(daysString) {
  if (!daysString) return [];
  const str = String(daysString).toUpperCase().trim();

  if (str === "TTH" || str === "T-TH") return [2, 4];
  if (str === "MW") return [1, 3];
  if (str === "FS") return [5, 6];
  if (str === "MWF") return [1, 3, 5];

  const matches = str.match(dayTokenPattern) || [];
  return matches
    .map((token) => dayCodeMap[token] ?? dayCodeMap[token.toUpperCase()])
    .filter((day) => day !== undefined && day !== null);
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const str = String(timeStr).trim();
  const isPM = /pm/i.test(str);
  const isAM = /am/i.test(str);
  
  let [hour, minute] = str.replace(/(am|pm)/gi, "").trim().split(":").map(Number);
  hour = hour || 0;
  minute = minute || 0;

  if (isPM && hour < 12) hour += 12;
  if (isAM && hour === 12) hour = 0;

  return hour * 60 + minute;
}

function formatClassTime(value) {
  if (!value) return "—";
  const [hour, minute] = String(value).split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute || 0).padStart(2, "0")} ${suffix}`;
}

function buildWeeklySchedule(sections) {
  const entries = [];
  (sections || []).forEach((section) => {
    parseDayCodes(section?.days).forEach((dayIndex) => {
      entries.push({
        dayIndex,
        timeStart: section?.time_start || "",
        timeEnd: section?.time_end || "",
        subjectCode: section?.subject_code || section?.code || "—",
        subjectName: section?.subject_name || section?.title || section?.name || "",
        sectionName: section?.section_no || section?.section_name || section?.section || section?.course_section || section?.sectionCode || "N/A",
        room: section?.room || "TBA",
        id: section?.id,
      });
    });
  });

  const timeSlots = [...new Set(entries.map((e) => e.timeStart))]
    .filter(Boolean)
    .sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b));

  return { entries, timeSlots };
}

function RealtimeCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = currentDate.getDate();

  const monthName = currentDate.toLocaleString("default", { month: "long" });
  const timeString = currentDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const daysArray = useMemo(() => {
    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(d);
    }
    return days;
  }, [firstDayOfMonth, daysInMonth]);

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
      <div className="flex justify-between items-center mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800">{monthName} {year}</h3>
          <p className="text-xs text-indigo-600 font-semibold">{timeString} · Live</p>
        </div>
        <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
          <Icon name="calendar" size={18} />
        </span>
      </div>

      <div className="grid grid-cols-7 text-center gap-1 text-[11px] font-semibold text-slate-400 mb-1">
        {weekdayLabels.map((day) => (
          <div key={day}>{day[0]}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {daysArray.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />;
          const isToday = day === today;

          return (
            <div
              key={day}
              className={`py-1 rounded-lg text-xs font-medium transition-colors ${
                isToday
                  ? "bg-indigo-600 text-white font-bold shadow-sm"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExpandedInstructorProfileCard({ instructor }) {
  const profile = {
    name: instructor?.name || "Jeorge",
    position: instructor?.position || "Assistant Professor",
    schedule: instructor?.schedule || "7:30 AM - 5:00 PM",
    gmail: instructor?.gmail || "jeorge@example.com",
    facebook: instructor?.facebook || "facebook.com/jeorge.dev",
    courses: instructor?.courses || ["BSIT 3A - Web Dev", "BSCS 2B - OOP", "BSIT 4A - Capstone"],
    initials: instructor?.initials || "J",
    color: instructor?.color || "bg-indigo-600",
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6 flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-5 mb-6">
          <div className="scale-125">
            <Avatar initials={profile.initials} color={profile.color} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">{profile.name}</h2>
            <p className="text-sm font-semibold text-indigo-600">{profile.position}</p>
          </div>
        </div>

        <hr className="border-slate-100 mb-6" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-slate-400 font-medium block mb-1">Live Schedule</span>
            <span className="font-bold text-emerald-700 bg-emerald-100/60 px-2.5 py-1 rounded-lg inline-block">
              {profile.schedule}
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-slate-400 font-medium block mb-1">Gmail Account</span>
            <a
              href={`mailto:${profile.gmail}`}
              className="font-semibold text-indigo-600 hover:underline truncate block"
              title={profile.gmail}
            >
              {profile.gmail}
            </a>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 sm:col-span-2">
            <span className="text-slate-400 font-medium block mb-1">Facebook Profile</span>
            <a
              href={`https://${profile.facebook}`}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-indigo-600 hover:underline truncate block"
              title={profile.facebook}
            >
              {profile.facebook}
            </a>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 sm:col-span-2">
            <span className="text-slate-400 font-medium block mb-2">Courses Handled</span>
            <div className="flex flex-wrap gap-1.5">
              {profile.courses.map((course, idx) => (
                <span
                  key={idx}
                  className="bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-1 rounded-lg text-xs"
                >
                  {course}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WeeklyScheduleTable({ sections, onOpenClassOptions }) {
  const { entries, timeSlots } = useMemo(() => buildWeeklySchedule(sections), [sections]);

  if (!timeSlots.length) {
    return <div className="p-8 text-center text-slate-500">No classes scheduled yet.</div>;
  }

  return (
    <div className="overflow-x-auto mt-4">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="p-2 text-center text-xs font-semibold text-slate-500">Time</th>
            {weekdayLabels.map((label) => (
              <th key={label} className="p-2 text-center text-xs font-semibold text-slate-500">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {timeSlots.map((timeSlot) => (
            <tr key={timeSlot}>
              <td className="p-2 text-[11px] font-semibold text-slate-500 whitespace-nowrap border-r border-slate-100">
                {formatClassTime(timeSlot)}
              </td>
              {weekdayLabels.map((_, dayIndex) => {
                const cellEntries = entries.filter(
                  (e) => e.timeStart === timeSlot && e.dayIndex === dayIndex
                );
                return (
                  <td key={dayIndex} className="p-1 align-top border-r border-slate-100">
                    {cellEntries.map((entry) => (
                      <div
                        key={`${entry.id}-${dayIndex}-${entry.timeStart}`}
                        onClick={() => onOpenClassOptions(entry.id)}
                        className="p-2 mb-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 cursor-pointer text-[11px] leading-tight transition-colors space-y-0.5"
                      >
                        <b className="font-bold text-slate-800 block truncate" title={entry.subjectCode}>
                          {entry.subjectCode}
                        </b>
                        {entry.subjectName && (
                          <span className="text-[10px] text-indigo-700 block truncate" title={entry.subjectName}>
                            {entry.subjectName}
                          </span>
                        )}
                        <div className="flex justify-between items-center text-[10px] text-slate-500 pt-0.5 border-t border-indigo-100/60">
                          <span className="font-medium text-slate-700">Sec. {entry.sectionName}</span>
                          <span className="font-medium text-slate-600">{entry.room}</span>
                        </div>
                      </div>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompactTodayScheduleSection({ sections, onOpenClassOptions, onOpenAction }) {
  const [viewMode, setViewMode] = useState("today");
  const now = new Date();
  const currentDayIndex = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const todaySections = useMemo(() => {
    return (sections || [])
      .filter((item) => parseDayCodes(item?.days).includes(currentDayIndex))
      .sort((a, b) => parseTimeToMinutes(a.time_start) - parseTimeToMinutes(b.time_start));
  }, [sections, currentDayIndex]);

  const getClassStatus = (item) => {
    const start = parseTimeToMinutes(item.time_start);
    const end = parseTimeToMinutes(item.time_end);
    if (currentMinutes >= start && currentMinutes <= end) return { label: "IN PROGRESS", tone: "live" };
    if (currentMinutes < start) return { label: "UPCOMING", tone: "upcoming" };
    return { label: "COMPLETED", tone: "completed" };
  };

  return (
    <section className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-full">
      <div>
        <div className="flex justify-between items-center mb-3">
          <div>
            <p className="text-[10px] font-bold text-slate-400 tracking-wider">SCHEDULE</p>
            <h2 className="text-base font-bold text-slate-800">
              {viewMode === "today" ? "Today's Agenda" : "Weekly Schedule"}
            </h2>
          </div>
          <div className="flex gap-1">
            <button
              className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors ${
                viewMode === "today" ? "bg-indigo-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => setViewMode("today")}
            >
              Today
            </button>
            <button
              className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors ${
                viewMode === "weekly" ? "bg-indigo-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => setViewMode("weekly")}
            >
              Weekly
            </button>
          </div>
        </div>

        {viewMode === "weekly" ? (
          <WeeklyScheduleTable sections={sections} onOpenClassOptions={onOpenClassOptions} />
        ) : (
          <div className="flex flex-col gap-3 mt-2">
            {todaySections.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">🎉 No classes scheduled for today!</div>
            ) : (
              todaySections.map((item) => {
                const status = getClassStatus(item);
                const isLive = status.tone === "live";

                const subjectCode = item.subject_code || item.code || "—";
                const subjectName = item.subject_name || item.title || item.name || "";
                const sectionName = item.section_no || item.section_name || item.section || item.course_section || item.sectionCode || "N/A";
                const room = item.room || "TBA";

                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-3.5 rounded-xl text-xs transition-all ${
                      isLive
                        ? "bg-emerald-50/70 border-l-4 border-emerald-500 shadow-sm"
                        : "bg-slate-50 border-l-4 border-slate-300"
                    }`}
                  >
                    <div className="flex gap-3 items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-900 font-bold text-sm">{subjectCode}</strong>
                          {subjectName && (
                            <span className="text-[11px] font-medium text-slate-500">• {subjectName}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                          <span className="bg-slate-200/60 font-semibold text-slate-700 px-2 py-0.5 rounded">
                            Sec. {sectionName}
                          </span>
                          <span className="bg-indigo-50 font-semibold text-indigo-700 px-2 py-0.5 rounded">
                            Room: {room}
                          </span>
                          <span>
                            {formatClassTime(item.time_start)} - {formatClassTime(item.time_end)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isLive && (
                        <button
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors"
                          onClick={() => onOpenAction("attendance", item.id)}
                        >
                          Attendance
                        </button>
                      )}
                      <button
                        className="p-1.5 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                        onClick={() => onOpenClassOptions(item.id)}
                      >
                        <Icon name="grid" size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function StatCard({ label, value, note, icon, trend }) {
  return (
    <article className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
      <div className="flex justify-between items-center mb-2">
        <span className="p-2 rounded-xl bg-slate-100 text-slate-600">
          <Icon name={icon} size={17} />
        </span>
        <span className="text-xs font-medium text-slate-400">{trend}</span>
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <strong className="text-2xl font-bold text-slate-900">{value}</strong>
      </div>
      <p className="text-xs text-slate-400 mt-1">{note}</p>
    </article>
  );
}

export default function OverviewView({
  setActive,
  instructor,
  students = [],
  stats = {},
  sections = [],
  onOpenClassOptions,
  onOpenAction,
}) {
  const bars = stats.attendanceBars || [];

  return (
    <div className="space-y-6">
      <section className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            {new Intl.DateTimeFormat("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            }).format(new Date())}
          </p>
          <h1 className="text-2xl font-extrabold text-slate-900">
            Good morning, {instructor?.name || "Jeorge"}.
          </h1>
          <p className="text-sm text-slate-500">Here’s what’s happening with your class today.</p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <CompactTodayScheduleSection
            sections={sections}
            onOpenClassOptions={onOpenClassOptions}
            onOpenAction={onOpenAction}
          />
        </div>

        <div className="space-y-6 flex flex-col justify-between">
          <ExpandedInstructorProfileCard instructor={instructor} />
          <RealtimeCalendar />
        </div>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          icon="calendar"
          trend="Live"
        />
        <StatCard
          label="Class average"
          value={stats.classAverage ?? "0.0"}
          note="Passing grade ≤ 3.05"
          icon="chart"
          trend="Live"
        />
        <StatCard
          label="Needs attention"
          value={stats.needsAttention ?? 0}
          note="Students below 80% attendance"
          icon="alert"
          trend="Review"
        />
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="text-xs font-bold text-slate-400">ATTENDANCE</p>
              <h2 className="text-lg font-bold text-slate-800">Attendance overview</h2>
            </div>
            <button
              className="text-indigo-600 hover:text-indigo-700 text-xs font-semibold flex items-center gap-1"
              onClick={() => setActive("classes")}
            >
              View details <Icon name="arrow" size={15} />
            </button>
          </div>

          <div className="flex justify-between items-end gap-4 my-6">
            <div>
              <strong className="text-3xl font-extrabold text-slate-900">{stats.monthAttendance ?? "0%"}</strong>
              <p className="text-xs text-slate-400 mt-1">Average attendance this month</p>
            </div>
            <div className="flex items-end gap-2 h-24">
              {bars.map((height, index) => (
                <div key={index} className="flex flex-col items-center gap-1">
                  <div className="w-4 bg-slate-100 h-full rounded-full flex items-end overflow-hidden">
                    <span className="w-full bg-indigo-500 rounded-full" style={{ height: `${height}%` }} />
                  </div>
                  <small className="text-[10px] text-slate-400">
                    {["M", "T", "W", "T", "F", "M", "T"][index]}
                  </small>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4 text-xs text-slate-500 border-t border-slate-100 pt-3">
            <span>Present <b className="text-slate-800">{stats.totalPresent ?? 0}</b></span>
            <span>Absent <b className="text-slate-800">{stats.totalAbsent ?? 0}</b></span>
            <span>Late <b className="text-slate-800">{stats.totalLate ?? 0}</b></span>
          </div>
        </section>

        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="text-xs font-bold text-slate-400">STUDENT CHECK-IN</p>
              <h2 className="text-lg font-bold text-slate-800">Needs your attention</h2>
            </div>
            <button
              className="text-indigo-600 hover:text-indigo-700 text-xs font-semibold flex items-center gap-1"
              onClick={() => setActive("classes")}
            >
              See all <Icon name="arrow" size={15} />
            </button>
          </div>

          <div className="space-y-3">
            {students
              .filter((student) => student.status !== "On track")
              .slice(0, 3)
              .map((student) => (
                <div key={student.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                  <div className="flex items-center gap-3">
                    <Avatar initials={student.initials} color={student.color} small />
                    <div>
                      <b className="text-sm font-semibold text-slate-800">{student.name}</b>
                      <p className="text-xs text-slate-400">{student.attendance}% attendance</p>
                    </div>
                  </div>
                  <button onClick={() => setActive("classes")} className="text-slate-400 hover:text-slate-600">
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