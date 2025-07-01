import {
  pgTable,
  text,
  uuid,
  timestamp,
  boolean,
  primaryKey,
} from "drizzle-orm/pg-core";
import { organization, user } from "./users-and-auth";

// -----------------------------------------------------------------------------
// Organization-scoped custom roles
// -----------------------------------------------------------------------------

/**
 * Custom role defined within an organization.
 *
 * – `system` roles are baked-in (owner/admin/member) and can't be removed.
 * – `name` is unique per organization.
 */
export const orgRole = pgTable("org_role", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  system: boolean("system").notNull().default(false),
  createdAt: timestamp("created_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// Unique (organizationId + name)
export const orgRoleNameIdx = primaryKey(orgRole.organizationId, orgRole.name);

// -----------------------------------------------------------------------------
// Permissions bound to a role
// -----------------------------------------------------------------------------

export const orgRolePermission = pgTable(
  "org_role_permission",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => orgRole.id, { onDelete: "cascade" }),
    /**
     * Permission identifier (e.g. `project:create`).
     * We intentionally keep it as a free-form string to avoid friction when
     * introducing new permissions – migration-less rollout.
     */
    permission: text("permission").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.roleId, table.permission] }),
    };
  },
);

// -----------------------------------------------------------------------------
// User ↔ Role linking within an organization
// -----------------------------------------------------------------------------

export const orgRoleAssignment = pgTable(
  "org_role_assignment",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => orgRole.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Keeping orgId redundant for faster lookup & FK cascade on org delete
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at")
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.roleId, table.userId] }),
    };
  },
);
