import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  randomUUID,
} from "crypto";

import {
  getGoogleAccessToken,
} from "@/lib/google-calendar-server";

import {
  getPairedDisplay,
  getDisplayServerSupabase,
} from "@/lib/display-auth-server";

export const dynamic =
  "force-dynamic";

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

type GoogleColorEntry = {
  background?: string;
  foreground?: string;
};

type GoogleColorsResponse = {
  event?: Record<
    string,
    GoogleColorEntry
  >;
};

type GoogleEventsResponse = {
  items?: GoogleEvent[];

  error?: {
    message?: string;
  };
};

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

function getLocalDateKey(
  dateTime: string,
  timeZone: string
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    );

  const parts =
    formatter.formatToParts(
      new Date(dateTime)
    );

  const values: Record<
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

export async function GET(
  request: NextRequest
) {
  try {
    /*
      =====================================================
      VERIFY THAT THIS BROWSER IS A PAIRED DISPLAY
      =====================================================
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

    /*
      =====================================================
      VALIDATE REQUESTED YEAR / MONTH
      =====================================================
    */

    const year =
      Number(
        request.nextUrl
          .searchParams
          .get("year")
      );

    const month =
      Number(
        request.nextUrl
          .searchParams
          .get("month")
      );

    if (
      !Number.isInteger(
        year
      ) ||
      !Number.isInteger(
        month
      ) ||
      month < 1 ||
      month > 12
    ) {
      return NextResponse.json(
        {
          error:
            "A valid year and month are required.",
        },
        {
          status: 400,
        }
      );
    }

    /*
      =====================================================
      USE THE PAIRED DISPLAY'S HOUSEHOLD
      =====================================================
    */

    const householdId =
      display.household_id;

    const timeZone =
      display.timezone ??
      "America/Los_Angeles";

    const supabase =
      getDisplayServerSupabase();

    /*
      =====================================================
      LOAD ONLY ENABLED GOOGLE CALENDARS FOR THIS HOUSEHOLD
      =====================================================
    */

    const {
      data: sources,
      error: sourceError,
    } =
      await supabase
        .from(
          "calendar_sources"
        )
        .select(
          `
          id,
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
            ascending: true,
          }
        );

    if (sourceError) {
      throw new Error(
        `Calendar source query failed: ${sourceError.message}`
      );
    }

    /*
      No calendars selected is valid.
    */

    if (
      !sources ||
      sources.length === 0
    ) {
      return NextResponse.json(
        {
          calendars: [],
          events: [],
        },
        {
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    /*
      =====================================================
      GOOGLE ACCESS TOKEN
      =====================================================
    */

    const accessToken =
      await getGoogleAccessToken(
        householdId
      );

    /*
      =====================================================
      GOOGLE EVENT COLOR PALETTE
      =====================================================
    */

    const colorsResponse =
      await fetch(
        "https://www.googleapis.com/calendar/v3/colors",
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },

          cache:
            "no-store",
        }
      );

    const colorsData =
      (await colorsResponse.json()) as
        GoogleColorsResponse;

    if (
      !colorsResponse.ok
    ) {
      throw new Error(
        "Unable to retrieve Google Calendar colors."
      );
    }

    const googleEventColors =
      colorsData.event ??
      {};

    /*
      =====================================================
      MONTH DATE RANGE

      We include one extra day on either side to avoid
      timezone edge cases near midnight.
      =====================================================
    */

    const timeMin =
      new Date(
        Date.UTC(
          year,
          month - 1,
          1
        ) -
          24 *
            60 *
            60 *
            1000
      ).toISOString();

    const timeMax =
      new Date(
        Date.UTC(
          year,
          month,
          1
        ) +
          24 *
            60 *
            60 *
            1000
      ).toISOString();

    const targetMonthPrefix =
      `${year}-${pad(
        month
      )}-`;

    /*
      =====================================================
      OUTPUT EVENT TYPE
      =====================================================
    */

    const outputEvents: Array<{
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
    }> = [];

    /*
      =====================================================
      FETCH EVENTS FROM EACH SELECTED CALENDAR
      =====================================================
    */

    for (
      const source of sources
    ) {
      const calendarId =
        source.provider_calendar_id;

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

      const eventResponse =
        await fetch(
          url.toString(),
          {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },

            cache:
              "no-store",
          }
        );

      const eventData =
        (await eventResponse.json()) as
          GoogleEventsResponse;

      if (
        !eventResponse.ok
      ) {
        throw new Error(
          eventData
            ?.error
            ?.message ??
            `Unable to load ${source.display_name}.`
        );
      }

      const googleEvents =
        eventData.items ??
        [];

      /*
        ===================================================
        PROCESS EACH GOOGLE EVENT
        ===================================================
      */

      for (
        const event of googleEvents
      ) {
        const eventId =
          event.id ??
          randomUUID();

        const title =
          event.summary ??
          "(No title)";

        /*
          -------------------------------------------------
          COLOR PRIORITY

          1. Google event-specific color
          2. Parent Google calendar color
          -------------------------------------------------
        */

        const eventColor =
          event.colorId
            ? googleEventColors[
                event.colorId
              ]
            : undefined;

        const resolvedColor =
          eventColor?.background ??
          calendarColor;

        const resolvedTextColor =
          eventColor?.foreground ??
          "#ffffff";

        const usesEventColor =
          Boolean(
            event.colorId &&
              eventColor
                ?.background
          );

        /*
          =================================================
          ALL-DAY EVENT
          =================================================

          Google uses an exclusive end date.

          Example:

          start.date = September 10
          end.date   = September 12

          Event occupies:
          September 10
          September 11
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
            safety < 366
          ) {
            if (
              currentDate.startsWith(
                targetMonthPrefix
              )
            ) {
              outputEvents.push(
                {
                  id:
                    `${eventId}-${currentDate}`,

                  calendarId,

                  calendarName:
                    source.display_name,

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
                }
              );
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
          =================================================
          TIMED EVENT
          =================================================
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

          /*
            Ignore events that fall outside the requested
            month after timezone conversion.
          */

          if (
            !dateKey.startsWith(
              targetMonthPrefix
            )
          ) {
            continue;
          }

          outputEvents.push(
            {
              id:
                eventId,

              calendarId,

              calendarName:
                source.display_name,

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
            }
          );
        }
      }
    }

    /*
      =====================================================
      SORT EVENTS

      Date first
      All-day before timed
      Then timed events by start time
      =====================================================
    */

    outputEvents.sort(
      (
        first,
        second
      ) => {
        if (
          first.date !==
          second.date
        ) {
          return first.date.localeCompare(
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

    /*
      =====================================================
      RESPONSE
      =====================================================
    */

    return NextResponse.json(
      {
        calendars:
          sources.map(
            (source) => ({
              id:
                source.provider_calendar_id,

              name:
                source.display_name,

              color:
                source.color ??
                "#169FE8",
            })
          ),

        events:
          outputEvents,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error(
      "Calendar events API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
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