import assert from "node:assert/strict";
import test from "node:test";
import { getAgendaDateKeys, eventsForAgendaDay } from "../src/lib/agenda-days.ts";

test("tomorrow advances the local calendar date across month, year, and leap-day boundaries", () => {
  assert.deepEqual(getAgendaDateKeys(2026, 10, 31), { today: "2026-10-31", tomorrow: "2026-11-01" });
  assert.deepEqual(getAgendaDateKeys(2026, 12, 31), { today: "2026-12-31", tomorrow: "2027-01-01" });
  assert.deepEqual(getAgendaDateKeys(2028, 2, 28), { today: "2028-02-28", tomorrow: "2028-02-29" });
  assert.deepEqual(getAgendaDateKeys(2028, 2, 29), { today: "2028-02-29", tomorrow: "2028-03-01" });
});
test("DST calendar dates do not skip or duplicate a day", () => {
  assert.equal(getAgendaDateKeys(2026, 3, 8).tomorrow, "2026-03-09");
  assert.equal(getAgendaDateKeys(2026, 11, 1).tomorrow, "2026-11-02");
});
test("each agenda selects only its day, sorts all-day first then time, and leaves the cache unchanged", () => {
  const events = [
    { id: "late", date: "2026-10-16", allDay: false, start: "2026-10-16T16:00:00-07:00" },
    { id: "today", date: "2026-10-15", allDay: false, start: null },
    { id: "all-day", date: "2026-10-16", allDay: true, start: null },
    { id: "early", date: "2026-10-16", allDay: false, start: "2026-10-16T08:00:00-07:00" },
  ];
  const before = structuredClone(events);
  assert.deepEqual(eventsForAgendaDay(events, "2026-10-16").map(e => e.id), ["all-day", "early", "late"]);
  assert.deepEqual(events, before);
  assert.deepEqual(eventsForAgendaDay(events, "2026-10-17"), []);
});
