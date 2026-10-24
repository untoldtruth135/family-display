type ServerKeyEnvironment = {
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SECRET_KEYS?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

// Shared by Next.js servers and Deno functions. Never import from client code.
// This selects credentials; Supabase still performs authentication and authorization.
export function resolveSupabaseServerKey(env: ServerKeyEnvironment): string {
  const modern = env.SUPABASE_SECRET_KEY?.trim();
  if (modern) {
    if (!modern.startsWith("sb_secret_")) {
      throw new Error("SUPABASE_SECRET_KEY must contain a Supabase secret API key.");
    }
    return modern;
  }

  const keyMap = env.SUPABASE_SECRET_KEYS?.trim();
  if (keyMap) {
    let parsed: unknown;
    try { parsed = JSON.parse(keyMap); }
    catch { throw new Error("SUPABASE_SECRET_KEYS must contain a valid key map."); }
    const key = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>).default : undefined;
    if (typeof key !== "string" || !key.trim().startsWith("sb_secret_")) {
      throw new Error("SUPABASE_SECRET_KEYS must contain a default secret API key.");
    }
    return key.trim();
  }

  // Compatibility only, while existing installations migrate. A configured but
  // invalid modern key never silently falls back to the failing legacy key.
  const legacy = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!legacy) throw new Error("Supabase server credentials are not configured.");
  if (legacy.startsWith("sb_publishable_")) {
    throw new Error("A publishable key cannot be used as a Supabase server credential.");
  }
  return legacy;
}
