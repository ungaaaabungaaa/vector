# AIKP Product Requirements Document

## 1. Introduction

AIKP is a Next.js–based standalone service designed to streamline project communication and task follow-ups within an organization. It combines a web UI, Discord integration, and AI-driven workflows to keep teams aligned on project activities and issue resolution.

## 2. Purpose

- Provide employees with a unified interface to log in, link Discord accounts, and interact with project data.
- Empower the AI to answer routine queries or escalate issues to Points of Contact (POCs) and project leads.
- Automate task follow-ups, ensuring timely completion and visibility across teams.

## 3. Scope

- Employee authentication via internal Google Auth scoped to a single organization.
- Discord bot for AI-driven interactions and notifications.
- Web UI for project management and user profile linking.
- AI logic for query handling, escalation, and automated follow-ups.

## 4. User Roles

- **Employee (Member):** Logs in, links Discord, and receives AI responses or follow-ups.
- **Point of Contact (POC):** Assigned per project; escalated issues and configures follow-ups.
- **Project Lead:** Oversees multiple POCs; can create projects, assign roles, and review follow-up statuses.
- **Administrator:** Manages overall hierarchy, projects, and permission scopes.

## 5. Key Features

### 5.1 Authentication & User Management

- Google OAuth scoped to the organization's domain.
- Post-signup flow to link Discord account via secure token.
- Role assignment (Member, POC, Lead, Admin) through the Admin UI.

### 5.2 Project & Hierarchy Management

- Admin UI to create and manage Projects.
- Define hierarchy: assign POCs and Leads per project.
- Each Project record contains:

  - Members list
  - POCs list
  - Lead

### 5.3 AI-Driven Query Handling

- Discord bot listens for member questions.
- AI consults OpenProject context for answers.
- If unable to resolve, AI escalates the query to the POC/Lead in Discord or via the web UI.

### 5.4 Follow-Ups for Issues

- **Definition:** A Follow-Up is an automated reminder chain for assigned tasks.
- POCs configure which tasks require follow-ups per project.
- AI sends prompts in Discord to assigned members:

  1. "Have you completed Task X?"
  2. Members respond with completion status and optional PR link.
  3. AI continues reminders until task marked done.

- Optional: enforce PR link submission as completion proof.

### 5.5 Notifications & Escalations

- Real-time notifications in Discord channels for escalated issues.
- Web UI dashboard for tracking open follow-ups and pending escalations.

## 6. Technical Architecture

- **Frontend:** Next.js app with Tailwind CSS for the UI.
- **Backend:** Node.js/Express API for business logic and AI orchestration.
- **Discord Integration:** Bot using Discord.js tied to backend endpoints.
- **AI Layer:** GPT-based model with access to OpenProject API context.
- **Database:** PostgreSQL for users, roles, projects, and follow-up records.
- **Auth:** Google OAuth for signup; JWT for session management.

## 7. Non-Functional Requirements

- **Security:** Org-scoped authentication; Discord tokens encrypted at rest.
- **Scalability:** Stateless Next.js deployment; horizontal scaling for API and bot.
- **Reliability:** Retry logic for follow-ups; monitoring and alerting on failures.

## 8. Future Enhancements

- Support for additional communication channels (Slack, Teams).
- Analytics dashboard for follow-up performance metrics.
- Customizable AI response templates per project.
