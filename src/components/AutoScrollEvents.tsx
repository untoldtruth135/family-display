"use client";

import {
  CSSProperties,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

type Props = {
  children: ReactNode;
};

type ScrollStyle =
  CSSProperties & {
    "--day-scroll-distance"?: string;
    "--day-scroll-duration"?: string;
  };

export default function AutoScrollEvents({
  children,
}: Props) {
  const viewportRef =
    useRef<HTMLDivElement>(
      null
    );

  const trackRef =
    useRef<HTMLDivElement>(
      null
    );

  const [
    distance,
    setDistance,
  ] =
    useState(0);

  const [
    duration,
    setDuration,
  ] =
    useState(14);

  useEffect(() => {
    const viewport =
      viewportRef.current;

    const track =
      trackRef.current;

    if (
      !viewport ||
      !track
    ) {
      return;
    }

    let frame:
      number | undefined;

    const measure = () => {
      if (
        frame !==
        undefined
      ) {
        cancelAnimationFrame(
          frame
        );
      }

      frame =
        requestAnimationFrame(
          () => {
            const overflow =
              Math.max(
                0,
                track.scrollHeight -
                  viewport.clientHeight
              );

            const nextDistance =
              overflow >
              4
                ? overflow
                : 0;

            setDistance(
              nextDistance
            );

            /*
              Larger event stacks move
              more slowly so text remains
              readable from across the room.
            */

            setDuration(
              Math.max(
                14,
                10 +
                  nextDistance /
                    10
              )
            );
          }
        );
    };

    measure();

    const observer =
      new ResizeObserver(
        measure
      );

    observer.observe(
      viewport
    );

    observer.observe(
      track
    );

    window.addEventListener(
      "resize",
      measure
    );

    return () => {
      observer.disconnect();

      window.removeEventListener(
        "resize",
        measure
      );

      if (
        frame !==
        undefined
      ) {
        cancelAnimationFrame(
          frame
        );
      }
    };
  }, [
    children,
  ]);

  const active =
    distance >
    0;

  const style:
    ScrollStyle | undefined =
    active
      ? {
          "--day-scroll-distance":
            `${distance}px`,

          "--day-scroll-duration":
            `${duration}s`,
        }
      : undefined;

  return (
    <div
      ref={
        viewportRef
      }
      className="dayEventsViewport"
    >
      <div
        ref={
          trackRef
        }
        className={`dayEventsTrack ${
          active
            ? "dayEventsTrackActive"
            : ""
        }`.trim()}
        style={
          style
        }
      >
        {children}
      </div>
    </div>
  );
}
