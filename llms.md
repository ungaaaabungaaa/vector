# AIKP — Project Context & AI Contributor Guide

This document distills the key facts and conventions about the code-base so that future AI (or human) contributors can jump in and make consistent, working changes quickly.

---

## 1. Stack Overview

• **Framework**: Next.js **15** (App Router, `/src/app`)
• **Language**: TypeScript (strict, `"paths": { "@/*": ["./src/*"] }`)
• **Runtime React**: v19 (Server Components by default)
• **Styling**: Tailwind CSS 4 (+ `class-variance-authority`, `tailwind-merge`)
• **ORM**: Drizzle ORM with PostgreSQL
• Schema files live in `src/db/schema/*`
• Migrations & generated SQL land in `/drizzle`
• Config: `drizzle.config.ts`
• **Environment validation**: `src/env.ts` uses **Zod** to parse **all** `process.env` variables at startup. _Never_ access `process.env` directly elsewhere.
• **Package manager**: **pnpm** (workspace-ready)
• **Dev database**: Docker-compose `postgres:17` (`docker-compose.dev-postgres.yml`)
• **Linting/Formatting**: ESLint (`eslint-config-next`) + Next.js defaults

---

## 2. Local Environment Variables (`.env.local`)

```
BETTER_AUTH_SECRET=<string>
DATABASE_URL=postgresql://devuser:devpass@localhost:5432/devdb
BETTER_AUTH_URL=http://localhost:3000
```

If you introduce a new env var:

1. Add it to the Zod schema in `src/env.ts`.
2. Update this file with a placeholder/default.
3. **NEVER** consume `process.env` directly; import `env` from `@/env` instead.

---

## 3. Dev DB (Docker)

```
username: devuser
password: devpass
database: devdb
port:     5432
image:    postgres:17
```

Spin it up with:

```bash
pnpm dlx --yes docker compose -f docker-compose.dev-postgres.yml up -d
```

---

## 4. NPM/Pnpm Scripts

```jsonc
"dev":         "next dev --turbopack",
"build":       "next build",
"start":       "next start",
"lint":        "next lint",
"db:generate": "drizzle-kit generate",   // Generate SQL from schema
"db:push":     "drizzle-kit push"        // Apply SQL to the database
```

---

## 5. Adding / Updating Things — **Rules for AI**

1. **Use pnpm**
   • Runtime dep: `pnpm add <pkg>`
   • Dev-only : `pnpm add -D <pkg>`

2. **Database**
   • **One-file-per-feature**: put _all_ tables for a feature in a single file, e.g. `src/db/schema/blog.ts`.
   • **Wire-up step**: open `src/db/schema/index.ts` and add `export * from "./blog";`. The aggregated `schema` object is passed to Drizzle automatically, so this keeps type-safety.
   • After every change run `pnpm run db:generate` → commit the generated SQL in `/drizzle`.
   • Push to the dev DB with `pnpm run db:push` if migrations should be applied locally.

3. **Env vars**
   • Extend the Zod schema (`src/env.ts`).
   • Update `.env.local` + mention any required secrets in docs/README.

4. **Imports**
   • Use `@/` alias for paths inside `src`.

5. **Components**
   • Assume Server Components; add `'use client'` at top for client components.

6. **Testing / Linting**
   • Ensure `pnpm run lint` passes. Follow existing ESLint + Prettier rules.

7. **Commit granularity**
   • Group logically related edits; keep diffs minimal.

8. **Type inference over hard-coding**  
   • Derive service-layer types directly from Drizzle tables using `InferInsertModel` / `InferSelectModel` (or `typeof ....$inferSelect` when available) instead of manually duplicating fields.  
   • This guarantees that schema changes cause compile-time errors instead of silently drifting.  
   • Example:

   ```ts
   type ProjectInsert = InferInsertModel<typeof project>;

   // Good → stays in sync automatically
   export type CreateProjectParams = Omit<
     ProjectInsert,
     "id" | "createdAt" | "updatedAt"
   >;
   ```

   Avoid crafting hand-written interfaces like `interface CreateProjectParams { name: string; ... }` when the information can be inferred.

9. **Justify any `any`**  
   • The `any` type is a last resort. If you really need it, add an inline comment explaining _why_ and, ideally, a TODO to remove it later.  
   • PRs without a justification comment next to `any` will be rejected during review.

10. **Router file naming & imports**  
    • All tRPC router source files must end with `*.router.ts` for automatic code-gen & DX tooling. Example: `project.router.ts`.  
    • Update import paths accordingly (`import { projectRouter } from "./project.router";`).  
    • Avoid `await import("./module")` inside routers—use static ES imports so types are checked and bundlers can tree-shake.

