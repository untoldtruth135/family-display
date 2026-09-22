import {
  createClient,
} from "npm:@supabase/supabase-js@2";


type OAuthRow = {
  household_id: string;

  access_token:
    | string
    | null;

  refresh_token:
    | string
    | null;

  expires_at:
    | string
    | null;
};


type CalendarSource = {
  provider_calendar_id: string;
  display_name: string;
  color:
    | string
    | null;
  sort_order:
    | number
    | null;
};


type GoogleEvent = {
  id?: string;
  summary?: string;
  colorId?: string;

  start?: {
    date?: string;
    dateTime?: string;
  };

  end?: {
    date?: string;
    dateTime?: string;
  };
};


type GoogleColor = {
  background?: string;
  foreground?: string;
};


type OutputEvent = {
  id: string;

  calendarId: string;
  calendarName: string;

  title: string;

  date: string;

  start:
    | string
    | null;

  end:
    | string
    | null;

  allDay: boolean;

  color: string;
  textColor: string;

  eventColorId:
    | string
    | null;

  usesEventColor: boolean;
};


const SUPABASE_URL =
  Deno.env.get(
    "SUPABASE_URL"
  );


const SERVICE_ROLE_KEY =
  Deno.env.get(
    "SUPABASE_SERVICE_ROLE_KEY"
  );


const GOOGLE_CLIENT_ID =
  Deno.env.get(
    "GOOGLE_CLIENT_ID"
  );


const GOOGLE_CLIENT_SECRET =
  Deno.env.get(
    "GOOGLE_CLIENT_SECRET"
  );


const CALENDAR_CRON_SECRET =
  Deno.env.get(
    "CALENDAR_CRON_SECRET"
  );


if (
  !SUPABASE_URL ||
  !SERVICE_ROLE_KEY
) {
  throw new Error(
    "Supabase server credentials are not configured."
  );
}


if (
  !GOOGLE_CLIENT_ID ||
  !GOOGLE_CLIENT_SECRET
) {
  throw new Error(
    "Google OAuth credentials are not configured."
  );
}


if (
  !CALENDAR_CRON_SECRET
) {
  throw new Error(
    "CALENDAR_CRON_SECRET is not configured."
  );
}


const supabase =
  createClient(
    SUPABASE_URL,
    SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession:
          false,

        autoRefreshToken:
          false,
      },
    }
  );


function pad(
  value: number
) {
  return String(
    value
  ).padStart(
    2,
    "0"
  );
}


function addDays(
  dateKey: string,
  amount: number
) {
  const [
    year,
    month,
    day,
  ] =
    dateKey
      .split("-")
      .map(Number);


  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day + amount
      )
    );


  return [
    date.getUTCFullYear(),

    pad(
      date.getUTCMonth() +
        1
    ),

    pad(
      date.getUTCDate()
    ),
  ].join("-");
}


function getCurrentYearMonth(
  timeZone: string
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone,

        year:
          "numeric",

        month:
          "2-digit",
      }
    );


  const parts =
    formatter.formatToParts(
      new Date()
    );


  let year =
    0;

  let month =
    0;


  for (
    const part of parts
  ) {
    if (
      part.type ===
      "year"
    ) {
      year =
        Number(
          part.value
        );
    }


    if (
      part.type ===
      "month"
    ) {
      month =
        Number(
          part.value
        );
    }
  }


  return {
    year,
    month,
  };
}


function getLocalDateKey(
  dateTime: string,
  timeZone: string
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone,

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      }
    );


  const parts =
    formatter.formatToParts(
      new Date(
        dateTime
      )
    );


  const values:
    Record<
      string,
      string
    > = {};


  for (
    const part of parts
  ) {
    if (
      part.type !==
      "literal"
    ) {
      values[
        part.type
      ] =
        part.value;
    }
  }


  return `${values.year}-${values.month}-${values.day}`;
}


async function sha256Hex(
  value: string
) {
  const bytes =
    new TextEncoder()
      .encode(
        value
      );


  const digest =
    await crypto.subtle
      .digest(
        "SHA-256",
        bytes
      );


  return Array
    .from(
      new Uint8Array(
        digest
      )
    )
    .map(
      (
        byte
      ) =>
        byte
          .toString(16)
          .padStart(
            2,
            "0"
          )
    )
    .join("");
}


