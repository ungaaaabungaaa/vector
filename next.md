# Next Steps: Service Layer Implementation for Project Management

Now that the core database schema for **Teams, Projects, Issues, Comments & Activity** has landed, the next milestone is to expose these tables through a clean, type-safe service layer and tRPC API. This doc lists the recommended work packages in order.

---

## 0. Platform & Workspace Foundation (Better-Auth Organization) — **COMPLETED** ✅

| Task                                             | Status |
| ------------------------------------------------ | ------ |
| Organization plugin wired on server & client     | ✅     |
| `pnpm run db:auth:generate` — regenerated schema | ✅     |
| `pnpm run db:generate` ➜ Drizzle migration       | ✅     |
| `pnpm run db:push` — migrated dev DB             | ✅     |

Remaining follow-ups:

1. `allowUserToCreateOrganization: true` — decide if self-serve workspaces should stay on.
2. `auth-client` now includes the `organizationClient()` plugin — use `authClient.useActiveOrganization()` instead of a custom helper. **Done ✅**
3. **Data-ownership checks** – update service layer queries to always scope by `organizationId`.

## 1. Data-Access & Business Services (`src/entities/*`)

🆕 **Role model clarification**

- Organisation scope → `member`, `admin` (handled by Better-Auth `member.role`).
- Project scope → `member`, `lead` (stored in `project_member.role`).

Schema update: `project_member` now includes a `role` column (`default "member"`). Regenerate & push migration.

1. **Teams** – `src/entities/teams/team.service.ts` — **Completed ✅**
   • CRUD operations (createTeam, updateTeam, addMember, removeMember, …)
   • Helper to generate the next `sequenceNumber` for issues (`getNextIssueSequence`)

2. **Projects** – `src/entities/projects/project.service.ts`
   • CRUD + member management helpers
   • **Workflow statuses** – new `project_status` table (organisation-scoped). `project.statusId` now points to these rows.
   • Business rule: a project can only reference members that belong to the owning team

3. **Issues** – `src/entities/issues/issue.service.ts` — **Completed ✅**
   • CRUD, status/priority, assignment helpers, activity logging
   • Text-search helpers still TODO (index later)

4. **Comments** – `src/entities/issues/comment.service.ts` — **Completed ✅**
   • CRUD + soft-delete with activity logging

## 2. tRPC Routers (`src/trpc/routers/*`) — **Completed ✅**

Routers implemented:  
• `team.router.ts` – team & member CRUD  
• `project.router.ts` – project CRUD & membership  
• `issue.router.ts` – issue lifecycle & comment endpoints  
All registered in the root `_app.ts` router.  
Role-gating middleware implemented (`assertAdmin`, `assertProjectLeadOrAdmin`, `assertAssigneeOrLeadOrAdmin` helpers in `src/trpc/permissions.ts`).

## 3. Better-Auth Role Integration — **Completed ✅**

Roles handled: `member`, `lead`, `admin` (Better-Auth) + `project_member.role`.  
Centralised permission helpers (`src/trpc/permissions.ts`) enforce:

• **Admin-only** – team CRUD.  
• **Lead or Admin** – project CRUD.  
• **Member** – create issues / comments (with membership check).  
• **Assignee or Lead or Admin** – status, priority, assignee mutations.

Routers import these helpers, so future endpoints get role gating for free.

## 4. UI Routes & Navigation

**Route convention**
`/<orgId>/…` → organisation-scoped pages (requires auth).
Global user pages live outside the org prefix so they are always reachable.

### 4.1 Post-login redirect

1. Read the user's **lastActiveOrganizationId** from Better-Auth (`organizationClient().getActive()`).
2. Fallback to the first membership row when the value is null.
3. `router.push(`"/${orgId}/dashboard"`)` once resolved.

### 4.2 Organisation-scoped routes

| Path                                     | Purpose                                                          |
| ---------------------------------------- | ---------------------------------------------------------------- |
| `/<orgId>/dashboard`                     | Overview – pinned projects, recent activity feed, quick links    |
| `/<orgId>/teams`                         | List all teams in the org                                        |
| `/<orgId>/teams/[teamId]`                | Team detail – members, projects, role management (admin only)    |
| `/<orgId>/projects`                      | List projects (filters: team, status, lead, search)              |
| `/<orgId>/projects/[projectId]`          | Project kanban board (workflow columns)                          |
| `/<orgId>/projects/[projectId]/settings` | Project settings (lead/admin only)                               |
| `/<orgId>/issues`                        | Organisation-wide issue list (assignee, project, status filters) |
| `/<orgId>/issues/[issueId]`              | Issue detail – description, activity, comments                   |
| `/<orgId>/settings`                      | Organisation settings (general, members, billing, integrations)  |

### 4.3 Global (non-org) routes

• `/settings/profile` — user profile & account settings  
• `/auth/*` — authentication flows

### 4.4 App Router structure

• `src/app/[orgId]/layout.tsx` wraps all org routes with a shared sidebar & org-switcher.  
• Child pages sit under the same directory mirroring the path table above.  
• `src/middleware.ts` guards all `/<orgId>/…` paths (redirect to `/login` when unauthenticated).  
• Prefer **Server Components** for data-fetching wrappers; sprinkle **Client Components** for interactive widgets (kanban drag-and-drop, comment editor, etc.).

