import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  primaryKey,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization } from "./users-and-auth";

// ----- Issue State Types (following Linear's approach) -----
export const issueStateTypeEnum = pgEnum("issue_state_type", [
  "backlog",
  "todo",
  "in_progress",
  "done",
  "canceled",
]);

// ----- Issue Priorities (workspace-level) -----
export const issuePriority = pgTable(
  "issue_priority",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    weight: integer("weight").default(0).notNull(), // smaller -> lower, larger -> higher
    color: text("color"), // tailwind color ref (#RRGGBB etc.)
    icon: text("icon"), // lucide icon name (e.g., "ArrowUp", "Circle", etc.)
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    // Ensure unique weight per organization (No duplicate priority weights)
    orgWeightIdx: uniqueIndex("issue_priority_org_weight_idx").on(
      table.organizationId,
      table.weight,
    ),
  }),
);

// ----- Issue Workflow States -----
export const issueState = pgTable(
  "issue_state",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").default(0).notNull(), // ordering left→right in board
    color: text("color"),
    icon: text("icon"), // lucide icon name (e.g., "Circle", "Play", "CheckCircle", etc.)
    type: issueStateTypeEnum("type").default("todo").notNull(), // semantic type following Linear
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    // Enforce unique semantic type per organization
    orgTypeIdx: uniqueIndex("issue_state_org_type_idx").on(
      table.organizationId,
      table.type,
    ),
  }),
);

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
