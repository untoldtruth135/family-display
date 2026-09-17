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

        setPhotos(
          shuffle
            ? shufflePhotos(
                loaded
              )
            : loaded
        );

        setIndex(0);
      } catch (
        error
      ) {
        console.error(
          "Background loading error:",
          error
        );
      }
    }

    loadPhotos();

    /*
      Signed photo URLs last
      one hour. Refresh them
      every 45 minutes.
    */
    const refreshTimer =
      setInterval(
        loadPhotos,
        45 *
          60 *
          1000
      );

    return () =>
      clearInterval(
        refreshTimer
      );
  }, [
    enabled,
    shuffle,
  ]);

  useEffect(() => {
    if (
      !enabled ||
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