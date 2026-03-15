# Vector

Open source project management platform built with Next.js, Convex, and Better Auth.

Vector is designed for teams that want issues, projects, teams, permissions, documents, and organization-level workflows in one codebase.

Quick links: [Features](#features) · [Screenshots](#screenshots) · [Quick Start](#quick-start) · [Environment Variables](#environment-variables) · [Development](#development) · [Documentation](#documentation) · [Contributing](#contributing)

![Issues Kanban Board](public/screenshots/issues-kanban.png)

## Features

- Multi-tenant organizations
- Projects, issues, teams, and role-based permissions
- Kanban and table views for issue tracking
- Rich document editor with markdown, mentions, and slash commands
- Real-time data updates with Convex
- Optional email and web-push notification delivery
- Better Auth integration with Convex-backed user data
- Type-safe frontend and backend with TypeScript

## Screenshots

<details>
<summary>Issues — Table View</summary>

![Issues Table View](public/screenshots/issues-table.png)

</details>

<details>
<summary>Project Detail</summary>

![Project Detail](public/screenshots/project-detail.png)

</details>

<details>
<summary>Documents</summary>

![Documents List](public/screenshots/documents.png)

</details>

<details>
<summary>Document Editor</summary>

![Document Detail](public/screenshots/document-detail.png)

</details>

## Stack

- Next.js 16 and React 19
- Convex for database, functions, realtime, and storage
- Better Auth with the Convex adapter
- Tailwind CSS v4, Base UI/Radix primitives, and shadcn/ui
- ESLint, Prettier, Husky, and pnpm

## Project Status

Vector is under active development. The top-level docs in this repository reflect the current contributor workflow. Some files under `docs/migration/` remain as historical implementation notes from earlier architecture work and should not be treated as onboarding documentation.

## Quick Start

### Requirements

- Node.js `>=20.19.0`
- `pnpm`
- A local Convex dev deployment

### Local Setup

1. Install dependencies.

   ```bash
   pnpm install
   ```

2. Create local environment variables.

   ```bash
   cp sample.env .env.local
   ```

3. Update `.env.local` with your local values.

   Minimum app setup usually includes:
   - `NEXT_PUBLIC_APP_URL=http://localhost:3000`
   - `BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000`
   - `BETTER_AUTH_SECRET=<your-secret>`
   - `NEXT_PUBLIC_CONVEX_URL=<your-local-convex-url>`
   - `CONVEX_SITE_URL=http://127.0.0.1:3211`
   - `NEXT_PUBLIC_CONVEX_SITE_URL=http://127.0.0.1:3211`

   `NEXT_PUBLIC_CONVEX_URL` alone is not enough for local auth helpers. The Next.js server also uses `CONVEX_SITE_URL` or `NEXT_PUBLIC_CONVEX_SITE_URL`.

   If you want the assistant enabled locally, also set these in the Convex environment:
   - `OPENROUTER_API_KEY=<your-openrouter-api-key>`
   - `OPENROUTER_MODEL=moonshotai/kimi-k2.5:nitro` (optional override)

   Example:

   ```bash
   pnpm convex env set OPENROUTER_API_KEY <your-openrouter-api-key>
   pnpm convex env set OPENROUTER_MODEL moonshotai/kimi-k2.5:nitro
   ```

4. Start Convex in one terminal.

   ```bash
   pnpm run convex:dev
   ```

5. Start Next.js in another terminal.

   ```bash
   pnpm run dev
   ```

6. Open `http://localhost:3000`.

   On a fresh local instance, visit `/setup-admin` to create the first administrator account.

## Environment Variables

Copy `sample.env` to `.env.local` and update the values.

For local development, Next.js and Convex can both read from the same root env file, so a single `.env.local` is enough. For production, split variables by the runtime that actually reads them.

### Minimum Local Setup

If you only want the app running locally, start with these:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000
BETTER_AUTH_SECRET=<your-secret>
NEXT_PUBLIC_CONVEX_URL=<your-local-convex-url>
CONVEX_SITE_URL=http://127.0.0.1:3211
NEXT_PUBLIC_CONVEX_SITE_URL=http://127.0.0.1:3211
```

Optional for local development:

- SMTP variables if you want real email delivery instead of local logging
- VAPID variables if you want browser push notifications
- `OPENROUTER_API_KEY` if you want the Convex assistant enabled
- `OPENROUTER_MODEL` to override the default assistant model
- `CONVEX_URL` / `CONVEX_ADMIN_KEY` for migration scripts and CLI-only workflows

### Set In Next.js Environment (`.env.local`, Vercel)

| Variable                       | Why it belongs here                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_CONVEX_URL`       | Read by the browser Convex providers and Next.js server code that talks to Convex. |
| `CONVEX_SITE_URL`              | Read by `src/lib/auth-server.ts` on the Next.js server for auth helper requests.   |
| `NEXT_PUBLIC_CONVEX_SITE_URL`  | Fallback for `CONVEX_SITE_URL` in `src/lib/auth-server.ts`.                        |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Read in browser push-subscription code.                                            |

### Set In Convex Environment

| Variable                      | Why it belongs here                                                                                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`          | Read in `convex/auth.ts` to sign Better Auth tokens and encrypt JWKS private keys.                                                                                |
| `NEXT_PUBLIC_APP_URL`         | Read in `convex/auth.ts` as the Better Auth base URL.                                                                                                             |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Read in `convex/auth.ts` for the auth callback allowlist.                                                                                                         |
| `SMTP_HOST`                   | SMTP server hostname for sending emails (OTP codes and notifications).                                                                                            |
| `SMTP_PORT`                   | SMTP port (default `587`, use `465` for SSL).                                                                                                                     |
| `SMTP_USER`                   | SMTP username for authentication.                                                                                                                                 |
| `SMTP_PASS`                   | SMTP password for authentication.                                                                                                                                 |
| `SMTP_FROM`                   | Sender address for outgoing emails, e.g. `Vector <noreply@yourdomain.com>`. Falls back to `SMTP_USER` if not set. Must be a valid email or `Name <email>` format. |
| `VAPID_PUBLIC_KEY`            | Read in `convex/notifications/actions.ts` for push delivery.                                                                                                      |
| `VAPID_PRIVATE_KEY`           | Read in `convex/notifications/actions.ts` for push delivery.                                                                                                      |
| `VAPID_SUBJECT`               | Read in `convex/notifications/actions.ts` for push delivery.                                                                                                      |
| `OPENROUTER_API_KEY`          | Required by `convex/ai/provider.ts` for the organization assistant and all agent responses.                                                                       |
| `OPENROUTER_MODEL`            | Optional model override for `convex/ai/provider.ts`. Defaults to `moonshotai/kimi-k2.5:nitro`.                                                                    |

`NEXT_PUBLIC_APP_URL` has a public-looking prefix, but the current code reads it from Convex auth code rather than browser code.

SMTP and VAPID settings are optional. If you leave them unset locally, the core app still runs. `OPENROUTER_API_KEY` is only required if you want the assistant feature to work.

### Local CLI / Convex Tooling Only

| Variable            | Why it belongs here                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `CONVEX_URL`        | Used by `scripts/run-permission-migrations.ts` when invoking `pnpm convex run`.                |
| `CONVEX_ADMIN_KEY`  | Only needed by `scripts/run-permission-migrations.ts` for admin-only migrations.               |
| `CONVEX_DEPLOYMENT` | Managed by the Convex CLI during local development. It is not read by the application runtime. |

## Development

| Command                  | Purpose                                                   |
| ------------------------ | --------------------------------------------------------- |
| `pnpm run dev`           | Start the Next.js development server                      |
| `pnpm run convex:dev`    | Run the local Convex backend and code generation          |
| `pnpm run lint`          | Run ESLint                                                |
| `pnpm run build`         | Build the production app                                  |
| `pnpm run format`        | Format the repository with Prettier                       |
| `pnpm run project:setup` | Install dependencies, prepare hooks, and print next steps |

## Documentation

Start with:

- Contributor docs: [docs/index.md](docs/index.md)
- Local setup: [docs/getting-started/01-local-setup.md](docs/getting-started/01-local-setup.md)
- Environment variables: [docs/getting-started/02-environment-variables.md](docs/getting-started/02-environment-variables.md)
- Common commands: [docs/getting-started/04-common-commands.md](docs/getting-started/04-common-commands.md)
- GitHub development tracking test guide: [docs/development/09-github-development-tracking.md](docs/development/09-github-development-tracking.md)

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), then check [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) and [SECURITY.md](SECURITY.md) for the expected collaboration and reporting process.

## License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE).
