import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const requireBrowser = createRequire(join(process.env.PLAYWRIGHT_PACKAGE_ROOT, "package.json"));
const { chromium } = requireBrowser("playwright");
const base = "http://127.0.0.1:3009";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "3009"], {
  stdio: ["ignore", "pipe", "pipe"], env: process.env
});
let serverLog = "";
server.stdout.on("data", chunk => { serverLog += chunk; });
server.stderr.on("data", chunk => { serverLog += chunk; });
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { ready = (await fetch(base)).ok; } catch {}
    if (ready) break;
    if (server.exitCode !== null) throw new Error(serverLog);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, "Local test server failed to start: " + serverLog);
  browser = await chromium.launch({ headless: true });
  await mkdir("artifacts/weather-layout", { recursive: true });
  for (const [width, height] of [[854, 480], [960, 540], [1280, 720], [1920, 1080]]) {
    for (const fontFamily of ["Arial", "Georgia", "Times New Roman"]) {
    for (const scenario of ["busy", "empty"]) {
      const page = await browser.newPage({ viewport: { width, height } });
      await page.clock.install({ time: new Date("2026-10-15T19:00:00Z") });
      // This test never contacts Supabase, Google, or any production host.
      await page.route("**/*", async route => {
        const url = new URL(route.request().url());
        if (url.origin !== base) return route.abort();
        if (url.pathname === "/api/display-config") return route.fulfill({ json: {
          household: { id: "test-household", name: "Test Family" },
          display: {
            id: "test-display", name: "TV", weatherLocation: "Lynden, Washington",
            message: "Strength isn’t proving you can handle everything alone; it’s knowing when to trust God, ask for help, and keep moving forward with courage. (Proverbs 3:5–6)", messageExpiresAt: null, scheduledMessages: [],
            orientation: "landscape", timezone: "America/Los_Angeles",
            use24HourClock: false, theme: "light", fontFamily,
            accentColor: "#169fe8", cardOpacity: 0.95,
            showClock: true, showWeather: true, showForecast: true,
            showCalendar: true, showMessage: true,
            backgroundEnabled: false, schedules: []
          }
        }});
        if (url.pathname === "/api/weather") return route.fulfill({ json: {
          observedAt: "2026-10-15T19:00:00Z", fetchedAt: "2026-10-15T19:00:00Z",
          location: { name: "Lynden", admin1: "Washington", timezone: "America/Los_Angeles" },
          current: { temperature: 57, feelsLike: 53, precipitationProbability: 0,
            condition: "Mainly clear", icon: "🌤️", weatherCode: 1 },
          daily: Array.from({ length: 5 }, (_, i) => ({
            date: "2026-10-" + (12 + i), high: 58, low: 36, icon: "☁️", weatherCode: 3
          }))
        }});
        if (url.pathname === "/api/calendar-events") return route.fulfill({ json: {
          calendars: [], events: scenario === "empty" ? [] : [
            ...Array.from({ length: 4 }, (_, i) => ({
              id: "today-" + i, calendarId: "family", calendarName: "Family",
              date: "2026-10-15", start: i === 0 ? null : "2026-10-15T15:00:00-07:00",
              end: null, allDay: i === 0, title: i === 0 ? "Today all-day event" : "Today appointment",
              color: "#169fe8", textColor: "#111", eventColorId: null, usesEventColor: false
            })),
            ...Array.from({ length: 3 }, (_, i) => ({
              id: "tomorrow-" + i, calendarId: "family", calendarName: "Family",
              date: "2026-10-16", start: i === 0 ? null : "2026-10-16T08:00:00-07:00",
              end: null, allDay: i === 0, title: i === 0 ? "Tomorrow all-day event" : "Tomorrow appointment",
              color: "#169fe8", textColor: "#111", eventColorId: null, usesEventColor: false
            }))
          ]
        }});
        if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, json: {} });
        return route.continue();
      });
      await page.goto(base);
      await page.locator(".weatherLocation").waitFor();
      await page.evaluate(() => document.fonts.ready);
      const geometry = await page.evaluate(() => {
        const card = document.querySelector(".weatherCard").getBoundingClientRect();
        const rows = [...document.querySelectorAll(".weatherDetails > div")].map(element => {
          const rect = element.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(element);
          const text = range.getBoundingClientRect();
          return { label: element.className, top: rect.top, bottom: rect.bottom,
            textBottom: text.bottom, left: text.left, right: text.right };
        });
        return { card: { top: card.top, bottom: card.bottom, left: card.left, right: card.right }, rows };
      });
      for (const row of geometry.rows) {
        assert.ok(row.top >= geometry.card.top, JSON.stringify({ width, height, fontFamily, geometry }));
        assert.ok(Math.max(row.bottom, row.textBottom) <= geometry.card.bottom - 3,
          "Weather text clipped at bottom: " + JSON.stringify({ width, height, fontFamily, geometry }));
        assert.ok(row.left >= geometry.card.left && row.right <= geometry.card.right,
          "Weather text clipped horizontally: " + JSON.stringify({ width, height, fontFamily, geometry }));
      }
      assert.equal(await page.locator(".weatherLocation").innerText(), "Lynden, Washington");
      await page.locator(".agendaDays").waitFor();
      if (scenario === "busy") await page.getByText("Tomorrow all-day event", { exact: true }).first().waitFor();
      else await page.waitForFunction(() => document.querySelectorAll(".agendaEmpty").length === 2 &&
        [...document.querySelectorAll(".agendaEmpty")].every(e => e.textContent === "No events"));
      assert.deepEqual(await page.locator(".todayAgendaHeader").allTextContents(), ["TODAY", "TOMORROW"]);
      if (scenario === "busy") {
        assert.equal(await page.locator(".agendaDays .todayAgendaItem").count(), 4);
        assert.deepEqual(await page.locator(".agendaDays .todayAgendaMore").allTextContents(),
          ["+2 more on calendar", "+1 more on calendar"]);
      }
      const cardGeometry = await page.evaluate(() => {
        const card = document.querySelector(".messageCard").getBoundingClientRect();
        const today = document.querySelector('[aria-label="TODAY"]').getBoundingClientRect();
        const tomorrow = document.querySelector('[aria-label="TOMORROW"]').getBoundingClientRect();
        const quote = document.querySelector(".messageText");
        const q = quote.getBoundingClientRect();
        return { cardBottom: card.bottom, todayBottom: today.bottom, tomorrowTop: tomorrow.top,
          tomorrowBottom: tomorrow.bottom, quoteTop: q.top, quoteBottom: q.bottom,
          quoteHeight: quote.clientHeight, quoteScroll: quote.scrollHeight };
      });
      assert.ok(cardGeometry.todayBottom <= cardGeometry.tomorrowTop, JSON.stringify(cardGeometry));
      assert.ok(cardGeometry.tomorrowBottom <= cardGeometry.quoteTop, JSON.stringify(cardGeometry));
      assert.ok(cardGeometry.quoteBottom <= cardGeometry.cardBottom, JSON.stringify(cardGeometry));
      assert.ok(cardGeometry.quoteScroll <= cardGeometry.quoteHeight + 1,
        "Quote clipped: " + JSON.stringify({ width, height, fontFamily, scenario, cardGeometry }));
      if (fontFamily === "Georgia") await page.screenshot({
        path: "artifacts/weather-layout/" + width + "x" + height + "-" + scenario + ".png"
      });
      console.log("PASS weather and Today/Tomorrow/quote: " + width + "x" + height + " " + fontFamily + " " + scenario);
      await page.close();
    }
    }
  }
} finally {
  if (browser) await browser.close();
  server.kill();
}
