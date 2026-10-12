import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = (await readFile(new URL("../src/app/api/weather/route.ts", import.meta.url), "utf8"))
  .replace('"next/server"', JSON.stringify(import.meta.resolve("next/server.js")));
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022
}}).outputText;
const { GET } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
const originalFetch = globalThis.fetch;
const originalError = console.error;
test.afterEach(() => { globalThis.fetch = originalFetch; console.error = originalError; });
const request = location => ({ nextUrl: new URL("https://example.invalid/api/weather" +
  (location ? "?location=" + encodeURIComponent(location) : "")) });
test("successful public weather uses bounded shared caching and separate provider lifetimes", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: new URL(url), options });
    const body = calls.length === 1 ? { results: [{
      name: "Seattle", latitude: 47.6, longitude: -122.3, timezone: "America/Los_Angeles"
    }] } : {
      current: { time: "2026-10-12T10:00", temperature_2m: 60, apparent_temperature: 59, weather_code: 3 },
      hourly: { time: ["2026-10-12T10:00"], precipitation_probability: [25] },
      daily: { time: ["2026-10-12"], weather_code: [3], temperature_2m_max: [65], temperature_2m_min: [50] }
    };
    return Response.json(body);
  };
  const response = await GET(request("Seattle"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "public, max-age=0, s-maxage=900, stale-while-revalidate=60");
  assert.equal(calls[0].options.next.revalidate, 86400);
  assert.equal(calls[1].options.next.revalidate, 900);
  assert.equal(calls[0].options.cache, undefined);
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
    assert.equal(response.headers.get("Cache-Control"), null);
  }
});
test("provider failures never receive the successful public cache policy", async () => {
  console.error = () => {};
  globalThis.fetch = async () => Response.json({ error: "rejected" }, { status: 400 });
  const response = await GET(request("Seattle"));
  assert.equal(response.status, 500);
  assert.equal(response.headers.get("Cache-Control"), null);
});

