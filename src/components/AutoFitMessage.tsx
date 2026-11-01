"use client";

import { useLayoutEffect, useRef } from "react";

type Props = { text: string; fontFamily: string };

export default function AutoFitMessage({ text, fontFamily }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const content = textRef.current;
    if (!box || !content) return;
    let disposed = false;
    let frame = 0;

    function fit() {
      if (disposed || !box || !content) return;
      box.dataset.quoteFit = "fitted";
      const style = window.getComputedStyle(box);
      const pixels = (value: string) => Number.parseFloat(value) || 0;
      const width = box.clientWidth - pixels(style.paddingLeft) - pixels(style.paddingRight);
      const height = box.clientHeight - pixels(style.paddingTop) - pixels(style.paddingBottom);
      // A sleeping/hidden display is measured again when it becomes visible.
      if (width <= 0 || height <= 0) return;
      const maximum = Math.max(1, pixels(style.fontSize));
      const minimum = Math.min(6, maximum);
      const fits = (size: number) => {
        content.style.fontSize = size + "px";
        return content.scrollHeight <= height && content.scrollWidth <= width &&
          content.getBoundingClientRect().height <= height;
      };
      let size = maximum;
      let overflow = false;
      if (!fits(maximum)) {
        size = minimum;
        if (fits(minimum)) {
          let low = minimum;
          let high = maximum;
          // Bounded layout work, independent of the quote's length.
          for (let step = 0; step < 12 && high - low > 0.05; step++) {
            const middle = (low + high) / 2;
            if (fits(middle)) low = middle;
            else high = middle;
          }
          size = Math.floor(low * 10) / 10;
        } else {
          // Pathological input (e.g. thousands of explicit newlines) cannot
          // remain legible and fit a finite box. Keep every word reachable.
          overflow = true;
        }
      }
      content.style.fontSize = size + "px";
      box.dataset.quoteFit = overflow ? "scroll" : "fitted";
      box.tabIndex = overflow ? 0 : -1;
    }

    function scheduleFit() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(fit);
    }

    fit();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleFit);
    observer?.observe(box);
    window.addEventListener("resize", scheduleFit);
    const fonts = document.fonts;
    void fonts?.ready.then(() => { if (!disposed) scheduleFit(); });
    fonts?.addEventListener?.("loadingdone", scheduleFit);
    return () => {
      disposed = true;
      observer?.disconnect();
      window.removeEventListener("resize", scheduleFit);
      fonts?.removeEventListener?.("loadingdone", scheduleFit);
      window.cancelAnimationFrame(frame);
    };
  }, [text, fontFamily]);

  return (
    <div className="messageText autoFitMessage" ref={boxRef} aria-label="Family message">
      <div className="autoFitMessageContent" ref={textRef}>{text}</div>
    </div>
  );
}
