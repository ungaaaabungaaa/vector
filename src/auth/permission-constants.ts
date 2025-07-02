// Wildcard permission constant for type safety
export const WILDCARD = "*" as const;

// Core permission constants as a const array for better type inference
export const PERMISSION_LIST = [
  // Organization permissions
  "org:view",
  "org:manage",
  "org:invite",

  // Role management
  "role:create",
  "role:update",
  "role:delete",
  "role:assign",

  // Project permissions
  "project:view",
  "project:create",
  "project:update",
  "project:delete",

  // Team permissions
  "team:view",
  "team:create",
  "team:update",
  "team:delete",

  // Issue permissions
  "issue:view",
  "issue:create",
  "issue:update",
  "issue:delete",

  // Assignment management
  "assignment:manage",
] as const;

// Create PERMISSIONS object for backwards compatibility
export const PERMISSIONS = Object.fromEntries(
  PERMISSION_LIST.map((perm) => [perm.replace(":", "_").toUpperCase(), perm]),
) as {
  readonly ORG_VIEW: "org:view";
  readonly ORG_MANAGE: "org:manage";
  readonly ORG_INVITE: "org:invite";
  readonly ROLE_CREATE: "role:create";
  readonly ROLE_UPDATE: "role:update";
  readonly ROLE_DELETE: "role:delete";
  readonly ROLE_ASSIGN: "role:assign";
  readonly PROJECT_VIEW: "project:view";
  readonly PROJECT_CREATE: "project:create";
  readonly PROJECT_UPDATE: "project:update";
  readonly PROJECT_DELETE: "project:delete";
  readonly TEAM_VIEW: "team:view";
  readonly TEAM_CREATE: "team:create";
  readonly TEAM_UPDATE: "team:update";
  readonly TEAM_DELETE: "team:delete";
  readonly ISSUE_VIEW: "issue:view";
  readonly ISSUE_CREATE: "issue:create";
  readonly ISSUE_UPDATE: "issue:update";
  readonly ISSUE_DELETE: "issue:delete";
  readonly ASSIGNMENT_MANAGE: "assignment:manage";
};

// Strong typing for permissions
export type Permission = (typeof PERMISSION_LIST)[number] | typeof WILDCARD;

// Custom permission escape hatch for future extensibility
export type CustomPermission = string & { _brand: "custom" };

// Helper to validate permissions at runtime
export function isValidPermission(perm: string): perm is Permission {
  return (
    perm === WILDCARD ||
    PERMISSION_LIST.includes(perm as (typeof PERMISSION_LIST)[number])
  );
}
