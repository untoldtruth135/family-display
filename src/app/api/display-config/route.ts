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
        "Supabase server key is not configured."
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

    /*
      -------------------------------------------------------
      HOUSEHOLD
      -------------------------------------------------------
    */

    const {
      data: households,
      error: householdError,
    } = await supabase
      .from("households")
      .select(
        `
        id,
        name,
        created_at
        `
      )
      .order(
        "created_at",
        {
          ascending: true,
        }
      )
      .limit(1);

    if (householdError) {
      throw new Error(
        `Household query failed: ${householdError.message}`
      );
    }

    const household =
      households?.[0];

    if (!household) {
      throw new Error(
        "No household was found."
      );
    }

    /*
      -------------------------------------------------------
      HOUSEHOLD DISPLAY SETTINGS
      -------------------------------------------------------
    */

    const {
      data: settings,
      error: settingsError,
    } = await supabase
      .from(
        "display_settings"
      )
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

    /*
      -------------------------------------------------------
      DISPLAY
      -------------------------------------------------------
    */

    const {
      data: displays,
      error: displayError,
    } = await supabase
      .from("displays")
      .select(
        `
        id,
        name,
        enabled,
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
        touch_controls_enabled,
        created_at
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
      .limit(1);

    if (displayError) {
      throw new Error(
        `Display query failed: ${displayError.message}`
      );
    }

    const display =
      displays?.[0];

    if (!display) {
      throw new Error(
        "No enabled display was found."
      );
    }

    /*
      -------------------------------------------------------
      SCHEDULES
      -------------------------------------------------------
    */

    const {
      data: scheduleRows,
      error: scheduleError,
    } = await supabase
      .from(
        "display_schedules"
      )
      .select(
        `
        id,
        day_of_week,
        start_time,
        end_time,
        action,
        enabled
        `
      )
      .eq(
        "display_id",
        display.id
      )
      .eq(
        "enabled",
        true
      )
      .order(
        "day_of_week",
        {
          ascending: true,
        }
      )
      .order(
        "start_time",
        {
          ascending: true,
        }
      );

    if (scheduleError) {
      throw new Error(
        `Schedule query failed: ${scheduleError.message}`
      );
    }

    const schedules =
      (
        scheduleRows ??
        []
      ).map(
        (schedule) => ({
          id:
            schedule.id,

          dayOfWeek:
            schedule.day_of_week,

          startTime:
            schedule.start_time,

          endTime:
            schedule.end_time,

          action:
            schedule.action,

          enabled:
            schedule.enabled,
        })
      );

    /*
      -------------------------------------------------------
      RESPONSE
      -------------------------------------------------------
    */

    return NextResponse.json(
      {
        household: {
          id:
            household.id,

          name:
            household.name,
        },

        display: {
          id:
            display.id,

          name:
            display.name,

          weatherLocation:
            settings
              ?.weather_location ??
            "Lynden, Washington",

          message:
            settings
              ?.current_message ??
            "",

          messageExpiresAt:
            settings
              ?.message_expires_at ??
            null,

          orientation:
            display.orientation,

          timezone:
            display.timezone,

          use24HourClock:
            display.use_24_hour_clock,

          theme:
            display.theme,

          fontFamily:
            display.font_family,

          accentColor:
            display.accent_color,

          cardOpacity:
            Number(
              display.card_opacity
            ),

          showClock:
            display.show_clock,

          showWeather:
            display.show_weather,

          showForecast:
            display.show_forecast,

          showCalendar:
            display.show_calendar,

          showMessage:
            display.show_message,

          backgroundEnabled:
            display.background_enabled,

          backgroundIntervalSeconds:
            display.background_interval_seconds,

          backgroundShuffle:
            display.background_shuffle,

          backgroundFit:
            display.background_fit,

          backgroundOverlayOpacity:
            Number(
              display.background_overlay_opacity
            ),

          touchControlsEnabled:
            display.touch_controls_enabled,

          schedules,
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