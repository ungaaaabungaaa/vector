// ----------------------------------------------------------------------------
// Access Control Layer
// ----------------------------------------------------------------------------
// This module provides the single source of truth for all authorization checks
// in the backend. It centralizes entity-specific permission logic (e.g.,
// "can this user view this issue?") and makes it "current-user-aware," so
// callers don't need to pass around user IDs.
//
// It is built on top of the core permission engine in `permissions.ts`.
// ----------------------------------------------------------------------------

import { getAuthUserId } from './authUtils';
import type { QueryCtx, MutationCtx } from './_generated/server';
import type { Id, Doc } from './_generated/dataModel';
import { permissionMatches } from './authz';
import {
  hasScopedPermission,
  PERMISSIONS,
  type Permission,
  type PermissionScope,
  type VisibilityState,
} from './permissions/utils';

// -----------------------------------------------------------------------------
// Generic Permission Helpers
// -----------------------------------------------------------------------------

/**
 * Check whether the current authenticated user possesses a given permission
 * inside the supplied scope. Returns `false` for unauthenticated requests.
 */
export async function hasPermission(
  ctx: QueryCtx | MutationCtx,
  scope: PermissionScope,
  permission: Permission,
): Promise<boolean> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    return false;
  }
  return hasScopedPermission(ctx, scope, userId, permission);
}

/**
 * Build a permission scope object from a domain entity.
 */
export function scopeFromEntity(entity: {
  organizationId: Id<'organizations'>;
  teamId?: Id<'teams'> | null;
  projectId?: Id<'projects'> | null;
}): PermissionScope {
  return {
    organizationId: entity.organizationId,
    teamId: entity.teamId ?? undefined,
    projectId: entity.projectId ?? undefined,
  };
}

function getVisibility(
  visibility: VisibilityState | null | undefined,
): VisibilityState {
  return visibility ?? 'organization';
}

async function getOrganizationMembership(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<'organizations'>,
  userId: Id<'users'>,
) {
  return ctx.db
    .query('members')
    .withIndex('by_org_user', q =>
      q.eq('organizationId', organizationId).eq('userId', userId),
    )
    .first();
}

async function roleIdsGrantPermission(
  ctx: QueryCtx | MutationCtx,
  roleIds: readonly Id<'roles'>[],
  permission: Permission,
): Promise<boolean> {
  const uniqueRoleIds = Array.from(new Set(roleIds));
  const permissionRows = await Promise.all(
    uniqueRoleIds.map(roleId =>
      ctx.db
        .query('rolePermissions')
        .withIndex('by_role', q => q.eq('roleId', roleId))
        .collect(),
    ),
  );

  return permissionRows.some(rows =>
    rows.some(row => permissionMatches(row.permission, permission)),
  );
}

async function legacyTeamRoleIdsGrantPermission(
  ctx: QueryCtx | MutationCtx,
  roleIds: readonly Id<'teamRoles'>[],
  permission: Permission,
): Promise<boolean> {
  const uniqueRoleIds = Array.from(new Set(roleIds));
  const permissionRows = await Promise.all(
    uniqueRoleIds.map(roleId =>
      ctx.db
        .query('teamRolePermissions')
        .withIndex('by_role', q => q.eq('roleId', roleId))
        .collect(),
    ),
  );

  return permissionRows.some(rows =>
    rows.some(row => permissionMatches(row.permission, permission)),
  );
}

async function legacyProjectRoleIdsGrantPermission(
  ctx: QueryCtx | MutationCtx,
  roleIds: readonly Id<'projectRoles'>[],
  permission: Permission,
): Promise<boolean> {
  const uniqueRoleIds = Array.from(new Set(roleIds));
  const permissionRows = await Promise.all(
    uniqueRoleIds.map(roleId =>
      ctx.db
        .query('projectRolePermissions')
        .withIndex('by_role', q => q.eq('roleId', roleId))
        .collect(),
    ),
  );

  return permissionRows.some(rows =>
    rows.some(row => permissionMatches(row.permission, permission)),
  );
}

