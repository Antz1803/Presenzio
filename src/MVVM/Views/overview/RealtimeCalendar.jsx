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
  const timeString = currentDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const daysArray = useMemo(
    () => [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ],
    [firstDay, daysInMonth],
  );

  return (
    <section className="rounded-lg border border-accent/20 bg-surface-1/85 p-3 backdrop-blur-xl">
      <div className="mb-2 flex items-start justify-between">
        <div>
          <h3 className="font-display text-sm font-semibold tracking-tight text-ink">
            {monthName} {year}
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-accent">
            <span className="size-1.5 animate-pulse rounded-full bg-accent shadow-[0_0_6px_#00F0FF]" />
            {timeString} - Live
          </p>
        </div>
        <span className="text-ink-2">
          <Icon name="calendar" size={16} />
        </span>
      </div>

      <div className="mb-0.5 grid grid-cols-7 gap-0.5 text-center font-mono text-[10px] text-ink-3">
        {weekdayLabels.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {daysArray.map((day, idx) =>
          !day ? (
            <div key={`empty-${idx}`} />
          ) : (
            <div
              key={`day-${day}`}
              className={`mx-auto grid size-6 place-items-center rounded-full font-mono text-[11px] transition ${
                day === today
                  ? "bg-accent font-bold text-canvas shadow-halo"
                  : "text-ink-2 hover:bg-surface-3 hover:text-ink"
              }`}
            >
              {day}
            </div>
          ),
        )}
      </div>
    </section>
  );
}