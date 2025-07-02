import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  integer,
  index,
  primaryKey,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user, organization } from "./users-and-auth";
import { team } from "./teams";

// ----- Project Status Types (following Linear's approach) -----
export const projectStatusTypeEnum = pgEnum("project_status_type", [
  "backlog",
  "planned",
  "in_progress",
  "completed",
  "canceled",
]);

// -----------------------------------------------------------------------------
// Project workflow statuses (organisation-scoped)
// -----------------------------------------------------------------------------

export const projectStatus = pgTable(
  "project_status",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").default(0).notNull(), // ordering in UI
    color: text("color"),
    icon: text("icon"), // lucide icon name (e.g., "Circle", "Play", "CheckCircle", etc.)
    type: projectStatusTypeEnum("type").default("planned").notNull(), // semantic type following Linear
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgTypeIdx: uniqueIndex("project_status_org_type_idx").on(
      table.organizationId,
      table.type,
    ),
  }),
);

export const project = pgTable(
  "project",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Short, URL-friendly key for the project (e.g., "mobile-app", "web-redesign") */
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    /** Owning team (optional – projects can span teams) */
    teamId: uuid("team_id").references(() => team.id, { onDelete: "set null" }),
    leadId: text("lead_id").references(() => user.id, { onDelete: "set null" }),
    /** Creator of the project (immutable) */
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    startDate: date("start_date"),
    dueDate: date("due_date"),
    statusId: uuid("status_id").references(() => projectStatus.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
  },
  (table) => ({
    orgNameIdx: index("project_org_name_idx").on(
      table.organizationId,
      table.name,
    ),
    // Ensure unique key within organization
    orgKeyIdx: index("project_org_key_idx").on(table.organizationId, table.key),
  }),
);

export const projectMember = pgTable(
  "project_member",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").default("member"),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.projectId, table.userId] }),
  }),
);

export const projectTeam = pgTable(
  "project_team",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.projectId, table.teamId] }),
  }),
);
