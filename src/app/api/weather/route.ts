import { NextRequest, NextResponse } from "next/server";

function describeWeather(code: number) {
  if (code === 0) return { condition: "Clear", icon: "☀️" };
  if ([1, 2].includes(code)) return { condition: "Partly cloudy", icon: "🌤️" };
  if (code === 3) return { condition: "Overcast", icon: "☁️" };
  if ([45, 48].includes(code)) return { condition: "Foggy", icon: "🌫️" };
  if (code >= 51 && code <= 57)
    return { condition: "Drizzle", icon: "🌦️" };
  if (code >= 61 && code <= 67)
    return { condition: "Rain", icon: "🌧️" };
  if (code >= 71 && code <= 77)
    return { condition: "Snow", icon: "🌨️" };
  if (code >= 80 && code <= 82)
    return { condition: "Rain showers", icon: "🌦️" };
  if (code >= 85 && code <= 86)
    return { condition: "Snow showers", icon: "🌨️" };
  if (code >= 95) return { condition: "Thunderstorms", icon: "⛈️" };

  return { condition: "Unknown", icon: "☁️" };
}

export async function GET(request: NextRequest) {
  try {
    const location = request.nextUrl.searchParams.get("location")?.trim();

    if (!location) {
      return NextResponse.json(
        { error: "Location is required" },
        { status: 400 }
      );
    }

    const geoResponse = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        location
      )}&count=1&language=en&format=json`,
      { cache: "no-store" }
    );

    if (!geoResponse.ok) {
      throw new Error("Geocoding failed");
    }

    const geoData = await geoResponse.json();
    const place = geoData.results?.[0];

    if (!place) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    const weatherResponse = await fetch(
      `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${place.latitude}` +
        `&longitude=${place.longitude}` +
        `&current=temperature_2m,weather_code` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
        `&temperature_unit=fahrenheit` +
        `&timezone=auto` +
        `&forecast_days=5`,
      { cache: "no-store" }
    );

    if (!weatherResponse.ok) {
      throw new Error("Weather request failed");
    }

    const weather = await weatherResponse.json();

    const currentDescription = describeWeather(weather.current.weather_code);

    const daily = weather.daily.time.map((date: string, index: number) => {
      const description = describeWeather(
        weather.daily.weather_code[index]
      );

      return {
        date,
        high: Math.round(weather.daily.temperature_2m_max[index]),
        low: Math.round(weather.daily.temperature_2m_min[index]),
        condition: description.condition,
        icon: description.icon,
      };
    });

    return NextResponse.json({
      location: [place.name, place.admin1].filter(Boolean).join(", "),
      timezone: weather.timezone,

      current: {
        temperature: Math.round(weather.current.temperature_2m),
        condition: currentDescription.condition,
        icon: currentDescription.icon,
      },

      daily,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unable to load weather" },
      { status: 500 }
    );
  }
}