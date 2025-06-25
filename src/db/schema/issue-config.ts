import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  boolean,
  primaryKey,
} from "drizzle-orm/pg-core";
import { organization } from "./users-and-auth";

// ----- Issue Priorities (workspace-level) -----
export const issuePriority = pgTable("issue_priority", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  weight: integer("weight").default(0).notNull(), // smaller -> lower, larger -> higher
  color: text("color"), // tailwind color ref (#RRGGBB etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ----- Issue Workflow States -----
export const issueState = pgTable("issue_state", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").default(0).notNull(), // ordering left→right in board
  color: text("color"),
  isClosed: boolean("is_closed").default(false).notNull(), // whether state counts as done
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ----- Issue Labels -----
export const issueLabel = pgTable("issue_label", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const issueLabelAssignment = pgTable(
  "issue_label_assignment",
  {
    issueId: uuid("issue_id").notNull(),
    labelId: uuid("label_id").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.issueId, table.labelId] }),
  }),
);
