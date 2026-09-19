import {
  NextRequest,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

export const DISPLAY_COOKIE_NAME =
  "family_display_token";

function getServerSupabase() {
  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY ??
    process.env
      .SUPABASE_SECRET_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not configured."
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "Supabase service role key is not configured."
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession:
          false,

        autoRefreshToken:
          false,
      },
    }
  );
}

export async function getPairedDisplay(
  request: NextRequest
) {
  const token =
    request.cookies
      .get(
        DISPLAY_COOKIE_NAME
      )
      ?.value;

  if (!token) {
    return null;
  }

  const supabase =
    getServerSupabase();

  const {
    data: display,
    error,
  } =
    await supabase
      .from(
        "displays"
      )
      .select(
        `
        id,
        household_id,
        name,
        device_code,
        display_token,
        token_version,
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
        touch_controls_enabled
        `
      )
      .eq(
        "display_token",
        token
      )
      .eq(
        "enabled",
        true
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      `Display authentication failed: ${error.message}`
    );
  }

  return display;
}

export function getDisplayServerSupabase() {
  return getServerSupabase();
}