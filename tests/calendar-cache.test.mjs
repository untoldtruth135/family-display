import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import {
  getDisplayCalendarRange,
  loadCalendarCache,
} from "../src/lib/calendar-cache.ts";

const rollover = new Date("2026-10-01T07:01:00Z");
const timezone = "America/Los_Angeles";
const cache = (start = "2026-09-20", end = "2026-11-15") => ({
  payload: {
    rangeStart: start,
    rangeEndExclusive: end,
    calendars: [{ id: "family" }],
    events: [{ title: "October appointment", date: "2026-10-02" }],
  },
  content_hash: "previous-month-hash",
  synced_at: "2026-09-30T23:00:00Z",
  sync_error: null,
});

// Exercise the actual Supabase query builder without credentials or network.
function database(responses) {
  const requests = [];
  const supabase = createClient("https://example.invalid", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input) => {
        const url = new URL(String(input));
        requests.push(url.searchParams);
        assert.equal(url.pathname, "/rest/v1/calendar_cache");
        assert.equal(url.searchParams.get("household_id"), "eq.household-a");
        assert.ok(responses.length, "unexpected database request");
        const response = responses.shift();
        return new Response(JSON.stringify(response.body), {
          status: response.status ?? 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  });
  return { supabase, requests };
}

function load(db, now = rollover, year = 2026, month = 10) {
  return loadCalendarCache(db.supabase, "household-a", year, month, timezone, now);
}

test("month rollover returns the previous payload and original freshness metadata", async () => {
  const previous = { ...cache(), sync_error: "Last sync failed" };
  const db = database([{ body: [] }, { body: [previous] }]);
  assert.deepEqual(await load(db), previous);
  assert.equal(db.requests[0].get("year"), "eq.2026");
  assert.equal(db.requests[0].get("month"), "eq.10");
  const fallback = db.requests[1];
  assert.equal(fallback.get("payload->>rangeStart"), "lte.2026-09-20");
  assert.equal(fallback.get("payload->>rangeEndExclusive"), "gte.2026-10-18");
  assert.equal(fallback.has("year"), false);
  assert.equal(fallback.has("month"), false);
  assert.equal(fallback.get("order"), "synced_at.desc.nullslast,year.desc,month.desc");
  assert.equal(fallback.get("limit"), "1");
});

test("new month row takes over as soon as sync creates it", async () => {
  const current = { ...cache(), content_hash: "new-month-hash" };
  const db = database([{ body: [current] }]);
  assert.deepEqual(await load(db), current);
  assert.equal(db.requests.length, 1);
});

test("authoritative empty and legacy month rows do not resurrect old calendars", async () => {
  for (const payload of [
    { calendars: [], events: [], rangeStart: "", rangeEndExclusive: "" },
    { calendars: [], events: [] },
  ]) {
    const current = { ...cache(), payload };
    assert.deepEqual(await load(database([{ body: [current] }])), current);
  }
});

test("exact exclusive-end coverage is sufficient", async () => {
  const exact = cache("2026-09-20", "2026-10-18");
  assert.deepEqual(await load(database([{ body: [] }, { body: [exact] }])), exact);
});

test("partial or unknown coverage cannot replace a missing month", async () => {
  for (const candidate of [
    cache("2026-09-21", "2026-11-15"),
    cache("2026-09-20", "2026-10-17"),
    cache("", ""),
    { ...cache(), payload: null },
    { ...cache(), payload: { calendars: [], events: [] } },
  ]) {
    assert.equal(await load(database([{ body: [] }, { body: [candidate] }])), null);
  }
  assert.equal(await load(database([{ body: [] }, { body: [] }])), null);
});

test("year rollover accepts a December cache for January", async () => {
  const previous = cache("2026-12-20", "2027-02-14");
  const db = database([{ body: [] }, { body: [previous] }]);
  assert.deepEqual(await load(db, new Date("2027-01-01T08:01:00Z"), 2027, 1), previous);
  assert.equal(db.requests[1].get("payload->>rangeEndExclusive"), "gte.2027-01-17");
});

test("display timezone, rather than the server UTC month, controls the range", () => {
  const instant = new Date("2026-10-01T00:01:00Z");
  assert.equal(getDisplayCalendarRange(instant, timezone).month, 9);
  assert.equal(getDisplayCalendarRange(instant, "Asia/Tokyo").month, 10);
});

test("fallback follows the display's local month before UTC and local rollover agree", async () => {
  const instant = new Date("2026-10-01T00:01:00Z");
  const previous = cache();
  const db = database([{ body: [] }, { body: [previous] }]);
  assert.deepEqual(await load(db, instant, 2026, 9), previous);
  assert.equal(db.requests.length, 2);

  const october = database([{ body: [] }]);
  assert.equal(await load(october, instant, 2026, 10), null);
  assert.equal(october.requests.length, 1);
});

test("leap-year rollover includes February 29 in the 28-day display range", async () => {
  const instant = new Date("2028-03-01T08:01:00Z");
  assert.deepEqual(getDisplayCalendarRange(instant, timezone), {
    year: 2028,
    month: 3,
    rangeStart: "2028-02-20",
    rangeEndExclusive: "2028-03-19",
  });
  const previous = cache("2028-02-20", "2028-04-16");
  assert.deepEqual(
    await load(database([{ body: [] }, { body: [previous] }]), instant, 2028, 3),
    previous
  );
});

test("Sunday rollover and DST still produce 28 calendar days", () => {
  assert.deepEqual(getDisplayCalendarRange(new Date("2026-11-01T08:30:00Z"), timezone), {
    year: 2026,
    month: 11,
    rangeStart: "2026-10-25",
    rangeEndExclusive: "2026-11-22",
  });
  assert.deepEqual(
    getDisplayCalendarRange(new Date("2026-11-01T09:30:00Z"), timezone),
    getDisplayCalendarRange(new Date("2026-11-01T08:30:00Z"), timezone)
  );
});

test("requests for other months never receive today's fallback", async () => {
  const db = database([{ body: [] }]);
  assert.equal(await load(db, rollover, 2026, 8), null);
  assert.equal(db.requests.length, 1);
});

test("database failures are surfaced rather than presented as an empty calendar", async () => {
  const failure = { status: 500, body: { message: "database unavailable" } };
  await assert.rejects(load(database([failure])), /Calendar cache query failed/);
  await assert.rejects(
    load(database([{ body: [] }, failure])),
    /Calendar cache fallback query failed/
  );
});
