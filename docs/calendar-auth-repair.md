# Calendar authentication repair (not deployed)

On October 24 the paired display configuration and scheduled calendar sync both
returned "JWT issued at future". Retained sync responses show the failure by
09:21 UTC, before the 15:02 UTC weather release. SQL access confirmed 104 events,
two calendars, five active pairings, and last successful sync at October 23 22:48 UTC.
These observations identify a database authentication failure, but do not prove
whether the legacy credential or the provider validation clock caused it.

The previous website selected SUPABASE_SERVICE_ROLE_KEY before SUPABASE_SECRET_KEY.
The sync function only read the legacy variable. Both now use the same resolver:
1. SUPABASE_SECRET_KEY (explicit sb_secret_ value).
2. SUPABASE_SECRET_KEYS JSON map, default entry (Supabase Edge runtime format).
3. SUPABASE_SERVICE_ROLE_KEY for backwards compatibility only.
An invalid configured modern value fails closed without exposing key material.
Existing display cookie/hash/revocation checks, household scope, Google OAuth state,
cron shared-secret authorization, and database policies are unchanged.

The dashboard shows a connection failure rather than claiming no calendars were
selected, and Today/Tomorrow distinguish an unavailable calendar from no events.

## Release prerequisites

No credentials, settings, database contents, cron jobs or deployments are changed
by this PR. Netlify currently lists SUPABASE_SERVICE_ROLE_KEY, but not
SUPABASE_SECRET_KEY. Before a future release, securely configure the existing
Supabase secret API key as SUPABASE_SECRET_KEY for the website's production
Functions runtime. Do not place it in NEXT_PUBLIC_* variables or source control.
Confirm that the Edge runtime supplies SUPABASE_SECRET_KEYS with a default entry,
or configure SUPABASE_SECRET_KEY there. Do not disable legacy keys yet.

Next.js and calendar-sync are separate deployment targets. A Netlify deployment
alone does not update the Supabase function. When separately authorized, release
both and verify paired display config, calendar event payload, fresh persisted
synced_at, and every sync results[].ok; HTTP 200 alone is insufficient.
If modern credentials still produce the timestamp error, escalate to Supabase
with timestamps and request IDs. Do not rewrite/sign JWTs, alter clocks, disable
validation or return privileged cached data to an unauthenticated request.

Official migration reference:
https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys

Offline tests use fake credentials and mock responses. They prove selection,
authorization preservation, error handling and recovery; they cannot certify
live restoration without the future configuration/release steps.
