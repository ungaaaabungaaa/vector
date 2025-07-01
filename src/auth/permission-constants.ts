export const PERMISSIONS = {
  ORG_VIEW: "org:view",
  ORG_MANAGE: "org:manage",
  ORG_INVITE: "org:invite",

  ROLE_CREATE: "role:create",
  ROLE_UPDATE: "role:update",
  ROLE_DELETE: "role:delete",
  ROLE_ASSIGN: "role:assign",

  PROJECT_CREATE: "project:create",
  PROJECT_UPDATE: "project:update",
  PROJECT_DELETE: "project:delete",

  TEAM_CREATE: "team:create",
  TEAM_UPDATE: "team:update",
  TEAM_DELETE: "team:delete",

  ISSUE_CREATE: "issue:create",
  ISSUE_UPDATE: "issue:update",
  ISSUE_DELETE: "issue:delete",
} as const;

export type Permission =
  | (typeof PERMISSIONS)[keyof typeof PERMISSIONS]
  | string;
