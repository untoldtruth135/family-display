import {
  randomBytes,
} from "crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  DISPLAY_COOKIE_NAME,
  getDisplayServerSupabase,
  hashDisplayToken,
} from "@/lib/display-auth-server";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";


type PairRequestBody = {
  deviceCode?: string;
  deviceName?: string;
};


/*
  =========================================================
  CLEAN DEVICE NAME
  =========================================================
*/

function cleanDeviceName(
  value:
    | string
    | undefined
) {
  const cleaned =
    value
      ?.trim()
      .replace(
        /\s+/g,
        " "
      )
      .slice(
        0,
        80
      );

  return cleaned ||
    null;
}


/*
  =========================================================
  BASIC DEVICE DESCRIPTION

  If the pairing page does not provide a custom name,
  create a useful name from the browser user-agent.

  Examples:

      Chrome on Windows
      Safari on iPad
      Chrome on Android
  =========================================================
*/

function getAutomaticDeviceName(
  userAgent: string
) {
  let browser =
    "Browser";

  let platform =
    "device";


  if (
    /Edg\//i.test(
      userAgent
    )
  ) {
    browser =
      "Edge";
  } else if (
    /Chrome\//i.test(
      userAgent
    )
  ) {
    browser =
      "Chrome";
  } else if (
    /Firefox\//i.test(
      userAgent
    )
  ) {
    browser =
      "Firefox";
  } else if (
    /Safari\//i.test(
      userAgent
    )
  ) {
    browser =
      "Safari";
  }


  if (
    /iPad/i.test(
      userAgent
    )
  ) {
    platform =
      "iPad";
  } else if (
    /iPhone/i.test(
      userAgent
    )
  ) {
    platform =
      "iPhone";
  } else if (
    /Android/i.test(
      userAgent
    )
  ) {
    platform =
      "Android";
  } else if (
    /Windows/i.test(
      userAgent
    )
  ) {
    platform =
      "Windows";
  } else if (
    /Macintosh|Mac OS X/i.test(
      userAgent
    )
  ) {
    platform =
      "Mac";
  } else if (
    /Linux/i.test(
      userAgent
    )
  ) {
    platform =
      "Linux";
  }


  return `${browser} on ${platform}`;
}


/*
  =========================================================
  PAIR DISPLAY
  =========================================================
*/

