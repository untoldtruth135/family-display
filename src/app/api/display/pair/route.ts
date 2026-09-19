import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  randomUUID,
} from "crypto";

import {
  DISPLAY_COOKIE_NAME,
  getDisplayServerSupabase,
} from "@/lib/display-auth-server";

export const dynamic =
  "force-dynamic";

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    const deviceCode =
      String(
        body?.deviceCode ??
          ""
      )
        .trim()
        .toUpperCase();

    if (!deviceCode) {
      return NextResponse.json(
        {
          error:
            "Device code is required.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      getDisplayServerSupabase();

    const {
      data: display,
      error: displayError,
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
          pairing_enabled,
          pairing_expires_at,
          enabled,
          token_version
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
        displayError.message
      );
    }

    if (!display) {
      return NextResponse.json(
        {
          error:
            "That display code was not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      !display
        .pairing_enabled
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

    if (
      display
        .pairing_expires_at &&
      new Date(
        display
          .pairing_expires_at
      ).getTime() <
        Date.now()
    ) {
      return NextResponse.json(
        {
          error:
            "This pairing code has expired. Enable pairing again from Settings.",
        },
        {
          status: 403,
        }
      );
    }

    /*
      Generate a fresh hidden display token
      every time a display is paired.
    */

    const newToken =
      randomUUID();

    const newVersion =
      Number(
        display
          .token_version ??
          1
      ) + 1;

    const {
      error: updateError,
    } =
      await supabase
        .from(
          "displays"
        )
        .update({
          display_token:
            newToken,

          token_version:
            newVersion,

          pairing_enabled:
            false,

          pairing_expires_at:
            null,

          paired_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          display.id
        );

    if (updateError) {
      throw new Error(
        updateError.message
      );
    }

    const response =
      NextResponse.json({
        success:
          true,

        display: {
          id:
            display.id,

          name:
            display.name,
        },
      });

    response.cookies.set(
      DISPLAY_COOKIE_NAME,
      newToken,
      {
        httpOnly:
          true,

        sameSite:
          "lax",

        secure:
          request.nextUrl
            .protocol ===
          "https:",

        path:
          "/",

        /*
          Keep the wall display paired
          for one year.
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
      "Display pairing error:",
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
      }
    );
  }
}