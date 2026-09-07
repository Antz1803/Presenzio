import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "../DashboardShared";
import { buildWeeklySchedule, formatClassTime, getSectionMeta, parseDayCodes, parseTimeToMinutes, weekdayLabels } from "./overviewUtils";

export function WeeklyScheduleTable({ sections, onOpenClassOptions }) {
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

export function CompactTodayScheduleSection({ sections, onOpenClassOptions, onOpenAction }) {
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
               No classes scheduled for today!
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
                          {meta.name && <span className="text-[11px] font-medium text-slate-500 truncate max-w-[150px]">â€¢ {meta.name}</span>}
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
