import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = (await readFile(new URL("../src/app/api/weather/route.ts", import.meta.url), "utf8"))
  .replace('"next/server"', JSON.stringify(import.meta.resolve("next/server.js")))
  .replace('"@/lib/weather-cache"', JSON.stringify(new URL("../src/lib/weather-cache.ts", import.meta.url).href));
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022
}}).outputText;
const { GET } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
const originalFetch = globalThis.fetch;
const originalError = console.error;
const originalNow = Date.now;
test.beforeEach(() => { Date.now = () => Date.parse("2026-10-24T14:00:00Z"); });
test.afterEach(() => { globalThis.fetch = originalFetch; console.error = originalError; Date.now = originalNow; });
const request = location => ({ nextUrl: new URL("https://example.invalid/api/weather" +
  (location ? "?location=" + encodeURIComponent(location) : "")) });
test("current weather uses one strict shared cache and uncached provider data", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: new URL(url), options });
    const body = calls.length === 1 ? { results: [{
      name: "Seattle", latitude: 47.6, longitude: -122.3, timezone: "America/Los_Angeles"
    }] } : {
      utc_offset_seconds: -25200,
      current: { time: "2026-10-24T07:00", temperature_2m: 60, apparent_temperature: 59, weather_code: 3 },
      hourly: { time: ["2026-10-24T07:00"], precipitation_probability: [25] },
      daily: { time: ["2026-10-24"], weather_code: [3], temperature_2m_max: [65], temperature_2m_min: [50] }
    };
    return Response.json(body);
  };
  const response = await GET(request("Seattle"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("Netlify-CDN-Cache-Control"), "public, s-maxage=300, must-revalidate");
  assert.equal(response.headers.get("CDN-Cache-Control"), "public, s-maxage=300, must-revalidate");
  assert.equal(response.headers.get("Netlify-Vary"), "query=location");
  for (const call of calls) {
    assert.equal(call.options.cache, "no-store");
    assert.equal(call.options.next, undefined);
  }
  const data = await response.json();
  assert.equal(data.current.temperature, 60);
  assert.equal(data.current.precipitationProbability, 25);
  assert.equal(data.daily.length, 1);
});
test("missing or unrecognized locations do not get a shared response cache policy", async () => {
  globalThis.fetch = async () => Response.json({ results: [] });
  for (const location of [null, "missing-place"]) {
    const response = await GET(request(location));
    assert.ok(response.status === 400 || response.status === 404);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("Netlify-CDN-Cache-Control"), "no-store");
  }
});
test("provider failures never receive the successful public cache policy", async () => {
  console.error = () => {};
  globalThis.fetch = async () => Response.json({ error: "rejected" }, { status: 400 });
  const response = await GET(request("Seattle"));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});


test("yesterday's provider body cannot be recached as fresh weather", async () => {
  console.error = () => {};
  let call = 0;
  globalThis.fetch = async () => Response.json(++call === 1
    ? { results: [{ name: "Lynden", latitude: 48.9465, longitude: -122.45211 }] }
    : { utc_offset_seconds: -25200, current: { time: "2026-10-23T11:00", temperature_2m: 53 },
        daily: { time: ["2026-10-23"] } });
  const response = await GET(request("Lynden"));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Netlify-CDN-Cache-Control"), "no-store");
  assert.match((await response.json()).error, /out of date/);
});
