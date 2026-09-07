export function formatTime(value) {
  return value ? String(value).slice(0, 5) : "";
}

export function formatTimeRange(section) {
  const start = formatTime(section?.time_start);
  const end = formatTime(section?.time_end);
  return start && end ? `${start} - ${end}` : "";
}

export function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  return `${month}/${day}/${year}`;
}

export function formatFileTime(value) {
  const time = formatTime(value);
  if (!time) return "";
  const [hourValue, minute] = time.split(":").map(Number);
  if (!Number.isFinite(hourValue) || !Number.isFinite(minute)) return "";
  return `${hourValue % 12 || 12}${String(minute).padStart(2, "0")}${hourValue >= 12 ? "PM" : "AM"}`;
}

export function safeFilePart(value) {
  return String(value || "class")
    .trim()
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, " ");
}
