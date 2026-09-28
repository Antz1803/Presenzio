const deanKeyPrefix = "presenzio-dean:";

export function getStoredDean(sectionId) {
  if (!sectionId || typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(`${deanKeyPrefix}${sectionId}`) || "";
  } catch {
    return "";
  }
}

export function setStoredDean(sectionId, value) {
  if (!sectionId || typeof window === "undefined") return;
  try {
    const key = `${deanKeyPrefix}${sectionId}`;
    const dean = String(value ?? "").trim();
    if (dean) window.localStorage.setItem(key, dean);
    else window.localStorage.removeItem(key);
  } catch {
    // Local storage may be unavailable in private/restricted browser contexts.
  }
}
