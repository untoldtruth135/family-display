"use client";

import { useEffect, useMemo, useState } from "react";
import WeatherPanels from "@/components/WeatherPanels";

type CalendarEvent = {
  date: number;
  title: string;
  time?: string;
  type?: "bar" | "dot";
};

const sampleEvents: CalendarEvent[] = [
  { date: 1, title: "First day of school", type: "bar" },
  { date: 3, title: "Trash Day", type: "bar" },
  {
    date: 3,
    title: "Kami violin lesson",
    time: "2:45 PM",
    type: "dot",
  },
  { date: 5, title: "LHS play auditions", type: "bar" },
  { date: 7, title: "No school - Labor Day", type: "bar" },
  { date: 10, title: "Trash Day", type: "bar" },
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
  { date: 18, title: "Daddy - Training", type: "bar" },
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
  { date: 24, title: "Trash Day", type: "bar" },
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

export default function Home() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const monthData = useMemo(() => {
    const year = now.getFullYear();
    const month = now.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const cells: Array<number | null> = [];

    for (let i = 0; i < firstDay.getDay(); i++) {
      cells.push(null);
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      cells.push(day);
    }

    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    return {
      monthName: now.toLocaleDateString("en-US", {
        month: "long",
      }),
      year,
      cells,
    };
  }, [now]);

 const timeParts = now
  .toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
  .match(/^(.+)\s(AM|PM)$/);

const formattedTime = timeParts?.[1] ?? "";
const meridiem = timeParts?.[2] ?? "";

  const formattedDate = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const today = now.getDate();

  return (
    <main className="dashboard">
      <aside className="sidebar">
        <section className="card clockCard">
          <div className="greeting">
            {getGreeting(now.getHours())}
          </div>

          <div className="clock">
  <span className="clockTime">{formattedTime}</span>
  <span className="meridiem">{meridiem}</span>
</div>

          <div className="date">
            {formattedDate}
          </div>
        </section>

        <WeatherPanels location="Lynden, Washington" />

        <section className="card messageCard">
          <div className="messageText">
            Good will steer,
            <br />
            but you must row.
          </div>

          <div className="mountainArt">
            <div className="mountain mountainBack" />
            <div className="mountain mountainFront" />
          </div>
        </section>
      </aside>

      <section className="calendarPanel">
        <header className="calendarHeader">
          <div>
            <div className="calendarTitle">
              {monthData.monthName} {monthData.year}
            </div>

            <div className="calendarSubtitle">
              Family Calendar
            </div>
          </div>

          <div className="headerActions">
            <span className="liveDot" />
            Live
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
          ].map((day) => (
            <div key={day}>
              {day}
            </div>
          ))}
        </div>

        <div className="calendarGrid">
          {monthData.cells.map((day, index) => {
            const events = day
              ? sampleEvents.filter(
                  (event) => event.date === day
                )
              : [];

            const isToday = day === today;

            return (
              <div
                key={`${day ?? "blank"}-${index}`}
                className={`calendarCell ${
                  isToday ? "todayCell" : ""
                }`}
              >
                {day !== null && (
                  <>
                    <div
                      className={`dayNumber ${
                        isToday ? "todayNumber" : ""
                      }`}
                    >
                      {day}
                    </div>

                    <div className="events">
                      {events.map(
                        (event, eventIndex) => {
                          const eventKey = `${event.title}-${eventIndex}`;

                          if (event.type === "bar") {
                            return (
                              <div
                                className="eventBar"
                                key={eventKey}
                              >
                                {event.title}
                              </div>
                            );
                          }

                          return (
                            <div
                              className="eventDot"
                              key={eventKey}
                            >
                              <span className="dot" />

                              <div>
                                {event.time && (
                                  <span className="eventTime">
                                    {event.time}{" "}
                                  </span>
                                )}

                                {event.title}
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
          })}
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
    </main>
  );
}