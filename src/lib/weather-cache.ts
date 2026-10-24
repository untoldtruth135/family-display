export const WEATHER_REFRESH_MS = 30 * 60 * 1000;
// Incoming observations must be recent; displayed readings can age until the next poll.
export const WEATHER_PROVIDER_MAX_AGE_MS = 30 * 60 * 1000;
export const WEATHER_MAX_AGE_MS = WEATHER_PROVIDER_MAX_AGE_MS + WEATHER_REFRESH_MS;
export const WEATHER_OUTAGE_MS = 2 * 60 * 60 * 1000;
export const WEATHER_REQUEST_MS = 40 * 1000;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export function weatherCacheAge(savedAt: unknown, now = Date.now()) {
  const timestamp = typeof savedAt === "string" && !/^\d+$/.test(savedAt)
    ? Date.parse(savedAt) : Number(savedAt);
  return Number.isFinite(timestamp) && timestamp > 0 && timestamp <= now
    ? now - timestamp : Infinity;
}

export function weatherRefreshDelay(savedAt: unknown, now = Date.now()) {
  return Math.max(0, WEATHER_REFRESH_MS - weatherCacheAge(savedAt, now));
}

// Open-Meteo's auto-timezone observation time has no offset in its string.
// Apply the offset accompanying THIS response, including its current DST offset.
export function providerObservationTime(time: unknown, offsetSeconds: unknown, now = Date.now()) {
  if (typeof time !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(time) ||
      typeof offsetSeconds !== "number" || !Number.isFinite(offsetSeconds) || Math.abs(offsetSeconds) > 14 * 3600) {
    throw new Error("Weather provider observation time is missing or invalid.");
  }
  const timestamp = Date.parse(time + "Z") - offsetSeconds * 1000;
  if (!Number.isFinite(timestamp) || timestamp > now + FUTURE_TOLERANCE_MS ||
      now - timestamp > WEATHER_PROVIDER_MAX_AGE_MS) {
    throw new Error("Weather provider observation is out of date.");
  }
  return new Date(timestamp).toISOString();
}

export function observationAge(observedAt: unknown, now = Date.now()) {
  if (typeof observedAt !== "string") return Infinity;
  const time = Date.parse(observedAt);
  if (!Number.isFinite(time) || time <= 0 || time > now + FUTURE_TOLERANCE_MS) return Infinity;
  return Math.max(0, now - time);
}

export function validWeatherSnapshot(data: unknown): data is {
  observedAt: string; fetchedAt: string; location: { name: string };
  current: { temperature: number }; daily: unknown[];
} {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  const current = d.current as Record<string, unknown> | undefined;
  const location = d.location as Record<string, unknown> | undefined;
  return Number.isFinite(current?.temperature) && typeof location?.name === "string" &&
    typeof d.observedAt === "string" && Number.isFinite(Date.parse(d.observedAt)) &&
    typeof d.fetchedAt === "string" && Number.isFinite(Date.parse(d.fetchedAt)) &&
    Array.isArray(d.daily) && d.daily.length > 0;
}

// Race the complete operation (headers AND body) so even an unresponsive WebView
// transport cannot prevent the caller from scheduling its next retry.
export async function fetchWeatherSnapshot(
  url: string, signal: AbortSignal, fetcher: typeof fetch = fetch, timeoutMs = WEATHER_REQUEST_MS
) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  let abort: () => void = () => {};
  const interrupted = new Promise<never>((_, reject) => {
    abort = () => { controller.abort(); reject(new Error("Weather request cancelled.")); };
    signal.addEventListener("abort", abort, { once: true });
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("Weather request timed out."));
    }, timeoutMs);
    if (signal.aborted) abort();
  });
  try {
    return await Promise.race([
      interrupted,
      (async () => {
        if (signal.aborted) throw new Error("Weather request cancelled.");
        const response = await fetcher(url, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error ?? "Weather refresh failed.");
        if (!validWeatherSnapshot(data) || observationAge(data.observedAt) > WEATHER_PROVIDER_MAX_AGE_MS ||
            observationAge(data.fetchedAt) > WEATHER_REFRESH_MS) {
          throw new Error("Weather response is out of date or invalid.");
        }
        return data;
      })(),
    ]);
  } finally {
    clearTimeout(timer!);
    signal.removeEventListener("abort", abort);
  }
}
