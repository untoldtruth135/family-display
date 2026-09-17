import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getGoogleAccessToken,
  getServerSupabase,
} from "@/lib/google-calendar-server";

export const dynamic =
  "force-dynamic";

async function verifyHousehold(
  request: NextRequest,
  householdId: string
) {
  const authorization =
    request.headers.get(
      "authorization"
    );

  if (
    !authorization?.startsWith(
      "Bearer "
    )
  ) {
    throw new Error(
      "You must be signed in."
    );
  }

  const userToken =
    authorization.slice(
      "Bearer ".length
    );

  const supabase =
    getServerSupabase();

  const {
    data: userData,
    error: userError,
  } =
    await supabase.auth.getUser(
      userToken
    );

  if (
    userError ||
    !userData.user
  ) {
    throw new Error(
      "Your sign-in session could not be verified."
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
        userData.user.id
      )
      .maybeSingle();

  if (membershipError) {
    throw new Error(
      membershipError.message
    );
  }

  if (!membership) {
    throw new Error(
      "You do not have access to this household."
    );
  }
}

export async function GET(
  request: NextRequest
) {
  try {
    const householdId =
      request.nextUrl
        .searchParams
        .get(
          "householdId"
        )
        ?.trim();

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

    await verifyHousehold(
      request,
      householdId
    );

    const accessToken =
      await getGoogleAccessToken(
        householdId
      );

    const response =
      await fetch(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250&showDeleted=false&showHidden=false",
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },

          cache:
            "no-store",
        }
      );

    const googleData =
      await response.json();

    if (!response.ok) {
      throw new Error(
        googleData.error
          ?.message ??
          "Unable to retrieve Google calendars."
      );
    }

    const supabase =
      getServerSupabase();

    const {
      data: savedSources,
      error: savedError,
    } =
      await supabase
        .from(
          "calendar_sources"
        )
        .select(
          `
          provider_calendar_id,
          display_name,
          color,
          enabled
          `
        )
        .eq(
          "household_id",
          householdId
        )
        .eq(
          "provider",
          "google"
        );

    if (savedError) {
      throw new Error(
        savedError.message
      );
    }

    const savedMap =
      new Map(
        (
          savedSources ??
          []
        ).map(
          (source) => [
            source.provider_calendar_id,
            source,
          ]
        )
      );

    const calendars =
      (
        googleData.items ??
        []
      ).map(
        (
          calendar: any
        ) => {
          const saved =
            savedMap.get(
              calendar.id
            );

          return {
            id:
              calendar.id,

            name:
              calendar.summary ??
              "Unnamed calendar",

            color:
              saved?.color ??
              calendar.backgroundColor ??
              "#169FE8",

            primary:
              Boolean(
                calendar.primary
              ),

            selected:
              saved?.enabled ??
              false,
          };
        }
      );

    return NextResponse.json({
      calendars,
    });
  } catch (error) {
    console.error(
      "Google calendar list error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Google calendars.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    const householdId =
      String(
        body?.householdId ??
          ""
      ).trim();

    const calendars =
      Array.isArray(
        body?.calendars
      )
        ? body.calendars
        : [];

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

    await verifyHousehold(
      request,
      householdId
    );

    const supabase =
      getServerSupabase();

    /*
      Disable all existing Google
      sources first.
    */

    const {
      error: disableError,
    } =
      await supabase
        .from(
          "calendar_sources"
        )
        .update({
          enabled:
            false,
        })
        .eq(
          "household_id",
          householdId
        )
        .eq(
          "provider",
          "google"
        );

    if (disableError) {
      throw new Error(
        disableError.message
      );
    }

    for (
      let index = 0;
      index <
      calendars.length;
      index++
    ) {
      const calendar =
        calendars[
          index
        ];

      if (
        !calendar?.id ||
        !calendar?.name
      ) {
        continue;
      }

      const {
        error:
          upsertError,
      } =
        await supabase
          .from(
            "calendar_sources"
          )
          .upsert(
            {
              household_id:
                householdId,

              provider:
                "google",

              provider_calendar_id:
                calendar.id,

              display_name:
                calendar.name,

              color:
                calendar.color ??
                "#169FE8",

              enabled:
                true,

              sort_order:
                index,
            },
            {
              onConflict:
                "household_id,provider,provider_calendar_id",
            }
          );

      if (upsertError) {
        throw new Error(
          upsertError.message
        );
      }
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Save Google calendars error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save Google calendars.",
      },
      {
        status: 500,
      }
    );
  }
}