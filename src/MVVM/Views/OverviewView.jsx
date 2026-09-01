import { useState, useMemo, useEffect, useCallback } from "react";
import { Avatar, Icon } from "./DashboardShared";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const dayCodeMap = {
  SU: 0,
  M: 1,
  T: 2,
  TU: 2,
  W: 3,
  TH: 4,
  F: 5,
  S: 6,
  SA: 6,
};

// Helper Utilities
function parseDayCodes(daysString) {
  if (!daysString) return [];
  const str = String(daysString).toUpperCase().replace(/[\s-]/g, "");
  const shortcuts = { TTH: [2, 4], MW: [1, 3], FS: [5, 6], MWF: [1, 3, 5] };
  if (shortcuts[str]) return shortcuts[str];

  const matches = str.match(/TTH|TH|TU|SU|SA|MWF|MW|FS|M|T|W|F|S/gi) || [];
  const parsed = matches.flatMap((t) => shortcuts[t.toUpperCase()] || (dayCodeMap[t.toUpperCase()] !== undefined ? [dayCodeMap[t.toUpperCase()]] : []));
  return [...new Set(parsed)];
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const str = String(timeStr).trim();
  const isPM = /pm/i.test(str);
  const isAM = /am/i.test(str);
  let [hour, minute] = str.replace(/(am|pm)/gi, "").trim().split(":").map(Number);
  hour = hour || 0; minute = minute || 0;
  if (isPM && hour < 12) hour += 12;
  if (isAM && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function formatClassTime(value) {
  if (!value) return "—";
  const [hour, minute] = String(value).split(":").map(Number);
  if (isNaN(hour)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${String(minute || 0).padStart(2, "0")} ${suffix}`;
}

function getSectionMeta(s) {
  return {
    code: s?.subject_code || s?.code || "—",
    name: s?.subject_name || s?.title || s?.name || "",
    sec: s?.section_no || s?.section_name || s?.section || s?.course_section || s?.sectionCode || "N/A",
    room: s?.room || "TBA",
  };
}

function buildWeeklySchedule(sections) {
  const entries = [];
  (sections || []).forEach((section, idx) => {
    const meta = getSectionMeta(section);
    parseDayCodes(section?.days).forEach((dayIndex) => {
      entries.push({
        dayIndex,
        timeStart: section?.time_start || "",
        timeEnd: section?.time_end || "",
        subjectCode: meta.code,
        subjectName: meta.name,
        sectionName: meta.sec,
        room: meta.room,
        id: section?.id || `section-${idx}`,
      });
    });
  });
  const timeSlots = [...new Set(entries.map((e) => e.timeStart))].filter(Boolean).sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b));
  return { entries, timeSlots };
}

function getLiveClassInfo(sections) {
  const now = new Date();
  const dayIndex = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const live = (sections || []).find((item) => {
    if (!parseDayCodes(item?.days).includes(dayIndex)) return false;
    return currentMinutes >= parseTimeToMinutes(item.time_start) && currentMinutes <= parseTimeToMinutes(item.time_end);
  });
  if (!live) return null;
  const meta = getSectionMeta(live);
  return { ...meta, timeStart: live.time_start, timeEnd: live.time_end };
}

// Components
function RealtimeCalendar() {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = currentDate.getDate();
  const monthName = currentDate.toLocaleString("default", { month: "long" });
  const timeString = currentDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const daysArray = useMemo(() => [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)], [firstDay, daysInMonth]);

  return (
    <div className="bg-white/70 backdrop-blur-xl p-5 rounded-3xl border border-white/60 shadow-xl shadow-slate-200/50 flex flex-col justify-between relative overflow-hidden">
      <div className="flex justify-between items-center mb-3">
        <div>
          <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">{monthName} {year}</h3>
          <p className="text-[11px] text-indigo-600 font-semibold tracking-wide flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" /> {timeString} · Live
          </p>
        </div>
        <span className="p-2.5 rounded-2xl bg-indigo-50/80 text-indigo-600 backdrop-blur-md border border-indigo-100/50">
          <Icon name="calendar" size={18} />
        </span>
      </div>

      <div className="grid grid-cols-7 text-center gap-1 text-[11px] font-bold text-slate-400 mb-1">
        {weekdayLabels.map((day) => <div key={day}>{day}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {daysArray.map((day, idx) => (
          !day ? <div key={`empty-${idx}`} /> : (
            <div
              key={`day-${day}`}
              className={`py-1.5 rounded-xl text-xs font-semibold transition-all ${
                day === today
                  ? "bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-200 scale-105"
                  : "text-slate-700 hover:bg-slate-100/60"
              }`}
            >
              {day}
            </div>
          )
        ))}
      </div>
    </div>
  );
}

function InfoBlock({ label, children }) {
  return (
    <div className="bg-slate-50/80 backdrop-blur-sm p-3 rounded-2xl border border-slate-100/80 shadow-inner">
      <span className="text-slate-400 font-medium block text-[10px] uppercase tracking-wider mb-1">{label}</span>
      {children}
    </div>
  );
}

function ExpandedInstructorProfileCard({ instructor, onUpdateInstructor, sections }) {
  const [isEditing, setIsEditing] = useState(false);
  const [liveClass, setLiveClass] = useState(() => getLiveClassInfo(sections));

  useEffect(() => {
    setLiveClass(getLiveClassInfo(sections));
    const timer = setInterval(() => setLiveClass(getLiveClassInfo(sections)), 60000);
    return () => clearInterval(timer);
  }, [sections]);

  const defaultProfile = useMemo(() => ({
    name: instructor?.name || "Jeorge",
    position: instructor?.position || "Assistant Professor",
    schedule: instructor?.schedule || "7:30 AM - 5:00 PM",
    gmail: instructor?.gmail || "jeorge@example.com",
    facebook: instructor?.facebook || "facebook.com/jeorge.dev",
    courses: instructor?.courses || ["BSIT 3A - Web Dev", "BSCS 2B - OOP", "BSIT 4A - Capstone"],
    initials: instructor?.initials || "J",
    color: instructor?.color || "bg-indigo-600",
    avatarUrl: instructor?.avatarUrl || "",
  }), [instructor]);

  const [formData, setFormData] = useState(defaultProfile);
  // Store raw text for comma-separated courses editing
  const [coursesInput, setCoursesInput] = useState("");

  useEffect(() => {
    setFormData(defaultProfile);
  }, [defaultProfile]);

  const handleOpenEdit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setFormData(defaultProfile);
    // Convert array to comma-separated string for editing
    setCoursesInput(Array.isArray(defaultProfile.courses) ? defaultProfile.courses.join(", ") : defaultProfile.courses || "");
    setIsEditing(true);
  };

  const handleChange = (e) => setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleCoursesChange = (e) => {
    setCoursesInput(e.target.value);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData((p) => ({ ...p, avatarUrl: reader.result }));
      reader.readAsDataURL(file);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Parse comma-separated string back to array
    const updatedCourses = coursesInput
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    const updatedProfile = {
      ...formData,
      courses: updatedCourses,
    };

    onUpdateInstructor?.(updatedProfile);
    setIsEditing(false);
  };

  return (
    <>
      <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl border border-white/60 shadow-xl shadow-slate-200/50 relative">
        <button
          type="button"
          onClick={handleOpenEdit}
          className="absolute top-5 right-5 p-2.5 bg-slate-100/80 hover:bg-slate-200/80 rounded-2xl text-slate-600 transition-all border border-slate-200/50 backdrop-blur-md shadow-sm z-10"
          title="Edit Profile Settings"
        >
          <Icon name="settings" size={16} />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          <div className="md:col-span-7 flex flex-col justify-between space-y-3">
            <div className="space-y-2.5 text-xs">
              <InfoBlock label="Live Schedule">
                {liveClass ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-lg border border-emerald-200/50">
                        {liveClass.code}
                      </span>
                      {liveClass.name && <span className="text-slate-600 font-medium text-xs truncate">{liveClass.name}</span>}
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow-sm shadow-emerald-200">
                        Ongoing
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                      <span className="bg-slate-200/60 font-medium text-slate-700 px-2 py-0.5 rounded-md">Sec. {liveClass.sec}</span>
                      <span className="bg-indigo-50 font-medium text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100/50">Room: {liveClass.room}</span>
                      <span className="self-center">{formatClassTime(liveClass.timeStart)} - {formatClassTime(liveClass.timeEnd)}</span>
                    </div>
                  </div>
                ) : (
                  <span className="font-semibold text-slate-400">No class in session</span>
                )}
              </InfoBlock>

              <InfoBlock label="Gmail Account">
                <a href={`mailto:${formData.gmail}`} className="font-semibold text-indigo-600 hover:underline truncate block">{formData.gmail}</a>
              </InfoBlock>

              <InfoBlock label="Facebook Profile">
                <a href={formData.facebook.startsWith("http") ? formData.facebook : `https://${formData.facebook}`} target="_blank" rel="noreferrer" className="font-semibold text-indigo-600 hover:underline truncate block">
                  {formData.facebook}
                </a>
              </InfoBlock>

              <InfoBlock label="Courses Handled">
                <div className="flex flex-wrap gap-1.5">
                  {(formData.courses || []).map((course, idx) => (
                    <span key={`${course}-${idx}`} className="bg-indigo-50/80 text-indigo-700 font-semibold px-2.5 py-0.5 rounded-lg text-[11px] border border-indigo-100/50">
                      {course}
                    </span>
                  ))}
                </div>
              </InfoBlock>
            </div>
          </div>

          <div className="md:col-span-5 flex flex-col items-center justify-between">
            <div className="w-full h-full min-h-[180px] max-h-[260px] bg-slate-100/80 rounded-2xl overflow-hidden border border-slate-200/60 shadow-inner flex items-center justify-center relative group">
              {formData.avatarUrl ? (
                <img src={formData.avatarUrl} alt={formData.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              ) : (
                <div className={`w-full h-full ${formData.color} flex items-center justify-center text-white text-5xl font-black bg-gradient-to-br from-indigo-500 to-violet-600`}>
                  {formData.initials}
                </div>
              )}
            </div>

            <div className="text-center pt-3 w-full">
              <h2 className="text-lg font-black text-slate-900 leading-tight">{formData.name}</h2>
              <p className="text-xs font-bold text-indigo-600 mt-0.5">{formData.position}</p>
            </div>
          </div>
        </div>
      </div>

      {isEditing && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white/90 backdrop-blur-2xl rounded-3xl max-w-md w-full p-6 shadow-2xl border border-white/60 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">Edit Profile Details</h3>
              <button type="button" onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">✕</button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Upload Profile Photo</label>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer" />
              </div>
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Full Name</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full p-2.5 rounded-xl border border-slate-200/80 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
              </div>
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Position / Title</label>
                <input type="text" name="position" value={formData.position} onChange={handleChange} className="w-full p-2.5 rounded-xl border border-slate-200/80 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
              </div>
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Courses Handled (comma-separated)</label>
                <input 
                  type="text" 
                  name="courses" 
                  value={coursesInput} 
                  onChange={handleCoursesChange} 
                  placeholder="e.g. BSIT 3A - Web Dev, BSCS 2B - OOP" 
                  className="w-full p-2.5 rounded-xl border border-slate-200/80 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                />
              </div>
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Gmail Address</label>
                <input type="email" name="gmail" value={formData.gmail} onChange={handleChange} className="w-full p-2.5 rounded-xl border border-slate-200/80 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
              </div>
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Facebook URL</label>
                <input type="text" name="facebook" value={formData.facebook} onChange={handleChange} className="w-full p-2.5 rounded-xl border border-slate-200/80 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold hover:opacity-90 shadow-md shadow-indigo-200">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function WeeklyScheduleTable({ sections, onOpenClassOptions }) {
  const { entries, timeSlots } = useMemo(() => buildWeeklySchedule(sections), [sections]);

  if (!timeSlots.length) return <div className="p-8 text-center text-xs font-semibold text-slate-400">No classes scheduled yet.</div>;

  return (
    <div className="overflow-x-auto mt-4 rounded-2xl border border-slate-100/80">
      <table className="w-full border-collapse text-left min-w-[600px]">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/50">
            <th className="p-2.5 text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">Time</th>
            {weekdayLabels.map((label) => <th key={label} className="p-2.5 text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100/60">
          {timeSlots.map((timeSlot) => (
            <tr key={timeSlot}>
              <td className="p-2 text-[11px] font-bold text-slate-400 whitespace-nowrap border-r border-slate-100/60 text-center">{formatClassTime(timeSlot)}</td>
              {weekdayLabels.map((_, dayIndex) => {
                const cellEntries = entries.filter((e) => e.timeStart === timeSlot && e.dayIndex === dayIndex);
                return (
                  <td key={dayIndex} className="p-1 align-top border-r border-slate-100/60">
                    {cellEntries.map((entry, idx) => (
                      <div
                        key={`${entry.id || entry.subjectCode}-${dayIndex}-${timeSlot}-${idx}`}
                        onClick={() => onOpenClassOptions?.(entry.id)}
                        className="p-2 mb-1 rounded-xl bg-indigo-50/70 hover:bg-indigo-100/80 border border-indigo-100/50 cursor-pointer text-[11px] transition-all space-y-0.5 hover:shadow-sm"
                      >
                        <b className="font-extrabold text-slate-800 block truncate" title={entry.subjectCode}>{entry.subjectCode}</b>
                        {entry.subjectName && <span className="text-[10px] text-indigo-600 font-medium block truncate" title={entry.subjectName}>{entry.subjectName}</span>}
                        <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-indigo-100/60">
                          <span className="font-semibold text-slate-600">Sec. {entry.sectionName}</span>
                          <span className="font-semibold text-indigo-500">{entry.room}</span>
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
  const [currentMinutes, setCurrentMinutes] = useState(() => new Date().getHours() * 60 + new Date().getMinutes());
  const currentDayIndex = new Date().getDay();

  useEffect(() => {
    const timer = setInterval(() => setCurrentMinutes(new Date().getHours() * 60 + new Date().getMinutes()), 60000);
    return () => clearInterval(timer);
  }, []);

  const todaySections = useMemo(() => {
    return (sections || [])
      .filter((item) => parseDayCodes(item?.days).includes(currentDayIndex))
      .sort((a, b) => parseTimeToMinutes(a.time_start) - parseTimeToMinutes(b.time_start));
  }, [sections, currentDayIndex]);

  const getClassStatus = useCallback((item) => {
    const start = parseTimeToMinutes(item.time_start);
    const end = parseTimeToMinutes(item.time_end);
    if (currentMinutes >= start && currentMinutes <= end) return { label: "Ongoing", tone: "live" };
    if (currentMinutes < start) return { label: "Upcoming", tone: "upcoming" };
    return { label: "Ended", tone: "completed" };
  }, [currentMinutes]);

  const statusStyles = {
    live: "bg-emerald-500 text-white shadow-sm shadow-emerald-200",
    upcoming: "bg-amber-100/80 text-amber-700 border border-amber-200/50",
    completed: "bg-slate-200/60 text-slate-500",
  };

  return (
    <section className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl border border-white/60 shadow-xl shadow-slate-200/50 flex flex-col justify-between h-full">
      <div>
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SCHEDULE</p>
            <h2 className="text-lg font-black text-slate-800 tracking-tight">{viewMode === "today" ? "Today's Agenda" : "Weekly Schedule"}</h2>
          </div>
          <div className="flex p-1 bg-slate-100/80 rounded-2xl border border-slate-200/50 backdrop-blur-md">
            {["today", "weekly"].map((mode) => (
              <button
                key={mode}
                className={`px-3 py-1 text-xs font-bold capitalize rounded-xl transition-all ${
                  viewMode === mode ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
                onClick={() => setViewMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {viewMode === "weekly" ? (
          <WeeklyScheduleTable sections={sections} onOpenClassOptions={onOpenClassOptions} />
        ) : (
          <div className="flex flex-col gap-3 mt-2">
            {todaySections.length === 0 ? (
              <div className="p-8 text-center text-xs font-semibold text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                🎉 No classes scheduled for today!
              </div>
            ) : (
              todaySections.map((item, idx) => {
                const status = getClassStatus(item);
                const isLive = status.tone === "live";
                const meta = getSectionMeta(item);

                return (
                  <div
                    key={item.id || `${meta.code}-${idx}`}
                    className={`flex items-center justify-between p-4 rounded-2xl text-xs transition-all ${
                      isLive
                        ? "bg-gradient-to-r from-emerald-50/80 to-teal-50/40 border border-emerald-200/80 shadow-md shadow-emerald-100/50"
                        : "bg-slate-50/80 border border-slate-100/80 hover:border-slate-200"
                    }`}
                  >
                    <div className="flex gap-3 items-center">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-slate-900 font-extrabold text-sm">{meta.code}</strong>
                          {meta.name && <span className="text-[11px] font-medium text-slate-500 truncate max-w-[150px]">• {meta.name}</span>}
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${statusStyles[status.tone]}`}>
                            {status.label}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-slate-500">
                          <span className="bg-slate-200/60 font-medium text-slate-700 px-2 py-0.5 rounded-md">Sec. {meta.sec}</span>
                          <span className="bg-indigo-50/80 font-medium text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100/50">Room: {meta.room}</span>
                          <span>{formatClassTime(item.time_start)} - {formatClassTime(item.time_end)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isLive && (
                        <button
                          className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white px-3 py-1.5 text-[11px] font-bold rounded-xl shadow-md shadow-emerald-200 transition-all"
                          onClick={() => onOpenAction?.("attendance", item.id)}
                        >
                          Attendance
                        </button>
                      )}
                      <button
                        className="p-2 border border-slate-200/80 hover:bg-slate-100/80 rounded-xl text-slate-600 transition-all bg-white/50"
                        onClick={() => onOpenClassOptions?.(item.id)}
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
    <article className="bg-white/70 backdrop-blur-xl p-5 rounded-3xl border border-white/60 shadow-xl shadow-slate-200/50 flex flex-col justify-between hover:translate-y-[-2px] transition-all">
      <div className="flex justify-between items-center mb-3">
        <span className="p-2.5 rounded-2xl bg-slate-100/80 text-slate-700 backdrop-blur-md">
          <Icon name={icon} size={18} />
        </span>
        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{trend}</span>
      </div>
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <strong className="text-2xl font-black text-slate-900 tracking-tight">{value}</strong>
      </div>
      <p className="text-xs font-medium text-slate-400 mt-1">{note}</p>
    </article>
  );
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