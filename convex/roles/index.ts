import { mutation, query, type MutationCtx } from '../_generated/server';
import { getAuthUserId } from '../authUtils';
import { v, ConvexError } from 'convex/values';
import { Id } from '../_generated/dataModel';
import { PERMISSIONS, requirePermission } from '../permissions/utils';

// -----------------------------------------------------------------------------
// Default Role Creation
// -----------------------------------------------------------------------------

/**
 * Create default system roles for a team
 */
export async function createDefaultTeamRoles(
  ctx: MutationCtx,
  teamId: Id<'teams'>,
) {
  // Create Lead role
  const leadRole = await ctx.db.insert('teamRoles', {
    teamId,
    name: 'Lead',
    description: 'Team lead with full team management permissions',
    system: true,
  });

  // Grant all team permissions to Lead role
  const leadPermissions = [PERMISSIONS.TEAM_ALL, PERMISSIONS.ISSUE_ALL];

  for (const permission of leadPermissions) {
    await ctx.db.insert('teamRolePermissions', {
      roleId: leadRole,
      permission,
    });
  }

  // Create Member role
  const memberRole = await ctx.db.insert('teamRoles', {
    teamId,
    name: 'Member',
    description: 'Basic team member with limited permissions',
    system: true,
  });

  // Grant basic permissions to Member role
  const memberPermissions = [
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.ISSUE_CREATE,
    PERMISSIONS.ISSUE_VIEW,
    PERMISSIONS.ISSUE_EDIT,
    PERMISSIONS.ISSUE_STATE_UPDATE,
  ];

  for (const permission of memberPermissions) {
    await ctx.db.insert('teamRolePermissions', {
      roleId: memberRole,
      permission,
    });
  }

  return { leadRole, memberRole };
}

/**
 * Create default system roles for a project
 */
export async function createDefaultProjectRoles(
  ctx: MutationCtx,
  projectId: Id<'projects'>,
) {
  // Create Lead role
  const leadRole = await ctx.db.insert('projectRoles', {
    projectId,
    name: 'Lead',
    description: 'Project lead with full project management permissions',
    system: true,
  });

  // Grant all project permissions to Lead role
  const leadPermissions = [PERMISSIONS.PROJECT_ALL, PERMISSIONS.ISSUE_ALL];

  for (const permission of leadPermissions) {
    await ctx.db.insert('projectRolePermissions', {
      roleId: leadRole,
      permission,
    });
  }

  // Create Member role
  const memberRole = await ctx.db.insert('projectRoles', {
    projectId,
    name: 'Member',
    description: 'Basic project member with limited permissions',
    system: true,
  });

  // Grant basic permissions to Member role
  const memberPermissions = [
    PERMISSIONS.PROJECT_VIEW,
    PERMISSIONS.ISSUE_CREATE,
    PERMISSIONS.ISSUE_VIEW,
    PERMISSIONS.ISSUE_EDIT,
    PERMISSIONS.ISSUE_STATE_UPDATE,
  ];

  for (const permission of memberPermissions) {
    await ctx.db.insert('projectRolePermissions', {
      roleId: memberRole,
      permission,
    });
  }

  return { leadRole, memberRole };
}

// -----------------------------------------------------------------------------
// Role Assignment Functions
// -----------------------------------------------------------------------------

/**
 * Assign a user to a team role
 */
export async function assignTeamRole(
  ctx: MutationCtx,
  teamId: Id<'teams'>,
  userId: Id<'users'>,
  roleId: Id<'teamRoles'>,
) {
  // Check if assignment already exists
  const existing = await ctx.db
    .query('teamRoleAssignments')
    .withIndex('by_role_user', q => q.eq('roleId', roleId).eq('userId', userId))
    .first();

  if (existing) {
    return existing._id;
  }

  // Create new assignment
  return await ctx.db.insert('teamRoleAssignments', {
    roleId,
    userId,
    teamId,
    assignedAt: Date.now(),
  });
}

/**
 * Assign a user to a project role
 */
