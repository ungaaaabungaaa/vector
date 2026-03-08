# Environment Variables

Vector currently reads a small set of auth, frontend, and Convex environment variables directly at runtime. Locally, both Next.js and Convex read from the same root env files, so `.env.local` can contain everything. In production, split variables by the runtime that actually reads them.

## Local Setup (`.env.local`)

For local development, create a `.env.local` file in the root of the project. You can start by copying `sample.env`.

```bash
cp sample.env .env.local
```

### Set In Next.js Environment (`.env.local`, Vercel)

| Variable                       | Confirmed usage                                                                                | Example                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------- | ----------------------- |
| `NEXT_PUBLIC_CONVEX_URL`       | Read by `src/providers/*`, `src/app/api/files/[...key]/route.ts`, and `src/lib/auth-server.ts` | `http://127.0.0.1:3210` |
| `CONVEX_SITE_URL`              | Read by `src/lib/auth-server.ts` on the Next.js server                                         | `http://127.0.0.1:3211` |
| `NEXT_PUBLIC_CONVEX_SITE_URL`  | Fallback read by `src/lib/auth-server.ts`                                                      | `http://127.0.0.1:3211` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Read by `src/lib/notifications.ts` in the browser                                              | `your_vapid_public_key` |

### Set In Convex Environment

| Variable                      | Confirmed usage                                              | Example                             |
| ----------------------------- | ------------------------------------------------------------ | ----------------------------------- |
| `BETTER_AUTH_SECRET`          | Read by `convex/auth.ts`                                     | `replace-with-a-long-random-secret` |
| `AUTH_SECRET`                 | Fallback read by `convex/auth.ts`                            | `replace-with-a-long-random-secret` |
| `NEXT_PUBLIC_APP_URL`         | Read by `convex/auth.ts` as Better Auth base URL             | `http://localhost:3000`             |
| `NEXT_PUBLIC_SITE_URL`        | Fallback read by `convex/auth.ts`                            | `http://localhost:3000`             |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Read by `convex/auth.ts` for trusted callback origins        | `http://localhost:3000`             |
| `SMTP_HOST`                   | Read by `convex/notifications/actions.ts` for email delivery | `smtp.resend.com`                   |
| `SMTP_PORT`                   | Read by `convex/notifications/actions.ts` for email delivery | `465`                               |
| `SMTP_USER`                   | Read by `convex/notifications/actions.ts` for email delivery | `resend`                            |
| `SMTP_PASS`                   | Read by `convex/notifications/actions.ts` for email delivery | `your_resend_api_key`               |
| `SMTP_FROM`                   | Read by `convex/notifications/actions.ts` for email delivery | `"Vector" <noreply@example.com>`    |
| `VAPID_PUBLIC_KEY`            | Read by `convex/notifications/actions.ts` for push delivery  | `your_vapid_public_key`             |
| `VAPID_PRIVATE_KEY`           | Read by `convex/notifications/actions.ts` for push delivery  | `your_vapid_private_key`            |
| `VAPID_SUBJECT`               | Read by `convex/notifications/actions.ts` for push delivery  | `mailto:notifications@example.com`  |

`NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_SITE_URL` look like frontend variables, but the current code only reads them inside `convex/auth.ts`.

### Local CLI / Convex Tooling Only

| Variable            | Confirmed usage                                         | Example                 |
| ------------------- | ------------------------------------------------------- | ----------------------- |
| `CONVEX_URL`        | Read by `scripts/run-permission-migrations.ts`          | `http://127.0.0.1:3210` |
| `CONVEX_ADMIN_KEY`  | Read by `scripts/run-permission-migrations.ts`          | `your_admin_key`        |
| `CONVEX_DEPLOYMENT` | Managed by the Convex CLI, not read by application code | auto-set by `convex`    |

## Adding New Variables

1. Add the variable to the runtime code that uses it.
2. Put it in the env for the runtime that reads it. Do not assume the `NEXT_PUBLIC_` prefix tells you the deployment target.
3. If the variable should be validated centrally in Next.js code, add it to `src/env.ts`.
4. Add it to `sample.env` with a safe local placeholder.
5. Update this documentation.
