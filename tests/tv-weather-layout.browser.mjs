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
      const page = await browser.newPage({ viewport: { width, height } });
      // This test never contacts Supabase, Google, or any production host.
      await page.route("**/*", async route => {
        const url = new URL(route.request().url());
        if (url.origin !== base) return route.abort();
        if (url.pathname === "/api/display-config") return route.fulfill({ json: {
          household: { id: "test-household", name: "Test Family" },
          display: {
            id: "test-display", name: "TV", weatherLocation: "Lynden, Washington",
            message: "Family message", messageExpiresAt: null, scheduledMessages: [],
            orientation: "landscape", timezone: "America/Los_Angeles",
            use24HourClock: false, theme: "light", fontFamily,
            accentColor: "#169fe8", cardOpacity: 0.95,
            showClock: true, showWeather: true, showForecast: true,
            showCalendar: true, showMessage: true,
            backgroundEnabled: false, schedules: []
          }
        }});
        if (url.pathname === "/api/weather") return route.fulfill({ json: {
          location: { name: "Lynden", admin1: "Washington" },
          current: { temperature: 57, feelsLike: 53, precipitationProbability: 0,
            condition: "Mainly clear", icon: "🌤️", weatherCode: 1 },
          daily: Array.from({ length: 5 }, (_, i) => ({
            date: "2026-10-" + (12 + i), high: 58, low: 36, icon: "☁️", weatherCode: 3
          }))
        }});
        if (url.pathname === "/api/calendar-events") return route.fulfill({ json: { calendars: [], events: [] } });
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
      if (fontFamily === "Georgia") await page.screenshot({
        path: "artifacts/weather-layout/" + width + "x" + height + ".png"
      });
      console.log("PASS weather location fully visible: " + width + "x" + height + " " + fontFamily);
      await page.close();
    }
  }
} finally {
  if (browser) await browser.close();
  server.kill();
}
