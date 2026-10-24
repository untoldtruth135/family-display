# Weather freshness repair

The October 24 read-only investigation reproduced a successful API response with
53 F / Clear and a forecast beginning October 23 while the provider returned
39.6 F / Overcast for October 24 at 07:00 local time. The exact internal
revalidation failure could not be recovered from the stalled hosting log viewer.

This repair removes nested framework/provider caching for weather. The route is
dynamic and consumes provider bodies within an eight-second deadline, retrying
once. Only successful, validated observations get a five-minute shared HTTP cache
with must-revalidate and explicit location query variation. Browser and error
responses use no-store, including explicit Netlify cache controls. No stale-while-
revalidate policy is used for this endpoint.

The provider observation time and its UTC offset are preserved as observedAt;
fetchedAt is separate. Observations over thirty minutes old, missing provenance,
invalid data, and unreasonable future timestamps are rejected. Client requests
have a forty-second deadline covering headers and body, including transports
that do not settle after abort. Requests retry with one-to-thirty-minute backoff.

Awake displays refresh every thirty minutes. Resume rechecks saved data age;
online recovery retries immediately. Displayed observations stay current for sixty minutes (the thirty-minute incoming\nobservation limit plus one thirty-minute polling interval). Older readings show\nLast known even if the last request succeeded. The two-hour outage limit is unchanged.\nA timestamp under the weather icon shows
As of or Last known. Only readings at most two hours old remain as outage fallback.
Legacy saved weather without timestamps is ignored. The calendar, photos, and
Supabase access patterns are unchanged.

GitHub-only validation uses mock weather/clock and an isolated local server:
real provider freshness, timeout/retry, stale success rejection, old-data expiry,
network recovery, and the existing TV layouts. It cannot certify hosted CDN
behavior until a separately authorized release. No deployment or cache purge
is part of preparing this repair.