Use the spacing & typography guidelines in `llms.md` to ensure visual consistency across pages.

### 4.5 UX Flow & User Journeys

> The following flows translate the **On-boarding & Organisation Switching** scenarios from `requirements.md` into concrete screen transitions.

**A. New signup → Create organisation**

1. User lands on `/auth/signup` (Google OAuth).
2. Upon first login the backend detects **no membership rows** → redirect to `/org-setup` wizard.
3. Wizard collects _organisation name_, optional _logo_.
4. `await authClient.organization.create({ name, slug, logo })` ➜ Better-Auth returns new org; user becomes **admin**.
5. Auto-seed default project settings ➜ redirect to `/${orgId}/dashboard` (see 4.2 table).
6. Toast: "Welcome to AIKP – invite your team to get started!"

**B. Invitation → New platform user**

1. User clicks invite link (`/auth/invite/<token>`). Token encodes target org.
2. Shows **Accept Invite** form (password + name). On submit:
   • Creates account, joins org as **member**.
3. Redirects to `/${orgId}/dashboard` with inline nudge to link Discord (`/settings/profile`).

**C. Invitation → Existing platform user**

1. Logged-in user hits invite link.
2. Backend creates membership row, sets **activeOrg** to invited org.
3. Soft reload via Next.js router ➜ `/${orgId}/dashboard`.
4. Org-switcher (header) can toggle back to previous workspaces.

**D. Day-to-day navigation**

1. Landing on Dashboard shows last visited project board (persisted in `localStorage`).
2. Sidebar: Teams → Projects → Issues hierarchy.
3. Selecting an issue opens **side-panel** on boards (`/${orgId}/projects/[projectId]`) or full page at `/${orgId}/issues/[issueId]`.
4. Global command-palette (`⌘K`) enables fuzzy quick-switch between teams/projects/issues.

**E. Auth fallback / expired session**
• Any request that fails auth triggers middleware redirect to `/auth/login?next=<originalPath>` so users return exactly where they left off after re-auth.

These journeys should steer component state (breadcrumbs, org-switcher context) and inform Cypress e2e tests later on.

## 5. Migrations & Seed Data

1. `pnpm run db:auth:generate` – re-sync auth schema after plugin config changes.
2. `pnpm run db:generate` – regen Drizzle migrations for app tables.
3. `pnpm run db:push` – apply locally & in CI.
4. Optional: write a seed script that creates a sample organization, team, project and user.

## 6. Documentation Updates

• Update `README.md` with new migrate/seed instructions.  
• Extend `requirements.md` with team/project concepts.

---

### 🚧 Blockers / Open Questions

1. **Search** – Do we need full-text search on issues now or later?
2. **Labels & Sprints** – Are they in scope for the MVP?
3. **Row Level Security** – Consider enabling RLS once Supabase or similar is introduced.

Feel free to adjust priorities based on product needs. 🎉

## 5. Members & Access — Implementation Plan

The current UI surfaces stubs for "Invite" and "Manage Members" but the functionality is not wired yet. The following phased plan will deliver a complete members & invitations flow.

### 5.1 DB & Service Layer (backend)

1. **Invitation table enhancements**
   • Ensure `invitation.status` enum values: `pending`, `accepted`, `expired`, `revoked`.<br/>
   • Add `createdAt` + `acceptedAt` timestamps.
2. **OrganizationService** additions
   • `listMembers(orgId)` → returns members + roles.<br/>
   • `inviteMember({ email, role })` → creates pending invite & sends email.<br/>
   • `acceptInvite(token, userId)` → onboards the user, updates status.
3. **Permission checks**
   • Only `owner`/`admin` can invite, revoke, or change roles.
4. **Email templates** (to be sent via Postmark): `invite-org` using Tailwind for styling.

### 5.2 tRPC Endpoints

```
organization.listMembers   // query
organization.invite        // mutation
organization.resendInvite  // mutation
organization.revokeInvite  // mutation
organization.updateRole    // mutation
invitation.accept          // public mutation (token)
```

Each protected by middleware (`assertAdmin`, `assertOwner`) as needed.

### 5.3 Client Components

1. **MembersList** – paginated table (name, email, role, last active). Role editable inline for admins.
2. **InviteDialog** – modal with email + role selector, uses `trpc.organization.invite`.
3. **PendingInvitesList** – collapsible section under Members card, with "Resend" & "Revoke".
4. **RoleBadge** – visually differentiates `owner`, `admin`, `member` per design tokens.

### 5.4 Routes & UI wiring

• Clicking "Invite" opens `InviteDialog`.<br/>
• "Manage Members" links to `/${orgId}/settings#members` (same page anchor) where the full list & invites are rendered.

### 5.5 Validation & Tests

1. Cypress e2e: invite flow, accept link, role-gated actions.
2. Unit tests for service helpers with a mocked DB.

### 5.6 Stretch Goals

• Bulk CSV invite upload.<br/>
• Slack DM invite via OAuth.

_Tracked in Jira → Epic **ORG-AC**_
