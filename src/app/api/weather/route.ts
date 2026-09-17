import { NextRequest, NextResponse } from "next/server";

type GeocodingResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  feature_code?: string;
  country_code?: string;
  admin1?: string;
  country?: string;
  timezone?: string;
  population?: number;
};

type GeocodingResponse = {
  results?: GeocodingResult[];
};

type CurrentWeather = {
  time: string;
  interval: number;
  temperature_2m: number;
  weather_code: number;
};

type DailyWeather = {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
};

type ForecastResponse = {
  latitude: number;
  longitude: number;
  timezone: string;

  current: CurrentWeather;

  daily: DailyWeather;
};

type WeatherDescription = {
  condition: string;
  icon: string;
};

function describeWeather(
  code: number
): WeatherDescription {
  switch (code) {
    case 0:
      return {
        condition: "Clear",
        icon: "☀️",
      };

    case 1:
      return {
        condition: "Mostly clear",
        icon: "🌤️",
      };

    case 2:
      return {
        condition: "Partly cloudy",
        icon: "⛅",
      };

    case 3:
      return {
        condition: "Overcast",
        icon: "☁️",
      };

    case 45:
    case 48:
      return {
        condition: "Foggy",
        icon: "🌫️",
      };

    case 51:
    case 53:
    case 55:
    case 56:
    case 57:
      return {
        condition: "Drizzle",
        icon: "🌦️",
      };

    case 61:
    case 63:
    case 65:
    case 66:
    case 67:
      return {
        condition: "Rain",
        icon: "🌧️",
      };

    case 71:
    case 73:
    case 75:
    case 77:
      return {
        condition: "Snow",
        icon: "🌨️",
      };

    case 80:
    case 81:
    case 82:
      return {
        condition: "Rain showers",
        icon: "🌦️",
      };

    case 85:
    case 86:
      return {
        condition: "Snow showers",
        icon: "🌨️",
      };

    case 95:
    case 96:
    case 99:
      return {
        condition: "Thunderstorms",
        icon: "⛈️",
      };

    default:
      return {
        condition: "Unknown",
        icon: "☁️",
      };
  }
}

export async function GET(
  request: NextRequest
) {
  try {
    /*
      Example:

      /api/weather?location=Lynden%2C%20Washington
    */

    const location =
      request.nextUrl.searchParams
        .get("location")
        ?.trim();

    if (!location) {
      return NextResponse.json(
        {
          error:
            "Location is required",
        },
        {
          status: 400,
        }
      );
    }

    /*
      ----------------------------------------
      STEP 1
      Convert location name to coordinates
      ----------------------------------------
    */

    const geocodingUrl =
      new URL(
        "https://geocoding-api.open-meteo.com/v1/search"
      );

    geocodingUrl.searchParams.set(
      "name",
      location
    );

    geocodingUrl.searchParams.set(
      "count",
      "1"
    );

    geocodingUrl.searchParams.set(
      "language",
      "en"
    );

    geocodingUrl.searchParams.set(
      "format",
      "json"
    );

    const geoResponse =
      await fetch(
        geocodingUrl.toString(),
        {
          cache: "no-store",
        }
      );

    if (!geoResponse.ok) {
      throw new Error(
        `Geocoding request failed: ${geoResponse.status}`
      );
    }

    const geoData =
      (await geoResponse.json()) as GeocodingResponse;

    const place =
      geoData.results?.[0];

    if (!place) {
      return NextResponse.json(
        {
          error:
            `Location "${location}" was not found`,
        },
        {
          status: 404,
        }
      );
    }

    /*
      ----------------------------------------
      STEP 2
      Request current weather + 5-day forecast
      ----------------------------------------
    */

    const forecastUrl =
      new URL(
        "https://api.open-meteo.com/v1/forecast"
      );

    forecastUrl.searchParams.set(
      "latitude",
      place.latitude.toString()
    );

    forecastUrl.searchParams.set(
      "longitude",
      place.longitude.toString()
    );

    forecastUrl.searchParams.set(
      "current",
      [
        "temperature_2m",
        "weather_code",
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

    /*
      Display Fahrenheit for now.

      Later we'll use the user's
      temperature_unit setting from Supabase.
    */

    forecastUrl.searchParams.set(
      "temperature_unit",
      "fahrenheit"
    );

    /*
      Open-Meteo determines the correct
      timezone from the requested location.
    */

    forecastUrl.searchParams.set(
      "timezone",
      "auto"
    );

    forecastUrl.searchParams.set(
      "forecast_days",
      "5"
    );

    const weatherResponse =
      await fetch(
        forecastUrl.toString(),
        {
          cache: "no-store",
        }
      );

    if (!weatherResponse.ok) {
      throw new Error(
        `Weather request failed: ${weatherResponse.status}`
      );
    }

    const weather =
      (await weatherResponse.json()) as ForecastResponse;

    /*
      Basic validation before trying
      to render the data.
    */

    if (
      !weather.current ||
      !weather.daily ||
      !Array.isArray(
        weather.daily.time
      )
    ) {
      throw new Error(
        "Weather response did not contain the expected data."
      );
    }

    /*
      ----------------------------------------
      STEP 3
      Convert WMO weather codes into
      readable descriptions and icons
      ----------------------------------------
    */

    const currentDescription =
      describeWeather(
        weather.current.weather_code
      );

    const daily =
      weather.daily.time.map(
        (
          date: string,
          index: number
        ) => {
          const code =
            weather.daily
              .weather_code[index];

          const description =
            describeWeather(code);

          return {
            date,

            weatherCode:
              code,

            condition:
              description.condition,

            icon:
              description.icon,

            high:
              Math.round(
                weather.daily
                  .temperature_2m_max[
                  index
                ]
              ),

            low:
              Math.round(
                weather.daily
                  .temperature_2m_min[
                  index
                ]
              ),
          };
        }
      );

    /*
      Create a user-friendly location name.

      Example:
      Lynden, Washington
    */

    const resolvedLocation =
      [
        place.name,
        place.admin1,
      ]
        .filter(Boolean)
        .join(", ");

    /*
      ----------------------------------------
      STEP 4
      Return a simplified weather object
      to WeatherPanels.tsx
      ----------------------------------------
    */

    return NextResponse.json(
      {
        location:
          resolvedLocation,

        latitude:
          place.latitude,

        longitude:
          place.longitude,

        timezone:
          weather.timezone,

        current: {
          temperature:
            Math.round(
              weather.current
                .temperature_2m
            ),

          weatherCode:
            weather.current
              .weather_code,

          condition:
            currentDescription
              .condition,

          icon:
            currentDescription
              .icon,
        },

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
          error instanceof Error
            ? error.message
            : "Unable to load weather data",
      },
      {
        status: 500,
      }
    );
  }
}