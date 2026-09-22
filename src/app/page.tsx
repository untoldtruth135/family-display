"use client";
import { createClient } from "@supabase/supabase-js";

import type {
  CSSProperties,
} from "react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import WeatherPanels from "@/components/WeatherPanels";
import RotatingBackground from "@/components/RotatingBackground";
import AutoScrollEvents from "@/components/AutoScrollEvents";
import AutoScrollText from "@/components/AutoScrollText";

/* =========================================================
   TYPES
   ========================================================= */

type ScheduleAction =
  | "active"
  | "dim"
  | "sleep";

type DisplaySchedule = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  action: ScheduleAction;
  enabled: boolean;
};

type CalendarEvent = {
  id: string;

  calendarId: string;
  calendarName: string;

  title: string;

  date: string;

  start: string | null;
  end: string | null;

  allDay: boolean;

  color: string;
  textColor: string;

  eventColorId:
    | string
    | null;

  usesEventColor: boolean;
};

type CalendarSource = {
  id: string;
  name: string;
  color: string;
};

type ScheduledMessage = {
  id: string;
  message: string;
  startsAt: string;

  endsAt:
    | string
    | null;

  priority: number;
};


type DisplayConfig = {
  household: {
    id: string;
    name: string;
  };

  display: {
    id: string;
    name: string;

    weatherLocation: string;

    message: string;

    messageExpiresAt:
      | string
      | null;

    scheduledMessages?:
      ScheduledMessage[];

    orientation:
      | "landscape"
      | "portrait"
      | "auto";

    timezone: string;

    use24HourClock: boolean;

    theme:
      | "light"
      | "dark"
      | "photo";

    fontFamily: string;

    accentColor: string;

    cardOpacity: number;

    showClock: boolean;

    showWeather: boolean;

    showForecast: boolean;

    showCalendar: boolean;

    showMessage: boolean;

    backgroundEnabled: boolean;

    backgroundIntervalSeconds: number;

    backgroundShuffle: boolean;

    backgroundFit:
      | "cover"
      | "contain";

    backgroundOverlayOpacity: number;

    touchControlsEnabled: boolean;

    schedules:
      DisplaySchedule[];
  };
};

/* =========================================================
   WEEKDAY MAP
   ========================================================= */

const WEEKDAY_MAP:
  Record<
    string,
    number
  > = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

/* =========================================================
   HELPERS
   ========================================================= */

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

function getGreeting(
  hour: number
) {
  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 17) {
    return "Good afternoon";
  }

  return "Good evening";
}

function getTimeZoneParts(
  date: Date,
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
          "numeric",

        day:
          "numeric",

        weekday:
          "short",

        hour:
          "2-digit",

        minute:
          "2-digit",

        hourCycle:
          "h23",
      }
    );

  const parts =
    formatter.formatToParts(
      date
    );

  const result:
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
      result[
        part.type
      ] =
        part.value;
    }
  }

  return {
    year:
      Number(
        result.year
      ),

    month:
      Number(
        result.month
      ),

    day:
      Number(
        result.day
      ),

    weekday:
      WEEKDAY_MAP[
        result.weekday
      ] ?? 0,

    hour:
      Number(
        result.hour
      ),

    minute:
      Number(
        result.minute
      ),
  };
}

function timeToMinutes(
  value: string
) {
  const [
    hourString,
    minuteString,
  ] =
    value
      .slice(
        0,
        5
      )
      .split(":");

  return (
    Number(
      hourString
    ) *
      60 +
    Number(
      minuteString
    )
  );
}

function getScheduleMode(
  schedules:
    DisplaySchedule[],
  currentDay:
    number,
  currentMinutes:
    number
): ScheduleAction {
  const matchingActions:
    ScheduleAction[] =
    [];

  for (
    const schedule
    of schedules
  ) {
    if (
      !schedule.enabled
    ) {
      continue;
    }

    const start =
      timeToMinutes(
        schedule.startTime
      );

    const end =
      timeToMinutes(
        schedule.endTime
      );

    const scheduleDay =
      schedule.dayOfWeek;

    let matches =
      false;

    /*
      Normal same-day schedule.
    */

    if (
      start < end
    ) {
      matches =
        currentDay ===
          scheduleDay &&
        currentMinutes >=
          start &&
        currentMinutes <
          end;
    }

    /*
      Overnight schedule.

      Example:
      Monday 22:00 -> Tuesday 06:00
    */

    else if (
      start > end
    ) {
      const nextDay =
        (
          scheduleDay +
          1
        ) %
        7;

      matches =
        (
          currentDay ===
            scheduleDay &&
          currentMinutes >=
            start
        ) ||
        (
          currentDay ===
            nextDay &&
          currentMinutes <
            end
        );
    }

    /*
      Same start/end means
      all day.
    */

    else {
      matches =
        currentDay ===
        scheduleDay;
    }

    if (matches) {
      matchingActions.push(
        schedule.action
      );
    }
  }

  /*
    Most restrictive mode wins.
  */

  if (
    matchingActions.includes(
      "sleep"
    )
  ) {
    return "sleep";
  }

  if (
    matchingActions.includes(
      "dim"
    )
  ) {
    return "dim";
  }

  return "active";
}

