# Family Display

A Next.js family dashboard hosted on Netlify, with Supabase providing pairing,
saved settings, photo storage, and the calendar cache.

## Development

Install the locked dependencies with `npm ci`, configure the required environment
variables locally, and start the dashboard with `npm run dev`.

Do not commit local environment files or credentials.

## Validation

Run offline regression tests with Node.js 22:

```bash
node --experimental-strip-types --test tests/*.test.mjs
npm run build
```

The Usage validation GitHub Actions workflow runs tests and the Next.js build
with dummy Supabase settings. It does not deploy or change the live database.

## Hosting

Netlify is the production host. Production deployments require explicit
authorization. Use `[skip netlify]` on test commits and draft PR titles to avoid
Netlify builds while GitHub Actions validates the branch.

Automatic Vercel deployments are disabled in `vercel.json`. The remaining account
connection can be disconnected under the Vercel project's Settings > Git.
This setting does not itself remove that connection or delete existing deployments.

The dashboard uses Geist fonts through Next.js. No Vercel hosting service is
required to build or run it.

See [photo bandwidth controls](docs/photo-bandwidth.md) and
[additional usage savings](docs/usage-savings.md) for cache behavior and release checks.
