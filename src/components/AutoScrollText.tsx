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
  className?: string;
};

type ScrollStyle =
  CSSProperties & {
    "--event-scroll-distance"?: string;
    "--event-scroll-duration"?: string;
  };

export default function AutoScrollText({
  children,
  className = "",
}: Props) {
  const viewportRef =
    useRef<HTMLSpanElement>(
      null
    );

  const contentRef =
    useRef<HTMLSpanElement>(
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
    useState(12);

  useEffect(() => {
    const viewport =
      viewportRef.current;

    const content =
      contentRef.current;

    if (
      !viewport ||
      !content
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
                content.scrollWidth -
                  viewport.clientWidth
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
              Allow roughly the same visual
              reading speed regardless of
              how long the title is.
            */

            setDuration(
              Math.max(
                12,
                9 +
                  nextDistance /
                    16
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
      content
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
          "--event-scroll-distance":
            `${distance}px`,

          "--event-scroll-duration":
            `${duration}s`,
        }
      : undefined;

  return (
    <span
      ref={
        viewportRef
      }
      className={`eventTextViewport ${className}`.trim()}
    >
      <span
        ref={
          contentRef
        }
        className={`eventTextScroller ${
          active
            ? "eventTextScrollerActive"
            : ""
        }`.trim()}
        style={
          style
        }
      >
        {children}
      </span>
    </span>
  );
}