async function hasTeamScopedVisibilityAccess(
  ctx: QueryCtx | MutationCtx,
  teamId: Id<'teams'>,
  userId: Id<'users'>,
  permission: Permission,
): Promise<boolean> {
  const [member, assignments, legacyAssignments] = await Promise.all([
    ctx.db
      .query('teamMembers')
      .withIndex('by_team_user', q =>
        q.eq('teamId', teamId).eq('userId', userId),
      )
      .first(),
    ctx.db
      .query('roleAssignments')
      .withIndex('by_team_user', q =>
        q.eq('teamId', teamId).eq('userId', userId),
      )
      .collect(),
    ctx.db
      .query('teamRoleAssignments')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect(),
  ]);

  if (member) {
    return true;
  }

  const scopedLegacyAssignments = legacyAssignments.filter(
    legacy => legacy.teamId === teamId,
  );

  const [hasUnifiedRolePermission, hasLegacyRolePermission] = await Promise.all(
    [
      roleIdsGrantPermission(
        ctx,
        assignments.map(assignment => assignment.roleId),
        permission,
      ),
      legacyTeamRoleIdsGrantPermission(
        ctx,
        scopedLegacyAssignments.map(assignment => assignment.roleId),
        permission,
      ),
    ],
  );

  return hasUnifiedRolePermission || hasLegacyRolePermission;
}

async function hasProjectScopedVisibilityAccess(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<'projects'>,
  userId: Id<'users'>,
  permission: Permission,
): Promise<boolean> {
  const [member, assignments, legacyAssignments] = await Promise.all([
    ctx.db
      .query('projectMembers')
      .withIndex('by_project_user', q =>
        q.eq('projectId', projectId).eq('userId', userId),
      )
      .first(),
    ctx.db
      .query('roleAssignments')
      .withIndex('by_project_user', q =>
        q.eq('projectId', projectId).eq('userId', userId),
      )
      .collect(),
    ctx.db
      .query('projectRoleAssignments')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect(),
  ]);

  if (member) {
    return true;
  }

  const scopedLegacyAssignments = legacyAssignments.filter(
    legacy => legacy.projectId === projectId,
  );

  const [hasUnifiedRolePermission, hasLegacyRolePermission] = await Promise.all(
    [
      roleIdsGrantPermission(
        ctx,
        assignments.map(assignment => assignment.roleId),
        permission,
      ),
      legacyProjectRoleIdsGrantPermission(
        ctx,
        scopedLegacyAssignments.map(assignment => assignment.roleId),
        permission,
      ),
    ],
  );

  return hasUnifiedRolePermission || hasLegacyRolePermission;
}

// -----------------------------------------------------------------------------
// Issue-Specific Access Control
// -----------------------------------------------------------------------------

/**
 * Check if the current user can view an issue, accounting for visibility,
 * membership, and roles.
 */
export async function canViewIssue(
  ctx: QueryCtx | MutationCtx,
  issue: Doc<'issues'>,
): Promise<boolean> {
  const userId = await getAuthUserId(ctx);
  const vis = getVisibility(issue.visibility);

  if (vis === 'public') return true;
  if (!userId) return false;
  if (issue.createdBy === userId) return true;

  // Private issues: only assignees can view (besides creator checked above)
  if (vis === 'private') {
    const assignee = await ctx.db
      .query('issueAssignees')
      .withIndex('by_issue_assignee', q =>
        q.eq('issueId', issue._id).eq('assigneeId', userId),
      )
      .first();
    return !!assignee;
  }

  if (issue.teamId) {
    if (
      await hasTeamScopedVisibilityAccess(
        ctx,
        issue.teamId,
        userId,
        PERMISSIONS.ISSUE_VIEW,
      )
    ) {
      return true;
    }
  }

  if (issue.projectId) {
    if (
      await hasProjectScopedVisibilityAccess(
        ctx,
        issue.projectId,
        userId,
        PERMISSIONS.ISSUE_VIEW,
      )
    ) {
      return true;
    }
  }

  if (vis === 'organization') {
    const membership = await getOrganizationMembership(
      ctx,
      issue.organizationId,
      userId,
    );
    if (!membership) return false;
    if (issue.projectId || issue.teamId) {
      return hasPermission(ctx, scopeFromEntity(issue), PERMISSIONS.ISSUE_VIEW);
    }
    return true;
  }

  return hasPermission(ctx, scopeFromEntity(issue), PERMISSIONS.ISSUE_VIEW);
}

/**
 * Check if the current user can edit an issue.
 */
export async function canEditIssue(
  ctx: QueryCtx | MutationCtx,
  issue: Doc<'issues'>,
): Promise<boolean> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return false;
  if (issue.createdBy === userId) return true;
  return hasPermission(ctx, scopeFromEntity(issue), PERMISSIONS.ISSUE_EDIT);
}

/**
 * Check if the current user can delete an issue.
 */
