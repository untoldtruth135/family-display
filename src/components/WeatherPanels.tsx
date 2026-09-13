"use client";

import { useEffect, useState } from "react";

type WeatherData = {
  location: string;
  timezone: string;
  current: {
    temperature: number;
    condition: string;
    icon: string;
  };
  daily: {
    date: string;
    high: number;
    low: number;
    condition: string;
    icon: string;
  }[];
};

export default function WeatherPanels({
  location,
}: {
  location: string;
}) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function loadWeather() {
      try {
        const response = await fetch(
          `/api/weather?location=${encodeURIComponent(location)}`
        );

        if (!response.ok) {
          throw new Error("Weather request failed");
        }

        const data = await response.json();
        setWeather(data);
        setError(false);
      } catch (err) {
        console.error(err);
        setError(true);
      }
    }

    loadWeather();

    const timer = setInterval(loadWeather, 15 * 60 * 1000);

    return () => clearInterval(timer);
  }, [location]);

  if (error) {
    return (
      <>
        <section className="card weatherCard">
          <div className="condition">Weather unavailable</div>
        </section>

        <section className="card forecastCard">
          <div className="condition">Unable to load forecast</div>
        </section>
      </>
    );
  }

  if (!weather) {
    return (
      <>
        <section className="card weatherCard">
          <div className="condition">Loading weather...</div>
        </section>

        <section className="card forecastCard">
          <div className="condition">Loading forecast...</div>
        </section>
      </>
    );
  }

  const today = weather.daily[0];

  return (
    <>
      <section className="card weatherCard">
        <div className="condition">{weather.current.condition}</div>

        <div className="weatherMain">
          <span className="weatherIcon">{weather.current.icon}</span>
          <span className="temperature">
            {weather.current.temperature}°
          </span>
        </div>

        <div className="weatherRange">
          <span>H: {today.high}°</span>
          <span>L: {today.low}°</span>
        </div>
      </section>

      <section className="card forecastCard">
        <div className="forecastGrid">
          {weather.daily.map((item, index) => {
            const date = new Date(`${item.date}T12:00:00`);

            const day =
              index === 0
                ? "Today"
                : date.toLocaleDateString("en-US", {
                    weekday: "short",
                  });

            return (
              <div className="forecastDay" key={item.date}>
                <div className="forecastLabel">{day}</div>
                <div className="forecastIcon">{item.icon}</div>
                <div className="forecastHigh">{item.high}°</div>
                <div className="forecastLow">{item.low}°</div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}