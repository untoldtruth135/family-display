import {
  NextRequest,
  NextResponse,
} from "next/server";

export const dynamic =
  "force-dynamic";

type WeatherDescription = {
  condition: string;
  icon: string;
};

async function fetchWithRetry(
  url: string,
  attempts = 3
) {
  let lastError:
    unknown = null;

  for (
    let attempt = 1;
    attempt <= attempts;
    attempt++
  ) {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => {
          controller.abort();
        },
        10_000
      );

    try {
      const response =
        await fetch(
          url,
          {
            cache:
              "no-store",

            signal:
              controller.signal,

            headers: {
              Accept:
                "application/json",
            },
          }
        );

      clearTimeout(
        timeout
      );

      /*
        Retry temporary
        upstream failures.
      */

      if (
        response.status >=
          500 &&
        attempt <
          attempts
      ) {
        await new Promise(
          (
            resolve
          ) =>
            setTimeout(
              resolve,
              500 *
                attempt
            )
        );

        continue;
      }

      return response;
    } catch (
      error
    ) {
      clearTimeout(
        timeout
      );

      lastError =
        error;

      if (
        attempt <
        attempts
      ) {
        await new Promise(
          (
            resolve
          ) =>
            setTimeout(
              resolve,
              500 *
                attempt
            )
        );

        continue;
      }
    }
  }

  if (
    lastError instanceof
    Error
  ) {
    throw new Error(
      `Weather provider connection failed after ${attempts} attempts: ${lastError.message}`
    );
  }

  throw new Error(
    `Weather provider connection failed after ${attempts} attempts.`
  );
}

function getWeatherDescription(
  code: number
): WeatherDescription {
  if (code === 0) {
    return {
      condition:
        "Clear",
      icon:
        "☀️",
    };
  }

  if (code === 1) {
    return {
      condition:
        "Mainly clear",
      icon:
        "🌤️",
    };
  }

  if (code === 2) {
    return {
      condition:
        "Partly cloudy",
      icon:
        "⛅",
    };
  }

  if (code === 3) {
    return {
      condition:
        "Overcast",
      icon:
        "☁️",
    };
  }

  if (
    code === 45 ||
    code === 48
  ) {
    return {
      condition:
        "Fog",
      icon:
        "🌫️",
    };
  }

  if (
    code === 51 ||
    code === 53 ||
    code === 55
  ) {
    return {
      condition:
        "Drizzle",
      icon:
        "🌦️",
    };
  }

  if (
    code === 56 ||
    code === 57
  ) {
    return {
      condition:
        "Freezing drizzle",
      icon:
        "🌧️",
    };
  }

  if (
    code === 61 ||
    code === 63 ||
    code === 65
  ) {
    return {
      condition:
        "Rain",
      icon:
        "🌧️",
    };
  }

  if (
    code === 66 ||
    code === 67
  ) {
    return {
      condition:
        "Freezing rain",
      icon:
        "🌧️",
    };
  }

  if (
    code === 71 ||
    code === 73 ||
    code === 75 ||
    code === 77
  ) {
    return {
      condition:
        "Snow",
      icon:
        "❄️",
    };
  }

  if (
    code === 80 ||
    code === 81 ||
    code === 82
  ) {
    return {
      condition:
        "Rain showers",
      icon:
        "🌦️",
    };
  }

  if (
    code === 85 ||
    code === 86
  ) {
    return {
      condition:
        "Snow showers",
      icon:
        "🌨️",
    };
  }

  if (
    code === 95 ||
    code === 96 ||
    code === 99
  ) {
    return {
      condition:
        "Thunderstorm",
      icon:
        "⛈️",
    };
  }

  return {
    condition:
      "Unknown",
    icon:
      "🌤️",
  };
}