async function getGoogleAccessToken(
  row: OAuthRow
) {
  const expiresAt =
    row.expires_at
      ? new Date(
          row.expires_at
        ).getTime()
      : 0;


  if (
    row.access_token &&
    expiresAt >
      Date.now() +
        60_000
  ) {
    return row.access_token;
  }


  if (
    !row.refresh_token
  ) {
    throw new Error(
      `Household ${row.household_id} has no Google refresh token.`
    );
  }


  const form =
    new URLSearchParams({
      client_id:
        GOOGLE_CLIENT_ID!,

      client_secret:
        GOOGLE_CLIENT_SECRET!,

      refresh_token:
        row.refresh_token,

      grant_type:
        "refresh_token",
    });


  const response =
    await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          form.toString(),
      }
    );


  const data =
    await response.json();


  if (
    !response.ok ||
    !data?.access_token
  ) {
    throw new Error(
      data?.error_description ??
      data?.error ??
      "Unable to refresh Google access token."
    );
  }


  const newExpiresAt =
    new Date(
      Date.now() +
        Number(
          data.expires_in ??
          3600
        ) *
          1000
    ).toISOString();


  const {
    error:
      updateError,
  } =
    await supabase
      .from(
        "google_oauth_tokens"
      )
      .update({
        access_token:
          data.access_token,

        expires_at:
          newExpiresAt,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "household_id",
        row.household_id
      );


  if (updateError) {
    throw new Error(
      `Unable to save refreshed Google token: ${updateError.message}`
    );
  }


  return data.access_token as
    string;
}


async function loadGoogleColors(
  accessToken: string
) {
  try {
    const response =
      await fetch(
        "https://www.googleapis.com/calendar/v3/colors",
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
        }
      );


    if (!response.ok) {
      return {} as
        Record<
          string,
          GoogleColor
        >;
    }


    const data =
      await response.json();


    return (
      data?.event ??
      {}
    ) as Record<
      string,
      GoogleColor
    >;
  } catch {
    return {} as
      Record<
        string,
        GoogleColor
      >;
  }
}