11. **Dynamic route params**  
    • In **App Router** server components, `params` is an **async Dynamic API**. Always `await params` before accessing its properties:

    ```ts
    const { projectId } = await params; // ✅ correct
    ```

    • Destructuring synchronously (`const { projectId } = params`) will throw at runtime.

12. **Date & Time handling**  
    • All timestamps are stored in **UTC** in the database.  
    • Use **date-fns** (and [`date-fns-tz`](https://github.com/date-fns/date-fns-tz) if you need conversions) for ALL parsing/formatting—never rely on the built-in `Date` utilities alone.  
    • A shared helper lives in `src/lib/date.ts` (`formatDateForDb`, `toDate`, `DATE_PATTERN`). Import from there instead of rolling your own.  
    • Client code should detect the viewer's IANA timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone` (or a persisted user/org preference) and format dates with date-fns accordingly.  
    • Never store timezone-specific values in the DB—store UTC, convert at the edges.

---

## 6. Folder Snapshot (trimmed)

```
/aikp
├─ AI_PROJECT_PROMPT.md        ← this file
├─ docker-compose.dev-postgres.yml
├─ drizzle.config.ts
├─ package.json
├─ pnpm-lock.yaml
├─ src/
│  ├─ app/                     (Next.js App Router)
│  ├─ db/
│  │  └─ schema/
│  │     └─ index.ts           (Drizzle tables)
│  ├─ env.ts                   (Zod validator)
│  └─ lib/
│     └─ utils.ts
├─ tsconfig.json               (path alias @/*)
└─ .env.local                  (secrets, NOT committed)
```

---

## 7. How to Run Locally

```bash
# Install deps
pnpm install

# Start Postgres container (first time)
pnpm dlx --yes docker compose -f docker-compose.dev-postgres.yml up -d

# Generate migrations (after editing schema)
pnpm run db:generate

# Dev server with Turbopack
pnpm dev
```

---

## 8. Shadcn UI Components

We use [shadcn/ui](https://ui.shadcn.com) for nicely-styled, Radix-powered components. The toolkit ships with a CLI that scaffolds components directly into your project (they are **copied**, not imported as a dependency, so you can fully own & tailor them).

### 8.1 Initial setup — Run **once**

```bash
# Adds the CLI temporarily and runs it
pnpm dlx shadcn@latest init --yes
```

Follow the prompts:

1. **Which style** → `tailwind`
2. **TypeScript** → `yes`
3. **Directory for components** → `src/components`
4. **Alias for import** → `@/components`
5. **Use App Router** → `yes`

This step generates:
• A `components.json` manifest (already in repo)
• Tailwind plugins / config tweaks
• A sample `button.tsx` component (can delete)

### 8.2 Adding components later

```bash
# e.g. add AlertDialog & Tabs components
pnpm dlx shadcn@latest add alert-dialog tabs --yes
```

The CLI reads `components.json` to know where to put files—so commit that file whenever it changes.

### 8.3 Rules for AI

1. **Do not** run `init` again if `components.json` already exists.
2. Always use `pnpm dlx shadcn@latest <command> --yes` so the CLI isn't installed permanently and auto-confirms prompts.
3. After adding components, ensure Tailwind classes compile (`pnpm dev`).
4. Keep component paths under `src/components` and import via `@/components/*`.

> **💡 Professional UI Design Patterns**: The authentication page (`src/app/auth/page.tsx`) serves as the **gold standard** for professional UI design in this codebase:
>
> **Layout Architecture:**
>
> - **Split-screen design**: Left branding panel (hidden on mobile), right form panel
> - **Responsive breakpoints**: `lg:` prefix for desktop layouts, mobile-first approach
> - **Container sizing**: `max-w-sm` for forms, proper padding with `px-6 lg:px-12 xl:px-16`
> - **Vertical centering**: `justify-center` with `min-h-screen` for full-height layouts
>
> **Visual Hierarchy:**
>
> - **Typography scale**: `text-xl` for card titles, `text-base` for descriptions, `text-sm` for labels
> - **Spacing system**: `space-y-8` for major sections, `space-y-6` for card content, `space-y-5` for form fields
> - **Color semantics**: `text-slate-600 dark:text-slate-400` for secondary elements
> - **Interactive states**: Proper `hover:`, `disabled:`, and `focus-visible:` states
>
> **Component Composition:**
>
> - **Card elevation**: `shadow-xl` with `backdrop-blur-sm` for depth
> - **Background treatments**: `