export async function POST(
  request: NextRequest
) {
  try {
    /*
      -----------------------------------------------------
      READ REQUEST
      -----------------------------------------------------
    */

    const body =
      (await request.json()) as
        PairRequestBody;

    const deviceCode =
      body.deviceCode
        ?.trim()
        .toUpperCase();

    if (!deviceCode) {
      return NextResponse.json(
        {
          error:
            "Display code is required.",
        },
        {
          status: 400,
        }
      );
    }


    /*
      -----------------------------------------------------
      FIND DISPLAY
      -----------------------------------------------------
    */

    const supabase =
      getDisplayServerSupabase();

    const {
      data: display,
      error:
        displayError,
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
          enabled,
          pairing_enabled,
          pairing_expires_at
          `
        )
        .eq(
          "device_code",
          deviceCode
        )
        .eq(
          "enabled",
          true
        )
        .maybeSingle();


    if (displayError) {
      throw new Error(
        `Display lookup failed: ${displayError.message}`
      );
    }


    /*
      Do not reveal whether an arbitrary display code exists
      unless pairing is currently allowed.
    */

    if (
      !display ||
      !display.pairing_enabled
    ) {
      return NextResponse.json(
        {
          error:
            "Pairing is not currently enabled for this display.",
        },
        {
          status: 403,
        }
      );
    }


    /*
      -----------------------------------------------------
      CHECK PAIRING EXPIRATION
      -----------------------------------------------------
    */

    if (
      !display.pairing_expires_at
    ) {
      return NextResponse.json(
        {
          error:
            "The pairing window has expired.",
        },
        {
          status: 403,
        }
      );
    }


    const expiresAt =
      new Date(
        display
          .pairing_expires_at
      ).getTime();


    if (
      !Number.isFinite(
        expiresAt
      ) ||
      expiresAt <
        Date.now()
    ) {
      /*
        Clean up the expired pairing window.
      */

      await supabase
        .from(
          "displays"
        )
        .update({
          pairing_enabled:
            false,

          pairing_expires_at:
            null,
        })
        .eq(
          "id",
          display.id
        );

      return NextResponse.json(
        {
          error:
            "The pairing window has expired. Enable pairing again in Settings.",
        },
        {
          status: 403,
        }
      );
    }


    /*
      -----------------------------------------------------
      DETERMINE DEVICE NAME
      -----------------------------------------------------
    */

    const suppliedDeviceName =
      cleanDeviceName(
        body.deviceName
      );

    const userAgent =
      request.headers.get(
        "user-agent"
      ) ?? "";

    const deviceName =
      suppliedDeviceName ??
      getAutomaticDeviceName(
        userAgent
      );


    /*
      -----------------------------------------------------
      CREATE A NEW UNIQUE DEVICE SECRET
      -----------------------------------------------------

      The browser receives the raw secret.

      Supabase receives ONLY:

          SHA-256(secret)

      Each paired device therefore has its own independent
      credential.
      -----------------------------------------------------
    */

    const rawToken =
      randomBytes(
        32
      ).toString(
        "base64url"
      );

    const tokenHash =
      hashDisplayToken(
        rawToken
      );

    const now =
      new Date()
        .toISOString();


    /*
      -----------------------------------------------------
      CREATE PAIRING RECORD
      -----------------------------------------------------
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
        .insert({
          display_id:
            display.id,

          device_name:
            deviceName,

          token_hash:
            tokenHash,

          paired_at:
            now,

          last_seen_at:
            now,

          revoked_at:
            null,
        })
        .select(
          `
          id,
          device_name,
          paired_at
          `
        )
        .single();


    if (pairingError) {
      throw new Error(
        `Unable to create paired device: ${pairingError.message}`
      );
    }


    /*
      -----------------------------------------------------
      CLOSE PAIRING WINDOW
      -----------------------------------------------------

      A pairing window is intentionally single-use.

      If you want to add another device, enable pairing
      again from Settings.

      Existing paired devices remain active.
      -----------------------------------------------------
    */

    const {
      error:
        displayUpdateError,
    } =
      await supabase
        .from(
          "displays"
        )
        .update({
          pairing_enabled:
            false,

          pairing_expires_at:
            null,

          paired_at:
            now,

          updated_at:
            now,
        })
        .eq(
          "id",
          display.id
        );


    if (
      displayUpdateError
    ) {
      /*
        The device pairing itself is valid.

        Log this failure rather than exposing the token or
        destroying an otherwise successful pairing.
      */

      console.error(
        "Unable to close display pairing window:",
        displayUpdateError.message
      );
    }


    /*
      -----------------------------------------------------
      SET SECURE HTTP-ONLY COOKIE
      -----------------------------------------------------
    */

    const response =
      NextResponse.json(
        {
          success:
            true,

          display: {
            id:
              display.id,

            name:
              display.name,
          },

          pairing: {
            id:
              pairing.id,

            deviceName:
              pairing.device_name,

            pairedAt:
              pairing.paired_at,
          },
        },
        {
          status: 200,

          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );


    response.cookies.set(
      {
        name:
          DISPLAY_COOKIE_NAME,

        value:
          rawToken,

        httpOnly:
          true,

        secure:
          request.nextUrl
            .protocol ===
          "https:",

        sameSite:
          "lax",

        path:
          "/",

        /*
          One year.

          Revocation in Supabase still immediately disables
          the token even if this cookie remains in the
          browser.
        */
        maxAge:
          60 *
          60 *
          24 *
          365,
      }
    );


    return response;
  } catch (error) {
    console.error(
      "Display pairing API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to pair display.",
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