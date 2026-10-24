import assert from "node:assert/strict";
import test from "node:test";
import { WEATHER_REFRESH_MS, WEATHER_PROVIDER_MAX_AGE_MS, WEATHER_MAX_AGE_MS, WEATHER_OUTAGE_MS,
  weatherCacheAge, weatherRefreshDelay, providerObservationTime, observationAge,
  validWeatherSnapshot, fetchWeatherSnapshot } from "../src/lib/weather-cache.ts";

const now = Date.parse("2026-10-24T14:00:00Z");
const snapshot = () => ({ observedAt: new Date(Date.now() - 60000).toISOString(),
  fetchedAt: new Date().toISOString(), location: { name: "Lynden" },
  current: { temperature: 40 }, daily: [{ date: "2026-10-24" }] });
test("weather polls every 30 minutes without postponing refresh on reload", () => {
  assert.equal(WEATHER_REFRESH_MS, 30 * 60000);
  assert.equal(weatherRefreshDelay(now - 5 * 60000, now), 25 * 60000);
  assert.equal(weatherRefreshDelay(now - WEATHER_REFRESH_MS, now), 0);
});
test("invalid or future saved timestamps never suppress refresh", () => {
  for (const t of [null, undefined, "", "invalid", Infinity, -1, now + 1]) {
    assert.equal(weatherRefreshDelay(t, now), 0);
    assert.equal(weatherCacheAge(t, now), Infinity);
  }
});
test("provider local time uses the accompanying timezone offset, including DST", () => {
  assert.equal(providerObservationTime("2026-10-24T07:00", -25200, now), "2026-10-24T14:00:00.000Z");
  assert.equal(providerObservationTime("2026-11-02T07:00", -28800, Date.parse("2026-11-02T15:00Z")),
    "2026-11-02T15:00:00.000Z");
});
test("yesterday's provider conditions are rejected rather than stamped fresh", () => {
  assert.throws(() => providerObservationTime("2026-10-23T11:00", -25200, now), /out of date/);
  for (const args of [[null, -25200], ["bad", -25200], ["2026-10-24T07:00", null],
    ["2026-10-24T08:00", -25200]]) {
    assert.throws(() => providerObservationTime(...args, now));
  }
  assert.equal(observationAge(undefined, now), Infinity);
  assert.equal(observationAge("2026-10-24T16:00Z", now), Infinity);
});
test("legacy cache without observation time is unusable", () => {
  assert.equal(validWeatherSnapshot({ location: {}, current: { temperature: 53 }, daily: [] }), false);
  assert.equal(validWeatherSnapshot(snapshot()), true);
  assert.equal(WEATHER_OUTAGE_MS, 2 * 60 * 60000);
});
test("successful browser fetch validates observation age independently of download time", async () => {
  const response = snapshot();
  const result = await fetchWeatherSnapshot("/weather", new AbortController().signal,
    async () => Response.json(response), 100);
  assert.deepEqual(result, response);
  response.observedAt = new Date(Date.now() - WEATHER_PROVIDER_MAX_AGE_MS - 1000).toISOString();
  await assert.rejects(fetchWeatherSnapshot("/weather", new AbortController().signal,
    async () => Response.json(response), 100), /out of date/);
});
test("hung headers and hung response bodies both time out", async () => {
  const never = () => new Promise(() => {});
  for (const fetcher of [never, async () => ({ ok: true, json: never })]) {
    await assert.rejects(fetchWeatherSnapshot("/weather", new AbortController().signal, fetcher, 15), /timed out/);
  }
});
test("cleanup aborts an outstanding request so its response cannot be installed later", async () => {
  const c = new AbortController();
  const promise = fetchWeatherSnapshot("/weather", c.signal, () => new Promise(() => {}), 1000);
  c.abort();
  await assert.rejects(promise, /cancelled/);
});
test("HTTP failures are surfaced instead of refreshing cache timestamps", async () => {
  await assert.rejects(fetchWeatherSnapshot("/weather", new AbortController().signal,
    async () => Response.json({ error: "offline" }, { status: 503 }), 100), /offline/);
});

test("display freshness includes one complete polling interval after an accepted observation", () => {
  assert.equal(WEATHER_PROVIDER_MAX_AGE_MS, 30 * 60000);
  assert.equal(WEATHER_MAX_AGE_MS, 60 * 60000);
  const observed = now - WEATHER_PROVIDER_MAX_AGE_MS;
  assert.equal(providerObservationTime("2026-10-24T06:30", -25200, now), new Date(observed).toISOString());
  assert.throws(() => providerObservationTime("2026-10-24T06:29", -25200, now), /out of date/);
  assert.equal(observationAge(new Date(observed).toISOString(), now + WEATHER_REFRESH_MS), WEATHER_MAX_AGE_MS);
  assert.ok(WEATHER_MAX_AGE_MS < WEATHER_OUTAGE_MS);
});
test("refresh resumes at the remaining interval rather than starting another thirty minutes", () => {
  assert.equal(weatherRefreshDelay(now - 29 * 60000, now), 60000);
  assert.equal(weatherRefreshDelay(now - 31 * 60000, now), 0);
});
