import {
  pgTable,
  uuid,
  text,
  timestamp,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { user, organization } from "./users-and-auth";

// Teams represent functional groups (e.g. Engineering, Marketing) that own issues.
// Each team gets a unique `key` which prefixes issue numbers (e.g. ENG-123).
export const team = pgTable("team", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  /** Short, uppercase key that prefixes issue IDs (e.g. ENG, MKT) */
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  /** Optional leader of the team */
  leadId: text("lead_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Mapping table -> many-to-many relationship between users and teams.
export const teamMember = pgTable(
  "team_member",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role"), // e.g. "member", "lead"
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.teamId, table.userId] }),
  }),
);

// unique key constraint on organization + key to avoid duplicate team keys across orgs
export const teamOrgKeyIdx = index("team_org_key_idx").on(
  team.organizationId,
  team.key,
);
