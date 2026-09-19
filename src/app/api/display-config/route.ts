import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getPairedDisplay,
  getDisplayServerSupabase,
} from "@/lib/display-auth-server";

export const dynamic =
  "force-dynamic";

export async function GET(
  request: NextRequest
) {
  try {
    /*
      -------------------------------------------------------
      VERIFY PAIRED DISPLAY
      -------------------------------------------------------
    */

    const display =
      await getPairedDisplay(
        request
      );

    if (!display) {
      return NextResponse.json(
        {
          error:
            "Display is not paired.",
        },
        {
          status: 401,

          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    const supabase =
      getDisplayServerSupabase();

    /*
      -------------------------------------------------------
      HOUSEHOLD
      -------------------------------------------------------
    */

    const {
      data: household,
      error: householdError,
    } =
      await supabase
        .from("households")
        .select(
          `
          id,
          name
          `
        )
        .eq(
          "id",
          display.household_id
        )
        .maybeSingle();

    if (householdError) {
      throw new Error(
        `Household query failed: ${householdError.message}`
      );
    }

    if (!household) {
      throw new Error(
        "The paired display household could not be found."
      );
    }

    /*
      -------------------------------------------------------
      DISPLAY SETTINGS
      -------------------------------------------------------
    */

    const {
      data: settings,
      error: settingsError,
    } =
      await supabase
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
          display.household_id
        )
        .maybeSingle();

    if (settingsError) {
      throw new Error(
        `Display settings query failed: ${settingsError.message}`
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
    } =
      await supabase
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
        (
          schedule
        ) => ({
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

        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }
}