async function loadOneCalendar(
  source:
    CalendarSource,
  accessToken: string,
  eventColors:
    Record<
      string,
      GoogleColor
    >,
  timeZone: string,
  timeMin: string,
  timeMax: string,
  targetStartDate: string,
  targetEndExclusive: string
) {
  const calendarId =
    source
      .provider_calendar_id;


  const calendarColor =
    source.color ??
    "#169FE8";


  const url =
    new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId
      )}/events`
    );


  url.searchParams.set(
    "singleEvents",
    "true"
  );

  url.searchParams.set(
    "orderBy",
    "startTime"
  );

  url.searchParams.set(
    "showDeleted",
    "false"
  );

  url.searchParams.set(
    "maxResults",
    "2500"
  );

  url.searchParams.set(
    "timeMin",
    timeMin
  );

  url.searchParams.set(
    "timeMax",
    timeMax
  );

  url.searchParams.set(
    "timeZone",
    timeZone
  );


  const response =
    await fetch(
      url.toString(),
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
      }
    );


  const data =
    await response.json();


  if (!response.ok) {
    throw new Error(
      data
        ?.error
        ?.message ??
      `Unable to load ${source.display_name}.`
    );
  }


  const googleEvents =
    (
      data?.items ??
      []
    ) as GoogleEvent[];


  const output:
    OutputEvent[] =
    [];


  for (
    const event
    of googleEvents
  ) {
    const eventId =
      event.id ??
      crypto.randomUUID();


    const title =
      event.summary ??
      "(No title)";


    const eventColor =
      event.colorId
        ? eventColors[
            event.colorId
          ]
        : undefined;


    const resolvedColor =
      eventColor
        ?.background ??
      calendarColor;


    const resolvedTextColor =
      eventColor
        ?.foreground ??
      "#ffffff";


    const usesEventColor =
      Boolean(
        event.colorId &&
        eventColor
          ?.background
      );


    /*
      ALL-DAY EVENT
    */

    if (
      event.start?.date
    ) {
      const startDate =
        event.start.date;


      const exclusiveEnd =
        event.end?.date ??
        addDays(
          startDate,
          1
        );


      let currentDate =
        startDate;


      let safety =
        0;


      while (
        currentDate <
          exclusiveEnd &&
        safety <
          366
      ) {
        if (
          currentDate >=
            targetStartDate &&
          currentDate <
            targetEndExclusive
        ) {
          output.push({
            id:
              `${eventId}-${currentDate}`,

            calendarId,

            calendarName:
              source
                .display_name,

            title,

            date:
              currentDate,

            start:
              null,

            end:
              null,

            allDay:
              true,

            color:
              resolvedColor,

            textColor:
              resolvedTextColor,

            eventColorId:
              event.colorId ??
              null,

            usesEventColor,
          });
        }


        currentDate =
          addDays(
            currentDate,
            1
          );


        safety++;
      }


      continue;
    }


    /*
      TIMED EVENT
    */

    if (
      event.start
        ?.dateTime
    ) {
      const dateKey =
        getLocalDateKey(
          event.start
            .dateTime,
          timeZone
        );


      if (
        dateKey <
          targetStartDate ||
        dateKey >=
          targetEndExclusive
      ) {
        continue;
      }


      output.push({
        id:
          eventId,

        calendarId,

        calendarName:
          source
            .display_name,

        title,

        date:
          dateKey,

        start:
          event.start
            .dateTime,

        end:
          event.end
            ?.dateTime ??
          null,

        allDay:
          false,

        color:
          resolvedColor,

        textColor:
          resolvedTextColor,

        eventColorId:
          event.colorId ??
          null,

        usesEventColor,
      });
    }
  }


  return output;
}


async function syncHousehold(
  tokenRow:
    OAuthRow
) {
  const householdId =
    tokenRow.household_id;


  /*
    Use an enabled display's
    timezone for this household.
  */

  const {
    data:
      display,
    error:
      displayError,
  } =
    await supabase
      .from(
        "displays"
      )
      .select(
        "timezone"
      )
      .eq(
        "household_id",
        householdId
      )
      .eq(
        "enabled",
        true
      )
      .limit(1)
      .maybeSingle();


  if (displayError) {
    throw new Error(
      `Display lookup failed: ${displayError.message}`
    );
  }


  const timeZone =
    display
      ?.timezone ??
    "America/Los_Angeles";


  const {
    year,
    month,
  } =
    getCurrentYearMonth(
      timeZone
    );


  if (
    !year ||
    !month
  ) {
    throw new Error(
      "Unable to determine household month."
    );
  }


  const {
    data:
      sourceRows,
    error:
      sourceError,
  } =
    await supabase
      .from(
        "calendar_sources"
      )
      .select(
        `
        provider_calendar_id,
        display_name,
        color,
        sort_order
        `
      )
      .eq(
        "household_id",
        householdId
      )
      .eq(
        "provider",
        "google"
      )
      .eq(
        "enabled",
        true
      )
      .order(
        "sort_order",
        {
          ascending:
            true,
        }
      );


  if (sourceError) {
    throw new Error(
      `Calendar source lookup failed: ${sourceError.message}`
    );
  }


  const sources =
    (
      sourceRows ??
      []
    ) as CalendarSource[];


  let events:
    OutputEvent[] =
    [];


  let targetStartDate = "";
  let targetEndExclusive = "";

  if (
    sources.length >
    0
  ) {
    const accessToken =
      await getGoogleAccessToken(
        tokenRow
      );


    const eventColors =
      await loadGoogleColors(
        accessToken
      );


    /*
      EIGHT-WEEK SYNC HORIZON

      Row 1 = previous week
      Row 2 = current week
      Syncs six additional weeks beyond the current week

      Dates are calculated in the household
      display timezone, then converted into
      UTC-safe date keys for Google filtering.
    */

    const todayDateKey =
      getLocalDateKey(
        new Date()
          .toISOString(),
        timeZone
      );


    const [
      todayYear,
      todayMonth,
      todayDay,
    ] =
      todayDateKey
        .split("-")
        .map(Number);


    const todayUtc =
      new Date(
        Date.UTC(
          todayYear,
          todayMonth - 1,
          todayDay
        )
      );


    /*
      Sunday beginning the current week.
    */

    const currentWeekStart =
      new Date(
        todayUtc
      );

    currentWeekStart.setUTCDate(
      currentWeekStart.getUTCDate() -
        currentWeekStart.getUTCDay()
    );


    /*
      One full week before the current week.
    */

    const gridStart =
      new Date(
        currentWeekStart
      );

    gridStart.setUTCDate(
      gridStart.getUTCDate() -
        7
    );


    /*
      Eight complete weeks = 56 calendar days.
    */

    const gridEndExclusive =
      new Date(
        gridStart
      );

    gridEndExclusive.setUTCDate(
      gridEndExclusive.getUTCDate() +
        56
    );


    targetStartDate =
      [
        gridStart
          .getUTCFullYear(),

        pad(
          gridStart
            .getUTCMonth() +
            1
        ),

        pad(
          gridStart
            .getUTCDate()
        ),
      ].join("-");


    targetEndExclusive =
      [
        gridEndExclusive
          .getUTCFullYear(),

        pad(
          gridEndExclusive
            .getUTCMonth() +
            1
        ),

        pad(
          gridEndExclusive
            .getUTCDate()
        ),
      ].join("-");


    /*
      Ask Google for one extra day on either side
      to protect against timezone-boundary events.

      loadOneCalendar still filters the final
      results to the exact 56-day sync range.
    */

    const timeMin =
      new Date(
        gridStart.getTime() -
          24 *
            60 *
            60 *
            1000
      ).toISOString();


    const timeMax =
      new Date(
        gridEndExclusive.getTime() +
          24 *
            60 *
            60 *
            1000
      ).toISOString();


    const groups =
      await Promise.all(
        sources.map(
          (
            source
          ) =>
            loadOneCalendar(
              source,
              accessToken,
              eventColors,
              timeZone,
              timeMin,
              timeMax,
              targetStartDate,
              targetEndExclusive
            )
        )
      );


    events =
      groups.flat();


    events.sort(
      (
        first,
        second
      ) => {
        if (
          first.date !==
          second.date
        ) {
          return first.date
            .localeCompare(
              second.date
            );
        }


        if (
          first.allDay !==
          second.allDay
        ) {
          return first.allDay
            ? -1
            : 1;
        }


        return (
          first.start ??
          ""
        ).localeCompare(
          second.start ??
          ""
        );
      }
    );
  }


  const payload = {
    rangeStart:
      targetStartDate,

    rangeEndExclusive:
      targetEndExclusive,

    calendars:
      sources.map(
        (
          source
        ) => ({
          id:
            source
              .provider_calendar_id,

          name:
            source
              .display_name,

          color:
            source.color ??
            "#169FE8",
        })
      ),

    events,
  };


  const contentHash =
    await sha256Hex(
      JSON.stringify(
        payload
      )
    );


  const {
    data:
      oldCache,
    error:
      oldCacheError,
  } =
    await supabase
      .from(
        "calendar_cache"
      )
      .select(
        "content_hash"
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


  if (oldCacheError) {
    throw new Error(
      `Calendar cache lookup failed: ${oldCacheError.message}`
    );
  }


  const changed =
    oldCache
      ?.content_hash !==
    contentHash;


  const now =
    new Date()
      .toISOString();


  const {
    error:
      cacheError,
  } =
    await supabase
      .from(
        "calendar_cache"
      )
      .upsert(
        {
          household_id:
            householdId,

          year,

          month,

          payload,

          content_hash:
            contentHash,

          synced_at:
            now,

          sync_started_at:
            null,

          sync_error:
            null,

          updated_at:
            now,
        },
        {
          onConflict:
            "household_id,year,month",
        }
      );


  if (cacheError) {
    throw new Error(
      `Calendar cache update failed: ${cacheError.message}`
    );
  }


  return {
    householdId,
    year,
    month,
    changed,
    events:
      events.length,
  };
}


Deno.serve(
  async (
    request
  ) => {
    if (
      request.method !==
      "POST"
    ) {
      return Response.json(
        {
          error:
            "Method not allowed.",
        },
        {
          status: 405,
        }
      );
    }


    const suppliedSecret =
      request.headers.get(
        "x-cron-secret"
      );


    if (
      suppliedSecret !==
      CALENDAR_CRON_SECRET
    ) {
      return Response.json(
        {
          error:
            "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }


    const {
      data:
        tokenRows,
      error:
        tokenError,
    } =
      await supabase
        .from(
          "google_oauth_tokens"
        )
        .select(
          `
          household_id,
          access_token,
          refresh_token,
          expires_at
          `
        );


    if (tokenError) {
      return Response.json(
        {
          error:
            tokenError.message,
        },
        {
          status: 500,
        }
      );
    }


    const results:
      Array<Record<
        string,
        unknown
      >> =
      [];


    for (
      const row
      of (
        tokenRows ??
        []
      ) as OAuthRow[]
    ) {
      try {
        const result =
          await syncHousehold(
            row
          );


        results.push({
          ok:
            true,

          ...result,
        });
      } catch (
        error
      ) {
        const message =
          error instanceof
            Error
            ? error.message
            : "Unknown synchronization error.";


        console.error(
          "Calendar household sync failed:",
          message
        );


        results.push({
          ok:
            false,

          householdId:
            row.household_id,

          error:
            message,
        });
      }
    }


    return Response.json({
      ok:
        true,

      processed:
        results.length,

      results,
    });
  }
);