function formatEventTime(
  isoDate: string,
  timezone: string,
  use24HourClock: boolean
) {
  return new Date(
    isoDate
  ).toLocaleTimeString(
    "en-US",
    {
      timeZone:
        timezone,

      hour:
        use24HourClock
          ? "2-digit"
          : "numeric",

      minute:
        "2-digit",

      hourCycle:
        use24HourClock
          ? "h23"
          : "h12",
    }
  );
}

function getContrastText(
  color: string
) {
  const hex =
    color
      .replace(
        "#",
        ""
      )
      .trim();

  if (
    hex.length !==
    6
  ) {
    return "#ffffff";
  }

  const red =
    Number.parseInt(
      hex.slice(
        0,
        2
      ),
      16
    );

  const green =
    Number.parseInt(
      hex.slice(
        2,
        4
      ),
      16
    );

  const blue =
    Number.parseInt(
      hex.slice(
        4,
        6
      ),
      16
    );

  if (
    Number.isNaN(
      red
    ) ||
    Number.isNaN(
      green
    ) ||
    Number.isNaN(
      blue
    )
  ) {
    return "#ffffff";
  }

  const luminance =
    (
      red *
        299 +
      green *
        587 +
      blue *
        114
    ) /
    1000;

  return luminance >
    155
    ? "#20252a"
    : "#ffffff";
}

/* =========================================================
   PAGE
   ========================================================= */

const familyDisplayRealtimeSupabase =
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );

