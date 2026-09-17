import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const serverKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL is not configured."
      );
    }

    if (!serverKey) {
      throw new Error(
        "No Supabase server key is configured."
      );
    }

    const supabase = createClient(
      supabaseUrl,
      serverKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const {
      data: household,
      error: householdError,
    } = await supabase
      .from("households")
      .select("id, name")
      .order("created_at", {
        ascending: true,
      })
      .limit(1)
      .maybeSingle();

    if (householdError) {
      throw new Error(
        `Household query failed: ${householdError.message}`
      );
    }

    if (!household) {
      return NextResponse.json(
        {
          error:
            "No household has been configured.",
        },
        {
          status: 404,
        }
      );
    }

    const {
      data: settings,
      error: settingsError,
    } = await supabase
      .from("display_settings")
      .select(
        `
        weather_location,
        current_message,
        message_expires_at
        `
      )
      .eq(
        "household_id",
        household.id
      )
      .maybeSingle();

    if (settingsError) {
      throw new Error(
        `Display settings query failed: ${settingsError.message}`
      );
    }

    const {
      data: display,
      error: displayError,
    } = await supabase
      .from("displays")
      .select(
        `
        id,
        name,
        device_code,
        orientation,
        timezone,
        use_24_hour_clock,
        theme,
        font_family,
        accent_color,
        card_opacity,
        show_clock,
        show_weather,
        show_forecast,
        show_calendar,
        show_message,
        background_enabled,
        background_interval_seconds,
        background_shuffle,
        background_fit,
        background_overlay_opacity,
        touch_controls_enabled
        `
      )
      .eq(
        "household_id",
        household.id
      )
      .eq(
        "enabled",
        true
      )
      .order(
        "created_at",
        {
          ascending: true,
        }
      )
      .limit(1)
      .maybeSingle();

    if (displayError) {
      throw new Error(
        `Display query failed: ${displayError.message}`
      );
    }

    if (!display) {
      return NextResponse.json(
        {
          error:
            "No enabled display has been configured.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json(
      {
        household: {
          id: household.id,
          name: household.name,
        },

        display: {
          id: display.id,
          name: display.name,

          weatherLocation:
            settings?.weather_location ??
            "Lynden, Washington",

          message:
            settings?.current_message ??
            "",

          messageExpiresAt:
            settings?.message_expires_at ??
            null,

          orientation:
            display.orientation,

          timezone:
            display.timezone ??
            "America/Los_Angeles",

          use24HourClock:
            display.use_24_hour_clock ??
            false,

          theme:
            display.theme ??
            "light",

          fontFamily:
            display.font_family ??
            "Arial",

          accentColor:
            display.accent_color ??
            "#169FE8",

          cardOpacity:
            Number(
              display.card_opacity ??
              0.95
            ),

          showClock:
            display.show_clock ??
            true,

          showWeather:
            display.show_weather ??
            true,

          showForecast:
            display.show_forecast ??
            true,

          showCalendar:
            display.show_calendar ??
            true,

          showMessage:
            display.show_message ??
            true,

          backgroundEnabled:
            display.background_enabled ??
            false,

          backgroundIntervalSeconds:
            display.background_interval_seconds ??
            600,

          backgroundShuffle:
            display.background_shuffle ??
            true,

          backgroundFit:
            display.background_fit ??
            "cover",

          backgroundOverlayOpacity:
            Number(
              display.background_overlay_opacity ??
              0.72
            ),

          touchControlsEnabled:
            display.touch_controls_enabled ??
            false,
        },
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
      "Display config API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load display configuration.",
      },
      {
        status: 500,
      }
    );
  }
}