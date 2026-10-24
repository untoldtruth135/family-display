import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
const { chromium } = createRequire(join(process.env.PLAYWRIGHT_PACKAGE_ROOT, "package.json"))("playwright");
const base = "http://127.0.0.1:3010";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "3010"],
  { stdio: ["ignore", "pipe", "pipe"], env: process.env });
let log = ""; server.stdout.on("data", c => { log += c; }); server.stderr.on("data", c => { log += c; });
let browser;
const initial = Date.parse("2026-10-24T14:00:00Z");
try {
  for (let i=0;i<100;i++) {
    try { if ((await fetch(base)).ok) break; } catch {}
    if (server.exitCode !== null) throw new Error(log);
    await new Promise(r => setTimeout(r, 200));
  }
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.clock.install({ time: new Date(initial) });
  // An old client cache without provenance must not prevent the first fetch.
  await page.addInitScript(() => localStorage.setItem("family-display:weather:lynden, washington",
    JSON.stringify({ savedAt: Date.now(), data: { current: { temperature: 99 }, daily: [] } })));
  let simulated = initial, calls = 0, mode = "fresh", temperature = 40, observationOffset = 29 * 60000;
  const temperatures = [];
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== base) return route.abort();
    if (url.pathname === "/api/display-config") return route.fulfill({ json: {
      household: { id: "household", name: "Test" }, display: {
        id: "tv", name: "TV", weatherLocation: "Lynden, Washington",
        message: "Quote", messageExpiresAt: null, scheduledMessages: [], schedules: [],
        timezone: "America/Los_Angeles", orientation: "landscape", theme: "light", fontFamily: "Georgia",
        use24HourClock: false, showClock: true, showWeather: true, showForecast: true,
        showCalendar: true, showMessage: true, backgroundEnabled: false
      }
    }});
    if (url.pathname === "/api/calendar-events") return route.fulfill({ json: { events: [], calendars: [] } });
    if (url.pathname === "/api/weather") {
      calls++;
      if (mode === "hang") return; // Deliberately leave the request unresolved.
      if (mode === "fail") return route.fulfill({ status: 503, json: { error: "Provider unavailable" } });
      const stamp = new Date(simulated - (mode === "stale" ? 24 * 3600000 : observationOffset)).toISOString();
      temperatures.push(temperature);
      return route.fulfill({ json: {
        observedAt: stamp, fetchedAt: new Date(simulated).toISOString(),
        location: { name: "Lynden", admin1: "Washington", timezone: "America/Los_Angeles" },
        current: { temperature, feelsLike: temperature - 5, precipitationProbability: 0, condition: "Overcast", icon: "☁️" },
        daily: [{ date: "2026-10-24", high: 50, low: 35, icon: "☁️" }]
      }});
    }
    return route.continue();
  });
  await page.goto(base);
  await page.waitForFunction(() => document.querySelector(".temperature")?.textContent.includes("40"));
  assert.ok(calls >= 1);
  assert.match(await page.locator(".weatherFreshness").innerText(), /As of.*6:31/s);
  console.log("PASS legacy data discarded; provider observation time displayed");

  const before = calls;
  simulated += 29 * 60000;
  await page.clock.fastForward(29 * 60000);
  await page.waitForTimeout(50);
  assert.equal(calls, before);
  assert.match(await page.locator(".weatherFreshness").innerText(), /As of/);
  simulated += 60000; temperature = 45; observationOffset = 0;
  await page.clock.fastForward(60000);
  await page.waitForFunction(() => document.querySelector(".temperature")?.textContent.includes("45"));
  assert.ok(calls > before);
  console.log("PASS thirty-minute polling updates current conditions");

  mode = "hang"; const beforeHang = calls;
  simulated += 30 * 60000;
  await page.clock.fastForward(30 * 60000);
  await page.waitForFunction(() => document.querySelector(".temperature") !== null);
  // Ensure route interception has received the hanging request before ticking its deadline.
  await page.waitForTimeout(50);
  assert.ok(calls > beforeHang);
  simulated += 41000;
  await page.clock.fastForward(41000);
  await page.waitForFunction(() => document.querySelector(".weatherFreshness")?.textContent.includes("Last known"));
  console.log("PASS hung request times out and retains labelled last-known weather");

  mode = "fresh"; temperature = 47; simulated += 61000;
  await page.clock.fastForward(61000);
  await page.waitForFunction(() => document.querySelector(".temperature")?.textContent.includes("47"));
  assert.match(await page.locator(".weatherFreshness").innerText(), /As of/);
  console.log("PASS retry after timeout restores fresh conditions");

  mode = "stale"; temperature = 99;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForFunction(() => document.querySelector(".weatherFreshness")?.textContent.includes("Last known"));
  assert.ok((await page.locator(".temperature").innerText()).includes("47"));
  assert.ok(!(await page.locator(".temperature").innerText()).includes("99"));
  console.log("PASS cached HTTP 200 with yesterday's observation is rejected");

  mode = "fail"; simulated += 3 * 3600000;
  await page.clock.fastForward(3 * 3600000);
  await page.waitForFunction(() => document.querySelector(".weatherUnavailable")?.textContent.includes("Weather unavailable"));
  assert.equal(await page.locator(".temperature").count(), 0);
  console.log("PASS expired fallback is removed instead of displayed indefinitely");

  mode = "fresh"; temperature = 51;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForFunction(() => document.querySelector(".temperature")?.textContent.includes("51"));
  console.log("PASS connectivity recovery refreshes immediately");
  await page.close();
} finally {
  if (browser) await browser.close();
  server.kill();
}
