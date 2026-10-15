import { useEffect, useState } from "react";

export default function LiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const date = now.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-surface-1/90 px-3 py-1 text-xs shadow-lg shadow-black/40">
      <span className="size-2 animate-pulse rounded-full bg-accent shadow-[0_0_8px_#00F0FF]" />
      <span className="font-mono tabular-nums text-ink">{time}</span>
      <span className="text-ink-3">|</span>
      <span className="text-ink-2">{date}</span>
    </div>
  );
}