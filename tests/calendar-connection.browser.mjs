import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
const { chromium } = createRequire(join(process.env.PLAYWRIGHT_PACKAGE_ROOT, "package.json"))("playwright");
const base = "http://127.0.0.1:3011";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "3011"],
  { stdio: ["ignore", "pipe", "pipe"], env: process.env });
let log = ""; server.stdout.on("data", c => { log += c; }); server.stderr.on("data", c => { log += c; });
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base)).ok) break; } catch {}
    if (server.exitCode !== null) throw new Error(log);
    await new Promise(r => setTimeout(r, 200));
  }
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.clock.install({ time: new Date("2026-10-24T15:00:00Z") });
  let healthy = false;
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== base) return route.abort();
    if (url.pathname === "/api/display-config") return route.fulfill(healthy ? { json: {
      household: { id: "household", name: "Family" }, display: {
        id: "tv", name: "TV", weatherLocation: "Lynden, Washington",
        message: "Recovered family message", messageExpiresAt: null, scheduledMessages: [], schedules: [],
        timezone: "America/Los_Angeles", orientation: "landscape", theme: "light", fontFamily: "Georgia",
        use24HourClock: false, showClock: true, showWeather: false, showForecast: false,
        showCalendar: true, showMessage: true, backgroundEnabled: false
      }
    }} : { status: 500, json: { error: "Display pairing authentication failed: JWT issued at future" } });
    if (url.pathname === "/api/calendar-events") return route.fulfill(healthy ?
      { json: { calendars: [{ id: "family", name: "Family test calendar", color: "#169FE8" }], events: [] } } :
      { status: 500, json: { error: "JWT issued at future" } });
    if (url.pathname === "/api/weather") return route.fulfill({ status: 503, json: { error: "Mock weather unavailable" } });
    return route.continue();
  });
  await page.goto(base);
  await page.getByText("Calendar connection unavailable. Retrying automatically.", { exact: true }).waitFor();
  assert.equal(await page.getByText("No Google calendars selected", { exact: true }).count(), 0);
  await page.waitForFunction(() => Array.from(document.querySelectorAll(".agendaEmpty")).every(
    element => element.textContent.includes("Calendar unavailable")));
  console.log("PASS authentication failure is visible and never claims no calendars or no events");
  healthy = true;
  await page.clock.fastForward(61000);
  await page.getByText("Recovered family message", { exact: true }).waitFor();
  assert.equal(await page.getByText("Calendar connection unavailable. Retrying automatically.", { exact: true }).count(), 0);
  console.log("PASS configuration recovers automatically without reload or re-pairing");
  await page.close();
} finally {
  if (browser) await browser.close();
  server.kill();
}