export async function GET(
  request: NextRequest
) {
  try {
    const location =
      request.nextUrl
        .searchParams
        .get(
          "location"
        )
        ?.trim();

    if (!location) {
      return NextResponse.json(
        {
          error:
            "Location is required.",
        },
        {
          status: 400,
        }
      );
    }

    /*
      =======================================================
      GEOCODE LOCATION
      =======================================================
    */

    const geocodeUrl =
      new URL(
        "https://geocoding-api.open-meteo.com/v1/search"
      );

    geocodeUrl.searchParams.set(
      "name",
      location
    );

    geocodeUrl.searchParams.set(
      "count",
      "1"
    );

    geocodeUrl.searchParams.set(
      "language",
      "en"
    );

    geocodeUrl.searchParams.set(
      "format",
      "json"
    );

    const geocodeResponse =
      await fetchWithRetry(
        geocodeUrl.toString()
      );

    if (
      !geocodeResponse.ok
    ) {
      throw new Error(
        `Geocoding request failed with HTTP ${geocodeResponse.status}.`
      );
    }

    const geocodeData =
      await geocodeResponse.json();

    const place =
      geocodeData
        ?.results?.[0];

    if (!place) {
      return NextResponse.json(
        {
          error:
            `Unable to find weather location: ${location}`,
        },
        {
          status: 404,
        }
      );
    }

    /*
      =======================================================
      WEATHER FORECAST
      =======================================================
    */

    const forecastUrl =
      new URL(
        "https://api.open-meteo.com/v1/forecast"
      );

    forecastUrl.searchParams.set(
      "latitude",
      String(
        place.latitude
      )
    );

    forecastUrl.searchParams.set(
      "longitude",
      String(
        place.longitude
      )
    );

    forecastUrl.searchParams.set(
      "current",
      [
        "temperature_2m",
        "apparent_temperature",
        "weather_code",
      ].join(",")
    );

    forecastUrl.searchParams.set(
      "hourly",
      [
        "precipitation_probability",
      ].join(",")
    );

    forecastUrl.searchParams.set(
      "daily",
      [
        "weather_code",
        "temperature_2m_max",
        "temperature_2m_min",
      ].join(",")
    );

    forecastUrl.searchParams.set(
      "temperature_unit",
      "fahrenheit"
    );

    forecastUrl.searchParams.set(
      "timezone",
      "auto"
    );

    forecastUrl.searchParams.set(
      "forecast_days",
      "5"
    );

    const forecastResponse =
      await fetchWithRetry(
        forecastUrl.toString()
      );

    if (
      !forecastResponse.ok
    ) {
      throw new Error(
        `Forecast request failed with HTTP ${forecastResponse.status}.`
      );
    }

    const forecastData =
      await forecastResponse.json();

    /*
      =======================================================
      CURRENT WEATHER
      =======================================================
    */

    const currentCode =
      Number(
        forecastData
          ?.current
          ?.weather_code ??
          0
      );

    const currentDescription =
      getWeatherDescription(
        currentCode
      );

    /*
      Match the hourly precipitation probability
      to the current local forecast hour.
    */

    const currentTime =
      String(
        forecastData
          ?.current
          ?.time ??
          ""
      );

    const currentHourKey =
      currentTime.slice(
        0,
        13
      );

    const hourlyTimes:
      string[] =
      forecastData
        ?.hourly
        ?.time ??
      [];

    const hourlyPrecipitation:
      number[] =
      forecastData
        ?.hourly
        ?.precipitation_probability ??
      [];

    const currentHourIndex =
      hourlyTimes.findIndex(
        (
          time
        ) =>
          String(
            time
          ).slice(
            0,
            13
          ) ===
          currentHourKey
      );

    const precipitationProbability =
      currentHourIndex >=
        0
        ? Math.round(
            Number(
              hourlyPrecipitation[
                currentHourIndex
              ] ??
                0
            )
          )
        : 0;


    const current = {
      temperature:
        Math.round(
          Number(
            forecastData
              ?.current
              ?.temperature_2m ??
              0
          )
        ),

      feelsLike:
        Math.round(
          Number(
            forecastData
              ?.current
              ?.apparent_temperature ??
              forecastData
                ?.current
                ?.temperature_2m ??
              0
          )
        ),

      precipitationProbability,

      weatherCode:
        currentCode,

      condition:
        currentDescription
          .condition,

      icon:
        currentDescription
          .icon,
    };

    /*
      =======================================================
      DAILY FORECAST
      =======================================================
    */

    const dates:
      string[] =
      forecastData
        ?.daily
        ?.time ??
      [];

    const weatherCodes:
      number[] =
      forecastData
        ?.daily
        ?.weather_code ??
      [];

    const highs:
      number[] =
      forecastData
        ?.daily
        ?.temperature_2m_max ??
      [];

    const lows:
      number[] =
      forecastData
        ?.daily
        ?.temperature_2m_min ??
      [];

    const daily =
      dates.map(
        (
          date,
          index
        ) => {
          const code =
            Number(
              weatherCodes[
                index
              ] ??
                0
            );

          const description =
            getWeatherDescription(
              code
            );

          return {
            date,

            weatherCode:
              code,

            condition:
              description
                .condition,

            icon:
              description
                .icon,

            high:
              Math.round(
                Number(
                  highs[
                    index
                  ] ??
                    0
                )
              ),

            low:
              Math.round(
                Number(
                  lows[
                    index
                  ] ??
                    0
                )
              ),
          };
        }
      );

    /*
      =======================================================
      RESPONSE
      =======================================================
    */

    return NextResponse.json(
      {
        location: {
          name:
            place.name,

          admin1:
            place.admin1 ??
            "",

          country:
            place.country ??
            "",

          latitude:
            place.latitude,

          longitude:
            place.longitude,

          timezone:
            place.timezone ??
            forecastData
              .timezone,
        },

        current,

        daily,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error(
      "Weather API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "Unable to load weather.",
      },
      {
        status: 500,
      }
    );
  }
}