export async function assignProjectRole(
  ctx: MutationCtx,
  projectId: Id<'projects'>,
  userId: Id<'users'>,
  roleId: Id<'projectRoles'>,
) {
  // Check if assignment already exists
  const existing = await ctx.db
    .query('projectRoleAssignments')
    .withIndex('by_role_user', q => q.eq('roleId', roleId).eq('userId', userId))
    .first();

  if (existing) {
    return existing._id;
  }

  // Create new assignment
  return await ctx.db.insert('projectRoleAssignments', {
    roleId,
    userId,
    projectId,
    assignedAt: Date.now(),
  });
}

// -----------------------------------------------------------------------------
// Role Management Mutations
// -----------------------------------------------------------------------------

/**
 * Create a custom team role
 */
export const createTeamRole = mutation({
  args: {
    teamId: v.id('teams'),
    name: v.string(),
    description: v.optional(v.string()),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    // Get team to check organization
    const team = await ctx.db.get('teams', args.teamId);
    if (!team) {
      throw new ConvexError('Team not found');
    }

    // Check if user can manage team roles
    await requirePermission(ctx, team.organizationId, PERMISSIONS.TEAM_EDIT);

    // Create the role
    const roleId = await ctx.db.insert('teamRoles', {
      teamId: args.teamId,
      name: args.name,
      description: args.description,
      system: false,
    });

    // Add permissions
    for (const permission of args.permissions) {
      await ctx.db.insert('teamRolePermissions', {
        roleId,
        permission,
      });
    }

    return roleId;
  },
});

/**
 * Create a custom project role
 */
export const createProjectRole = mutation({
  args: {
    projectId: v.id('projects'),
    name: v.string(),
    description: v.optional(v.string()),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    // Get project to check organization
    const project = await ctx.db.get('projects', args.projectId);
    if (!project) {
      throw new ConvexError('Project not found');
    }

    // Check if user can manage project roles
    await requirePermission(
      ctx,
      project.organizationId,
      PERMISSIONS.PROJECT_EDIT,
    );

    // Create the role
    const roleId = await ctx.db.insert('projectRoles', {
      projectId: args.projectId,
      name: args.name,
      description: args.description,
      system: false,
    });

    // Add permissions
    for (const permission of args.permissions) {
      await ctx.db.insert('projectRolePermissions', {
        roleId,
        permission,
      });
    }

    return roleId;
  },
});

/**
 * Assign a user to a team role
 */
export const assignUserToTeamRole = mutation({
  args: {
    teamId: v.id('teams'),
    userId: v.id('users'),
    roleId: v.id('teamRoles'),
  },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new ConvexError('Unauthorized');
    }

    // Get team to check organization
    const team = await ctx.db.get('teams', args.teamId);
    if (!team) {
      throw new ConvexError('Team not found');
    }

    // Check if user can manage team members
    await requirePermission(
      ctx,
      team.organizationId,
      PERMISSIONS.TEAM_MEMBER_ADD,
    );

    return await assignTeamRole(ctx, args.teamId, args.userId, args.roleId);
  },
});

/**
 * Assign a user to a project role
 */
export const assignUserToProjectRole = mutation({
  args: {
    projectId: v.id('projects'),
    userId: v.id('users'),
    roleId: v.id('projectRoles'),
  },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new ConvexError('Unauthorized');
    }

    // Get project to check organization
    const project = await ctx.db.get('projects', args.projectId);
    if (!project) {
      throw new ConvexError('Project not found');
    }

    // Check if user can manage project members
    await requirePermission(
      ctx,
      project.organizationId,
      PERMISSIONS.PROJECT_MEMBER_ADD,
    );

    return await assignProjectRole(
      ctx,
      args.projectId,
      args.userId,
      args.roleId,
    );
  },
});

// -----------------------------------------------------------------------------
// Role Query Functions
// -----------------------------------------------------------------------------

/**
 * Get all roles for a team
 */
export const getTeamRoles = query({
  args: {
    teamId: v.id('teams'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    return await ctx.db
      .query('teamRoles')
      .withIndex('by_team', q => q.eq('teamId', args.teamId))
      .collect();
  },
});

/**
 * Get all roles for a project
 */
export const getProjectRoles = query({
  args: {
    projectId: v.id('projects'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    return await ctx.db
      .query('projectRoles')
      .withIndex('by_project', q => q.eq('projectId', args.projectId))
      .collect();
  },
});

// -----------------------------------------------------------------------------
// Organization-Scoped Role Functions (for custom org roles)
// -----------------------------------------------------------------------------

/**
 * List all custom (non-system) roles for an organization identified by slug.
 */
export const list = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      return [];
    }

    // Anyone who can view the org can see its roles, so we don't do an explicit permission check here.
    return await ctx.db
      .query('orgRoles')
      .withIndex('by_organization', q => q.eq('organizationId', org._id))
      .collect();
  },
});

