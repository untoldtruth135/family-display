import type { SupabaseClient } from "@supabase/supabase-js";

export type CalendarCacheRow = {
  payload: {
    calendars: unknown[];
    events: unknown[];
    rangeStart?: string;
    rangeEndExclusive?: string;
  } | null;
  content_hash: string | null;
  synced_at: string | null;
  sync_error: string | null;
};

const CACHE_COLUMNS = "payload, content_hash, synced_at, sync_error";

export function getDisplayCalendarRange(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const year = value("year");
  const month = value("month");
  const start = new Date(Date.UTC(year, month - 1, value("day")));

  // Match the dashboard: previous Sunday through four complete weeks.
  start.setUTCDate(start.getUTCDate() - start.getUTCDay() - 7);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 28);

  return {
    year,
    month,
    rangeStart: start.toISOString().slice(0, 10),
    rangeEndExclusive: end.toISOString().slice(0, 10),
  };
}

export async function loadCalendarCache(
  supabase: SupabaseClient,
  householdId: string,
  year: number,
  month: number,
  timeZone: string,
  now = new Date()
): Promise<CalendarCacheRow | null> {
  const { data, error } = await supabase
    .from("calendar_cache")
    .select(CACHE_COLUMNS)
    .eq("household_id", householdId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (error) {
    throw new Error(`Calendar cache query failed: ${error.message}`);
  }

  // Keep the authoritative month's row, including intentionally empty caches
  // when all calendars are disabled and legacy payloads without range metadata.
  if (data) return data as CalendarCacheRow;

  const range = getDisplayCalendarRange(now, timeZone);

  // The dashboard requests its current local month. Do not substitute today's
  // calendar for an explicit request for a different month.
  if (year !== range.year || month !== range.month) return null;

  const { data: fallback, error: fallbackError } = await supabase
    .from("calendar_cache")
    .select(CACHE_COLUMNS)
    .eq("household_id", householdId)
    .lte("payload->>rangeStart", range.rangeStart)
    .gte("payload->>rangeEndExclusive", range.rangeEndExclusive)
    .order("synced_at", { ascending: false, nullsFirst: false })
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fallbackError) {
    throw new Error(`Calendar cache fallback query failed: ${fallbackError.message}`);
  }

  // Missing/empty range metadata must never qualify as proven coverage.
  const payload = fallback?.payload;
  if (
    !payload?.rangeStart ||
    !payload?.rangeEndExclusive ||
    payload.rangeStart > range.rangeStart ||
    payload.rangeEndExclusive < range.rangeEndExclusive
  ) {
    return null;
  }

  return fallback as CalendarCacheRow;
}

export type CalendarCacheVersion = {
  content_hash: string | null;
  synced_at: string | null;
  sync_error: string | null;
  range_start?: string | null;
  range_end?: string | null;
};

// Project only metadata. A 304 after reading "payload" would still cost Supabase egress.
export async function loadCalendarVersion(
  supabase: SupabaseClient,
  householdId: string,
  year: number,
  month: number,
  timeZone: string,
  now = new Date()
): Promise<CalendarCacheVersion | null> {
  const columns = "content_hash,synced_at,sync_error,range_start:payload->>rangeStart,range_end:payload->>rangeEndExclusive";
  const { data, error } = await supabase.from("calendar_cache").select(columns)
    .eq("household_id", householdId).eq("year", year).eq("month", month).maybeSingle();
  if (error) throw new Error(`Calendar version query failed: ${error.message}`);
  if (data) return data as CalendarCacheVersion;
  const range = getDisplayCalendarRange(now, timeZone);
  if (year !== range.year || month !== range.month) return null;
  const { data: fallback, error: fallbackError } = await supabase.from("calendar_cache")
    .select(columns).eq("household_id", householdId)
    .lte("payload->>rangeStart", range.rangeStart)
    .gte("payload->>rangeEndExclusive", range.rangeEndExclusive)
    .order("synced_at", { ascending: false, nullsFirst: false })
    .order("year", { ascending: false }).order("month", { ascending: false })
    .limit(1).maybeSingle();
  if (fallbackError) throw new Error(`Calendar version fallback query failed: ${fallbackError.message}`);
  if (!fallback?.range_start || !fallback?.range_end ||
      fallback.range_start > range.rangeStart || fallback.range_end < range.rangeEndExclusive) return null;
  return fallback as CalendarCacheVersion;
}

export function calendarEtagMatches(header: string | null, hash: string | null) {
  if (!header || !hash) return false;
  // GET permits weak comparison, but "*" would let a client with no saved data skip the body.
  return header.split(",").some(value => value.trim().replace(/^W\//, "") === `"${hash}"`);
}