export async function canDeleteIssue(
  ctx: QueryCtx | MutationCtx,
  issue: Doc<'issues'>,
): Promise<boolean> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return false;
  if (issue.createdBy === userId) return true;
  return hasPermission(ctx, scopeFromEntity(issue), PERMISSIONS.ISSUE_DELETE);
}

/**
 * Check if the current user can assign users to an issue.
 */
export async function canAssignIssue(
  ctx: QueryCtx | MutationCtx,
  issue: Doc<'issues'>,
): Promise<boolean> {
  return hasPermission(ctx, scopeFromEntity(issue), PERMISSIONS.ISSUE_ASSIGN);
}

/**
 * Check if the current user can update an assignee's state on an issue.
 */
export async function canUpdateAssignmentState(
  ctx: QueryCtx | MutationCtx,
  issue: Doc<'issues'>,
  assigneeId: Id<'users'>,
): Promise<boolean> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return false;

  if (assigneeId === userId) {
    const assignee = await ctx.db
      .query('issueAssignees')
      .withIndex('by_issue_assignee', q =>
        q.eq('issueId', issue._id).eq('assigneeId', userId),
      )
      .first();
    return !!assignee;
  }

  return hasPermission(
    ctx,
    scopeFromEntity(issue),
    PERMISSIONS.ISSUE_ASSIGNMENT_UPDATE,
  );
}

/**
 * Check if the current user can update an issue's workflow state.
 */
export async function canUpdateIssueState(
  ctx: QueryCtx | MutationCtx,
  issue: Doc<'issues'>,
): Promise<boolean> {
  return hasPermission(
    ctx,
    scopeFromEntity(issue),
    PERMISSIONS.ISSUE_STATE_UPDATE,
  );
}

/**
 * Check if the current user can update an issue's team/project relations.
 */
export async function canUpdateIssueRelations(
  ctx: QueryCtx | MutationCtx,
  issue: Doc<'issues'>,
): Promise<boolean> {
  return hasPermission(
    ctx,
    scopeFromEntity(issue),
    PERMISSIONS.ISSUE_RELATION_UPDATE,
  );
}

// -----------------------------------------------------------------------------
// Team-Specific Access Control
// -----------------------------------------------------------------------------

/**
 * Check if the current user can view a team.
 */
export async function canViewTeam(
  ctx: QueryCtx | MutationCtx,
  team: Doc<'teams'>,
): Promise<boolean> {
  const userId = await getAuthUserId(ctx);
  const vis = getVisibility(team.visibility);

  if (vis === 'public') return true;
  if (!userId) return false;
  if (team.createdBy === userId) return true;

  if (vis === 'private') {
    return hasTeamScopedVisibilityAccess(
      ctx,
      team._id,
      userId,
      PERMISSIONS.TEAM_VIEW,
    );
  }

  if (vis === 'organization') {
    const membership = await getOrganizationMembership(
      ctx,
      team.organizationId,
      userId,
    );
    if (!membership) return false;
    return hasPermission(ctx, scopeFromEntity(team), PERMISSIONS.TEAM_VIEW);
  }

  return hasPermission(ctx, scopeFromEntity(team), PERMISSIONS.TEAM_VIEW);
}

/**
 * Check if the current user can edit a team.
 */
export async function canEditTeam(
  ctx: QueryCtx | MutationCtx,
  team: Doc<'teams'>,
): Promise<boolean> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return false;
  if (team.createdBy === userId) return true;
  return hasPermission(ctx, scopeFromEntity(team), PERMISSIONS.TEAM_EDIT);
}

/**
 * Check if the current user can delete a team.
 */
export async function canDeleteTeam(
  ctx: QueryCtx | MutationCtx,
  team: Doc<'teams'>,
): Promise<boolean> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return false;
  if (team.createdBy === userId) return true;
  return hasPermission(ctx, scopeFromEntity(team), PERMISSIONS.TEAM_DELETE);
}

/**
 * Check if the current user can manage team members (add/remove/update).
 */
export async function canManageTeamMembers(
  ctx: QueryCtx | MutationCtx,
  team: Doc<'teams'>,
  action: 'add' | 'remove' | 'update',
): Promise<boolean> {
  const permissionMap = {
    add: PERMISSIONS.TEAM_MEMBER_ADD,
    remove: PERMISSIONS.TEAM_MEMBER_REMOVE,
    update: PERMISSIONS.TEAM_MEMBER_UPDATE,
  };
  return hasPermission(ctx, scopeFromEntity(team), permissionMap[action]);
}

