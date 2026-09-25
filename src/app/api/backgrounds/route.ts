import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getPairedDisplay,
  getDisplayServerSupabase,
} from "@/lib/display-auth-server";

export const dynamic = "force-dynamic";

const BUCKET = "background-photos";
const SIGNED_URL_LIFETIME_SECONDS = 7 * 24 * 60 * 60;

export async function GET(
  request: NextRequest
) {
  try {
    // -----------------------------------------------------
    // VERIFY THIS BROWSER IS A PAIRED DISPLAY
    // -----------------------------------------------------

    const display =
      await getPairedDisplay(request);

    if (!display) {
      return NextResponse.json(
        {
          error:
            "Display is not paired.",
        },
        {
          status: 401,
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    const supabase =
      getDisplayServerSupabase();

    // -----------------------------------------------------
    // LOAD ENABLED PHOTOS FOR THIS HOUSEHOLD
    // -----------------------------------------------------

    const {
      data: photoRows,
      error: photoError,
    } =
      await supabase
        .from("background_photos")
        .select(
          `
          id,
          household_id,
          display_id,
          storage_path,
          file_name,
          enabled,
          sort_order,
          created_at
          `
        )
        .eq(
          "household_id",
          display.household_id
        )
        .eq(
          "enabled",
          true
        )
        .order(
          "sort_order",
          {
            ascending: true,
          }
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        );

    if (photoError) {
      throw new Error(
        `Background photo query failed: ${photoError.message}`
      );
    }

    // Household-wide photos have display_id = null.
    // Display-specific photos must match this display.

    const matchingPhotos =
      (photoRows ?? []).filter(
        (photo) =>
          photo.display_id ===
            display.id ||
          photo.display_id === null
      );

    // -----------------------------------------------------
    // CREATE TEMPORARY SIGNED URLS
    // -----------------------------------------------------

    const photos: Array<{
      id: string;
      fileName: string;
      url: string;
    }> = [];

    // Start before signing so this conservatively covers every photo's expiry.
    const expiresAt = Date.now() + SIGNED_URL_LIFETIME_SECONDS * 1000;

    for (
      const photo of matchingPhotos
    ) {
      const {
        data: signedUrlData,
        error: signedUrlError,
      } =
        await supabase.storage
          .from(BUCKET)
          .createSignedUrl(
            photo.storage_path,
            SIGNED_URL_LIFETIME_SECONDS
          );

      if (signedUrlError) {
        console.error(
          `Unable to sign background ${photo.id}:`,
          signedUrlError
        );
        continue;
      }

      if (
        !signedUrlData?.signedUrl
      ) {
        continue;
      }

      photos.push({
        id: photo.id,
        fileName:
          photo.file_name,
        url:
          signedUrlData.signedUrl,
      });
    }

    return NextResponse.json(
      {
        photos,
        expiresAt,
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
      "Background API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load background photos.",
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
