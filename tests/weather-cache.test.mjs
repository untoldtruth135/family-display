import assert from "node:assert/strict";
import test from "node:test";
import { WEATHER_REFRESH_MS, WEATHER_OUTAGE_MS, weatherCacheAge, weatherRefreshDelay } from "../src/lib/weather-cache.ts";

const now = Date.parse("2026-10-12T12:00:00Z");
test("a fresh restored weather snapshot waits only its remaining refresh interval", () => {
  assert.equal(weatherRefreshDelay(now - 30 * 60 * 1000, now), 90 * 60 * 1000);
  assert.equal(weatherRefreshDelay(now, now), WEATHER_REFRESH_MS);
});
test("stale weather refreshes immediately, including the exact expiry boundary", () => {
  assert.equal(weatherRefreshDelay(now - WEATHER_REFRESH_MS, now), 0);
  assert.equal(weatherRefreshDelay(now - WEATHER_OUTAGE_MS, now), 0);
});
test("invalid and future timestamps cannot suppress weather refresh", () => {
  for (const stamp of [null, undefined, "", "invalid", Infinity, -1, now + 1]) {
    assert.equal(weatherRefreshDelay(stamp, now), 0);
    assert.equal(weatherCacheAge(stamp, now), Infinity);
  }
});

