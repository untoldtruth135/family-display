import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import { loadCalendarVersion, calendarEtagMatches } from "../src/lib/calendar-cache.ts";

const row = { content_hash: "v1", synced_at: "2026-10-12T12:00:00Z", sync_error: null,
  range_start: "2026-09-20", range_end: "2026-11-15" };
const now = new Date("2026-10-01T07:01:00Z");
function database(responses) {
  const requests = [];
  const client = createClient("https://example.invalid", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async input => {
      const url = new URL(String(input));
      requests.push(url.searchParams);
      assert.equal(url.searchParams.get("household_id"), "eq.household-a");
      assert.ok(responses.length, "unexpected query");
      const next = responses.shift();
      return new Response(JSON.stringify(next.body), {
        status: next.status ?? 200, headers: { "Content-Type": "application/json" }
      });
    }}
  });
  return { client, requests };
}
const version = db => loadCalendarVersion(db.client, "household-a", 2026, 10, "America/Los_Angeles", now);
test("version check projects no event payload and stays household scoped", async () => {
  const db = database([{ body: [row] }]);
  assert.deepEqual(await version(db), row);
  assert.equal(db.requests.length, 1);
  assert.equal(db.requests[0].get("select"),
    "content_hash,synced_at,sync_error,range_start:payload->>rangeStart,range_end:payload->>rangeEndExclusive");
});
test("version fallback proves the same full display coverage at month rollover", async () => {
  const db = database([{ body: [] }, { body: [row] }]);
  assert.deepEqual(await version(db), row);
  assert.equal(db.requests[1].get("payload->>rangeStart"), "lte.2026-09-20");
  assert.equal(db.requests[1].get("payload->>rangeEndExclusive"), "gte.2026-10-18");
  assert.equal(db.requests[1].get("limit"), "1");
});
test("metadata for partial or missing coverage never produces an unchanged response", async () => {
  for (const fallback of [{ ...row, range_start: "" }, { ...row, range_end: "2026-10-17" },
    { ...row, range_start: "2026-09-21" }]) {
    assert.equal(await version(database([{ body: [] }, { body: [fallback] }])), null);
  }
});
test("version lookup does not fallback for an explicitly different month", async () => {
  const db = database([{ body: [] }]);
  assert.equal(await loadCalendarVersion(db.client, "household-a", 2026, 8, "America/Los_Angeles", now), null);
  assert.equal(db.requests.length, 1);
});
test("version query errors remain failures", async () => {
  const failure = { body: { message: "unavailable" }, status: 500 };
  await assert.rejects(version(database([failure])), /version query failed/);
  await assert.rejects(version(database([{ body: [] }, failure])), /version fallback query failed/);
});
test("ETags support weak and list comparison without wildcard false positives", () => {
  for (const header of ['"v1"', 'W/"v1"', '"old", W/"v1"']) assert.equal(calendarEtagMatches(header, "v1"), true);
  for (const header of [null, "", "*", '"v2"', "v1"]) assert.equal(calendarEtagMatches(header, "v1"), false);
  assert.equal(calendarEtagMatches('"v1"', null), false);
});

// Transpile the real route and replace only its infrastructure imports.
// Actual Supabase query builders above exercise projection/filter behavior offline.
let paired = true;
let db;
const auth = `export async function getPairedDisplay() { return globalThis.__calendarFixture.paired
  ? { household_id: "household-a", timezone: "America/Los_Angeles" } : null; }
export function getDisplayServerSupabase() { return globalThis.__calendarFixture.client; }`;
const authUrl = "data:text/javascript;base64," + Buffer.from(auth).toString("base64");
let source = await readFile(new URL("../src/app/api/calendar-events/route.ts", import.meta.url), "utf8");
source = source.replace('"next/server"', JSON.stringify(import.meta.resolve("next/server.js")))
  .replace('"@/lib/display-auth-server"', JSON.stringify(authUrl))
  .replace('"@/lib/calendar-cache"', JSON.stringify(new URL("../src/lib/calendar-cache.ts", import.meta.url).href));
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { GET } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
function request(etag) {
  return { headers: new Headers(etag ? { "If-None-Match": etag } : {}),
    nextUrl: new URL("https://example.invalid/api/calendar-events?year=2026&month=10") };
}
function fixture(responses, isPaired = true) {
  paired = isPaired;
  db = database(responses);
  globalThis.__calendarFixture = { paired, client: db.client };
}
test("unchanged paired calendar returns 304 after only the small metadata read", async () => {
  fixture([{ body: [row] }]);
  const response = await GET(request('"v1"'));
  assert.equal(response.status, 304);
  assert.equal(await response.text(), "");
  assert.equal(response.headers.get("ETag"), '"v1"');
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(db.requests.length, 1);
});
test("revoked/unpaired display receives 401 even with matching ETag", async () => {
  fixture([], false);
  assert.equal((await GET(request('"v1"'))).status, 401);
  assert.equal(db.requests.length, 0);
});
test("changed version returns full payload and its actual latest hash", async () => {
  const payload = { calendars: [], events: [{ title: "Changed" }] };
  fixture([{ body: [{ ...row, content_hash: "v2" }] },
    { body: [{ ...row, content_hash: "v3", payload }] }]);
  const response = await GET(request('"v1"'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), payload);
  assert.equal(response.headers.get("ETag"), '"v3"');
  assert.equal(db.requests.length, 2);
});
test("first load needs only one full payload query", async () => {
  fixture([{ body: [{ ...row, payload: { calendars: [], events: [] } }] }]);
  assert.equal((await GET(request())).status, 200);
  assert.equal(db.requests.length, 1);
});
test("unchanged response retains sync failure and freshness headers", async () => {
  fixture([{ body: [{ ...row, sync_error: "upstream failed" }] }]);
  const response = await GET(request('"v1"'));
  assert.equal(response.status, 304);
  assert.equal(response.headers.get("X-Calendar-Sync-Error"), "true");
  assert.equal(response.headers.get("X-Calendar-Cache"), "stale");
});

