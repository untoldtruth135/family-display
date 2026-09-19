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
      60 *
      60 *
      1000;

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
      Background URLs are signed for
      three hours.

      We will only restore a cached
      manifest if it is less than two
      hours old.
    */

    function restoreCachedPhotos() {
      try {
        const raw =
          sessionStorage.getItem(
            cacheKey
          );

        if (!raw) {
          return false;
        }

        const cached =
          JSON.parse(raw);

        const savedAt =
          Number(
            cached?.savedAt
          );

        if (
          !savedAt ||
          Date.now() -
            savedAt >
            2 *
              60 *
              60 *
              1000
        ) {
          return false;
        }

        if (
          !Array.isArray(
            cached?.photos
          )
        ) {
          return false;
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

        return true;
      } catch {
        return false;
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
          normalDelay
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
      If a recently signed manifest is
      available, show it immediately.
    */

    restoreCachedPhotos();

    loadPhotos();

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