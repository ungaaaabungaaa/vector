import { query, type QueryCtx } from '../_generated/server';
import { v } from 'convex/values';
import { PERMISSIONS, type Permission } from '../_shared/permissions';
import { getAuthUserId } from '../authUtils';
import type { Id } from '../_generated/dataModel';

export type VisibilityState = 'private' | 'organization' | 'public';

export interface PermissionScope {
  organizationId: Id<'organizations'>;
  teamId?: Id<'teams'>;
  projectId?: Id<'projects'>;
}

function permissionMatches(
  userPermission: string,
  requiredPermission: string,
): boolean {
  if (userPermission === requiredPermission) return true;
  if (userPermission === PERMISSIONS.ALL) return true;
  if (userPermission.endsWith(':*')) {
    const prefix = userPermission.slice(0, -1);
    return requiredPermission.startsWith(prefix);
  }
  return false;
}

async function hasScopedPermission(
  ctx: QueryCtx,
  scope: PermissionScope,
  userId: Id<'users'>,
  requiredPermission: Permission,
): Promise<boolean> {
  const member = await ctx.db
    .query('members')
    .withIndex('by_org_user', q =>
      q.eq('organizationId', scope.organizationId).eq('userId', userId),
    )
    .first();
  if (!member) return false;
  if (member.role === 'owner' || member.role === 'admin') return true;

  const defaultPermissions: Permission[] = [
    PERMISSIONS.ISSUE_CREATE,
    PERMISSIONS.ISSUE_VIEW,
  ];
  if (
    defaultPermissions.some(perm => permissionMatches(perm, requiredPermission))
  )
    return true;

  const orgRoleAssignments = await ctx.db
    .query('orgRoleAssignments')
    .withIndex('by_organization', q =>
      q.eq('organizationId', scope.organizationId),
    )
    .filter(q => q.eq(q.field('userId'), userId))
    .collect();
  for (const assignment of orgRoleAssignments) {
    const rolePermissions = await ctx.db
      .query('orgRolePermissions')
      .withIndex('by_role', q => q.eq('roleId', assignment.roleId))
      .collect();
    for (const rolePerm of rolePermissions) {
      if (permissionMatches(rolePerm.permission, requiredPermission))
        return true;
    }
  }

  if (scope.teamId) {
    const teamRoleAssignments = await ctx.db
      .query('teamRoleAssignments')
      .withIndex('by_team', q => q.eq('teamId', scope.teamId!))
      .filter(q => q.eq(q.field('userId'), userId))
      .collect();
    for (const assignment of teamRoleAssignments) {
      const rolePermissions = await ctx.db
        .query('teamRolePermissions')
        .withIndex('by_role', q => q.eq('roleId', assignment.roleId))
        .collect();
      for (const rolePerm of rolePermissions) {
        if (permissionMatches(rolePerm.permission, requiredPermission))
          return true;
      }
    }
  }

  if (scope.projectId) {
    const projectRoleAssignments = await ctx.db
      .query('projectRoleAssignments')
      .withIndex('by_project', q => q.eq('projectId', scope.projectId!))
      .filter(q => q.eq(q.field('userId'), userId))
      .collect();
    for (const assignment of projectRoleAssignments) {
      const rolePermissions = await ctx.db
        .query('projectRolePermissions')
        .withIndex('by_role', q => q.eq('roleId', assignment.roleId))
        .collect();
      for (const rolePerm of rolePermissions) {
        if (permissionMatches(rolePerm.permission, requiredPermission))
          return true;
      }
    }
  }

  return false;
}

export const has = query({
  args: {
    orgSlug: v.string(),
    permission: v.union(...Object.values(PERMISSIONS).map(p => v.literal(p))),
    teamId: v.optional(v.id('teams')),
    projectId: v.optional(v.id('projects')),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();
    if (!org) return false;

    const scope: PermissionScope = {
      organizationId: org._id,
      teamId: args.teamId,
      projectId: args.projectId,
    };

    return await hasScopedPermission(ctx, scope, userId, args.permission);
  },
});

export const hasMultiple = query({
  args: {
    orgSlug: v.string(),
    permissions: v.array(
      v.union(...Object.values(PERMISSIONS).map(p => v.literal(p))),
    ),
    teamId: v.optional(v.id('teams')),
    projectId: v.optional(v.id('projects')),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const results: Record<string, boolean> = {};

    if (!userId) {
      for (const permission of args.permissions) results[permission] = false;
      return results;
    }

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();
    if (!org) {
      for (const permission of args.permissions) results[permission] = false;
      return results;
    }

    const scope: PermissionScope = {
      organizationId: org._id,
      teamId: args.teamId,
      projectId: args.projectId,
    };

    for (const permission of args.permissions) {
      results[permission] = await hasScopedPermission(
        ctx,
        scope,
        userId,
        permission,
      );
    }

    return results;
  },
});
