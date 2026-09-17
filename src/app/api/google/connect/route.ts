import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

import {
  randomUUID,
} from "crypto";

export const dynamic =
  "force-dynamic";

function getAppOrigin(
  request: NextRequest
) {
  const configuredOrigin =
    process.env
      .NEXT_PUBLIC_APP_URL
      ?.trim()
      .replace(
        /\/+$/,
        ""
      );

  if (
    configuredOrigin
  ) {
    return configuredOrigin;
  }

  const forwardedHost =
    request.headers
      .get(
        "x-forwarded-host"
      )
      ?.split(",")[0]
      .trim();

  const forwardedProto =
    request.headers
      .get(
        "x-forwarded-proto"
      )
      ?.split(",")[0]
      .trim();

  if (
    forwardedHost
  ) {
    return `${
      forwardedProto ??
      "https"
    }://${forwardedHost}`;
  }

  return request
    .nextUrl
    .origin;
}

export async function POST(
  request: NextRequest
) {
  try {
    const supabaseUrl =
      process.env
        .NEXT_PUBLIC_SUPABASE_URL;

    const serviceRoleKey =
      process.env
        .SUPABASE_SERVICE_ROLE_KEY ??
      process.env
        .SUPABASE_SECRET_KEY;

    const googleClientId =
      process.env
        .GOOGLE_CLIENT_ID;

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

    if (!googleClientId) {
      throw new Error(
        "GOOGLE_CLIENT_ID is not configured."
      );
    }

    const authorization =
      request.headers.get(
        "authorization"
      );

    if (
      !authorization
        ?.startsWith(
          "Bearer "
        )
    ) {
      return NextResponse.json(
        {
          error:
            "You must be signed in.",
        },
        {
          status: 401,
        }
      );
    }

    const userAccessToken =
      authorization.slice(
        "Bearer ".length
      );

    const body =
      await request.json();

    const householdId =
      String(
        body?.householdId ??
          ""
      ).trim();

    if (!householdId) {
      return NextResponse.json(
        {
          error:
            "Household ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      createClient(
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

    const {
      data: userData,
      error: userError,
    } =
      await supabase.auth.getUser(
        userAccessToken
      );

    if (
      userError ||
      !userData.user
    ) {
      return NextResponse.json(
        {
          error:
            "Your sign-in session could not be verified.",
        },
        {
          status: 401,
        }
      );
    }

    const {
      data: membership,
      error: membershipError,
    } =
      await supabase
        .from(
          "household_members"
        )
        .select(
          "household_id"
        )
        .eq(
          "household_id",
          householdId
        )
        .eq(
          "user_id",
          userData
            .user
            .id
        )
        .maybeSingle();

    if (
      membershipError
    ) {
      throw new Error(
        `Household membership check failed: ${membershipError.message}`
      );
    }

    if (!membership) {
      return NextResponse.json(
        {
          error:
            "You do not have access to this household.",
        },
        {
          status: 403,
        }
      );
    }

    const state =
      randomUUID();

    const appOrigin =
      getAppOrigin(
        request
      );

    const redirectUri =
      `${appOrigin}/api/google/callback`;

    console.log(
      "Google OAuth redirect URI:",
      redirectUri
    );

    const googleUrl =
      new URL(
        "https://accounts.google.com/o/oauth2/v2/auth"
      );

    googleUrl.searchParams.set(
      "client_id",
      googleClientId
    );

    googleUrl.searchParams.set(
      "redirect_uri",
      redirectUri
    );

    googleUrl.searchParams.set(
      "response_type",
      "code"
    );

    googleUrl.searchParams.set(
      "access_type",
      "offline"
    );

    googleUrl.searchParams.set(
      "prompt",
      "consent"
    );

    googleUrl.searchParams.set(
      "include_granted_scopes",
      "true"
    );

    googleUrl.searchParams.set(
      "scope",
      [
        "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
        "https://www.googleapis.com/auth/calendar.events.readonly",
      ].join(" ")
    );

    googleUrl.searchParams.set(
      "state",
      state
    );

    const response =
      NextResponse.json({
        url:
          googleUrl.toString(),
      });

    response.cookies.set(
      "google_oauth_state",
      state,
      {
        httpOnly:
          true,

        sameSite:
          "lax",

        secure:
          appOrigin.startsWith(
            "https://"
          ),

        path:
          "/",

        maxAge:
          10 * 60,
      }
    );

    response.cookies.set(
      "google_oauth_household",
      householdId,
      {
        httpOnly:
          true,

        sameSite:
          "lax",

        secure:
          appOrigin.startsWith(
            "https://"
          ),

        path:
          "/",

        maxAge:
          10 * 60,
      }
    );

    return response;
  } catch (error) {
    console.error(
      "Google connect error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to start Google connection.",
      },
      {
        status: 500,
      }
    );
  }
}