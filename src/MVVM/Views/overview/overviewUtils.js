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
  if (!value) return "â€”";
  const [hour, minute] = String(value).split(":").map(Number);
  if (isNaN(hour)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${String(minute || 0).padStart(2, "0")} ${suffix}`;
}

function getSectionMeta(s) {
  return {
    code: s?.subject_code || s?.code || "â€”",
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

export {
  weekdayLabels,
  parseDayCodes,
  parseTimeToMinutes,
  formatClassTime,
  getSectionMeta,
  buildWeeklySchedule,
  getLiveClassInfo,
};

