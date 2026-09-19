import {
  createHash,
} from "crypto";

import {
  NextRequest,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

export const DISPLAY_COOKIE_NAME =
  "family_display_token";


/*
  =========================================================
  SUPABASE SERVICE CLIENT
  =========================================================
*/

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


/*
  =========================================================
  HASH DISPLAY TOKEN
  =========================================================

  The browser stores the real secret in an HTTP-only cookie.

  Supabase stores only its SHA-256 hash.
  =========================================================
*/

export function hashDisplayToken(
  token: string
) {
  return createHash(
    "sha256"
  )
    .update(token)
    .digest("hex");
}


/*
  =========================================================
  LOAD DISPLAY
  =========================================================
*/

async function loadDisplay(
  displayId: string
) {
  const supabase =
    getServerSupabase();

  const {
    data: display,
    error,
  } =
    await supabase
      .from("displays")
      .select(
        `
        id,
        household_id,
        name,
        device_code,
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
        paired_at
        `
      )
      .eq(
        "id",
        displayId
      )
      .eq(
        "enabled",
        true
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      `Display query failed: ${error.message}`
    );
  }

  return display;
}


/*
  =========================================================
  UPDATE LAST SEEN
  =========================================================

  Update at most once every five minutes so normal dashboard
  polling does not create excessive database writes.
  =========================================================
*/

async function touchPairing(
  pairingId: string,
  currentLastSeen:
    | string
    | null
) {
  const now =
    Date.now();

  const lastSeen =
    currentLastSeen
      ? new Date(
          currentLastSeen
        ).getTime()
      : 0;

  const fiveMinutes =
    5 *
    60 *
    1000;

  if (
    lastSeen &&
    now - lastSeen <
      fiveMinutes
  ) {
    return;
  }

  const supabase =
    getServerSupabase();

  const {
    error,
  } =
    await supabase
      .from(
        "display_pairings"
      )
      .update({
        last_seen_at:
          new Date(
            now
          ).toISOString(),
      })
      .eq(
        "id",
        pairingId
      )
      .is(
        "revoked_at",
        null
      );

  if (error) {
    console.error(
      "Unable to update paired device last_seen_at:",
      error.message
    );
  }
}


/*
  =========================================================
  AUTHENTICATE PAIRED DISPLAY
  =========================================================

  There is no legacy displays.display_token fallback.

  Every display browser must have an active row in:

      display_pairings

  with a matching SHA-256 token hash.
  =========================================================
*/

export async function getPairedDisplay(
  request: NextRequest
) {
  const token =
    request.cookies.get(
      DISPLAY_COOKIE_NAME
    )?.value;

  if (!token) {
    return null;
  }

  const tokenHash =
    hashDisplayToken(
      token
    );

  const supabase =
    getServerSupabase();

  const {
    data: pairing,
    error:
      pairingError,
  } =
    await supabase
      .from(
        "display_pairings"
      )
      .select(
        `
        id,
        display_id,
        device_name,
        paired_at,
        last_seen_at,
        revoked_at
        `
      )
      .eq(
        "token_hash",
        tokenHash
      )
      .maybeSingle();

  if (pairingError) {
    throw new Error(
      `Display pairing authentication failed: ${pairingError.message}`
    );
  }

  if (!pairing) {
    return null;
  }

  /*
    Revoked pairings must never authenticate.
  */

  if (
    pairing.revoked_at
  ) {
    return null;
  }

  const display =
    await loadDisplay(
      pairing.display_id
    );

  if (!display) {
    return null;
  }

  await touchPairing(
    pairing.id,
    pairing.last_seen_at
  );

  return {
    ...display,

    pairing_id:
      pairing.id,

    pairing_device_name:
      pairing.device_name,

    pairing_paired_at:
      pairing.paired_at,

    pairing_last_seen_at:
      pairing.last_seen_at,
  };
}


/*
  =========================================================
  EXPORTED SERVICE CLIENT
  =========================================================
*/

export function getDisplayServerSupabase() {
  return getServerSupabase();
}