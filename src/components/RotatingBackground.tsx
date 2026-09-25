"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type Photo = {
  id: string;
  fileName:
    | string
    | null;
  url: string;
};

type Props = {
  enabled: boolean;

  intervalSeconds: number;

  shuffle: boolean;

  fit:
    | "cover"
    | "contain";

  overlayOpacity: number;

  paused?: boolean;
};

function shufflePhotos(
  items: Photo[]
) {
  const copy =
    [...items];

  for (
    let i =
      copy.length - 1;
    i > 0;
    i--
  ) {
    const j =
      Math.floor(
        Math.random() *
          (i + 1)
      );

    [
      copy[i],
      copy[j],
    ] = [
      copy[j],
      copy[i],
    ];
  }

  return copy;
}

export default function RotatingBackground({
  enabled,
  intervalSeconds,
  shuffle,
  fit,
  overlayOpacity,
  paused = false,
}: Props) {
  const [
    photos,
    setPhotos,
  ] =
    useState<Photo[]>([]);

  const [
    index,
    setIndex,
  ] =
    useState(0);

  useEffect(() => {
    if (!enabled) {
      setPhotos([]);
      return;
    }

    if (paused) {
      return;
    }

    let cancelled =
      false;

    let timer:
      number | undefined;

    const normalDelay =
      24 *
      60 *
      60 *
      1000;

    const expirationMargin = 60 * 60 * 1000;

    const maxFailureDelay =
      60 *
      60 *
      1000;

    let failureDelay =
      5 *
      60 *
      1000;

    const cacheKey =
      "family-display:backgrounds";

    /*
      Reuse signed URLs for 24 hours, refreshing at least one hour
      before expiration. Old manifests without expiresAt must be
      fetched again because their URLs were only valid for three hours.
      A valid but overdue manifest can still display during a retry.
    */

    function restoreCachedPhotos(): number | null {
      try {
        const raw =
          sessionStorage.getItem(
            cacheKey
          );

        if (!raw) {
          return null;
        }

        const cached =
          JSON.parse(raw);

        const savedAt =
          Number(
            cached?.savedAt
          );

        const expiresAt = Number(cached?.expiresAt);
        const now = Date.now();

        if (
          !Number.isFinite(savedAt) ||
          savedAt <= 0 ||
          savedAt > now ||
          !Number.isFinite(expiresAt) ||
          expiresAt - expirationMargin <= now
        ) {
          return null;
        }

        if (
          !Array.isArray(
            cached?.photos
          )
        ) {
          return null;
        }

        const restored =
          cached.photos as
            Photo[];

        setPhotos(
          shuffle
            ? shufflePhotos(
                restored
              )
            : restored
        );

        setIndex(0);

        return Math.max(
          0,
          Math.min(savedAt + normalDelay, expiresAt - expirationMargin) - now
        );
      } catch {
        return null;
      }
    }

    function scheduleNext(
      delay: number
    ) {
      if (cancelled) {
        return;
      }

      timer =
        window.setTimeout(
          loadPhotos,
          delay
        );
    }

    async function loadPhotos() {
      try {
        const response =
          await fetch(
            "/api/backgrounds",
            {
              cache:
                "no-store",
            }
          );

        if (
          response.status ===
          401
        ) {
          try {
            sessionStorage.removeItem(
              cacheKey
            );
          } catch {
            // Ignore storage failures.
          }

          window.location.replace(
            "/pair"
          );

          return;
        }

        if (
          !response.ok
        ) {
          throw new Error(
            "Unable to load backgrounds."
          );
        }

        const data =
          await response.json();

        const loaded =
          (data.photos ??
            []) as Photo[];

        if (cancelled) {
          return;
        }

        const expiresAt = Number(data.expiresAt);
        if (
          !Number.isFinite(expiresAt) ||
          expiresAt - expirationMargin <= Date.now()
        ) {
          throw new Error("Background manifest expiration is missing or too soon.");
        }

        setPhotos(
          shuffle
            ? shufflePhotos(
                loaded
              )
            : loaded
        );

        setIndex(0);

        try {
          sessionStorage.setItem(
            cacheKey,
            JSON.stringify({
              savedAt:
                Date.now(),

              expiresAt,

              photos:
                loaded,
            })
          );
        } catch {
          // Cache failure should not
          // affect the display.
        }

        failureDelay =
          5 *
          60 *
          1000;

        scheduleNext(
          Math.max(
            0,
            Math.min(normalDelay, expiresAt - expirationMargin - Date.now())
          )
        );
      } catch (
        error
      ) {
        console.error(
          "Background loading error:",
          error
        );

        if (cancelled) {
          return;
        }

        restoreCachedPhotos();

        scheduleNext(
          failureDelay
        );

        failureDelay =
          Math.min(
            failureDelay *
              2,
            maxFailureDelay
          );
      }
    }

    /*
      Resume the original refresh deadline rather than renewing URLs
      on every reload, visibility change, or wake from scheduled sleep.
    */

    const remainingDelay = restoreCachedPhotos();
    if (remainingDelay !== null && remainingDelay > 0) {
      scheduleNext(remainingDelay);
    } else {
      void loadPhotos();
    }

    return () => {
      cancelled =
        true;

      if (
        timer !==
        undefined
      ) {
        window.clearTimeout(
          timer
        );
      }
    };
  }, [
    enabled,
    shuffle,
    paused,
  ]);

  useEffect(() => {
    if (
      !enabled ||
      paused ||
      photos.length <= 1
    ) {
      return;
    }

    const seconds =
      Math.max(
        30,
        intervalSeconds
      );

    const timer =
      setInterval(
        () => {
          setIndex(
            (
              current
            ) =>
              (current +
                1) %
              photos.length
          );
        },
        seconds *
          1000
      );

    return () =>
      clearInterval(
        timer
      );
  }, [
    enabled,
    paused,
    photos,
    intervalSeconds,
  ]);

  const visiblePhotos =
    useMemo(
      () =>
        photos.map(
          (
            photo,
            photoIndex
          ) => ({
            ...photo,

            active:
              photoIndex ===
              index,
          })
        ),
      [
        photos,
        index,
      ]
    );

  if (
    !enabled ||
    photos.length === 0
  ) {
    return null;
  }

  return (
    <div
      className="rotatingBackground"
      aria-hidden="true"
    >
      {visiblePhotos.map(
        (
          photo
        ) => (
          <div
            key={
              photo.id
            }
            className={`rotatingBackgroundImage ${
              photo.active
                ? "rotatingBackgroundImageActive"
                : ""
            }`}
            style={{
              backgroundImage:
                `url("${photo.url}")`,

              backgroundSize:
                fit,
            }}
          />
        )
      )}

      <div
        className="rotatingBackgroundOverlay"
        style={{
          backgroundColor:
            `rgba(238, 241, 243, ${overlayOpacity})`,
        }}
      />
    </div>
  );
}
