"use client";

import {
  useEffect,
  useState,
} from "react";

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

type Props = {
  location: string;

  showWeather?: boolean;

  showForecast?: boolean;
};

export default function WeatherPanels({
  location,
  showWeather = true,
  showForecast = true,
}: Props) {
  const [
    weather,
    setWeather,
  ] =
    useState<WeatherData | null>(
      null
    );

  const [
    error,
    setError,
  ] =
    useState(false);

  useEffect(() => {
    if (
      !showWeather &&
      !showForecast
    ) {
      return;
    }

    async function loadWeather() {
      try {
        const response =
          await fetch(
            `/api/weather?location=${encodeURIComponent(
              location
            )}`,
            {
              cache:
                "no-store",
            }
          );

        if (
          !response.ok
        ) {
          throw new Error(
            "Weather request failed"
          );
        }

        const data =
          await response.json();

        setWeather(
          data
        );

        setError(
          false
        );
      } catch (
        err
      ) {
        console.error(
          err
        );

        setError(
          true
        );
      }
    }

    loadWeather();

    const timer =
      setInterval(
        loadWeather,
        15 *
          60 *
          1000
      );

    return () =>
      clearInterval(
        timer
      );
  }, [
    location,
    showWeather,
    showForecast,
  ]);

  if (
    !showWeather &&
    !showForecast
  ) {
    return null;
  }

  if (error) {
    return (
      <>
        {showWeather && (
          <section className="card weatherCard">
            <div className="condition">
              Weather unavailable
            </div>
          </section>
        )}

        {showForecast && (
          <section className="card forecastCard">
            <div className="condition">
              Forecast unavailable
            </div>
          </section>
        )}
      </>
    );
  }

  if (!weather) {
    return (
      <>
        {showWeather && (
          <section className="card weatherCard">
            <div className="condition">
              Loading weather...
            </div>
          </section>
        )}

        {showForecast && (
          <section className="card forecastCard">
            <div className="condition">
              Loading forecast...
            </div>
          </section>
        )}
      </>
    );
  }

  const today =
    weather.daily[0];

  return (
    <>
      {showWeather && (
        <section className="card weatherCard">
          <div className="condition">
            {
              weather
                .current
                .condition
            }
          </div>

          <div className="weatherMain">
            <span className="weatherIcon">
              {
                weather
                  .current
                  .icon
              }
            </span>

            <span className="temperature">
              {
                weather
                  .current
                  .temperature
              }
              °
            </span>
          </div>

          <div className="weatherRange">
            <span>
              H:{" "}
              {
                today
                  .high
              }
              °
            </span>

            <span>
              L:{" "}
              {
                today
                  .low
              }
              °
            </span>
          </div>
        </section>
      )}

      {showForecast && (
        <section className="card forecastCard">
          <div className="forecastGrid">
            {weather.daily.map(
              (
                item,
                itemIndex
              ) => {
                const date =
                  new Date(
                    `${item.date}T12:00:00`
                  );

                const day =
                  itemIndex ===
                  0
                    ? "Today"
                    : date.toLocaleDateString(
                        "en-US",
                        {
                          weekday:
                            "short",
                        }
                      );

                return (
                  <div
                    className="forecastDay"
                    key={
                      item.date
                    }
                  >
                    <div className="forecastLabel">
                      {
                        day
                      }
                    </div>

                    <div className="forecastIcon">
                      {
                        item.icon
                      }
                    </div>

                    <div className="forecastHigh">
                      {
                        item.high
                      }
                      °
                    </div>

                    <div className="forecastLow">
                      {
                        item.low
                      }
                      °
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </section>
      )}
    </>
  );
}