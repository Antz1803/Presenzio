import { useState } from "react";
import { Avatar, Icon } from "./DashboardShared";

// Academic day codes like "MWF" and "TTh". Longer tokens are matched first.
const dayTokenPattern = /Th|Tu|Su|Sa|M|T|W|F|S/g;
const dayCodeMap = { Su: 0, M: 1, T: 2, W: 3, Th: 4, F: 5, Sa: 6 };
const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseDayCodes(daysString) {
  const matches = String(daysString || "").match(dayTokenPattern) || [];
  return matches.map((token) => dayCodeMap[token]).filter((day) => day != null);
}

function isScheduledToday(section, todayIndex) {
  return parseDayCodes(section?.days).includes(todayIndex);
}

function compareByStartTime(a, b) {
  return String(a.time_start || "").localeCompare(String(b.time_start || ""));
}

function formatClassTime(value) {
  if (!value) return "—";
  const [hour, minute] = String(value).split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function buildWeeklySchedule(sections) {
  const entries = [];
  (sections || []).forEach((section) => {
    parseDayCodes(section?.days).forEach((dayIndex) => {
      entries.push({
        dayIndex,
        timeStart: section?.time_start || "",
        timeEnd: section?.time_end || "",
        subjectCode: section?.subject_code || "—",
        subjectTitle: section?.subject_title || "",
        room: section?.room || "",
        id: section?.id,
      });
    });
  });

  const timeSlots = [...new Set(entries.map((entry) => entry.timeStart))]
    .filter(Boolean)
    .sort();

  return { entries, timeSlots };
}

const scheduleTableStyle = { width: "100%", borderCollapse: "collapse" };
const scheduleHeaderCellStyle = {
  textAlign: "center",
  padding: "8px 6px",
  fontSize: "12px",
  fontWeight: 600,
  color: "#6b7280",
  borderBottom: "1px solid #e5e7eb",
};
const scheduleTimeCellStyle = {
  padding: "8px 10px",
  fontSize: "12px",
  fontWeight: 600,
  color: "#6b7280",
  whiteSpace: "nowrap",
  borderBottom: "1px solid #f1f2f4",
  borderRight: "1px solid #f1f2f4",
};
const scheduleBodyCellStyle = {
  padding: "6px",
  verticalAlign: "top",
  borderBottom: "1px solid #f1f2f4",
  borderRight: "1px solid #f1f2f4",
};
const scheduleClassChipStyle = {
  display: "block",
  padding: "6px 8px",
  borderRadius: "8px",
  background: "#eef2ff",
  cursor: "pointer",
  fontSize: "12px",
  lineHeight: 1.3,
};

function WeeklyScheduleTable({ sections, onOpenClassOptions }) {
  const { entries, timeSlots } = buildWeeklySchedule(sections);

  if (!timeSlots.length) {
    return <div className="empty-state">No classes scheduled yet.</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={scheduleTableStyle}>
        <thead>
          <tr>
            <th style={scheduleHeaderCellStyle}>Time</th>
            {weekdayLabels.map((label) => (
              <th key={label} style={scheduleHeaderCellStyle}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map((timeSlot) => (
            <tr key={timeSlot}>
              <td style={scheduleTimeCellStyle}>{formatClassTime(timeSlot)}</td>
              {weekdayLabels.map((_, dayIndex) => {
                const cellEntries = entries.filter(
                  (entry) => entry.timeStart === timeSlot && entry.dayIndex === dayIndex,
                );
                return (
                  <td key={dayIndex} style={scheduleBodyCellStyle}>
                    {cellEntries.map((entry) => (
                      <span
                        key={`${entry.id}-${dayIndex}`}
                        style={scheduleClassChipStyle}
                        onClick={() => onOpenClassOptions(entry.id)}
                      >
                        <b>{entry.subjectCode}</b>
                        <br />
                        {formatClassTime(entry.timeStart)} - {formatClassTime(entry.timeEnd)}
                        {entry.room ? ` · ${entry.room}` : ""}
                      </span>
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

function TodayScheduleSection({ sections, onOpenClassOptions, onOpenAction }) {
  const [viewMode, setViewMode] = useState("today");
  const now = new Date();
  const currentDayIndex = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [hour, minute] = timeStr.split(":").map(Number);
    return hour * 60 + (minute || 0);
  };

  const todaySections = (sections || [])
    .filter((item) => isScheduledToday(item, currentDayIndex))
    .sort(compareByStartTime);

  const getClassStatus = (item) => {
    const start = parseTimeToMinutes(item.time_start);
    const end = parseTimeToMinutes(item.time_end);
    if (currentMinutes >= start && currentMinutes <= end) {
      return { label: "IN PROGRESS", tone: "live" };
    }
    if (currentMinutes < start) {
      return { label: "UPCOMING", tone: "upcoming" };
    }
    return { label: "COMPLETED", tone: "completed" };
  };

  return (
    <section className="card today-schedule-card">
      <div
        className="card-heading"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <div>
          <p className="section-kicker">SCHEDULE</p>
          <h2>{viewMode === "today" ? "Today's Agenda" : "Weekly Schedule"}</h2>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className={viewMode === "today" ? "primary-button" : "outline-button"}
            style={{ padding: "4px 12px", fontSize: "13px" }}
            onClick={() => setViewMode("today")}
          >
            Today
          </button>
          <button
            className={viewMode === "weekly" ? "primary-button" : "outline-button"}
            style={{ padding: "4px 12px", fontSize: "13px" }}
            onClick={() => setViewMode("weekly")}
          >
            Weekly Grid
          </button>
        </div>
      </div>

      {viewMode === "weekly" ? (
        <WeeklyScheduleTable
          sections={sections}
          onOpenClassOptions={onOpenClassOptions}
        />
      ) : (
        <div className="today-timeline">
          {todaySections.length === 0 ? (
            <div className="empty-state">🎉 No classes scheduled for today!</div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                marginTop: "12px",
              }}
            >
              {todaySections.map((item) => {
                const status = getClassStatus(item);
                const isLive = status.tone === "live";
                return (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 16px",
                      borderRadius: "12px",
                      background: isLive ? "#f0fdf4" : "#f9fafb",
                      borderLeft: isLive ? "4px solid #22c55e" : "4px solid #cbd5e1",
                      boxShadow: isLive ? "0 2px 8px rgba(34, 197, 94, 0.15)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                      <div style={{ minWidth: "110px" }}>
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            color: isLive ? "#15803d" : "#475569",
                          }}
                        >
                          {formatClassTime(item.time_start)}
                        </span>
                        <br />
                        <small style={{ color: "#94a3b8", fontSize: "11px" }}>
                          to {formatClassTime(item.time_end)}
                        </small>
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <strong style={{ fontSize: "15px", color: "#0f172a" }}>
                            {item.subject_code}
                          </strong>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: "12px",
                              textTransform: "uppercase",
                              background: isLive
                                ? "#dcfce7"
                                : status.tone === "upcoming"
                                  ? "#e0f2fe"
                                  : "#f1f5f9",
                              color: isLive
                                ? "#15803d"
                                : status.tone === "upcoming"
                                  ? "#0369a1"
                                  : "#64748b",
                            }}
                          >
                            {status.label}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                          {item.subject_title} {item.room ? `· Room ${item.room}` : ""}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      {isLive && (
                        <button
                          className="primary-button"
                          style={{ padding: "6px 12px", fontSize: "12px" }}
                          onClick={() => onOpenAction("attendance", item.id)}
                        >
                          Take Attendance
                        </button>
                      )}
                      <button
                        className="outline-button"
                        style={{ padding: "6px 10px" }}
                        onClick={() => onOpenClassOptions(item.id)}
                        title="Options"
                      >
                        <Icon name="grid" size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function StatCard({ label, value, note, icon, tone, trend }) {
  return (
    <article className={`stat-card stat-${tone}`}>
      <div className="stat-top">
        <span className="stat-icon">
          <Icon name={icon} size={17} />
        </span>
        <span className="stat-trend">{trend}</span>
      </div>
      <p className="stat-label">{label}</p>
      <strong>{value}</strong>
      <p className="stat-note">{note}</p>
    </article>
  );
}

export default function OverviewView({
  setActive,
  students,
  stats,
  sections,
  onOpenClassOptions,
  onOpenAction,
}) {
  const bars = stats.attendanceBars;

  return (
    <>
      <section className="welcome-row">
        <div>
          <p className="eyebrow">
            {new Intl.DateTimeFormat("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            }).format(new Date())}
          </p>
          <h1>Good morning, Jeorge.</h1>
          <p className="welcome-copy">Here’s what’s happening with your class today.</p>
        </div>
        <button className="primary-button" onClick={() => setActive("classes")}>
          <Icon name="plus" size={17} /> Mark attendance
        </button>
      </section>
      <TodayScheduleSection
        sections={sections}
        onOpenClassOptions={onOpenClassOptions}
        onOpenAction={onOpenAction}
      />
      <section className="stats-grid">
        <StatCard
          label="Total students"
          value={stats.totalStudents}
          note={stats.male + " male · " + stats.female + " female"}
          icon="users"
          tone="plum"
          trend="Live"
        />
        <StatCard
          label="Today's attendance"
          value={stats.todayAttendance}
          note={stats.todayPresent + " present · " + stats.todayAbsent + " absent"}
          icon="calendar"
          tone="blue"
          trend="Live"
        />
        <StatCard
          label="Class average"
          value={stats.classAverage}
          note="Passing grade ≤ 3.05"
          icon="chart"
          tone="green"
          trend="Live"
        />
        <StatCard
          label="Needs attention"
          value={stats.needsAttention}
          note="Students below 80% attendance"
          icon="alert"
          tone="peach"
          trend="Review"
        />
      </section>
      <div className="dashboard-grid">
        <section className="card attendance-card">
          <div className="card-heading">
            <div>
              <p className="section-kicker">ATTENDANCE</p>
              <h2>Attendance overview</h2>
            </div>
            <button className="text-button" onClick={() => setActive("classes")}>
              View details <Icon name="arrow" size={15} />
            </button>
          </div>
          <div className="attendance-content">
            <div className="attendance-total">
              <strong>{stats.monthAttendance}</strong>
              <span className="positive">Live</span>
              <p>Average attendance this month</p>
            </div>
            <div className="bar-chart" aria-label="Weekly attendance chart">
              {bars.map((height, index) => (
                <div className="bar-column" key={index}>
                  <div className="bar-track">
                    <span style={{ height: `${height}%` }} />
                  </div>
                  <small>{["M", "T", "W", "T", "F", "M", "T"][index]}</small>
                </div>
              ))}
            </div>
          </div>
          <div className="attendance-legend">
            <span>
              <i className="dot present" /> Present <b>{stats.totalPresent}</b>
            </span>
            <span>
              <i className="dot absent" /> Absent <b>{stats.totalAbsent}</b>
            </span>
            <span>
              <i className="dot late" /> Late <b>{stats.totalLate}</b>
            </span>
          </div>
        </section>
        <section className="card performance-card">
          <div className="card-heading">
            <div>
              <p className="section-kicker">PERFORMANCE</p>
              <h2>Grade distribution</h2>
            </div>
            <button className="select-button">
              All periods <span>⌄</span>
            </button>
          </div>
          <div className="performance-body">
            <div className="donut">
              <div className="donut-center">
                <strong>{stats.classAverage}</strong>
                <small>average</small>
              </div>
            </div>
            <div className="distribution">
              <div>
                <span><i className="dot excellent" /> Excellent</span>
                <b>{stats.excellentCount} <small>students</small></b>
              </div>
              <div>
                <span><i className="dot good" /> Good</span>
                <b>{stats.goodCount} <small>students</small></b>
              </div>
              <div>
                <span><i className="dot watch" /> Needs review</span>
                <b>{stats.needsReviewCount} <small>students</small></b>
              </div>
            </div>
          </div>
          <div className="performance-footer">
            <span>Passing rate</span>
            <strong>{stats.passingRate}</strong>
            <span className="positive">Live</span>
          </div>
        </section>
        <section className="card activity-card">
          <div className="card-heading">
            <div>
              <p className="section-kicker">RECENT ACTIVITY</p>
              <h2>Latest updates</h2>
            </div>
          </div>
          <div className="activity-list">
            <div className="empty-state">No recent activity yet.</div>
          </div>
        </section>
        <section className="card attention-card">
          <div className="card-heading">
            <div>
              <p className="section-kicker">STUDENT CHECK-IN</p>
              <h2>Needs your attention</h2>
            </div>
            <button className="text-button" onClick={() => setActive("classes")}>
              See all <Icon name="arrow" size={15} />
            </button>
          </div>
          <div className="attention-list">
            {students
              .filter((student) => student.status !== "On track")
              .slice(0, 3)
              .map((student) => (
                <div className="student-row" key={student.id}>
                  <Avatar initials={student.initials} color={student.color} small />
                  <div className="student-info">
                    <b>{student.name}</b>
                    <small>{student.attendance}% attendance</small>
                  </div>
                  <span
                    className={`status status-${student.status.toLowerCase().replace(" ", "-")}`}
                  >
                    {student.status}
                  </span>
                  <button className="row-arrow" onClick={() => setActive("classes")}>
                    <Icon name="arrow" size={15} />
                  </button>
                </div>
              ))}
          </div>
        </section>
      </div>
    </>
  );
}