export default function Home() {
  /*
    ---------------------------------------------------------
    HYDRATION-SAFE CLOCK
    ---------------------------------------------------------
  */

  const [
    now,
    setNow,
  ] =
    useState<Date>(
      () =>
        new Date(0)
    );

  const [
    mounted,
    setMounted,
  ] =
    useState(false);

  /*
    ---------------------------------------------------------
    DISPLAY CONFIG
    ---------------------------------------------------------
  */

  const [
    displayConfig,
    setDisplayConfig,
  ] =
    useState<
      DisplayConfig | null
    >(null);

  const [
    configError,
    setConfigError,
  ] =
    useState(false);

  /*
    ---------------------------------------------------------
    GOOGLE CALENDAR
    ---------------------------------------------------------
  */

  const [
    calendarEvents,
    setCalendarEvents,
  ] =
    useState<
      CalendarEvent[]
    >([]);

  const [
    calendarSources,
    setCalendarSources,
  ] =
    useState<
      CalendarSource[]
    >([]);

  const [
    calendarError,
    setCalendarError,
  ] =
    useState(false);

  const [
    calendarLoading,
    setCalendarLoading,
  ] =
    useState(false);

  /* =======================================================
     PAGE VISIBILITY
     ======================================================= */

  const [
    pageVisible,
    setPageVisible,
  ] =
    useState(false);

  useEffect(() => {
    function updateVisibility() {
      setPageVisible(
        !document.hidden
      );
    }

    updateVisibility();

    document.addEventListener(
      "visibilitychange",
      updateVisibility
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        updateVisibility
      );
    };
  }, []);

  /* =======================================================
     CLOCK
     ======================================================= */

  useEffect(() => {
    setMounted(
      true
    );

    setNow(
      new Date()
    );

    const timer =
      window.setInterval(
        () => {
          setNow(
            new Date()
          );
        },
        1000
      );

    return () => {
      window.clearInterval(
        timer
      );
    };
  }, []);

  /* =======================================================
     DISPLAY CONFIG
     ======================================================= */

  useEffect(() => {
    if (!pageVisible) {
      return;
    }

    let cancelled =
      false;

    let timer:
      number | undefined;

    const normalDelay =
      5 *
      60 *
      1000;

    const maxFailureDelay =
      15 *
      60 *
      1000;

    let failureDelay =
      60 *
      1000;

    const cacheKey =
      "family-display:display-config";

    function clearPrivateCache() {
      try {
        for (
          let index =
            sessionStorage.length -
            1;
          index >= 0;
          index--
        ) {
          const key =
            sessionStorage.key(
              index
            );

          if (
            key?.startsWith(
              "family-display:"
            )
          ) {
            sessionStorage.removeItem(
              key
            );
          }
        }
      } catch {
        // Ignore storage failures.
      }
    }

    function restoreCachedConfig() {
      try {
        const raw =
          sessionStorage.getItem(
            cacheKey
          );

        if (!raw) {
          return false;
        }

        const cached =
          JSON.parse(raw);

        const cachedData =
          cached?.data;

        if (
          !cachedData
            ?.household ||
          !cachedData
            ?.display
        ) {
          return false;
        }

        setDisplayConfig(
          cachedData as
            DisplayConfig
        );

        return true;
      } catch {
        return false;
      }
    }

    function scheduleNext(
      delay: number
    ) {
      if (cancelled) {
        return;
      }

      timer =
        window.setTimeout(
          loadConfig,
          delay
        );
    }

    async function loadConfig() {
      try {
        const response =
          await fetch(
            "/api/display-config",
            {
              cache:
                "no-store",
            }
          );

        const data =
          await response
            .json()
            .catch(
              () =>
                null
            );

        if (
          response.status ===
          401
        ) {
          clearPrivateCache();

          window.location.replace(
            "/pair"
          );

          return;
        }

        if (
          !response.ok
        ) {
          throw new Error(
            data?.error ??
              "Unable to load display configuration."
          );
        }

        if (cancelled) {
          return;
        }

        setDisplayConfig(
          data as
            DisplayConfig
        );

        try {
          sessionStorage.setItem(
            cacheKey,
            JSON.stringify({
              savedAt:
                Date.now(),

              data,
            })
          );
        } catch {
          // Cache failure should never
          // break the dashboard.
        }

        setConfigError(
          false
        );

        failureDelay =
          60 *
          1000;

        scheduleNext(
          normalDelay
        );
      } catch (
        error
      ) {
        console.error(
          "Display config error:",
          error
        );

        if (cancelled) {
          return;
        }

        /*
          Only restore cached private
          data AFTER a real network/server
          failure.

          A 401 never uses cached data.
        */

        restoreCachedConfig();

        setConfigError(
          true
        );

        scheduleNext(
          failureDelay
        );

        failureDelay =
          Math.min(
            failureDelay *
              2,
            maxFailureDelay
          );
      }
    }

    loadConfig();

    return () => {
      cancelled =
        true;

      if (
        timer !==
        undefined
      ) {
        window.clearTimeout(
          timer
        );
      }
    };
  }, [
    pageVisible,
  ]);

  /* =======================================================
     DISPLAY DEFAULTS
     ======================================================= */

  const timezone =
    displayConfig
      ?.display
      .timezone ??
    "America/Los_Angeles";

  const orientation =
    displayConfig
      ?.display
      .orientation ??
    "landscape";

  const theme =
    displayConfig
      ?.display
      .theme ??
    "light";

  const fontFamily =
    displayConfig
      ?.display
      .fontFamily ??
    "Arial";

  const accentColor =
    displayConfig
      ?.display
      .accentColor ??
    "#169FE8";

  const cardOpacity =
    displayConfig
      ?.display
      .cardOpacity ??
    0.95;

  const use24HourClock =
    displayConfig
      ?.display
      .use24HourClock ??
    false;

  const showClock =
    displayConfig
      ?.display
      .showClock ??
    true;

  const showWeather =
    displayConfig
      ?.display
      .showWeather ??
    true;

  const showForecast =
    displayConfig
      ?.display
      .showForecast ??
    true;

  const showCalendar =
    displayConfig
      ?.display
      .showCalendar ??
    true;

  const showMessage =
    displayConfig
      ?.display
      .showMessage ??
    true;

  const backgroundEnabled =
    displayConfig
      ?.display
      .backgroundEnabled ??
    false;

  const weatherLocation =
    displayConfig
      ?.display
      .weatherLocation ??
    "Lynden, Washington";

  const schedules =
    displayConfig
      ?.display
      .schedules ??
    [];

  /* =======================================================
     LOCAL DATE / TIME
     ======================================================= */

  const timezoneParts =
    getTimeZoneParts(
      now,
      timezone
    );

  const currentYear =
    timezoneParts.year;

  const currentMonth =
    timezoneParts.month;

  /* =======================================================
     SCHEDULE
     ======================================================= */

  const currentMinutes =
    timezoneParts.hour *
      60 +
    timezoneParts.minute;

  const scheduleMode =
    getScheduleMode(
      schedules,
      timezoneParts.weekday,
      currentMinutes
    );

  /* =======================================================
     GOOGLE CALENDAR EVENTS
     Supabase Realtime + 60-minute fallback
     ======================================================= */

  useEffect(() => {
    if (
      !mounted ||
      !pageVisible ||
      scheduleMode ===
        "sleep" ||
      !displayConfig ||
      !showCalendar ||
      currentYear <
        2000
    ) {
      return;
    }

    let cancelled =
      false;

    let fallbackTimer:
      number | undefined;

    let requestInFlight =
      false;

    /*
      Realtime is now the primary refresh mechanism.

      This one-hour timer is only a safety net in case
      a browser temporarily loses its Realtime connection.
    */

    const normalFallbackDelay =
      60 *
      60 *
      1000;

    const maxFailureDelay =
      15 *
      60 *
      1000;

    let failureDelay =
      60 *
      1000;

    const householdId =
      displayConfig.household.id;

    const cacheKey =
      `family-display:calendar:${householdId}:${currentYear}-${currentMonth}`;

    const realtimeTopic =
      `calendar:${householdId}`;

    function clearPrivateCache() {
      try {
        for (
          let index =
            sessionStorage.length -
            1;
          index >= 0;
          index--
        ) {
          const key =
            sessionStorage.key(
              index
            );

          if (
            key?.startsWith(
              "family-display:"
            )
          ) {
            sessionStorage.removeItem(
              key
            );
          }
        }
      } catch {
        // Ignore storage failures.
      }
    }

    function restoreCachedCalendar() {
      try {
        const raw =
          sessionStorage.getItem(
            cacheKey
          );

        if (!raw) {
          return false;
        }

        const cached =
          JSON.parse(raw);

        if (
          !Array.isArray(
            cached?.events
          ) ||
          !Array.isArray(
            cached?.calendars
          )
        ) {
          return false;
        }

        setCalendarEvents(
          cached.events
        );

        setCalendarSources(
          cached.calendars
        );

        return true;
      } catch {
        return false;
      }
    }

    function scheduleFallback(
      delay: number
    ) {
      if (
        cancelled
      ) {
        return;
      }

      if (
        fallbackTimer !==
        undefined
      ) {
        window.clearTimeout(
          fallbackTimer
        );
      }

      fallbackTimer =
        window.setTimeout(
          () => {
            void loadCalendarEvents();
          },
          delay
        );
    }

    async function loadCalendarEvents() {
      if (
        cancelled ||
        requestInFlight
      ) {
        return;
      }

      requestInFlight =
        true;

      try {
        setCalendarLoading(
          true
        );

        const response =
          await fetch(
            `/api/calendar-events?year=${currentYear}&month=${currentMonth}`,
            {
              cache:
                "no-store",
            }
          );

        const data =
          await response
            .json()
            .catch(
              () =>
                null
            );

        if (
          response.status ===
          401
        ) {
          clearPrivateCache();

          window.location.replace(
            "/pair"
          );

          return;
        }

        if (
          !response.ok
        ) {
          throw new Error(
            data?.error ??
              "Unable to load Google Calendar events."
          );
        }

        if (
          cancelled
        ) {
          return;
        }

        const nextEvents =
          Array.isArray(
            data?.events
          )
            ? data.events
            : [];

        const nextCalendars =
          Array.isArray(
            data?.calendars
          )
            ? data.calendars
            : [];

        setCalendarEvents(
          nextEvents
        );

        setCalendarSources(
          nextCalendars
        );

        try {
          sessionStorage.setItem(
            cacheKey,
            JSON.stringify({
              savedAt:
                Date.now(),

              events:
                nextEvents,

              calendars:
                nextCalendars,
            })
          );
        } catch {
          // Ignore cache failures.
        }

        setCalendarError(
          false
        );

        failureDelay =
          60 *
          1000;

        /*
          No 1-minute polling anymore.

          Realtime will normally cause the next refresh.
          This timer is only the one-hour fallback.
        */

        scheduleFallback(
          normalFallbackDelay
        );
      } catch (
        error
      ) {
        console.error(
          "Calendar events error:",
          error
        );

        if (
          cancelled
        ) {
          return;
        }

        /*
          Continue showing the most recent successful
          calendar information.
        */

        restoreCachedCalendar();

        setCalendarError(
          true
        );

        /*
          Failed requests retry sooner.

          1, 2, 4, 8, then 15 minutes maximum.
        */

        scheduleFallback(
          failureDelay
        );

        failureDelay =
          Math.min(
            failureDelay *
              2,
            maxFailureDelay
          );
      } finally {
        requestInFlight =
          false;

        if (
          !cancelled
        ) {
          setCalendarLoading(
            false
          );
        }
      }
    }

    /*
      Listen only for this household's
      calendar change notifications.

      The broadcast contains no private
      calendar event data.
    */

    const realtimeChannel =
      familyDisplayRealtimeSupabase
        .channel(
          realtimeTopic
        )
        .on(
          "broadcast",
          {
            event:
              "calendar_changed",
          },
          (
            message
          ) => {
            if (
              cancelled
            ) {
              return;
            }

            const changedYear =
              Number(
                message
                  ?.payload
                  ?.year
              );

            const changedMonth =
              Number(
                message
                  ?.payload
                  ?.month
              );

            /*
              Ignore notifications for months
              this display is not currently showing.
            */

            if (
              Number.isFinite(
                changedYear
              ) &&
              Number.isFinite(
                changedMonth
              ) &&
              (
                changedYear !==
                  currentYear ||
                changedMonth !==
                  currentMonth
              )
            ) {
              return;
            }

            void loadCalendarEvents();
          }
        )
        .subscribe(
          (
            status
          ) => {
            if (
              status ===
              "CHANNEL_ERROR"
            ) {
              console.error(
                "Calendar Realtime channel error."
              );
            }
          }
        );

    /*
      Immediately show cached data,
      then perform one secure server read.

      After this, Realtime becomes
      the primary refresh mechanism.
    */

    restoreCachedCalendar();

    void loadCalendarEvents();

    return () => {
      cancelled =
        true;

      if (
        fallbackTimer !==
        undefined
      ) {
        window.clearTimeout(
          fallbackTimer
        );
      }

      void familyDisplayRealtimeSupabase
        .removeChannel(
          realtimeChannel
        );
    };
  }, [
    mounted,
    pageVisible,
    scheduleMode,
    displayConfig?.household.id,
    showCalendar,
    currentYear,
    currentMonth,
  ]);

  /* =======================================================
     CLOCK FORMAT
     ======================================================= */

  const timeString =
    now.toLocaleTimeString(
      "en-US",
      {
        timeZone:
          timezone,

        hour:
          "2-digit",

        minute:
          "2-digit",

        hourCycle:
          use24HourClock
            ? "h23"
            : "h12",
      }
    );

  let formattedTime =
    timeString;

  let meridiem =
    "";

  if (
    !use24HourClock
  ) {
    const match =
      timeString.match(
        /^(.+)\s(AM|PM)$/
      );

    if (match) {
      formattedTime =
        match[1];

      meridiem =
        match[2];
    }
  }

  const formattedDate =
    now.toLocaleDateString(
      "en-US",
      {
        timeZone:
          timezone,

        weekday:
          "long",

        month:
          "long",

        day:
          "numeric",
      }
    );

  /* =======================================================
     MONTH GRID
     ======================================================= */

  const monthData =
    useMemo(() => {
      type CalendarCell = {
        day: number;
        month: number;
        year: number;
        dateKey: string;
        monthLabel: string;
        isMonthStart: boolean;
        isCurrentWeek: boolean;
        inCurrentMonth: boolean;
      };


      const todayUtc =
        new Date(
          Date.UTC(
            timezoneParts.year,
            timezoneParts.month -
              1,
            timezoneParts.day
          )
        );


      /*
        Sunday at the beginning of the
        current calendar week.
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
        The first row is always the
        previous week.
      */

      const gridStart =
        new Date(
          currentWeekStart
        );

      gridStart.setUTCDate(
        gridStart.getUTCDate() -
          7
      );


      const cells:
        CalendarCell[] =
        [];


      for (
        let index =
          0;
        index <
          28;
        index++
      ) {
        const date =
          new Date(
            gridStart
          );

        date.setUTCDate(
          gridStart.getUTCDate() +
            index
        );


        const cellYear =
          date.getUTCFullYear();

        const cellMonth =
          date.getUTCMonth() +
          1;

        const cellDay =
          date.getUTCDate();


        const monthLabel =
          new Intl.DateTimeFormat(
            "en-US",
            {
              month:
                "short",

              timeZone:
                "UTC",
            }
          ).format(
            date
          );


        cells.push({
          day:
            cellDay,

          month:
            cellMonth,

          year:
            cellYear,

          dateKey:
            `${cellYear}-${pad(
              cellMonth
            )}-${pad(
              cellDay
            )}`,

          monthLabel,

          isMonthStart:
            cellDay ===
            1,

          /*
            Index 7-13 is always row 2,
            which is the current week.
          */

          isCurrentWeek:
            index >=
              7 &&
            index <
              14,

          inCurrentMonth:
            cellMonth ===
              timezoneParts.month &&
            cellYear ===
              timezoneParts.year,
        });
      }


      const first =
        cells[0];

      const last =
        cells[
          cells.length -
            1
        ];


      const longMonth =
        (
          year: number,
          month: number
        ) =>
          new Intl.DateTimeFormat(
            "en-US",
            {
              month:
                "long",

              timeZone:
                "UTC",
            }
          )
            .format(
              new Date(
                Date.UTC(
                  year,
                  month -
                    1,
                  1
                )
              )
            )
            .toUpperCase();


      let headerLabel =
        "";


      if (
        first.year ===
          last.year &&
        first.month ===
          last.month
      ) {
        headerLabel =
          `${longMonth(
            first.year,
            first.month
          )} ${first.year}`;
      } else if (
        first.year ===
        last.year
      ) {
        headerLabel =
          `${longMonth(
            first.year,
            first.month
          )} — ${longMonth(
            last.year,
            last.month
          )} ${first.year}`;
      } else {
        headerLabel =
          `${longMonth(
            first.year,
            first.month
          )} ${first.year} — ${longMonth(
            last.year,
            last.month
          )} ${last.year}`;
      }


      return {
        headerLabel,

        cells,
      };
    }, [
      timezoneParts.year,
      timezoneParts.month,
      timezoneParts.day,
    ]);

  /* =======================================================
     MESSAGE
     ======================================================= */

  /*
    Start with the existing normal family message.
  */

  let message =
    displayConfig
      ?.display
      .message ??
    "God will steer, but you must row.";


  const messageExpiration =
    displayConfig
      ?.display
      .messageExpiresAt;


  if (
    messageExpiration &&
    new Date(
      messageExpiration
    ).getTime() <=
      now.getTime()
  ) {
    message =
      "";
  }


  /*
    Scheduled messages temporarily override
    the normal family message.

    Highest priority wins.

    For equal priority, the message that
    started most recently wins.
  */

  const activeScheduledMessage =
    (
      displayConfig
        ?.display
        .scheduledMessages ??
      []
    )
      .filter(
        (
          scheduled
        ) => {
          const starts =
            new Date(
              scheduled.startsAt
            ).getTime();

          const ends =
            scheduled.endsAt
              ? new Date(
                  scheduled.endsAt
                ).getTime()
              : null;


          return (
            starts <=
              now.getTime() &&
            (
              ends ===
                null ||
              ends >
                now.getTime()
            )
          );
        }
      )
      .sort(
        (
          first,
          second
        ) => {
          if (
            first.priority !==
            second.priority
          ) {
            return (
              second.priority -
              first.priority
            );
          }


          return (
            new Date(
              second.startsAt
            ).getTime() -
            new Date(
              first.startsAt
            ).getTime()
          );
        }
      )[0];


  if (
    activeScheduledMessage
  ) {
    message =
      activeScheduledMessage
        .message;
  }

  /* =======================================================
     SIDEBAR
     ======================================================= */

  /*
    Keep the left-column proportions balanced.

    The clock is intentionally about 25% shorter
    than before, with that space transferred to
    the Today / Family Message card.
  */

  const sidebarTodayDateKey =
    `${timezoneParts.year}-${pad(
      timezoneParts.month
    )}-${pad(
      timezoneParts.day
    )}`;

  const sidebarHasTodayAgenda =
    calendarEvents.some(
      (
        event
      ) =>
        event.date ===
        sidebarTodayDateKey
    );

  const sidebarRows:
    string[] = [];

  if (showClock) {
    sidebarRows.push(
      "1fr"
    );
  }

  if (showWeather) {
    sidebarRows.push(
      "1fr"
    );
  }

  if (showForecast) {
    sidebarRows.push(
      "0.7fr"
    );
  }

  if (
    showMessage ||
    sidebarHasTodayAgenda
  ) {
    sidebarRows.push(
      "3.05fr"
    );
  }

  const hasSidebar =
    sidebarRows.length >
    0;

  /* =======================================================
     CSS VARIABLES
     ======================================================= */

  const dashboardStyle =
    {
      "--accent":
        accentColor,

      "--card-opacity":
        cardOpacity,

      fontFamily,
    } as CSSProperties;

  /* =======================================================
     HYDRATION GUARD
     ======================================================= */

  if (!mounted) {
    return (
      <main
        className="dashboard"
        aria-hidden="true"
      />
    );
  }

  /* =======================================================
     RENDER
     ======================================================= */

  /* =======================================================
     TODAY AGENDA
     ======================================================= */

  const todayDateKey =
    `${timezoneParts.year}-${pad(
      timezoneParts.month
    )}-${pad(
      timezoneParts.day
    )}`;


  const todayAgendaEvents =
    calendarEvents
      .filter(
        (
          event
        ) =>
          event.date ===
          todayDateKey
      )
      .sort(
        (
          first,
          second
        ) => {
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


  const visibleTodayAgendaEvents =
    todayAgendaEvents.slice(
      0,
      4
    );


  return (
    <main
      className={[
        "dashboard",

        `theme-${theme}`,

        `orientation-${orientation}`,

        backgroundEnabled
          ? "hasBackground"
          : "",

        !hasSidebar
          ? "noSidebar"
          : "",

        !showCalendar
          ? "noCalendar"
          : "",
      ]
        .filter(
          Boolean
        )
        .join(" ")}
      style={
        dashboardStyle
      }
    >
      {/* ===================================================
          ROTATING BACKGROUND
          =================================================== */}

      <RotatingBackground
        enabled={
          backgroundEnabled
        }
        intervalSeconds={
          displayConfig
            ?.display
            .backgroundIntervalSeconds ??
          600
        }
        shuffle={
          displayConfig
            ?.display
            .backgroundShuffle ??
          true
        }
        fit={
          displayConfig
            ?.display
            .backgroundFit ??
          "cover"
        }
        overlayOpacity={
          displayConfig
            ?.display
            .backgroundOverlayOpacity ??
          0.72
        }
        paused={
          !pageVisible ||
          scheduleMode ===
            "sleep"
        }
      />

      {/* ===================================================
          SIDEBAR
          =================================================== */}

      {hasSidebar && (
        <aside
          className="sidebar"
          style={{
            gridTemplateRows:
              sidebarRows.join(
                " "
              ),
          }}
        >
          {/* CLOCK */}

          {showClock && (
            <section className="card clockCard">
              <div className="greeting">
                {getGreeting(
                  timezoneParts.hour
                )}
              </div>

              <div className="clock">
                <span className="clockTime">
                  {
                    formattedTime
                  }
                </span>

                {meridiem && (
                  <span className="meridiem">
                    {
                      meridiem
                    }
                  </span>
                )}
              </div>

              <div className="date">
                {
                  formattedDate
                }
              </div>
            </section>
          )}

          {/* WEATHER */}

          <WeatherPanels
            location={
              weatherLocation
            }
            showWeather={
              showWeather
            }
            showForecast={
              showForecast
            }
            paused={
              !pageVisible ||
              scheduleMode ===
                "sleep"
            }
          />

          {/* TODAY AGENDA + MESSAGE */}

          {(
            showMessage ||
            todayAgendaEvents.length >
              0
          ) && (
            <section
              className={`card messageCard ${
                todayAgendaEvents.length >
                  0
                  ? "messageCardWithAgenda"
                  : ""
              }`}
            >
              {todayAgendaEvents.length >
                0 && (
                <div className="todayAgenda">
                  <div className="todayAgendaHeader">
                    TODAY
                  </div>

                  <div className="todayAgendaList">
                    {visibleTodayAgendaEvents.map(
                      (
                        event
                      ) => (
                        <div
                          className="todayAgendaItem"
                          key={
                            `agenda-${event.id}`
                          }
                        >
                          <span className="todayAgendaTime">
                            {event.allDay
                              ? "ALL DAY"
                              : event.start
                                ? formatEventTime(
                                    event.start,
                                    timezone,
                                    use24HourClock
                                  )
                                : ""}
                          </span>

                          <AutoScrollText className="todayAgendaTitle">
                            {
                              event.title
                            }
                          </AutoScrollText>
                        </div>
                      )
                    )}

                    {todayAgendaEvents.length >
                      visibleTodayAgendaEvents.length && (
                      <div className="todayAgendaMore">
                        +
                        {
                          todayAgendaEvents.length -
                          visibleTodayAgendaEvents.length
                        }{" "}
                        more
                      </div>
                    )}
                  </div>
                </div>
              )}

              {showMessage && (
                <>
                  {todayAgendaEvents.length >
                    0 && (
                    <div className="todayAgendaDivider" />
                  )}

                  <div className="messageText">
                    {
                      message ||
                      " "
                    }
                  </div>
                </>
              )}

              <div className="mountainArt">
                <div className="mountain mountainBack" />

                <div className="mountain mountainFront" />
              </div>
            </section>
          )}
        </aside>
      )}

      {/* ===================================================
          GOOGLE CALENDAR
          =================================================== */}

      {showCalendar && (
        <section className="calendarPanel">
          {/* ===============================================
              HEADER
              =============================================== */}

          <header className="calendarHeader">
            <div>
              <div className="calendarTitle">
                {
                  monthData.headerLabel
                }
              </div>

              <div className="calendarSubtitle">
                {displayConfig
                  ?.household
                  .name ??
                  "Family Calendar"}
              </div>
            </div>

            <div className="headerActions">
              <span className="liveDot" />

              {calendarLoading
                ? "Syncing"
                : calendarError ||
                    configError
                  ? "Offline"
                  : "Live"}
            </div>
          </header>

          {/* ===============================================
              WEEKDAYS
              =============================================== */}

          <div className="weekdayRow">
            {[
              "SUN",
              "MON",
              "TUE",
              "WED",
              "THU",
              "FRI",
              "SAT",
            ].map(
              (
                day
              ) => (
                <div
                  key={
                    day
                  }
                >
                  {
                    day
                  }
                </div>
              )
            )}
          </div>

          {/* ===============================================
              MONTH GRID
              =============================================== */}

          <div className="calendarGrid">
            {monthData
              .cells
              .map(
                (
                  cell,
                  index
                ) => {
                  const day =
                    cell?.day ??
                    null;

                  /*
                    Each populated cell now carries
                    its complete YYYY-MM-DD date.
                  */

                  const dateKey =
                    cell
                      ?.dateKey ??
                    "";

                  const events =
                    cell
                      ? calendarEvents.filter(
                          (
                            event
                          ) =>
                            event.date ===
                            dateKey
                        )
                      : [];

                  const isToday =
                    Boolean(
                      cell &&
                      cell.day ===
                        timezoneParts.day &&
                      cell.month ===
                        timezoneParts.month &&
                      cell.year ===
                        timezoneParts.year
                    );

                  const isOtherMonth =
                    Boolean(
                      cell &&
                      !cell.inCurrentMonth
                    );

                  const isCurrentWeek =
                    Boolean(
                      cell
                        ?.isCurrentWeek
                    );

                  return (
                    <div
                      key={
                        cell
                          ?.dateKey ??
                        `blank-${index}`
                      }
                      className={`calendarCell ${
                        isToday
                          ? "todayCell"
                          : ""
                      } ${
                        isOtherMonth
                          ? "otherMonthCell"
                          : ""
                      } ${
                        isCurrentWeek
                          ? "currentWeekCell"
                          : ""
                      }`}
                    >
                      {cell && (
                        <>
                          {/* DATE NUMBER */}

                          <div
                            className={`dayNumber ${
                              isToday
                                ? "todayNumber"
                                : ""
                            } ${
                              isOtherMonth
                                ? "otherMonthNumber"
                                : ""
                            }`}
                          >
                            {cell.isMonthStart
                              ? `${cell.monthLabel} ${cell.day}`
                              : cell.day}
                          </div>

                          {/* =================================
                              AUTOMATIC EVENT SCROLLER
                              ================================= */}

                          <AutoScrollEvents>
                            {events.map(
                              (
                                event
                              ) => {
                                /*
                                  -----------------------------
                                  ALL-DAY EVENT

                                  Uses a full Google-colored bar.
                                  -----------------------------
                                */

                                if (
                                  event.allDay
                                ) {
                                  const textColor =
                                    event.usesEventColor &&
                                    event.textColor
                                      ? event.textColor
                                      : getContrastText(
                                          event.color
                                        );

                                  return (
                                    <div
                                      className="eventBar"
                                      key={
                                        event.id
                                      }
                                      style={{
                                        backgroundColor:
                                          event.color,

                                        color:
                                          textColor,
                                      }}
                                      title={`${event.calendarName}: ${event.title}`}
                                    >
                                      <AutoScrollText>
                                        {
                                          event.title
                                        }
                                      </AutoScrollText>
                                    </div>
                                  );
                                }

                                /*
                                  -----------------------------
                                  TIMED EVENT

                                  Uses the Google color as the dot.
                                  -----------------------------
                                */

                                return (
                                  <div
                                    className="eventDot"
                                    key={
                                      event.id
                                    }
                                    title={`${event.calendarName}: ${event.title}`}
                                  >
                                    <span
                                      className="dot"
                                      style={{
                                        backgroundColor:
                                          event.color,
                                      }}
                                    />

                                    <div className="eventDotContent">
                                      {event.start && (
                                        <span className="eventTime">
                                          {formatEventTime(
                                            event.start,
                                            timezone,
                                            use24HourClock
                                          )}
                                        </span>
                                      )}

                                      <AutoScrollText>
                                        {
                                          event.title
                                        }
                                      </AutoScrollText>
                                    </div>
                                  </div>
                                );
                              }
                            )}
                          </AutoScrollEvents>
                        </>
                      )}
                    </div>
                  );
                }
              )}
          </div>

          {/* ===============================================
              GOOGLE CALENDAR LEGEND
              =============================================== */}

          <footer className="calendarFooter">
            <div className="calendarLegend">
              {calendarSources.length >
              0 ? (
                calendarSources.map(
                  (
                    calendar
                  ) => (
                    <span
                      key={
                        calendar.id
                      }
                      style={{
                        display:
                          "inline-flex",

                        alignItems:
                          "center",

                        gap:
                          "5px",

                        marginRight:
                          "14px",
                      }}
                    >
                      <span
                        style={{
                          width:
                            "10px",

                          height:
                            "10px",

                          borderRadius:
                            "50%",

                          flex:
                            "0 0 auto",

                          backgroundColor:
                            calendar.color,
                        }}
                      />

                      <span>
                        {
                          calendar.name
                        }
                      </span>
                    </span>
                  )
                )
              ) : (
                <span>
                  No Google calendars selected
                </span>
              )}
            </div>
          </footer>
        </section>
      )}

      {/* ===================================================
          DIM MODE
          =================================================== */}

      {scheduleMode ===
        "dim" && (
        <div
          className="scheduleDimOverlay"
          aria-hidden="true"
        />
      )}

      {/* ===================================================
          SLEEP MODE
          =================================================== */}

      {scheduleMode ===
        "sleep" && (
        <div
          className="scheduleSleepOverlay"
          aria-hidden="true"
        />
      )}
    </main>
  );
}
