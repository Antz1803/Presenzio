const AVATAR_KEY_PREFIX = "presenzio-instructor-avatar:";

function avatarKey(userId) {
  return userId ? `${AVATAR_KEY_PREFIX}${userId}` : null;
}

export function getStoredInstructorAvatar(userId) {
  const key = avatarKey(userId);
  if (!key || typeof window === "undefined") return "";

  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

export function storeInstructorAvatar(userId, avatarUrl) {
  const key = avatarKey(userId);
  if (!key || typeof window === "undefined") return;

  try {
    if (avatarUrl) window.localStorage.setItem(key, avatarUrl);
    else window.localStorage.removeItem(key);
  } catch {
    // Profile text remains usable if local storage is unavailable or full.
  }
}
