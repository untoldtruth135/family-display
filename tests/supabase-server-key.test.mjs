import assert from "node:assert/strict";
import test from "node:test";
import { resolveSupabaseServerKey as resolve } from "../supabase/functions/_shared/server-key.ts";

test("explicit modern secret wins over the legacy key and runtime map", () => {
  assert.equal(resolve({ SUPABASE_SECRET_KEY: " sb_secret_website ",
    SUPABASE_SECRET_KEYS: '{"default":"sb_secret_edge"}',
    SUPABASE_SERVICE_ROLE_KEY: "legacy-future-jwt" }), "sb_secret_website");
});
test("Edge runtime default secret is selected instead of the built-in legacy key", () => {
  assert.equal(resolve({ SUPABASE_SECRET_KEYS: '{"default":" sb_secret_edge "}',
    SUPABASE_SERVICE_ROLE_KEY: "legacy-future-jwt" }), "sb_secret_edge");
});
test("legacy-only installations keep their existing credential", () => {
  assert.equal(resolve({ SUPABASE_SERVICE_ROLE_KEY: " legacy-jwt " }), "legacy-jwt");
  assert.equal(resolve({ SUPABASE_SECRET_KEY: " ", SUPABASE_SECRET_KEYS: "",
    SUPABASE_SERVICE_ROLE_KEY: "sb_secret_existing-slot" }), "sb_secret_existing-slot");
});
test("invalid modern configuration fails closed without leaking it or using legacy", () => {
  for (const env of [
    { SUPABASE_SECRET_KEY: "sensitive-invalid-value" },
    { SUPABASE_SECRET_KEYS: "sensitive-invalid-json" },
    { SUPABASE_SECRET_KEYS: "null" }, { SUPABASE_SECRET_KEYS: "[]" },
    { SUPABASE_SECRET_KEYS: '{"other":"sb_secret_not-default"}' },
    { SUPABASE_SECRET_KEYS: '{"default":123}' },
    { SUPABASE_SECRET_KEYS: '{"default":"sb_publishable_wrong"}' },
  ]) {
    assert.throws(() => resolve({ ...env, SUPABASE_SERVICE_ROLE_KEY: "legacy" }),
      error => !/sensitive|not-default|sb_publishable_wrong/.test(error.message));
  }
});
test("missing and publishable server credentials are rejected", () => {
  assert.throws(() => resolve({}), /not configured/);
  assert.throws(() => resolve({ SUPABASE_SERVICE_ROLE_KEY: "sb_publishable_public" }), /publishable/);
});
