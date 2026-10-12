# Dashboard photo bandwidth controls

Photos are authorized by a fresh paired /api/backgrounds manifest on startup and hourly thereafter. The image cache is scoped to the pairing, and file versions are hashes of immutable storage paths plus creation timestamps. Uploads use a new UUID path with upsert disabled; replacing an image must also use a new path. Disabled/deleted photos are removed on the next manifest refresh.

The slideshow renders blob URLs only. Cache failures, missing persistent budget storage, and quota exhaustion never fall back to remote image URLs. Existing local photos continue to rotate. A fresh startup without a working manifest uses the plain dashboard background until authorization succeeds.

Limits per browser installation:
- 20 MB of image-body reservations per UTC day.
- 100 MB across the last 31 UTC dates (independent of the Supabase billing date).
- 5 MB per downloaded image; 64 MB and 64 images in the local cache.
- New uploads: at most 1920 pixels on the longest side and 400 KB encoded.

Downloads reserve 5 MB in localStorage before the request. Successful cached responses settle to their actual body size. Failed, interrupted, or uncacheable requests keep the reservation. Clearing browser data resets this ledger, so these are application safeguards, not an organization-level billing cap. Web Locks serialize cache operations across supporting browser tabs; a module queue also serializes requests within each page. Browser-managed eviction is handled by the same download budget.

The console reports cacheHits, downloads, downloadedBytes, and skipped without logging private photo URLs. Compare Supabase uncached egress after clients reload onto this release; keep total usage below 100 MB/day as an operating target. Each additional browser has its own allowance. Other storage clients and API traffic also consume the organization quota.

Validation: node --test tests/background-photo-cache.test.mjs tests/calendar-cache.test.mjs; npm run build. A browser fixture also verified one initial image download, zero downloads for renewed signed URLs, and zero downloads after a full reload; an oversized noisy upload was reduced to 372050 bytes at 1080 x 810.

Existing production photo optimization on 2026-10-12: the display copy was reduced from 2938748 to 350508 bytes (88 percent). The original object remains intact. The rollback mapping and original bytes are preserved in the existing Codespace under /tmp/fd-background-migration; restore the original storage_path association from applied.json if needed. No photo objects were deleted.
