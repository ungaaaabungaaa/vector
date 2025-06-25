# AIKP Product Requirements Document

## 1. Introduction

AIKP is a Next.js–based standalone service designed to streamline project communication and task tracking within an organization. It combines a web UI, Discord integration, and real-time notifications to keep teams aligned on project activities and issue resolution.

## 2. Purpose

- Provide employees with a unified interface to log in, link Discord accounts, and interact with project data.
- Deliver real-time notifications for comments, assignments and status changes.
- Allow project leads and admins to triage and prioritise issues efficiently.

## 3. Scope

- Employee authentication via internal Google Auth scoped to a single organization.
- Discord bot for notifications and basic slash-commands (e.g. create issue).
- Web UI for team / project management and user profile linking.

## 4. User Roles

- **Member:** Default role – can read & contribute within granted projects.
- **Project Lead:** Can create/update projects, triage issues and manage project members.
- **Administrator:** Organisation-wide privileges – manage members, teams and projects.

### 4.1 Organisation-level Roles (Better-Auth `member.role`)

| Role       | Scope        | Capabilities                              |
| ---------- | ------------ | ----------------------------------------- |
| **Admin**  | Organisation | Manage members, projects, teams           |
| **Member** | Organisation | Read & contribute within granted projects |

### 4.2 Project-level Roles (`project_member.role`)

| Role       | Scope   | Capabilities                                   |
| ---------- | ------- | ---------------------------------------------- |
| **Lead**   | Project | CRUD on project, manage members, triage issues |
| **Member** | Project | Create / update own issues & comments          |

_A two-layer model lets a user be an admin in their own organisation yet just a member when invited elsewhere._

The database reflects this:

- Organisation role → `member.role` (Better-Auth table)
- Project role → `project_member.role` (column, default **member**, optional **lead**)

Access-control middleware and service-layer queries MUST check **both** roles.

## Organization Roles

| Role   | Permissions                                                                                                |
| ------ | ---------------------------------------------------------------------------------------------------------- |
| owner  | Full control over the organization. Can delete the org. Only one owner per org (creator is auto-promoted). |
| admin  | Manage settings, members, billing, etc. Cannot delete the organization.                                    |
| member | Standard user, no administrative rights.                                                                   |

Notes:

- The `member_role` Postgres enum enforces the allowed values (`owner`, `admin`, `member`).
- Server logic treats `owner` **and** `admin` the same for all typical admin-level actions; delete-organization endpoints require `owner`.

## 5. Key Features

### 5.1 Authentication & User Management

- Google OAuth (organisation-scoped)
- Post-signup flow to link Discord
- Role assignment (Member, Lead, Admin) through the Admin UI

### 5.2 Project & Hierarchy Management

- Admin UI to create/manage Teams & Projects
- Define hierarchy: assign Leads per project
- Each Project record stores members list + Lead

### 5.3 Real-time Notifications

- Discord bot relays comment/issue events to project channels
- Web-UI toast & inbox for mentions / assignments

## 6. Technical Architecture

- **Frontend:** Next.js app with Tailwind CSS for the UI.
- **Backend:** Node.js/Express API for business logic and AI orchestration.
- **Discord Integration:** Bot using Discord.js tied to backend endpoints.
- **AI Layer:** GPT-based model with access to OpenProject API context.
- **Database:** PostgreSQL for users, roles, teams, projects and issues.
- **Auth:** Google OAuth for signup; JWT for session management.

## 7. Non-Functional Requirements

- **Security:** Org-scoped authentication; Discord tokens encrypted at rest.
- **Scalability:** Stateless Next.js deployment; horizontal scaling for API and bot.
- **Reliability:** Notification retry logic; monitoring and alerting on failures.

## 8. Future Enhancements

- Support for additional communication channels (Slack, Teams).
- Analytics dashboard for notification / activity metrics.
- Customizable response templates per project.

### 9. On-boarding & Organisation Switching Use Cases

1. **New signup → create organisation**

   1. User signs up ➜ redirected to **organisation setup** wizard.
   2. Wizard collects _org name_, _slug_ (+ optional logo).
   3. Upon completion the user becomes **admin** of the new org (`member.role = "admin"`).
   4. Default project settings are seeded; user lands on **Dashboard**.

2. **Invite to existing org → new platform user**

   1. User receives invitation email, clicks link.
   2. Completes minimal signup (password, name).
   3. Invitation is accepted ⇒ they become **member** of the inviting org.
   4. No personal organisation is created.

3. **Invite to existing org → existing platform user**
   1. Logged-in user clicks invite link.
   2. Invitation accepted; new `member` row is created in that org.
   3. UI switches active organisation to the newly joined one.
   4. User can toggle between organisations via org-switcher (uses Better-Auth `organization.setActive`).
