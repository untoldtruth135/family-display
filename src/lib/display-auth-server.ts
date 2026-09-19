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

  The browser receives the real secret token.

  Supabase stores only:

      SHA-256(secret token)

  This means the actual browser credential is not stored
  in the display_pairings table.
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
  UUID CHECK

  This is only needed during migration from our original
  single-device display_token architecture.

  The old displays.display_token column is UUID.

  Future pairing tokens do not need to be UUIDs.
  =========================================================
*/

function looksLikeUuid(
  value: string
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
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
  UPDATE LAST-SEEN TIME
  =========================================================

  The dashboard calls several private APIs.

  We do not want every individual API request to cause a
  database write, so last_seen_at is updated at most about
  once every five minutes.
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
  MIGRATE LEGACY PAIRED DISPLAY
  =========================================================

  Our old system stored the active browser token directly
  in:

      displays.display_token

  If a browser still has one of those valid tokens, we
  automatically create a display_pairings record for it.

  This allows the currently working wall display to survive
  the migration without forcing another pairing.
  =========================================================
*/

async function migrateLegacyToken(
  token: string,
  tokenHash: string
) {
  /*
    Old display_token values are UUIDs.

    If this is not a UUID, it cannot be a valid legacy
    token, so do not query the UUID column.
  */

  if (
    !looksLikeUuid(
      token
    )
  ) {
    return null;
  }

  const supabase =
    getServerSupabase();

  const {
    data: legacyDisplay,
    error:
      legacyError,
  } =
    await supabase
      .from("displays")
      .select(
        `
        id,
        household_id,
        name,
        device_code,
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
        touch_controls_enabled,
        paired_at
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

  if (legacyError) {
    throw new Error(
      `Legacy display authentication failed: ${legacyError.message}`
    );
  }

  if (!legacyDisplay) {
    return null;
  }

  const now =
    new Date().toISOString();

  /*
    Insert the migration record.

    token_hash is UNIQUE, so upsert makes this safe if two
    requests arrive at nearly the same time.
  */

  const {
    data: pairing,
    error:
      pairingError,
  } =
    await supabase
      .from(
        "display_pairings"
      )
      .upsert(
        {
          display_id:
            legacyDisplay.id,

          device_name:
            "Existing paired device",

          token_hash:
            tokenHash,

          paired_at:
            legacyDisplay
              .paired_at ??
            now,

          last_seen_at:
            now,

          revoked_at:
            null,
        },
        {
          onConflict:
            "token_hash",
        }
      )
      .select(
        `
        id,
        device_name,
        paired_at,
        last_seen_at,
        revoked_at
        `
      )
      .single();

  if (pairingError) {
    throw new Error(
      `Legacy pairing migration failed: ${pairingError.message}`
    );
  }

  return {
    ...legacyDisplay,

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
  AUTHENTICATE PAIRED DISPLAY
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

  /*
    -------------------------------------------------------
    CHECK NEW MULTI-DEVICE PAIRING TABLE
    -------------------------------------------------------

    We intentionally query the pairing even if revoked.

    Why?

    If a pairing has been revoked, we need to know that the
    hash existed and was revoked.

    Otherwise the legacy migration fallback could
    accidentally recreate a revoked device.
  */

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

  /*
    -------------------------------------------------------
    KNOWN TOKEN
    -------------------------------------------------------
  */

  if (pairing) {
    /*
      A revoked token must never fall through to the legacy
      migration path.
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
    -------------------------------------------------------
    LEGACY MIGRATION FALLBACK
    -------------------------------------------------------

    No display_pairings record exists for this token.

    Check whether it is a valid token from the original
    single-device system.

    If yes, migrate it automatically.
  */

  return migrateLegacyToken(
    token,
    tokenHash
  );
}


/*
  =========================================================
  EXPORTED SERVER SUPABASE CLIENT
  =========================================================
*/

export function getDisplayServerSupabase() {
  return getServerSupabase();
}