export const PERMISSIONS = {
  // Organization Permissions
  ORG_VIEW: 'org:view',
  ORG_MANAGE_SETTINGS: 'org:manage:settings',
  ORG_MANAGE_BILLING: 'org:manage:billing',
  ORG_MANAGE_MEMBERS: 'org:manage:members',
  ORG_MANAGE_ROLES: 'org:manage:roles',

  // Project Permissions
  PROJECT_CREATE: 'project:create',
  PROJECT_VIEW: 'project:view',
  PROJECT_EDIT: 'project:edit',
  PROJECT_DELETE: 'project:delete',
  PROJECT_MEMBER_ADD: 'project:member:add',
  PROJECT_MEMBER_REMOVE: 'project:member:remove',
  PROJECT_MEMBER_UPDATE: 'project:member:update',
  PROJECT_LEAD_UPDATE: 'project:lead:update',

  // Team Permissions
  TEAM_CREATE: 'team:create',
  TEAM_VIEW: 'team:view',
  TEAM_EDIT: 'team:edit',
  TEAM_DELETE: 'team:delete',
  TEAM_MEMBER_ADD: 'team:member:add',
  TEAM_MEMBER_REMOVE: 'team:member:remove',
  TEAM_MEMBER_UPDATE: 'team:member:update',
  TEAM_LEAD_UPDATE: 'team:lead:update',

  // Issue Permissions
  ISSUE_CREATE: 'issue:create',
  ISSUE_VIEW: 'issue:view',
  ISSUE_EDIT: 'issue:edit',
  ISSUE_DELETE: 'issue:delete',
  ISSUE_ASSIGN: 'issue:assign',
  ISSUE_ASSIGNMENT_UPDATE: 'issue:assignment:update',
  ISSUE_RELATION_UPDATE: 'issue:relation:update',
  ISSUE_STATE_UPDATE: 'issue:state:update',
  ISSUE_PRIORITY_UPDATE: 'issue:priority:update',

  // Document Permissions
  DOCUMENT_CREATE: 'document:create',
  DOCUMENT_VIEW: 'document:view',
  DOCUMENT_EDIT: 'document:edit',
  DOCUMENT_DELETE: 'document:delete',

  // Wildcard permissions
  ALL: '*',
  ISSUE_ALL: 'issue:*',
  TEAM_ALL: 'team:*',
  PROJECT_ALL: 'project:*',
  DOCUMENT_ALL: 'document:*',
} as const;

// Helper type for permission values
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_VALUES: Permission[] = Object.values(PERMISSIONS);

// Define wildcard permission for owner role (full access)
const WILDCARD: Permission = PERMISSIONS.ALL;

// Public type for built-in member roles (system roles)
export type BuiltinRole = 'owner' | 'admin' | 'member';

export const SYSTEM_ROLE_KEYS = {
  ORG_OWNER: 'org:owner',
  ORG_ADMIN: 'org:admin',
  ORG_MEMBER: 'org:member',
  TEAM_LEAD: 'team:lead',
  TEAM_MEMBER: 'team:member',
  PROJECT_LEAD: 'project:lead',
  PROJECT_MEMBER: 'project:member',
} as const;

export type SystemRoleKey =
  (typeof SYSTEM_ROLE_KEYS)[keyof typeof SYSTEM_ROLE_KEYS];

/**
 * Static permission sets for the default organization roles.
 *
 * NOTE: This file purposefully contains **no server-only imports** so it can be
 * bundled on the client side without dragging in the database driver (pg).
 */
