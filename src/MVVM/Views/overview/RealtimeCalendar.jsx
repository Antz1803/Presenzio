import { useEffect, useMemo, useState } from "react";
import { Icon } from "../DashboardShared";
import { weekdayLabels } from "./overviewUtils";

export default function RealtimeCalendar() {
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
