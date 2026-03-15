# Local Setup

This guide walks through the current local development workflow for Vector.

## Prerequisites

- Node.js `>=20.19.0`
- `pnpm`
- A local Convex development deployment

## Installation

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Create local environment variables**

   ```bash
   cp sample.env .env.local
   ```

3. **Update `.env.local`**

   Minimum local app setup usually includes:
   - `NEXT_PUBLIC_APP_URL=http://localhost:3000`
   - `BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000`
   - `BETTER_AUTH_SECRET=<your-secret>`
   - `NEXT_PUBLIC_CONVEX_URL=<your-local-convex-url>`
   - `CONVEX_SITE_URL=http://127.0.0.1:3211`
   - `NEXT_PUBLIC_CONVEX_SITE_URL=http://127.0.0.1:3211`

   See [Environment Variables](./02-environment-variables.md) for the full breakdown.

4. **Start Convex**

   ```bash
   pnpm run convex:dev
   ```

   Keep this running while you work on Convex functions or schema changes so generated bindings stay current.

5. **Start Next.js**

   ```bash
   pnpm run dev
   ```

6. **Open the app**

   Visit [http://localhost:3000](http://localhost:3000).

7. **Bootstrap the first admin**

   On a fresh local instance, open [http://localhost:3000/setup-admin](http://localhost:3000/setup-admin) to create the initial administrator account.

## Notes

- `pnpm run project:setup` is available as a lightweight bootstrap helper for dependencies and Git hooks.
- Optional SMTP settings can be left unset during local development.
- Optional VAPID settings are only needed if you want browser push notifications locally.
