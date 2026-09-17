import { createClient } from "@supabase/supabase-js";

export function getServerSupabase() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY;

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
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

export async function getGoogleAccessToken(
  householdId: string
) {
  const supabase =
    getServerSupabase();

  const {
    data: tokenRow,
    error: tokenError,
  } = await supabase
    .from("google_oauth_tokens")
    .select(
      `
      access_token,
      refresh_token,
      expires_at
      `
    )
    .eq(
      "household_id",
      householdId
    )
    .maybeSingle();

  if (tokenError) {
    throw new Error(
      `Unable to read Google connection: ${tokenError.message}`
    );
  }

  if (!tokenRow) {
    throw new Error(
      "Google Calendar is not connected."
    );
  }

  const expiresAt =
    tokenRow.expires_at
      ? new Date(
          tokenRow.expires_at
        ).getTime()
      : 0;

  /*
    Reuse the existing token if it has
    at least another minute of life.
  */

  if (
    tokenRow.access_token &&
    expiresAt >
      Date.now() +
        60_000
  ) {
    return tokenRow.access_token;
  }

  if (
    !tokenRow.refresh_token
  ) {
    throw new Error(
      "Google refresh token is missing. Reconnect Google Calendar."
    );
  }

  const clientId =
    process.env.GOOGLE_CLIENT_ID;

  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET;

  if (
    !clientId ||
    !clientSecret
  ) {
    throw new Error(
      "Google OAuth server configuration is incomplete."
    );
  }

  const response =
    await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams({
            client_id:
              clientId,

            client_secret:
              clientSecret,

            refresh_token:
              tokenRow.refresh_token,

            grant_type:
              "refresh_token",
          }),

        cache: "no-store",
      }
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    !data.access_token
  ) {
    throw new Error(
      data.error_description ??
        data.error ??
        "Unable to refresh Google Calendar access."
    );
  }

  const expiresAtIso =
    new Date(
      Date.now() +
        Number(
          data.expires_in ??
            3600
        ) *
          1000
    ).toISOString();

  const {
    error: updateError,
  } = await supabase
    .from(
      "google_oauth_tokens"
    )
    .update({
      access_token:
        data.access_token,

      expires_at:
        expiresAtIso,

      updated_at:
        new Date()
          .toISOString(),
    })
    .eq(
      "household_id",
      householdId
    );

  if (updateError) {
    throw new Error(
      `Unable to update Google token: ${updateError.message}`
    );
  }

  return data.access_token as string;
}