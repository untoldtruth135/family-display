"use client";

import {
  useEffect,
  useState,
} from "react";

type CurrentWeather = {
  temperature: number;

  /*
    Optional so an older cached response
    remains safe during an upgrade.
  */
  feelsLike?: number;
  precipitationProbability?: number;

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
  paused?: boolean;
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
  paused = false,
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
    if (paused) {
      return;
    }

    let cancelled =
      false;

    let timer:
      number | undefined;

    const normalDelay =
      120 *
      60 *
      1000;

    const maxFailureDelay =
      120 *
      60 *
      1000;

    let failureDelay =
      5 *
      60 *
      1000;

    const cleanedLocation =
      location?.trim() ??
      "";

    if (!cleanedLocation) {
      setError(
        "Weather location is not configured."
      );

      setLoading(
        false
      );

      return;
    }

    const cacheKey =
      `family-display:weather:${cleanedLocation.toLowerCase()}`;

    /*
      Weather is public data, so it is
      safe to keep the last successful
      result in localStorage.

      Cached weather may be used for up
      to 12 hours during an outage.
    */

    function restoreCachedWeather() {
      try {
        const raw =
          localStorage.getItem(
            cacheKey
          );

        if (!raw) {
          return false;
        }

        const cached =
          JSON.parse(raw);

        const savedAt =
          Number(
            cached?.savedAt
          );

        if (
          !savedAt ||
          Date.now() -
            savedAt >
            12 *
              60 *
              60 *
              1000
        ) {
          return false;
        }

        if (
          !cached?.data
            ?.current ||
          !Array.isArray(
            cached?.data
              ?.daily
          )
        ) {
          return false;
        }

        setWeather(
          cached.data as
            WeatherResponse
        );

        setLoading(
          false
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
          loadWeather,
          delay
        );
    }

    async function loadWeather() {
      try {
        const response =
          await fetch(
            `/api/weather?location=${encodeURIComponent(
              cleanedLocation
            )}`,
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
          data as
            WeatherResponse
        );

        try {
          localStorage.setItem(
            cacheKey,
            JSON.stringify({
              savedAt:
                Date.now(),

              data,
            })
          );
        } catch {
          // Cache failures are harmless.
        }

        setError("");

        setLoading(
          false
        );

        failureDelay =
          5 *
          60 *
          1000;

        scheduleNext(
          normalDelay
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

        const restored =
          restoreCachedWeather();

        if (!restored) {
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

    /*
      Show cached weather immediately
      if available while current weather
      is being retrieved.
    */

    restoreCachedWeather();

    loadWeather();

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
    location,
    paused,
  ]);

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

              {(
                Number.isFinite(
                  weather
                    .current
                    .feelsLike
                ) ||
                Number.isFinite(
                  weather
                    .current
                    .precipitationProbability
                )
              ) && (
                <div className="weatherMeta">
                  {Number.isFinite(
                    weather
                      .current
                      .feelsLike
                  ) && (
                    <span>
                      Feels{" "}
                      {
                        weather
                          .current
                          .feelsLike
                      }
                      °
                    </span>
                  )}

                  {Number.isFinite(
                    weather
                      .current
                      .precipitationProbability
                  ) && (
                    <span>
                      Rain{" "}
                      {
                        weather
                          .current
                          .precipitationProbability
                      }
                      %
                    </span>
                  )}
                </div>
              )}

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