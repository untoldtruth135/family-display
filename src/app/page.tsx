"use client";

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
    let cancelled =
      false;

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
          !response.ok
        ) {
          throw new Error(
            data?.error ??
              "Unable to load display configuration."
          );
        }

        if (
          cancelled
        ) {
          return;
        }

        setDisplayConfig(
          data as
            DisplayConfig
        );

        setConfigError(
          false
        );
      } catch (
        error
      ) {
        console.error(
          "Display config error:",
          error
        );

        if (
          !cancelled
        ) {
          setConfigError(
            true
          );
        }
      }
    }

    loadConfig();

    const timer =
      window.setInterval(
        loadConfig,
        15_000
      );

    return () => {
      cancelled =
        true;

      window.clearInterval(
        timer
      );
    };
  }, []);

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
     GOOGLE CALENDAR EVENTS
     ======================================================= */

  useEffect(() => {
    if (
      !mounted ||
      !displayConfig ||
      !showCalendar ||
      currentYear <
        2000
    ) {
      return;
    }

    let cancelled =
      false;

    async function loadCalendarEvents() {
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

        setCalendarEvents(
          Array.isArray(
            data?.events
          )
            ? data.events
            : []
        );

        setCalendarSources(
          Array.isArray(
            data?.calendars
          )
            ? data.calendars
            : []
        );

        setCalendarError(
          false
        );
      } catch (
        error
      ) {
        console.error(
          "Calendar events error:",
          error
        );

        if (
          !cancelled
        ) {
          setCalendarError(
            true
          );
        }
      } finally {
        if (
          !cancelled
        ) {
          setCalendarLoading(
            false
          );
        }
      }
    }

    loadCalendarEvents();

    /*
      Reload Google events every
      five minutes.
    */

    const timer =
      window.setInterval(
        loadCalendarEvents,
        5 *
          60 *
          1000
      );

    return () => {
      cancelled =
        true;

      window.clearInterval(
        timer
      );
    };
  }, [
    mounted,
    displayConfig?.household.id,
    showCalendar,
    currentYear,
    currentMonth,
  ]);

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
      const year =
        timezoneParts.year;

      const monthIndex =
        timezoneParts.month -
        1;

      const firstDay =
        new Date(
          year,
          monthIndex,
          1
        );

      const lastDay =
        new Date(
          year,
          monthIndex +
            1,
          0
        );

      const cells:
        Array<
          number | null
        > = [];

      for (
        let index = 0;
        index <
        firstDay.getDay();
        index++
      ) {
        cells.push(
          null
        );
      }

      for (
        let day = 1;
        day <=
        lastDay.getDate();
        day++
      ) {
        cells.push(
          day
        );
      }

      while (
        cells.length %
          7 !==
        0
      ) {
        cells.push(
          null
        );
      }

      const monthName =
        new Intl.DateTimeFormat(
          "en-US",
          {
            month:
              "long",
          }
        ).format(
          new Date(
            year,
            monthIndex,
            1
          )
        );

      return {
        monthName,

        year,

        month:
          monthIndex +
          1,

        cells,
      };
    }, [
      timezoneParts.year,
      timezoneParts.month,
    ]);

  /* =======================================================
     MESSAGE
     ======================================================= */

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

  /* =======================================================
     SIDEBAR
     ======================================================= */

  const sidebarRows:
    string[] = [];

  if (showClock) {
    sidebarRows.push(
      "1.35fr"
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

  if (showMessage) {
    sidebarRows.push(
      "2.7fr"
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
          />

          {/* MESSAGE */}

          {showMessage && (
            <section className="card messageCard">
              <div className="messageText">
                {
                  message ||
                  " "
                }
              </div>

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
                  monthData.monthName
                }{" "}
                {
                  monthData.year
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
                  day,
                  index
                ) => {
                  /*
                    Build the same YYYY-MM-DD
                    key returned by the
                    Google event API.
                  */

                  const dateKey =
                    day
                      ? `${monthData.year}-${pad(
                          monthData.month
                        )}-${pad(
                          day
                        )}`
                      : "";

                  const events =
                    day
                      ? calendarEvents.filter(
                          (
                            event
                          ) =>
                            event.date ===
                            dateKey
                        )
                      : [];

                  const isToday =
                    day ===
                      timezoneParts.day &&
                    monthData.month ===
                      timezoneParts.month &&
                    monthData.year ===
                      timezoneParts.year;

                  return (
                    <div
                      key={`${
                        day ??
                        "blank"
                      }-${index}`}
                      className={`calendarCell ${
                        isToday
                          ? "todayCell"
                          : ""
                      }`}
                    >
                      {day !==
                        null && (
                        <>
                          {/* DATE NUMBER */}

                          <div
                            className={`dayNumber ${
                              isToday
                                ? "todayNumber"
                                : ""
                            }`}
                          >
                            {
                              day
                            }
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
                                      {
                                        event.title
                                      }
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

                                    <div>
                                      {event.start && (
                                        <span className="eventTime">
                                          {formatEventTime(
                                            event.start,
                                            timezone,
                                            use24HourClock
                                          )}{" "}
                                        </span>
                                      )}

                                      {
                                        event.title
                                      }
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