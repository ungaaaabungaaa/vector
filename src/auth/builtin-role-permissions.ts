import { PERMISSIONS, type Permission } from "./permission-constants";

// Public type for built-in member roles (system roles)
export type BuiltinRole = "owner" | "admin" | "member";

/**
 * Static permission sets for the default organization roles.
 *
 * NOTE: This file purposefully contains **no server-only imports** so it can be
 * bundled on the client side without dragging in the database driver (pg).
 */
export const BUILTIN_ROLE_PERMISSIONS: Record<BuiltinRole, Permission[]> = {
  owner: ["*"], // God-mode within the organization
  admin: [
    PERMISSIONS.ORG_MANAGE,
    PERMISSIONS.ORG_INVITE,
    PERMISSIONS.ROLE_CREATE,
    PERMISSIONS.ROLE_UPDATE,
    PERMISSIONS.ROLE_DELETE,
    PERMISSIONS.ROLE_ASSIGN,
    PERMISSIONS.PROJECT_CREATE,
    PERMISSIONS.PROJECT_UPDATE,
    PERMISSIONS.PROJECT_DELETE,
    PERMISSIONS.TEAM_CREATE,
    PERMISSIONS.TEAM_UPDATE,
    PERMISSIONS.TEAM_DELETE,
    PERMISSIONS.ISSUE_CREATE,
    PERMISSIONS.ISSUE_UPDATE,
  ],
  member: [
    PERMISSIONS.ORG_VIEW,
    PERMISSIONS.ISSUE_CREATE,
    PERMISSIONS.ISSUE_UPDATE,
  ],
};