export const BUILTIN_ROLE_PERMISSIONS: Record<BuiltinRole, Permission[]> = {
  // Owner gets universal wildcard permission
  owner: [WILDCARD],

  // Admin gets broad but scoped permissions (no universal wildcard)
  admin: [
    // Organization
    PERMISSIONS.ORG_VIEW,
    PERMISSIONS.ORG_MANAGE_SETTINGS,
    PERMISSIONS.ORG_MANAGE_BILLING,
    PERMISSIONS.ORG_MANAGE_MEMBERS,
    PERMISSIONS.ORG_MANAGE_ROLES,

    // Projects
    PERMISSIONS.PROJECT_VIEW,
    PERMISSIONS.PROJECT_CREATE,
    PERMISSIONS.PROJECT_EDIT,
    PERMISSIONS.PROJECT_DELETE,
    PERMISSIONS.PROJECT_MEMBER_ADD,
    PERMISSIONS.PROJECT_MEMBER_REMOVE,
    PERMISSIONS.PROJECT_MEMBER_UPDATE,
    PERMISSIONS.PROJECT_LEAD_UPDATE,

    // Teams
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.TEAM_CREATE,
    PERMISSIONS.TEAM_EDIT,
    PERMISSIONS.TEAM_DELETE,
    PERMISSIONS.TEAM_MEMBER_ADD,
    PERMISSIONS.TEAM_MEMBER_REMOVE,
    PERMISSIONS.TEAM_MEMBER_UPDATE,
    PERMISSIONS.TEAM_LEAD_UPDATE,

    // Issues
    PERMISSIONS.ISSUE_VIEW,
    PERMISSIONS.ISSUE_CREATE,
    PERMISSIONS.ISSUE_EDIT,
    PERMISSIONS.ISSUE_DELETE,
    PERMISSIONS.ISSUE_ASSIGN,
    PERMISSIONS.ISSUE_ASSIGNMENT_UPDATE,
    PERMISSIONS.ISSUE_RELATION_UPDATE,
    PERMISSIONS.ISSUE_STATE_UPDATE,
    PERMISSIONS.ISSUE_PRIORITY_UPDATE,

    // Documents
    PERMISSIONS.DOCUMENT_VIEW,
    PERMISSIONS.DOCUMENT_CREATE,
    PERMISSIONS.DOCUMENT_EDIT,
    PERMISSIONS.DOCUMENT_DELETE,
  ],

  // Member gets essential read / limited write access
  member: [
    PERMISSIONS.ORG_VIEW,

    // Projects
    PERMISSIONS.PROJECT_VIEW,

    // Teams
    PERMISSIONS.TEAM_VIEW,

    // Issues
    PERMISSIONS.ISSUE_VIEW,
    PERMISSIONS.ISSUE_CREATE,
    PERMISSIONS.ISSUE_EDIT,

    // Documents
    PERMISSIONS.DOCUMENT_VIEW,
    PERMISSIONS.DOCUMENT_CREATE,
    PERMISSIONS.DOCUMENT_EDIT,
  ],
};

// Default permissions for new admin roles (for migration purposes)
export const DEFAULT_ADMIN_PERMISSIONS = BUILTIN_ROLE_PERMISSIONS.admin;

export const TEAM_SYSTEM_ROLE_PERMISSIONS: Record<
  typeof SYSTEM_ROLE_KEYS.TEAM_LEAD | typeof SYSTEM_ROLE_KEYS.TEAM_MEMBER,
  Permission[]
> = {
  [SYSTEM_ROLE_KEYS.TEAM_LEAD]: [PERMISSIONS.TEAM_ALL, PERMISSIONS.ISSUE_ALL],
  [SYSTEM_ROLE_KEYS.TEAM_MEMBER]: [
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.ISSUE_CREATE,
    PERMISSIONS.ISSUE_VIEW,
    PERMISSIONS.ISSUE_EDIT,
    PERMISSIONS.ISSUE_STATE_UPDATE,
  ],
};

export const PROJECT_SYSTEM_ROLE_PERMISSIONS: Record<
  typeof SYSTEM_ROLE_KEYS.PROJECT_LEAD | typeof SYSTEM_ROLE_KEYS.PROJECT_MEMBER,
  Permission[]
> = {
  [SYSTEM_ROLE_KEYS.PROJECT_LEAD]: [
    PERMISSIONS.PROJECT_ALL,
    PERMISSIONS.ISSUE_ALL,
  ],
  [SYSTEM_ROLE_KEYS.PROJECT_MEMBER]: [
    PERMISSIONS.PROJECT_VIEW,
    PERMISSIONS.ISSUE_CREATE,
    PERMISSIONS.ISSUE_VIEW,
    PERMISSIONS.ISSUE_EDIT,
    PERMISSIONS.ISSUE_STATE_UPDATE,
  ],
};
