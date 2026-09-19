import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getPairedDisplay,
  getDisplayServerSupabase,
} from "@/lib/display-auth-server";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

/*
  This value is informational only.

  Supabase Cron now owns Google Calendar
  synchronization.

  This API NEVER contacts Google.

  If the cache becomes old, we continue
  returning the last successful calendar
  data so the family display keeps working.
*/

const CACHE_STALE_MS =
  5 *
  60 *
  1000;

type CalendarPayload = {
  calendars: unknown[];
  events: unknown[];
};

type CalendarCacheRow = {
  payload:
    | CalendarPayload
    | null;

  content_hash:
    | string
    | null;

  synced_at:
    | string
    | null;

  sync_error:
    | string
    | null;
};

function cacheIsStale(
  syncedAt:
    | string
    | null
) {
  if (!syncedAt) {
    return true;
  }

  const syncedTime =
    new Date(
      syncedAt
    ).getTime();

  if (
    !Number.isFinite(
      syncedTime
    )
  ) {
    return true;
  }

  return (
    Date.now() -
      syncedTime >
    CACHE_STALE_MS
  );
}

function calendarResponse(
  cache:
    CalendarCacheRow
) {
  const payload =
    cache.payload ?? {
      calendars: [],
      events: [],
    };

  const stale =
    cacheIsStale(
      cache.synced_at
    );

  return NextResponse.json(
    payload,
    {
      headers: {
        "Cache-Control":
          "private, no-store",

        "X-Calendar-Cache":
          stale
            ? "stale"
            : "fresh",

        "X-Calendar-Synced-At":
          cache.synced_at ??
          "",

        "X-Calendar-Sync-Error":
          cache.sync_error
            ? "true"
            : "false",

        ...(cache.content_hash
          ? {
              ETag:
                `"${cache.content_hash}"`,
            }
          : {}),
      },
    }
  );
}

export async function GET(
  request: NextRequest
) {
  try {
    /*
      The real calendar contents remain
      protected by our paired-display cookie.

      Supabase Realtime only tells the browser
      that something changed.
    */

    const display =
      await getPairedDisplay(
        request
      );

    if (!display) {
      return NextResponse.json(
        {
          error:
            "Display is not paired.",
        },
        {
          status: 401,

          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    const year =
      Number(
        request.nextUrl
          .searchParams
          .get(
            "year"
          )
      );

    const month =
      Number(
        request.nextUrl
          .searchParams
          .get(
            "month"
          )
      );

    if (
      !Number.isInteger(
        year
      ) ||
      !Number.isInteger(
        month
      ) ||
      year <
        2000 ||
      month <
        1 ||
      month >
        12
    ) {
      return NextResponse.json(
        {
          error:
            "A valid year and month are required.",
        },
        {
          status: 400,

          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    const householdId =
      display.household_id;

    const supabase =
      getDisplayServerSupabase();

    /*
      CACHE ONLY.

      There is intentionally no Google API
      call anywhere in this route.

      Google synchronization is handled by:

      Supabase Cron
          ->
      calendar-sync Edge Function
          ->
      Google Calendar
          ->
      calendar_cache
    */

    const {
      data,
      error,
    } =
      await supabase
        .from(
          "calendar_cache"
        )
        .select(
          `
          payload,
          content_hash,
          synced_at,
          sync_error
          `
        )
        .eq(
          "household_id",
          householdId
        )
        .eq(
          "year",
          year
        )
        .eq(
          "month",
          month
        )
        .maybeSingle();

    if (error) {
      throw new Error(
        `Calendar cache query failed: ${error.message}`
      );
    }

    /*
      This can occur briefly at the beginning
      of a new month before the next Supabase
      Cron synchronization has created the
      new month's cache row.

      We do NOT fall back to Google here.
    */

    if (!data) {
      return NextResponse.json(
        {
          error:
            "Calendar cache is not available yet.",
        },
        {
          status: 503,

          headers: {
            "Cache-Control":
              "no-store",

            "Retry-After":
              "60",

            "X-Calendar-Cache":
              "missing",
          },
        }
      );
    }

    return calendarResponse(
      data as CalendarCacheRow
    );
  } catch (
    error
  ) {
    console.error(
      "Calendar events API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof
            Error
            ? error.message
            : "Unable to load calendar events.",
      },
      {
        status: 500,

        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }
}
