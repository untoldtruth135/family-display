# Additional usage savings

Prepared on a test branch; no live cron or production deployment is performed.

- Calendar requests with a saved ETag authenticate first, then query only hash,
  freshness, and coverage metadata. Matching versions return 304 without reading
  the event payload from Supabase. Changed versions still load the complete cache.
  Month rollover retains the existing coverage checks, empty-cache semantics, and
  household scoping. The browser sends ETags only after restoring valid saved data.
- Weather restored from local storage avoids an immediate fetch while under two
  hours old. Older data remains usable for up to twelve hours during an outage.
  Geocoding is cached for one day, forecasts for fifteen minutes, and successful
  public weather responses have a fifteen-minute shared-cache lifetime.
- Background photo manifest checks pause while the page is hidden or scheduled
  asleep. On resume, pairing and current membership are checked again before
  private photo bytes are restored. Existing download budgets are unchanged.
- Configuration polling remains every five minutes so schedule changes and
  scheduled messages continue working. Four displayed weeks and the eight-week
  calendar horizon are unchanged.
- ops/calendar-sync-five-minutes.sql is a separately applied, guarded operation:
  one-minute to five-minute cadence, 1440 to 288 scheduled runs per day.
  It allows up to five minutes for newly changed calendar events to synchronize.
  The calendar stale indicator becomes fifteen minutes to allow scheduling jitter.
  GitHub tests do not apply the SQL, call Google, or access live Supabase data.

## Validation and release

GitHub Actions installs the committed npm lockfile, runs offline regression tests,
and builds Next.js with dummy Supabase configuration. It has read-only repository
permissions and no deployment step. Use [skip netlify] on branch commits and the
PR title to suppress Netlify builds while still running GitHub Actions.

Do not merge or apply the SQL until a separate production release is authorized.
After release, check per-household sync results and persisted cache freshness;
HTTP 200 alone is insufficient. Compare Supabase's service-specific daily usage
after at least one full day, separating cached and uncached usage.

