import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const BUCKET = "background-photos";

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
        "Supabase server key is not configured."
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

    // -----------------------------------------------------
    // 1. Find the household
    // -----------------------------------------------------

    const {
      data: household,
      error: householdError,
    } = await supabase
      .from("households")
      .select("id")
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
      return NextResponse.json({
        photos: [],
      });
    }

    // -----------------------------------------------------
    // 2. Find the first enabled display
    // -----------------------------------------------------

    const {
      data: display,
      error: displayError,
    } = await supabase
      .from("displays")
      .select("id")
      .eq(
        "household_id",
        household.id
      )
      .eq(
        "enabled",
        true
      )
      .order("created_at", {
        ascending: true,
      })
      .limit(1)
      .maybeSingle();

    if (displayError) {
      throw new Error(
        `Display query failed: ${displayError.message}`
      );
    }

    if (!display) {
      return NextResponse.json({
        photos: [],
      });
    }

    // -----------------------------------------------------
    // 3. Load enabled household photos
    // -----------------------------------------------------

    const {
      data: photoRows,
      error: photosError,
    } = await supabase
      .from("background_photos")
      .select(
        `
        id,
        display_id,
        storage_path,
        file_name,
        sort_order,
        enabled
        `
      )
      .eq(
        "household_id",
        household.id
      )
      .eq(
        "enabled",
        true
      )
      .order("sort_order", {
        ascending: true,
      });

    if (photosError) {
      throw new Error(
        `Background photo query failed: ${photosError.message}`
      );
    }

    /*
      Keep:
      - photos assigned to this display
      - household-wide photos where display_id is null

      Filtering here avoids possible PostgREST .or() parsing issues.
    */

    const applicablePhotos =
      (photoRows ?? []).filter(
        (photo) =>
          photo.display_id === display.id ||
          photo.display_id === null
      );

    // -----------------------------------------------------
    // 4. Generate temporary URLs for private photos
    // -----------------------------------------------------

    const signedPhotos = await Promise.all(
      applicablePhotos.map(
        async (photo) => {
          const {
            data: signedData,
            error: signedError,
          } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(
              photo.storage_path,
              60 * 60
            );

          if (signedError) {
            console.error(
              `Unable to sign ${photo.storage_path}:`,
              signedError
            );

            return null;
          }

          if (!signedData?.signedUrl) {
            return null;
          }

          return {
            id: photo.id,

            fileName:
              photo.file_name,

            url:
              signedData.signedUrl,
          };
        }
      )
    );

    const photos =
      signedPhotos.filter(
        (
          photo
        ): photo is {
          id: string;
          fileName: string | null;
          url: string;
        } => photo !== null
      );

    return NextResponse.json(
      {
        photos,
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
      "Background photo API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown background photo error.",
      },
      {
        status: 500,
      }
    );
  }
}