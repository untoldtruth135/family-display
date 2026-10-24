import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const jsUrl = source => "data:text/javascript;base64," + Buffer.from(
  ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64");
const helper = jsUrl(await readFile(new URL("../supabase/functions/_shared/server-key.ts", import.meta.url), "utf8"));
const sdk = jsUrl(`export function createClient(url, key) {
  globalThis.__calendarAuth.keys.push(key);
  return { from(table) {
    const chain = {
      select() { return chain; }, eq() { return chain; }, update() { return chain; },
      is() { return chain; }, maybeSingle() { return Promise.resolve(result()); },
      then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); }
    };
    function result() {
      const state = globalThis.__calendarAuth;
      if (key === "legacy-future-jwt") return { data: null, error: { message: "JWT issued at future" } };
      let data = table === "display_pairings" ? state.pairing :
        table === "displays" ? (state.display.enabled ? state.display : null) : [];
      return { data, error: null };
    }
    return chain;
  }};
}`);
const compile = async (path, replacements) => {
  let source = await readFile(new URL("../" + path, import.meta.url), "utf8");
  for (const [from, to] of replacements) source = source.replace(from, JSON.stringify(to));
  return jsUrl(source);
};
const displayModule = await compile("src/lib/display-auth-server.ts", [
  ['"@supabase/supabase-js"', sdk], ['"@/lib/supabase-server-key"', helper],
  ['"next/server"', import.meta.resolve("next/server.js")]
]);
const { getPairedDisplay } = await import(displayModule);
const savedEnv = { ...process.env };
const savedDeno = globalThis.Deno;
const request = token => ({ cookies: { get: () => token ? { value: token } : undefined } });

test.beforeEach(() => {
  delete process.env.SUPABASE_SECRET_KEY; delete process.env.SUPABASE_SECRET_KEYS;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "legacy-future-jwt";
  globalThis.__calendarAuth = { keys: [],
    pairing: { id: "pair", display_id: "display", revoked_at: null,
      last_seen_at: new Date().toISOString() },
    display: { id: "display", household_id: "household", enabled: true } };
});
test.afterEach(() => {
  for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY",
    "SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (savedEnv[name] === undefined) delete process.env[name]; else process.env[name] = savedEnv[name];
  }
  globalThis.Deno = savedDeno;
  delete globalThis.__calendarAuth;
});
test("legacy timestamp failure is preserved, and a configured secret restores paired lookup", async () => {
  await assert.rejects(getPairedDisplay(request("device-token")), /JWT issued at future/);
  process.env.SUPABASE_SECRET_KEY = "sb_secret_mock";
  const display = await getPairedDisplay(request("device-token"));
  assert.equal(display.household_id, "household");
  assert.equal(display.pairing_id, "pair");
  assert.deepEqual(globalThis.__calendarAuth.keys.slice(1), ["sb_secret_mock", "sb_secret_mock"]);
});
test("modern credentials do not bypass missing, unknown, revoked or disabled pairings", async () => {
  process.env.SUPABASE_SECRET_KEY = "sb_secret_mock";
  assert.equal(await getPairedDisplay(request(null)), null);
  assert.deepEqual(globalThis.__calendarAuth.keys, []);
  globalThis.__calendarAuth.pairing = null;
  assert.equal(await getPairedDisplay(request("unknown")), null);
  globalThis.__calendarAuth.pairing = { revoked_at: new Date().toISOString() };
  assert.equal(await getPairedDisplay(request("revoked")), null);
  globalThis.__calendarAuth.pairing = { display_id: "display", revoked_at: null };
  globalThis.__calendarAuth.display.enabled = false;
  assert.equal(await getPairedDisplay(request("disabled")), null);
});
test("sync uses the runtime secret map and still requires the cron secret", async () => {
  const env = { SUPABASE_URL: "https://example.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "legacy-future-jwt",
    SUPABASE_SECRET_KEYS: '{"default":"sb_secret_edge"}',
    GOOGLE_CLIENT_ID: "mock-id", GOOGLE_CLIENT_SECRET: "mock-google",
    CALENDAR_CRON_SECRET: "mock-cron" };
  let handler;
  globalThis.Deno = { env: { get: name => env[name] }, serve: fn => { handler = fn; } };
  await import(await compile("supabase/functions/calendar-sync/index.ts", [
    ['"npm:@supabase/supabase-js@2"', sdk], ['"../_shared/server-key.ts"', helper]
  ]));
  assert.deepEqual(globalThis.__calendarAuth.keys, ["sb_secret_edge"]);
  const call = (method, secret) => handler(new Request("https://example.invalid/sync", {
    method, headers: secret ? { "x-cron-secret": secret } : {}
  }));
  assert.equal((await call("GET")).status, 405);
  assert.equal((await call("POST", "wrong")).status, 401);
  const result = await call("POST", "mock-cron");
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { ok: true, processed: 0, results: [] });
});
