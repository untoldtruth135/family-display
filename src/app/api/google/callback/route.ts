import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

export const dynamic =
  "force-dynamic";

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;

  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  email?: string;
};

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

export async function GET(
  request: NextRequest
) {
  const appOrigin =
    getAppOrigin(
      request
    );

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

    const googleClientSecret =
      process.env
        .GOOGLE_CLIENT_SECRET;

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

    if (
      !googleClientId ||
      !googleClientSecret
    ) {
      throw new Error(
        "Google OAuth server configuration is incomplete."
      );
    }

    /*
      -------------------------------------------------------
      VALIDATE GOOGLE CALLBACK
      -------------------------------------------------------
    */

    const params =
      request.nextUrl
        .searchParams;

    const code =
      params.get(
        "code"
      );

    const returnedState =
      params.get(
        "state"
      );

    const googleError =
      params.get(
        "error"
      );

    const storedState =
      request.cookies
        .get(
          "google_oauth_state"
        )
        ?.value;

    const householdId =
      request.cookies
        .get(
          "google_oauth_household"
        )
        ?.value;

    if (googleError) {
      throw new Error(
        `Google authorization failed: ${googleError}`
      );
    }

    if (!code) {
      throw new Error(
        "Google authorization code is missing."
      );
    }

    if (
      !returnedState ||
      !storedState ||
      returnedState !==
        storedState
    ) {
      throw new Error(
        "Google OAuth security state did not match."
      );
    }

    if (!householdId) {
      throw new Error(
        "Household information is missing from the Google connection."
      );
    }

    /*
      -------------------------------------------------------
      TOKEN EXCHANGE
      -------------------------------------------------------
    */

    const redirectUri =
      `${appOrigin}/api/google/callback`;

    console.log(
      "Google token redirect URI:",
      redirectUri
    );

    const tokenResponse =
      await fetch(
        "https://oauth2.googleapis.com/token",
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },

          body:
            new URLSearchParams({
              code,

              client_id:
                googleClientId,

              client_secret:
                googleClientSecret,

              redirect_uri:
                redirectUri,

              grant_type:
                "authorization_code",
            }),
        }
      );

    const tokenData =
      (await tokenResponse.json()) as
        GoogleTokenResponse;

    if (
      !tokenResponse.ok ||
      !tokenData.access_token
    ) {
      throw new Error(
        tokenData
          .error_description ??
          tokenData.error ??
          "Google token exchange failed."
      );
    }

    /*
      -------------------------------------------------------
      GET GOOGLE ACCOUNT EMAIL
      -------------------------------------------------------
    */

    let googleEmail:
      string | null =
      null;

    try {
      const userInfoResponse =
        await fetch(
          "https://www.googleapis.com/oauth2/v2/userinfo",
          {
            headers: {
              Authorization:
                `Bearer ${tokenData.access_token}`,
            },

            cache:
              "no-store",
          }
        );

      if (
        userInfoResponse.ok
      ) {
        const userInfo =
          (await userInfoResponse.json()) as
            GoogleUserInfo;

        googleEmail =
          userInfo.email ??
          null;
      }
    } catch {
      // Email lookup is optional.
    }

    /*
      -------------------------------------------------------
      SUPABASE SERVER CLIENT
      -------------------------------------------------------
    */

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

    /*
      -------------------------------------------------------
      EXISTING CONNECTION
      -------------------------------------------------------
    */

    const {
      data: existing,
      error: existingError,
    } =
      await supabase
        .from(
          "google_oauth_tokens"
        )
        .select(
          `
          refresh_token,
          google_account_email,
          scopes
          `
        )
        .eq(
          "household_id",
          householdId
        )
        .maybeSingle();

    if (
      existingError
    ) {
      throw new Error(
        `Unable to read existing Google connection: ${existingError.message}`
      );
    }

    /*
      -------------------------------------------------------
      REFRESH TOKEN
      -------------------------------------------------------
    */

    const refreshToken =
      tokenData
        .refresh_token ??
      existing
        ?.refresh_token ??
      null;

    if (!refreshToken) {
      throw new Error(
        "Google did not return a refresh token. Reconnect and approve calendar access again."
      );
    }

    /*
      -------------------------------------------------------
      SCOPES

      Google returns:
      "scope1 scope2"

      Supabase expects:
      ["scope1", "scope2"]
      -------------------------------------------------------
    */

    const scopes =
      tokenData.scope
        ? tokenData.scope
            .split(/\s+/)
            .filter(Boolean)
        : existing?.scopes ??
          [];

    /*
      -------------------------------------------------------
      EXPIRATION
      -------------------------------------------------------
    */

    const expiresAt =
      new Date(
        Date.now() +
          (
            tokenData
              .expires_in ??
            3600
          ) *
            1000
      ).toISOString();

    /*
      -------------------------------------------------------
      SAVE GOOGLE CONNECTION
      -------------------------------------------------------
    */

    const {
      error: saveError,
    } =
      await supabase
        .from(
          "google_oauth_tokens"
        )
        .upsert(
          {
            household_id:
              householdId,

            google_account_email:
              googleEmail ??
              existing
                ?.google_account_email ??
              null,

            access_token:
              tokenData
                .access_token,

            refresh_token:
              refreshToken,

            expires_at:
              expiresAt,

            scopes,

            updated_at:
              new Date()
                .toISOString(),
          },
          {
            onConflict:
              "household_id",
          }
        );

    if (saveError) {
      throw new Error(
        `Unable to save Google connection: ${saveError.message}`
      );
    }

    /*
      -------------------------------------------------------
      SUCCESS
      -------------------------------------------------------
    */

    const response =
      NextResponse.redirect(
        `${appOrigin}/settings?google=connected`
      );

    response.cookies.delete(
      "google_oauth_state"
    );

    response.cookies.delete(
      "google_oauth_household"
    );

    return response;
  } catch (error) {
    console.error(
      "Google callback error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Google Calendar connection failed.";

    return NextResponse.redirect(
      `${appOrigin}/settings?google=error&message=${encodeURIComponent(
        message
      )}`
    );
  }
}