"use client";

import { useEffect, useState } from "react";
import { getBackgroundBlobs, PHOTO_CACHE, type BackgroundPhoto } from "@/lib/background-photo-cache";

type Props = { enabled: boolean; intervalSeconds: number; shuffle: boolean; fit: "cover" | "contain"; overlayOpacity: number; paused?: boolean };
type LocalPhoto = { id: string; url: string };

export default function RotatingBackground({ enabled, intervalSeconds, shuffle, fit, overlayOpacity, paused = false }: Props) {
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!enabled) { setPhotos([]); return; }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let objectUrls: string[] = [];
    let retry = 5 * 60 * 1000;
    const controller = new AbortController();
    async function load() {
      let delay = 60 * 60 * 1000;
      try {
        // Validate pairing and photo membership before reading private local bytes.
        // Only the small manifest is refreshed hourly; unchanged image bodies stay local.
        const response = await fetch("/api/backgrounds", { cache: "no-store", signal: controller.signal });
        if (response.status === 401) {
          setPhotos([]);
          if ("caches" in window) await caches.delete(PHOTO_CACHE).catch(() => false);
          window.location.replace("/pair"); return;
        }
        if (!response.ok) throw new Error("Unable to load photo manifest.");
        const data = await response.json();
        if (typeof data.scope !== "string" || !Array.isArray(data.photos)) throw new Error("Invalid photo manifest.");
        if (cancelled) return;
        const result = await getBackgroundBlobs(data.scope, data.photos as BackgroundPhoto[]);
        if (cancelled) return;
        const next = result.photos.map((photo) => ({ id: photo.id, url: URL.createObjectURL(photo.blob) }));
        if (shuffle) {
          for (let i = next.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [next[i], next[j]] = [next[j], next[i]];
          }
        }
        const previous = objectUrls;
        objectUrls = next.map((photo) => photo.url);
        setPhotos(next); setIndex(0);
        previous.forEach((url) => URL.revokeObjectURL(url));
        console.info("Background photo cache", result.stats);
        retry = 5 * 60 * 1000;
      } catch (error) {
        if (cancelled) return;
        console.warn("Background photo cache unavailable; retaining local photos.", error);
        delay = retry; retry = Math.min(retry * 2, 60 * 60 * 1000);
      }
      if (!cancelled) timer = setTimeout(load, delay);
    }
    void load();
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); objectUrls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [enabled, shuffle]);

  useEffect(() => {
    if (!enabled || paused || photos.length <= 1) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % photos.length), Math.max(30, intervalSeconds) * 1000);
    return () => clearInterval(timer);
  }, [enabled, paused, photos.length, intervalSeconds]);

  if (!enabled || !photos.length) return null;
  return <div className="rotatingBackground" aria-hidden="true">
    {photos.map((photo, photoIndex) => <div key={photo.id}
      className={"rotatingBackgroundImage " + (photoIndex === index ? "rotatingBackgroundImageActive" : "")}
      style={{ backgroundImage: 'url("' + photo.url + '")', backgroundSize: fit }} />)}
    <div className="rotatingBackgroundOverlay" style={{ backgroundColor: "rgba(238, 241, 243, " + overlayOpacity + ")" }} />
  </div>;
}
