import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  integer,
  boolean,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { user, organization } from "./users-and-auth";
import { team } from "./teams";

// -----------------------------------------------------------------------------
// Project workflow statuses (organisation-scoped)
// -----------------------------------------------------------------------------

export const projectStatus = pgTable("project_status", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").default(0).notNull(), // ordering in UI
  color: text("color"),
  isClosed: boolean("is_closed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const project = pgTable(
  "project",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    /** Owning team (optional – projects can span teams) */
    teamId: uuid("team_id").references(() => team.id, { onDelete: "set null" }),
    leadId: text("lead_id").references(() => user.id, { onDelete: "set null" }),
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