// -----------------------------------------------------------------------------
// Project-Specific Access Control
// -----------------------------------------------------------------------------

/**
 * Check if the current user can view a project.
 */
export async function canViewProject(
  ctx: QueryCtx | MutationCtx,
  project: Doc<'projects'>,
): Promise<boolean> {
  const userId = await getAuthUserId(ctx);
  const vis = getVisibility(project.visibility);

  if (vis === 'public') return true;
  if (!userId) return false;
  if (project.createdBy === userId) return true;

  if (vis === 'private') {
    return hasProjectScopedVisibilityAccess(
      ctx,
      project._id,
      userId,
      PERMISSIONS.PROJECT_VIEW,
    );
  }

  if (vis === 'organization') {
    const membership = await getOrganizationMembership(
      ctx,
      project.organizationId,
      userId,
    );
    if (!membership) return false;
    return hasPermission(
      ctx,
      scopeFromEntity(project),
      PERMISSIONS.PROJECT_VIEW,
    );
  }

  return hasPermission(ctx, scopeFromEntity(project), PERMISSIONS.PROJECT_VIEW);
}

/**
 * Check if the current user can edit a project.
 */
export async function canEditProject(
  ctx: QueryCtx | MutationCtx,
  project: Doc<'projects'>,
): Promise<boolean> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return false;
  if (project.createdBy === userId) return true;
  return hasPermission(ctx, scopeFromEntity(project), PERMISSIONS.PROJECT_EDIT);
}

/**
 * Check if the current user can delete a project.
 */
export async function canDeleteProject(
  ctx: QueryCtx | MutationCtx,
  project: Doc<'projects'>,
): Promise<boolean> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return false;
  if (project.createdBy === userId) return true;
  return hasPermission(
    ctx,
    scopeFromEntity(project),
    PERMISSIONS.PROJECT_DELETE,
  );
}

/**
 * Check if a user can manage project members (add/remove/update).
 */
// -----------------------------------------------------------------------------
// Document-Specific Access Control
// -----------------------------------------------------------------------------

/**
 * Check if the current user can view a document.
 */
export async function canViewDocument(
  ctx: QueryCtx | MutationCtx,
  doc: Doc<'documents'>,
): Promise<boolean> {
  const userId = await getAuthUserId(ctx);
  const vis = getVisibility(doc.visibility);

  if (vis === 'public') return true;
  if (!userId) return false;
  if (doc.createdBy === userId) return true;

  if (doc.teamId) {
    const member = await ctx.db
      .query('teamMembers')
      .withIndex('by_team_user', q =>
        q.eq('teamId', doc.teamId!).eq('userId', userId),
      )
      .first();
    if (member) return true;
  }

  if (doc.projectId) {
    const member = await ctx.db
      .query('projectMembers')
      .withIndex('by_project_user', q =>
        q.eq('projectId', doc.projectId!).eq('userId', userId),
      )
      .first();
    if (member) return true;
  }

  if (vis === 'private') {
    return false;
  }

  if (vis === 'organization') {
    const member = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', doc.organizationId).eq('userId', userId),
      )
      .first();
    return !!member;
  }

  return hasPermission(ctx, scopeFromEntity(doc), PERMISSIONS.DOCUMENT_VIEW);
}

/**
 * Check if the current user can edit a document.
 */
export async function canEditDocument(
  ctx: QueryCtx | MutationCtx,
  doc: Doc<'documents'>,
): Promise<boolean> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return false;
  if (doc.createdBy === userId) return true;
  return hasPermission(ctx, scopeFromEntity(doc), PERMISSIONS.DOCUMENT_EDIT);
}

/**
 * Check if the current user can delete a document.
 */
export async function canDeleteDocument(
  ctx: QueryCtx | MutationCtx,
  doc: Doc<'documents'>,
): Promise<boolean> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return false;
  if (doc.createdBy === userId) return true;
  return hasPermission(ctx, scopeFromEntity(doc), PERMISSIONS.DOCUMENT_DELETE);
}

export async function canManageProjectMembers(
  ctx: QueryCtx | MutationCtx,
  project: Doc<'projects'>,
  action: 'add' | 'remove' | 'update',
): Promise<boolean> {
  const permissionMap = {
    add: PERMISSIONS.PROJECT_MEMBER_ADD,
    remove: PERMISSIONS.PROJECT_MEMBER_REMOVE,
    update: PERMISSIONS.PROJECT_MEMBER_UPDATE,
  };
  return hasPermission(ctx, scopeFromEntity(project), permissionMap[action]);
}
