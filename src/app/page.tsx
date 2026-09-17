"use client";

import type { CSSProperties } from "react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import WeatherPanels from "@/components/WeatherPanels";
import RotatingBackground from "@/components/RotatingBackground";

type CalendarEvent = {
  date: number;
  title: string;
  time?: string;
  type?: "bar" | "dot";
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
  };
};

const sampleEvents: CalendarEvent[] = [
  {
    date: 1,
    title: "First day of school",
    type: "bar",
  },
  {
    date: 3,
    title: "Trash Day",
    type: "bar",
  },
  {
    date: 3,
    title: "Kami violin lesson",
    time: "2:45 PM",
    type: "dot",
  },
  {
    date: 5,
    title: "LHS play auditions",
    type: "bar",
  },
  {
    date: 7,
    title: "No school - Labor Day",
    type: "bar",
  },
  {
    date: 10,
    title: "Trash Day",
    type: "bar",
  },
  {
    date: 10,
    title: "Kami violin lesson",
    time: "2:45 PM",
    type: "dot",
  },
  {
    date: 12,
    title: "Whiskey walk",
    time: "4:00 PM",
    type: "dot",
  },
  {
    date: 15,
    title: "NCY",
    time: "6:15 PM",
    type: "dot",
  },
  {
    date: 17,
    title: "Beth's birthday",
    time: "12:00 PM",
    type: "dot",
  },
  {
    date: 18,
    title: "Daddy - Training",
    type: "bar",
  },
  {
    date: 22,
    title: "NCY",
    time: "6:15 PM",
    type: "dot",
  },
  {
    date: 23,
    title: "Ortho",
    time: "9:00 AM",
    type: "dot",
  },
  {
    date: 24,
    title: "Trash Day",
    type: "bar",
  },
  {
    date: 24,
    title: "Kami violin lesson",
    time: "2:45 PM",
    type: "dot",
  },
];

function getGreeting(hour: number) {
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
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        hourCycle: "h23",
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

    hour:
      Number(
        result.hour
      ),
  };
}

export default function Home() {
  const [
    now,
    setNow,
  ] =
    useState(
      new Date()
    );

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
    CLOCK
    ---------------------------------------------------------
  */

  useEffect(() => {
    const timer =
      setInterval(
        () => {
          setNow(
            new Date()
          );
        },
        1000
      );

    return () =>
      clearInterval(
        timer
      );
  }, []);

  /*
    ---------------------------------------------------------
    DISPLAY CONFIGURATION
    ---------------------------------------------------------

    Re-check every 15 seconds so changes made from
    /settings appear on the wall display automatically.
  */

  useEffect(() => {
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

        if (
          !response.ok
        ) {
          const errorData =
            await response
              .json()
              .catch(
                () => null
              );

          throw new Error(
            errorData?.error ??
              "Unable to load display configuration."
          );
        }

        const data =
          (await response.json()) as DisplayConfig;

        setDisplayConfig(
          data
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

        setConfigError(
          true
        );
      }
    }

    loadConfig();

    const timer =
      setInterval(
        loadConfig,
        15_000
      );

    return () =>
      clearInterval(
        timer
      );
  }, []);

  /*
    ---------------------------------------------------------
    DEFAULTS
    ---------------------------------------------------------
  */

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

  /*
    ---------------------------------------------------------
    DATE / TIME
    ---------------------------------------------------------
  */

  const timezoneParts =
    getTimeZoneParts(
      now,
      timezone
    );

  /*
    Explicit hourCycle is used here so
    24-hour format reliably produces
    values like 14:35 instead of 2:35 PM.
  */

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

  /*
    ---------------------------------------------------------
    CALENDAR GRID
    ---------------------------------------------------------
  */

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
        let i = 0;
        i <
        firstDay.getDay();
        i++
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

      return {
        monthName:
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
          ),

        year,

        cells,
      };
    }, [
      timezoneParts.year,
      timezoneParts.month,
    ]);

  /*
    ---------------------------------------------------------
    MESSAGE EXPIRATION
    ---------------------------------------------------------
  */

  let message =
    displayConfig
      ?.display
      .message ??
    "Good will steer, but you must row.";

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
    ---------------------------------------------------------
    DYNAMIC SIDEBAR ROWS
    ---------------------------------------------------------
  */

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

  /*
    ---------------------------------------------------------
    CSS VARIABLES
    ---------------------------------------------------------
  */

  const dashboardStyle =
    {
      "--accent":
        accentColor,

      "--card-opacity":
        cardOpacity,

      fontFamily,
    } as CSSProperties;

  /*
    ---------------------------------------------------------
    RENDER
    ---------------------------------------------------------
  */

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

          {showMessage && (
            <section className="card messageCard">
              <div className="messageText">
                {message ||
                  " "}
              </div>

              <div className="mountainArt">
                <div className="mountain mountainBack" />

                <div className="mountain mountainFront" />
              </div>
            </section>
          )}
        </aside>
      )}

      {showCalendar && (
        <section className="calendarPanel">
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

              {configError
                ? "Offline"
                : "Live"}
            </div>
          </header>

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
              (day) => (
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

          <div className="calendarGrid">
            {monthData.cells.map(
              (
                day,
                index
              ) => {
                const events =
                  day
                    ? sampleEvents.filter(
                        (
                          event
                        ) =>
                          event.date ===
                          day
                      )
                    : [];

                const isToday =
                  day ===
                  timezoneParts.day;

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

                        <div className="events">
                          {events.map(
                            (
                              event,
                              eventIndex
                            ) => {
                              const key =
                                `${event.title}-${eventIndex}`;

                              if (
                                event.type ===
                                "bar"
                              ) {
                                return (
                                  <div
                                    className="eventBar"
                                    key={
                                      key
                                    }
                                  >
                                    {
                                      event.title
                                    }
                                  </div>
                                );
                              }

                              return (
                                <div
                                  className="eventDot"
                                  key={
                                    key
                                  }
                                >
                                  <span className="dot" />

                                  <div>
                                    {event.time && (
                                      <span className="eventTime">
                                        {
                                          event.time
                                        }{" "}
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
                        </div>
                      </>
                    )}
                  </div>
                );
              }
            )}
          </div>

          <footer className="calendarFooter">
            <div className="calendarLegend">
              <span className="legendColor blue" />

              Family Calendar

              <span className="legendColor gray" />

              Shared Calendar
            </div>
          </footer>
        </section>
      )}
    </main>
  );
}