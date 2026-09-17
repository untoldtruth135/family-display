"use client";

import {
  useEffect,
  useState,
} from "react";

type CurrentWeather = {
  temperature: number;
  weatherCode: number;
  condition: string;
  icon: string;
};

type DailyWeather = {
  date: string;
  weatherCode: number;
  condition: string;
  icon: string;
  high: number;
  low: number;
};

type WeatherResponse = {
  location: {
    name: string;
    admin1: string;
    country: string;
    latitude: number;
    longitude: number;
    timezone: string;
  };

  current: CurrentWeather;

  daily: DailyWeather[];
};

type Props = {
  location: string;
  showWeather?: boolean;
  showForecast?: boolean;
};

function getDayLabel(
  dateString: string,
  index: number
) {
  if (index === 0) {
    return "TODAY";
  }

  const date =
    new Date(
      `${dateString}T12:00:00`
    );

  return new Intl.DateTimeFormat(
    "en-US",
    {
      weekday: "short",
    }
  )
    .format(date)
    .toUpperCase();
}

export default function WeatherPanels({
  location,
  showWeather = true,
  showForecast = true,
}: Props) {
  const [
    weather,
    setWeather,
  ] =
    useState<
      WeatherResponse | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  useEffect(() => {
    let cancelled =
      false;

    async function loadWeather() {
      if (
        !location ||
        !location.trim()
      ) {
        if (!cancelled) {
          setError(
            "Weather location is not configured."
          );

          setLoading(
            false
          );
        }

        return;
      }

      try {
        const response =
          await fetch(
            `/api/weather?location=${encodeURIComponent(
              location.trim()
            )}`,
            {
              cache:
                "no-store",
            }
          );

        /*
          Read the response body even
          when the status is an error.
          This lets us see the actual
          API error instead of only
          "Weather request failed".
        */

        const data =
          await response
            .json()
            .catch(
              () => null
            );

        if (
          !response.ok
        ) {
          const message =
            data?.error ??
            `Weather request failed with HTTP ${response.status}.`;

          throw new Error(
            message
          );
        }

        if (
          !data?.current ||
          !Array.isArray(
            data?.daily
          )
        ) {
          throw new Error(
            "Weather API returned an unexpected response."
          );
        }

        if (cancelled) {
          return;
        }

        setWeather(
          data as WeatherResponse
        );

        setError("");
        setLoading(
          false
        );
      } catch (
        requestError
      ) {
        console.error(
          "Weather request error:",
          requestError
        );

        if (cancelled) {
          return;
        }

        /*
          If we already have weather
          loaded, keep displaying it
          instead of blanking the card
          because of one temporary
          request failure.
        */

        if (!weather) {
          setError(
            requestError instanceof
              Error
              ? requestError.message
              : "Weather unavailable."
          );
        }

        setLoading(
          false
        );
      }
    }

    loadWeather();

    /*
      Refresh every 15 minutes.
    */

    const timer =
      window.setInterval(
        loadWeather,
        15 * 60 * 1000
      );

    return () => {
      cancelled =
        true;

      window.clearInterval(
        timer
      );
    };
  }, [location]);

  if (
    !showWeather &&
    !showForecast
  ) {
    return null;
  }

  if (
    loading &&
    !weather
  ) {
    return (
      <>
        {showWeather && (
          <section className="card weatherCard">
            <div className="weatherLoading">
              Loading weather...
            </div>
          </section>
        )}

        {showForecast && (
          <section className="card forecastCard">
            <div className="weatherLoading">
              Loading forecast...
            </div>
          </section>
        )}
      </>
    );
  }

  if (
    error &&
    !weather
  ) {
    return (
      <>
        {showWeather && (
          <section className="card weatherCard">
            <div className="weatherUnavailable">
              <strong>
                Weather unavailable
              </strong>

              <span>
                {error}
              </span>
            </div>
          </section>
        )}

        {showForecast && (
          <section className="card forecastCard">
            <div className="weatherUnavailable">
              Forecast unavailable
            </div>
          </section>
        )}
      </>
    );
  }

  if (!weather) {
    return null;
  }

  return (
    <>
      {showWeather && (
        <section className="card weatherCard">
          <div className="currentWeather">
            <div className="weatherIcon">
              {
                weather
                  .current
                  .icon
              }
            </div>

            <div className="weatherDetails">
              <div className="temperature">
                {
                  weather
                    .current
                    .temperature
                }
                °
              </div>

              <div className="condition">
                {
                  weather
                    .current
                    .condition
                }
              </div>

              <div className="weatherLocation">
                {
                  weather
                    .location
                    .name
                }
                {weather
                  .location
                  .admin1
                  ? `, ${weather.location.admin1}`
                  : ""}
              </div>
            </div>
          </div>
        </section>
      )}

      {showForecast && (
        <section className="card forecastCard">
          <div className="forecastDays">
            {weather.daily.map(
              (
                day,
                index
              ) => (
                <div
                  className="forecastDay"
                  key={
                    day.date
                  }
                >
                  <div className="forecastDayName">
                    {getDayLabel(
                      day.date,
                      index
                    )}
                  </div>

                  <div className="forecastIcon">
                    {
                      day.icon
                    }
                  </div>

                  <div className="forecastTemps">
                    <span className="forecastHigh">
                      {
                        day.high
                      }
                      °
                    </span>

                    <span className="forecastLow">
                      {
                        day.low
                      }
                      °
                    </span>
                  </div>
                </div>
              )
            )}
          </div>
        </section>
      )}
    </>
  );
}