/**
 * Create a custom organization role.
 */
export const create = mutation({
  args: {
    orgSlug: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    // Ensure user can manage roles
    await requirePermission(ctx, org._id, PERMISSIONS.ORG_MANAGE_ROLES);

    const roleId = await ctx.db.insert('orgRoles', {
      organizationId: org._id,
      name: args.name,
      description: args.description,
      system: false,
    });

    // Store permissions
    for (const permission of args.permissions) {
      await ctx.db.insert('orgRolePermissions', {
        roleId,
        permission,
      });
    }

    return roleId;
  },
});

/**
 * Assign a user to a custom organization role.
 */
export const assign = mutation({
  args: {
    orgSlug: v.string(),
    roleId: v.id('orgRoles'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    // Ensure user can manage org roles / members
    await requirePermission(ctx, org._id, PERMISSIONS.ORG_MANAGE_ROLES);

    // Prevent duplicate assignment
    const existing = await ctx.db
      .query('orgRoleAssignments')
      .withIndex('by_role_user', q =>
        q.eq('roleId', args.roleId).eq('userId', args.userId),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert('orgRoleAssignments', {
      roleId: args.roleId,
      userId: args.userId,
      organizationId: org._id,
      assignedAt: Date.now(),
    });
  },
});

/**
 * Remove a role assignment from a user.
 */
export const removeAssignment = mutation({
  args: {
    orgSlug: v.string(),
    roleId: v.id('orgRoles'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    await requirePermission(ctx, org._id, PERMISSIONS.ORG_MANAGE_ROLES);

    const assignment = await ctx.db
      .query('orgRoleAssignments')
      .withIndex('by_role_user', q =>
        q.eq('roleId', args.roleId).eq('userId', args.userId),
      )
      .first();

    if (assignment) {
      await ctx.db.delete('orgRoleAssignments', assignment._id);
    }
  },
});

/**
 * Get a specific org role by ID.
 */
export const get = query({
  args: {
    orgSlug: v.string(),
    roleId: v.id('orgRoles'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    await requirePermission(ctx, org._id, PERMISSIONS.ORG_MANAGE_ROLES);

    const role = await ctx.db.get('orgRoles', args.roleId);
    if (!role || role.organizationId !== org._id) {
      throw new ConvexError('ROLE_NOT_FOUND');
    }

    return role;
  },
});

/**
 * Get all permissions for a specific organization role.
 */
export const getPermissions = query({
  args: {
    roleId: v.id('orgRoles'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    // You might want to add a permission check here to ensure the user can view role permissions

    return await ctx.db
      .query('orgRolePermissions')
      .withIndex('by_role', q => q.eq('roleId', args.roleId))
      .collect();
  },
});

/**
 * Update an existing organization role.
 */
export const update = mutation({
  args: {
    orgSlug: v.string(),
    roleId: v.id('orgRoles'),
    name: v.string(),
    description: v.optional(v.string()),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    await requirePermission(ctx, org._id, PERMISSIONS.ORG_MANAGE_ROLES);

    const role = await ctx.db.get('orgRoles', args.roleId);
    if (!role || role.organizationId !== org._id) {
      throw new ConvexError('ROLE_NOT_FOUND');
    }

    // Update role metadata
    await ctx.db.patch('orgRoles', role._id, {
      name: args.name,
      description: args.description,
    });

    // Replace permissions: remove old, add new
    const existingPerms = await ctx.db
      .query('orgRolePermissions')
      .withIndex('by_role', q => q.eq('roleId', role._id))
      .collect();

    for (const perm of existingPerms) {
      await ctx.db.delete('orgRolePermissions', perm._id);
    }

    for (const permission of args.permissions) {
      await ctx.db.insert('orgRolePermissions', {
        roleId: role._id,
        permission,
      });
    }
  },
});

// -----------------------------------------------------------------------------
// End of organization-scoped role functions
// -----------------------------------------------------------------------------
