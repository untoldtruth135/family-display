"use client";

import type {
  ReactNode,
} from "react";

import {
  useEffect,
  useRef,
} from "react";

type Props = {
  children: ReactNode;
};

export default function AutoScrollEvents({
  children,
}: Props) {
  const viewportRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const trackRef =
    useRef<HTMLDivElement | null>(
      null
    );

  useEffect(() => {
    const viewportNode =
      viewportRef.current;

    const trackNode =
      trackRef.current;

    if (
      viewportNode === null ||
      trackNode === null
    ) {
      return;
    }

    /*
      Explicit non-null aliases.

      TypeScript now knows these can never
      be null inside the animation callbacks.
    */

    const viewportElement:
      HTMLDivElement =
      viewportNode;

    const trackElement:
      HTMLDivElement =
      trackNode;

    let animationFrameId =
      0;

    let position =
      0;

    let direction:
      1 | -1 = 1;

    let maximumOffset =
      0;

    let lastFrameTime =
      performance.now();

    let pauseUntil =
      lastFrameTime +
      2000;

    const SCROLL_SPEED =
      24;

    const PAUSE_DURATION =
      2000;

    function applyPosition() {
      trackElement.style.transform =
        `translate3d(0, -${position}px, 0)`;
    }

    function measure() {
      maximumOffset =
        Math.max(
          0,
          trackElement.scrollHeight -
            viewportElement.clientHeight
        );

      if (
        maximumOffset <= 2
      ) {
        position =
          0;

        direction =
          1;

        applyPosition();

        return;
      }

      if (
        position >
        maximumOffset
      ) {
        position =
          maximumOffset;

        applyPosition();
      }
    }

    function animate(
      currentTime: number
    ) {
      const elapsed =
        currentTime -
        lastFrameTime;

      lastFrameTime =
        currentTime;

      if (
        maximumOffset >
          2 &&
        currentTime >=
          pauseUntil
      ) {
        position +=
          direction *
          SCROLL_SPEED *
          (
            elapsed /
            1000
          );

        if (
          position >=
          maximumOffset
        ) {
          position =
            maximumOffset;

          direction =
            -1;

          pauseUntil =
            currentTime +
            PAUSE_DURATION;
        }

        if (
          position <= 0
        ) {
          position =
            0;

          direction =
            1;

          pauseUntil =
            currentTime +
            PAUSE_DURATION;
        }

        applyPosition();
      }

      animationFrameId =
        window.requestAnimationFrame(
          animate
        );
    }

    position =
      0;

    direction =
      1;

    applyPosition();

    measure();

    const resizeObserver =
      new ResizeObserver(
        () => {
          measure();
        }
      );

    resizeObserver.observe(
      viewportElement
    );

    resizeObserver.observe(
      trackElement
    );

    const mutationObserver =
      new MutationObserver(
        () => {
          measure();
        }
      );

    mutationObserver.observe(
      trackElement,
      {
        childList:
          true,

        subtree:
          true,

        characterData:
          true,
      }
    );

    animationFrameId =
      window.requestAnimationFrame(
        animate
      );

    return () => {
      window.cancelAnimationFrame(
        animationFrameId
      );

      resizeObserver.disconnect();

      mutationObserver.disconnect();
    };
  }, []);

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
        className="dayEventsTrack"
      >
        {children}
      </div>
    </div>
  );
}