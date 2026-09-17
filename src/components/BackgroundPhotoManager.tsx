"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";

type BackgroundPhoto = {
  id: string;
  storage_path: string;
  file_name: string | null;
  enabled: boolean;
  sort_order: number;
  signedUrl?: string;
};

type Props = {
  householdId: string;
  displayId: string;
};

const BUCKET = "background-photos";

export default function BackgroundPhotoManager({
  householdId,
  displayId,
}: Props) {
  const [photos, setPhotos] = useState<BackgroundPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    loadPhotos();
  }, [householdId, displayId]);

  async function loadPhotos() {
    setLoading(true);
    setError("");

    const { data, error: photoError } = await supabase
      .from("background_photos")
      .select(
        `
        id,
        storage_path,
        file_name,
        enabled,
        sort_order
        `
      )
      .eq("household_id", householdId)
      .or(`display_id.eq.${displayId},display_id.is.null`)
      .order("sort_order", {
        ascending: true,
      });

    if (photoError) {
      setError(photoError.message);
      setLoading(false);
      return;
    }

    const records = (data ?? []) as BackgroundPhoto[];

    const recordsWithUrls = await Promise.all(
      records.map(async (photo) => {
        const { data: signedData, error: signedError } =
          await supabase.storage
            .from(BUCKET)
            .createSignedUrl(
              photo.storage_path,
              60 * 60
            );

        if (signedError) {
          console.error(
            "Unable to create signed photo URL:",
            signedError
          );

          return photo;
        }

        return {
          ...photo,
          signedUrl: signedData.signedUrl,
        };
      })
    );

    setPhotos(recordsWithUrls);
    setLoading(false);
  }

  async function handleUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    setUploading(true);
    setError("");
    setNotice("");

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    try {
      for (let index = 0; index < files.length; index++) {
        const file = files[index];

        if (!allowedTypes.includes(file.type)) {
          throw new Error(
            `${file.name} is not a supported image type.`
          );
        }

        if (file.size > 10 * 1024 * 1024) {
          throw new Error(
            `${file.name} is larger than 10 MB.`
          );
        }

        const extension =
          file.name
            .split(".")
            .pop()
            ?.toLowerCase() || "jpg";

        const storagePath =
          `${householdId}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } =
          await supabase.storage
            .from(BUCKET)
            .upload(storagePath, file, {
              cacheControl: "3600",
              upsert: false,
              contentType: file.type,
            });

        if (uploadError) {
          throw new Error(
            `Unable to upload ${file.name}: ${uploadError.message}`
          );
        }

        const { error: metadataError } =
          await supabase
            .from("background_photos")
            .insert({
              household_id: householdId,
              display_id: displayId,
              storage_path: storagePath,
              file_name: file.name,
              enabled: true,
              sort_order: photos.length + index,
            });

        if (metadataError) {
          await supabase.storage
            .from(BUCKET)
            .remove([storagePath]);

          throw new Error(
            `Unable to save ${file.name}: ${metadataError.message}`
          );
        }
      }

      setNotice(
        files.length === 1
          ? "Photo uploaded successfully."
          : `${files.length} photos uploaded successfully.`
      );

      await loadPhotos();
    } catch (uploadFailure) {
      setError(
        uploadFailure instanceof Error
          ? uploadFailure.message
          : "Unable to upload photo."
      );
    } finally {
      setUploading(false);

      // Allows the same file to be selected again later.
      event.target.value = "";
    }
  }

  async function togglePhoto(photo: BackgroundPhoto) {
    setError("");
    setNotice("");

    const newValue = !photo.enabled;

    const { error: updateError } =
      await supabase
        .from("background_photos")
        .update({
          enabled: newValue,
        })
        .eq("id", photo.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setPhotos((current) =>
      current.map((item) =>
        item.id === photo.id
          ? {
              ...item,
              enabled: newValue,
            }
          : item
      )
    );
  }

  async function deletePhoto(photo: BackgroundPhoto) {
    const confirmed = window.confirm(
      `Delete ${
        photo.file_name ?? "this photo"
      } from Family Display?`
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setNotice("");

    const { error: storageError } =
      await supabase.storage
        .from(BUCKET)
        .remove([photo.storage_path]);

    if (storageError) {
      setError(
        `Unable to delete photo file: ${storageError.message}`
      );
      return;
    }

    const { error: databaseError } =
      await supabase
        .from("background_photos")
        .delete()
        .eq("id", photo.id);

    if (databaseError) {
      setError(
        `Photo file was removed, but the database entry could not be deleted: ${databaseError.message}`
      );
      return;
    }

    setPhotos((current) =>
      current.filter((item) => item.id !== photo.id)
    );

    setNotice("Photo deleted.");
  }

  return (
    <div className="photoManager">
      <div className="photoUploadRow">
        <label className="photoUploadButton">
          {uploading
            ? "Uploading..."
            : "Upload Photos"}

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={uploading}
            onChange={handleUpload}
          />
        </label>

        <span className="photoUploadHelp">
          JPG, PNG or WebP. Maximum 10 MB each.
        </span>
      </div>

      {error && (
        <div className="photoError">
          {error}
        </div>
      )}

      {notice && (
        <div className="photoSuccess">
          {notice}
        </div>
      )}

      {loading ? (
        <div className="photoEmpty">
          Loading photos...
        </div>
      ) : photos.length === 0 ? (
        <div className="photoEmpty">
          No background photos have been uploaded yet.
        </div>
      ) : (
        <div className="photoGrid">
          {photos.map((photo) => (
            <div
              className={`photoTile ${
                photo.enabled
                  ? ""
                  : "photoDisabled"
              }`}
              key={photo.id}
            >
              <div className="photoPreview">
                {photo.signedUrl ? (
                  <img
                    src={photo.signedUrl}
                    alt={
                      photo.file_name ??
                      "Background photo"
                    }
                  />
                ) : (
                  <div className="photoUnavailable">
                    Preview unavailable
                  </div>
                )}
              </div>

              <div className="photoInfo">
                <div className="photoName">
                  {photo.file_name ??
                    "Background photo"}
                </div>

                <div className="photoActions">
                  <button
                    type="button"
                    className="photoToggleButton"
                    onClick={() =>
                      togglePhoto(photo)
                    }
                  >
                    {photo.enabled
                      ? "Enabled"
                      : "Disabled"}
                  </button>

                  <button
                    type="button"
                    className="photoDeleteButton"
                    onClick={() =>
                      deletePhoto(photo)
                    }
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}