"use client";

import { WEATHER_REFRESH_MS, WEATHER_MAX_AGE_MS, WEATHER_OUTAGE_MS,
  observationAge, validWeatherSnapshot, weatherRefreshDelay, fetchWeatherSnapshot } from "@/lib/weather-cache";

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
  observedAt: string;
  fetchedAt: string;
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

  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (paused || (!showWeather && !showForecast)) return;
    let cancelled = false;
    let inFlight = false;
    let timer: number | undefined;
    let retryDelay = 60_000;
    let lastSuccess = 0;
    const controller = new AbortController();
    setWeather(null);
    setLoading(true);
    setError("");
    const cleanedLocation = location?.trim() ?? "";
    const cacheKey = `family-display:weather:${cleanedLocation.toLowerCase()}`;
    if (!cleanedLocation) {
      setError("Weather location is not configured.");
      setLoading(false);
      return;
    }

    function restore() {
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) ?? "null");
        if (!validWeatherSnapshot(cached?.data) ||
            observationAge(cached.data.observedAt) > WEATHER_OUTAGE_MS) return false;
        lastSuccess = Number(cached.savedAt) || 0;
        setWeather(cached.data as WeatherResponse);
        setLoading(false);
        return true;
      } catch { return false; }
    }

    function schedule(delay: number) {
      if (cancelled) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(loadWeather, delay);
    }

    async function loadWeather() {
      if (cancelled || inFlight) return;
      inFlight = true;
      window.clearTimeout(timer);
      let delay = retryDelay;
      try {
        const data = await fetchWeatherSnapshot(
          `/api/weather?location=${encodeURIComponent(cleanedLocation)}`, controller.signal
        );
        if (cancelled) return;
        lastSuccess = Date.now();
        setNow(lastSuccess);
        setWeather(data as WeatherResponse);
        setError("");
        try { localStorage.setItem(cacheKey, JSON.stringify({ savedAt: lastSuccess, data })); } catch {}
        retryDelay = 60_000;
        delay = WEATHER_REFRESH_MS;
      } catch (error) {
        if (cancelled) return;
        setError(error instanceof Error ? error.message : "Weather refresh failed.");
        setNow(Date.now());
        // Retain a bounded, visibly labelled last-known reading; never make it fresh.
        restore();
        delay = retryDelay;
        retryDelay = Math.min(retryDelay * 2, WEATHER_REFRESH_MS);
      } finally {
        inFlight = false;
        if (!cancelled) {
          setLoading(false);
          schedule(delay);
        }
      }
    }

    const restored = restore();
    const remaining = restored ? weatherRefreshDelay(lastSuccess) : 0;
    // A restored observation older than the current-data bound is retried immediately.
    let cachedCurrent = false;
    try {
      const raw = JSON.parse(localStorage.getItem(cacheKey) ?? "null");
      cachedCurrent = observationAge(raw?.data?.observedAt) <= WEATHER_MAX_AGE_MS;
    } catch {}
    if (remaining > 0 && cachedCurrent) schedule(remaining);
    else void loadWeather();

    function refreshAfterRecovery() {
      if (!cancelled) void loadWeather();
    }
    function refreshAfterFocus() {
      if (weatherRefreshDelay(lastSuccess) === 0) refreshAfterRecovery();
    }
    window.addEventListener("online", refreshAfterRecovery);
    window.addEventListener("focus", refreshAfterFocus);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
      window.removeEventListener("online", refreshAfterRecovery);
      window.removeEventListener("focus", refreshAfterFocus);
    };
  }, [location, paused, showWeather, showForecast]);

  const expired = !weather || observationAge(weather.observedAt, now) > WEATHER_OUTAGE_MS;
  const delayed = !!error || (!!weather && observationAge(weather.observedAt, now) > WEATHER_MAX_AGE_MS);
  const observedTime = weather && !expired
    ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit",
        timeZone: weather.location.timezone || "America/Los_Angeles" }).format(new Date(weather.observedAt))
    : "";

  if (
    !showWeather &&
    !showForecast
  ) {
    return null;
  }

  if (
    loading &&
    expired
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

  if (expired) {
    return (
      <>
        {showWeather && (
          <section className="card weatherCard">
            <div className="weatherUnavailable">
              <strong>
                Weather unavailable
              </strong>

              <span>
                {error || "Weather reading expired. Retrying…"}
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

  if (!weather || expired) {
    return null;
  }

  return (
    <>
      {showWeather && (
        <section className="card weatherCard">
          <div className="currentWeather">
            <div className="weatherIcon" aria-label={delayed ? "Last known weather" : "Current weather"}>
              <span className="weatherSymbol">
              {
                weather
                  .current
                  .icon
              }
              </span>
              <small className={`weatherFreshness ${delayed ? "weatherFreshnessDelayed" : ""}`} role="status">
                <span>{delayed ? "Last known" : "As of"}</span>
                <span>{observedTime}</span>
              </small>
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
