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
        timezone,
        temperature_unit,
        use_24_hour_clock,
        theme,
        current_message,
        message_expires_at,
        updated_at
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

    if (!settings) {
      return NextResponse.json(
        {
          error:
            "Display settings have not been configured.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json(
      {
        household: {
          name: household.name,
        },

        display: {
          weatherLocation:
            settings.weather_location ??
            "Lynden, Washington",

          timezone:
            settings.timezone ??
            "America/Los_Angeles",

          temperatureUnit:
            settings.temperature_unit ??
            "F",

          use24HourClock:
            settings.use_24_hour_clock ??
            false,

          theme:
            settings.theme ??
            "light",

          message:
            settings.current_message ??
            "",

          messageExpiresAt:
            settings.message_expires_at ??
            null,

          updatedAt:
            settings.updated_at ??
            null,
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