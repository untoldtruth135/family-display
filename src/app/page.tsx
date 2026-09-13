"use client";

import { useEffect, useMemo, useState } from "react";

type CalendarEvent = {
  date: number;
  title: string;
  time?: string;
  type?: "bar" | "dot";
};

const sampleEvents: CalendarEvent[] = [
  { date: 1, title: "First day of school", type: "bar" },
  { date: 3, title: "Trash Day", type: "bar" },
  { date: 3, title: "Kami violin lesson", time: "2:45 PM", type: "dot" },
  { date: 5, title: "LHS play auditions", type: "bar" },
  { date: 7, title: "No school - Labor Day", type: "bar" },
  { date: 10, title: "Trash Day", type: "bar" },
  { date: 10, title: "Kami violin lesson", time: "2:45 PM", type: "dot" },
  { date: 12, title: "Whiskey walk", time: "4:00 PM", type: "dot" },
  { date: 15, title: "NCY", time: "6:15 PM", type: "dot" },
  { date: 17, title: "Beth's birthday", time: "12:00 PM", type: "dot" },
  { date: 18, title: "Daddy - Training", type: "bar" },
  { date: 22, title: "NCY", time: "6:15 PM", type: "dot" },
  { date: 23, title: "Ortho", time: "9:00 AM", type: "dot" },
  { date: 24, title: "Trash Day", type: "bar" },
  { date: 24, title: "Kami violin lesson", time: "2:45 PM", type: "dot" },
];

const forecast = [
  { day: "Today", icon: "☁️", high: 68, low: 55 },
  { day: "Mon", icon: "🌤️", high: 77, low: 51 },
  { day: "Tue", icon: "🌤️", high: 71, low: 51 },
  { day: "Wed", icon: "☁️", high: 64, low: 55 },
  { day: "Thu", icon: "☁️", high: 60, low: 51 },
];

function getGreeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const monthData = useMemo(() => {
    const year = now.getFullYear();
    const month = now.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const cells: (number | null)[] = [];

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
      monthName: now.toLocaleDateString("en-US", { month: "long" }),
      year,
      cells,
    };
  }, [now]);

  const formattedTime = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

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
          <div className="greeting">{getGreeting(now.getHours())}</div>
          <div className="clock">{formattedTime}</div>
          <div className="date">{formattedDate}</div>
        </section>

        <section className="card weatherCard">
          <div className="condition">Mostly cloudy</div>

          <div className="weatherMain">
            <span className="weatherIcon">☁️</span>
            <span className="temperature">64°</span>
          </div>

          <div className="weatherRange">
            <span>H: 68°</span>
            <span>L: 55°</span>
          </div>
        </section>

        <section className="card forecastCard">
          <div className="forecastGrid">
            {forecast.map((item) => (
              <div className="forecastDay" key={item.day}>
                <div className="forecastLabel">{item.day}</div>
                <div className="forecastIcon">{item.icon}</div>
                <div className="forecastHigh">{item.high}°</div>
                <div className="forecastLow">{item.low}°</div>
              </div>
            ))}
          </div>
        </section>

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
            <div className="calendarSubtitle">Family Calendar</div>
          </div>

          <div className="headerActions">
            <span className="liveDot" />
            Live
          </div>
        </header>

        <div className="weekdayRow">
          {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        <div className="calendarGrid">
          {monthData.cells.map((day, index) => {
            const events = day
              ? sampleEvents.filter((event) => event.date === day)
              : [];

            return (
              <div
                className={`calendarCell ${
                  day === today ? "todayCell" : ""
                }`}
                key={`${day}-${index}`}
              >
                {day && (
                  <>
                    <div
                      className={`dayNumber ${
                        day === today ? "todayNumber" : ""
                      }`}
                    >
                      {day}
                    </div>

                    <div className="events">
                      {events.map((event, eventIndex) =>
                        event.type === "bar" ? (
                          <div
                            className="eventBar"
                            key={`${event.title}-${eventIndex}`}
                          >
                            {event.title}
                          </div>
                        ) : (
                          <div
                            className="eventDot"
                            key={`${event.title}-${eventIndex}`}
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
                        )
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
