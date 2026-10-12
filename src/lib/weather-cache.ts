export const WEATHER_REFRESH_MS = 2 * 60 * 60 * 1000;
export const WEATHER_OUTAGE_MS = 12 * 60 * 60 * 1000;

// Future/invalid timestamps must not suppress refreshes indefinitely.
export function weatherCacheAge(savedAt: unknown, now = Date.now()) {
  const timestamp = Number(savedAt);
  return Number.isFinite(timestamp) && timestamp > 0 && timestamp <= now
    ? now - timestamp
    : Infinity;
}

export function weatherRefreshDelay(savedAt: unknown, now = Date.now()) {
  return Math.max(0, WEATHER_REFRESH_MS - weatherCacheAge(savedAt, now));
}

