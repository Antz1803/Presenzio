import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "../DashboardShared";
import {
  buildWeeklySchedule,
  formatClassTime,
  getSectionMeta,
  parseDayCodes,
  parseTimeToMinutes,
  weekdayLabels,
} from "./overviewUtils";

export function WeeklyScheduleTable({ sections, onOpenClassOptions }) {
  const { entries, timeSlots } = useMemo(
    () => buildWeeklySchedule(sections),
    [sections],
  );

  if (!timeSlots.length)
    return (
      <div className="p-6 text-center text-xs text-ink-3">
        No classes scheduled yet.
      </div>
    );

  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-white/5">
      <table className="w-full min-w-[560px] border-collapse text-left">
        <thead>
          <tr className="border-b border-white/5 bg-canvas">
            <th className="p-2 text-center font-mono text-[10px] font-medium uppercase tracking-wider text-ink-3">
              Time
            </th>
            {weekdayLabels.map((label) => (
              <th
                key={label}
                className="p-2 text-center font-mono text-[10px] font-medium uppercase tracking-wider text-ink-3"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map((timeSlot, rowIdx) => (
            <tr
              key={timeSlot}
              className={rowIdx % 2 ? "bg-surface-1" : "bg-canvas"}
            >
              <td className="whitespace-nowrap border-r border-white/5 p-1.5 text-center font-mono text-[10px] text-ink-3">
                {formatClassTime(timeSlot)}
              </td>
              {weekdayLabels.map((_, dayIndex) => {
                const cellEntries = entries.filter(
                  (e) => e.timeStart === timeSlot && e.dayIndex === dayIndex,
                );
                return (
                  <td
                    key={dayIndex}
                    className="border-r border-white/5 p-1 align-top"
                  >
                    {cellEntries.map((entry, idx) => (
                      <button
                        type="button"
                        key={`${entry.id || entry.subjectCode}-${dayIndex}-${timeSlot}-${idx}`}
                        onClick={() => onOpenClassOptions?.(entry.id)}
                        className="mb-1 block w-full space-y-0.5 rounded border border-accent/20 bg-surface-2 p-1.5 text-left text-[10px] transition hover:border-accent/50 hover:shadow-glow"
                      >
                        <b
                          className="block truncate font-mono font-bold text-ink"
                          title={entry.subjectCode}
                        >
                          {entry.subjectCode}
                        </b>
                        {entry.subjectName && (
                          <span
                            className="block truncate text-[9px] text-accent-4"
                            title={entry.subjectName}
                          >
                            {entry.subjectName}
                          </span>
                        )}
                        <div className="flex items-center justify-between border-t border-white/5 pt-0.5 font-mono text-[9px]">
                          <span className="text-ink-2">
                            Sec. {entry.sectionName}
                          </span>
                          <span className="text-accent">{entry.room}</span>
                        </div>
                      </button>
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

const STATUS_STYLES = {
  live: "border-accent bg-accent text-canvas font-bold shadow-glow",
  upcoming: "border-amber-500/40 bg-amber-500/20 text-amber-300 font-bold",
  completed: "border-white/10 bg-surface-3 text-ink-2 font-semibold",
};

export function CompactTodayScheduleSection({
  sections,
  onOpenClassOptions,
  onOpenAction,
}) {
  const [viewMode, setViewMode] = useState("today");
  const [currentMinutes, setCurrentMinutes] = useState(
    () => new Date().getHours() * 60 + new Date().getMinutes(),
  );
  const currentDayIndex = new Date().getDay();

  useEffect(() => {
    const timer = setInterval(
      () =>
        setCurrentMinutes(new Date().getHours() * 60 + new Date().getMinutes()),
      60000,
    );
    return () => clearInterval(timer);
  }, []);

  const todaySections = useMemo(() => {
    return (sections || [])
      .filter((item) => parseDayCodes(item?.days).includes(currentDayIndex))
      .sort(
        (a, b) =>
          parseTimeToMinutes(a.time_start) - parseTimeToMinutes(b.time_start),
      );
  }, [sections, currentDayIndex]);

  const getClassStatus = useCallback(
    (item) => {
      const start = parseTimeToMinutes(item.time_start);
      const end = parseTimeToMinutes(item.time_end);
      if (currentMinutes >= start && currentMinutes <= end)
        return { label: "Ongoing", tone: "live" };
      if (currentMinutes < start)
        return { label: "Upcoming", tone: "upcoming" };
      return { label: "Ended", tone: "completed" };
    },
    [currentMinutes],
  );

  // Highlight the ongoing class, otherwise the next one coming up.
  const highlightedId = useMemo(() => {
    const live = todaySections.find((s) => getClassStatus(s).tone === "live");
    const next = todaySections.find(
      (s) => getClassStatus(s).tone === "upcoming",
    );
    const pick = live || next;
    return pick ? (pick.id ?? todaySections.indexOf(pick)) : null;
  }, [todaySections, getClassStatus]);

  return (
    <section className="rounded-lg border border-accent/20 bg-surface-1/85 p-4 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-accent">
            Schedule
          </p>
          <h2 className="font-display text-base font-semibold tracking-tight text-ink">
            {viewMode === "today" ? "Today's Agenda" : "Weekly Schedule"}
          </h2>
        </div>
        <div className="flex rounded-md border border-slate-700/50 bg-surface-2 p-0.5">
          {["today", "weekly"].map((mode) => (
            <button
              key={mode}
              type="button"
              className={`rounded px-2.5 py-0.5 text-[11px] capitalize transition ${
                viewMode === mode
                  ? "bg-linear-to-r from-accent to-accent-4 font-bold text-canvas shadow-md shadow-accent/30"
                  : "font-medium text-ink-2 hover:text-ink"
              }`}
              onClick={() => setViewMode(mode)}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {viewMode === "weekly" ? (
        <WeeklyScheduleTable
          sections={sections}
          onOpenClassOptions={onOpenClassOptions}
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          {todaySections.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-xs text-ink-3">
              No classes scheduled for today.
            </div>
          ) : (
            todaySections.map((item, idx) => {
              const status = getClassStatus(item);
              const meta = getSectionMeta(item);
              const rowKey = item.id ?? idx;
              const isHighlighted = rowKey === highlightedId;
              const isLive = status.tone === "live";

              return (
                <div
                  key={item.id || `${meta.code}-${idx}`}
                  className={`group flex flex-wrap items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 transition ${
                    isHighlighted
                      ? "border-accent/60 bg-surface-2 shadow-glow"
                      : "border-white/5 bg-surface-2/60 hover:border-accent/30"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`rounded border px-1.5 py-px font-mono text-[9px] uppercase tracking-wide ${STATUS_STYLES[status.tone]}`}
                    >
                      {status.label}
                    </span>
                    <h3 className="flex min-w-0 items-center gap-1.5 truncate text-[11px] font-bold text-ink">
                      {meta.code}
                      {isHighlighted && (
                        <span className="size-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_6px_#00F0FF]" />
                      )}
                    </h3>
                    {meta.name && (
                      <span className="hidden max-w-[120px] truncate text-[10px] text-ink-3 xl:inline">
                        {meta.name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 font-mono text-[10px]">
                    <span
                      className={`rounded border px-1.5 py-px ${
                        isHighlighted
                          ? "border-accent bg-accent font-bold text-canvas"
                          : "border-white/10 bg-surface-3 text-ink"
                      }`}
                    >
                      Sec. {meta.sec}
                    </span>
                    <span className="text-ink-2">Room: {meta.room}</span>
                    <span className={isHighlighted ? "text-accent" : "text-ink-3"}>
                      {formatClassTime(item.time_start)} -{" "}
                      {formatClassTime(item.time_end)}
                    </span>
                    {isLive && (
                      <button
                        type="button"
                        className="rounded bg-accent px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-canvas transition hover:shadow-halo active:scale-[0.98]"
                        onClick={() => onOpenAction?.("attendance", item.id)}
                      >
                        Attendance
                      </button>
                    )}
                    <button
                      type="button"
                      title="Manage class"
                      aria-label="Manage class"
                      className="rounded p-0.5 text-ink-3 transition-colors group-hover:text-accent"
                      onClick={() => onOpenClassOptions?.(item.id)}
                    >
                      <Icon name="more" size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}