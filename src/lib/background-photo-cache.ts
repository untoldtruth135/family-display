// Private photos are read only after a fresh, paired manifest has authorized them.
// Never fall back to rendering remote URLs: storage/budget failures must fail closed.
export type BackgroundPhoto = { id: string; fileName: string | null; url: string; cacheKey: string };
export const PHOTO_CACHE = "family-display:photo-bytes:v1";
export const MAX_PHOTO_BYTES = 5_000_000;
export const DAILY_PHOTO_BYTES = 20_000_000;
export const ROLLING_PHOTO_BYTES = 100_000_000;
export const MAX_CACHE_BYTES = 64_000_000;
const BUDGET_KEY = "family-display:photo-budget:v1";

type Environment = { cache: Cache; storage: Storage; fetch: typeof fetch; now: () => number; origin: string };
let queue: Promise<unknown> = Promise.resolve();

export function reservePhotoDownload(storage: Storage, now: number) {
  const today = new Date(now).toISOString().slice(0, 10);
  const cutoff = new Date(now - 30 * 86400000).toISOString().slice(0, 10);
  const raw = storage.getItem(BUDGET_KEY);
  const ledger: Record<string, number> = raw === null ? {} : JSON.parse(raw);
  if (!ledger || typeof ledger !== "object" || Array.isArray(ledger) ||
      Object.entries(ledger).some(([day, bytes]) => !/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(bytes) || bytes < 0)) {
    throw new Error("Photo download budget is invalid.");
  }
  for (const day of Object.keys(ledger)) if (day < cutoff) delete ledger[day];
  const total = Object.values(ledger).reduce((a, b) => a + b, 0);
  if ((ledger[today] ?? 0) + MAX_PHOTO_BYTES > DAILY_PHOTO_BYTES || total + MAX_PHOTO_BYTES > ROLLING_PHOTO_BYTES) return null;
  // Persist a worst-case reservation BEFORE fetching. Interrupted/failed requests
  // keep the reservation so reloads and retries cannot reset the allowance.
  ledger[today] = (ledger[today] ?? 0) + MAX_PHOTO_BYTES;
  storage.setItem(BUDGET_KEY, JSON.stringify(ledger));
  return (bytes: number) => {
    const current = JSON.parse(storage.getItem(BUDGET_KEY) ?? "{}");
    current[today] = Math.max(0, (current[today] ?? MAX_PHOTO_BYTES) - MAX_PHOTO_BYTES + bytes);
    storage.setItem(BUDGET_KEY, JSON.stringify(current));
  };
}

export async function loadCachedBackgrounds(scope: string, photos: BackgroundPhoto[], env: Environment) {
  const loaded: Array<BackgroundPhoto & { blob: Blob }> = [];
  const stats = { cacheHits: 0, downloads: 0, downloadedBytes: 0, skipped: 0 };
  const selected = photos.slice(0, 64);
  const keyFor = (photo: BackgroundPhoto) => env.origin + "/__local-photo/" + encodeURIComponent(scope) + "/" + encodeURIComponent(photo.cacheKey);
  const allowed = new Set(selected.map(keyFor));
  let occupied = 0;
  for (const request of await env.cache.keys()) {
    if (!allowed.has(request.url)) { await env.cache.delete(request); continue; }
    const response = await env.cache.match(request);
    occupied += Number(response?.headers.get("X-Photo-Bytes") ?? MAX_PHOTO_BYTES);
  }
  for (const photo of selected) {
    const key = keyFor(photo);
    try {
      const saved = await env.cache.match(key);
      if (saved) {
        const blob = await saved.blob();
        if (blob.size > 0 && blob.size <= MAX_PHOTO_BYTES && blob.type.startsWith("image/")) {
          loaded.push({ ...photo, blob }); stats.cacheHits++; continue;
        }
        await env.cache.delete(key);
      }
      if (occupied + MAX_PHOTO_BYTES > MAX_CACHE_BYTES) { stats.skipped++; continue; }
      const settle = reservePhotoDownload(env.storage, env.now());
      if (!settle) { stats.skipped++; continue; }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const response = await env.fetch(photo.url, { signal: controller.signal, credentials: "omit", cache: "no-store" });
        const type = response.headers.get("Content-Type") ?? "";
        const length = Number(response.headers.get("Content-Length") ?? 0);
        if (!response.ok || !type.startsWith("image/") || length > MAX_PHOTO_BYTES || !response.body) {
          controller.abort(); throw new Error("Photo response is not a supported, bounded image.");
        }
        const reader = response.body.getReader();
        const chunks: Uint8Array<ArrayBuffer>[] = [];
        let bytes = 0;
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          bytes += part.value.byteLength;
          if (bytes > MAX_PHOTO_BYTES) { controller.abort(); await reader.cancel(); throw new Error("Photo exceeds download limit."); }
          chunks.push(new Uint8Array(part.value));
        }
        if (!bytes) throw new Error("Empty photo.");
        const blob = new Blob(chunks, { type });
        await env.cache.put(key, new Response(blob, { headers: { "Content-Type": type, "X-Photo-Bytes": String(bytes) } }));
        occupied += bytes;
        settle(bytes);
        loaded.push({ ...photo, blob });
        stats.downloads++; stats.downloadedBytes += bytes;
      } finally { clearTimeout(timeout); }
    } catch {
      // Keep cached photos and the conservative reservation. Never retry with an img URL.
      stats.skipped++;
    }
  }
  return { photos: loaded, stats };
}

export function getBackgroundBlobs(scope: string, photos: BackgroundPhoto[]) {
  const task = async () => {
    if (!window.isSecureContext || !("caches" in window)) throw new Error("Persistent photo cache unavailable.");
    const run = async () => loadCachedBackgrounds(scope, photos, {
      cache: await caches.open(PHOTO_CACHE), storage: localStorage,
      fetch: window.fetch.bind(window), now: Date.now, origin: window.location.origin,
    });
    // Serialize reservations and cache maintenance across tabs where supported.
    if (navigator.locks) return navigator.locks.request(PHOTO_CACHE, run);
    return run();
  };
  const result = queue.then(task, task);
  queue = result.catch(() => undefined);
  return result;
}
