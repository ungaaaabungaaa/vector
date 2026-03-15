import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from '../_generated/server';
import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import {
  getOrganizationBySlug,
  permissionValidator,
  requireAuthUser,
  requireOrgPermission,
  requireOrganizationMember,
  requireScopedPermission,
} from '../authz';
import { canViewProject, canViewTeam } from '../access';
import {
  recordActivity,
  resolveProjectScope,
  resolveTeamScope,
  snapshotForProject,
  snapshotForTeam,
} from '../activities/lib';
import {
  PERMISSIONS,
  PROJECT_SYSTEM_ROLE_PERMISSIONS,
  SYSTEM_ROLE_KEYS,
  TEAM_SYSTEM_ROLE_PERMISSIONS,
  type Permission,
  type SystemRoleKey,
} from '../_shared/permissions';

type OrganizationRoleId = Id<'roles'> | Id<'orgRoles'>;

type OrganizationRoleSummary = {
  _id: OrganizationRoleId;
  _creationTime: number;
  organizationId: Id<'organizations'>;
  scopeType: 'organization';
  key: string;
  name: string;
  description?: string;
  system: boolean;
};

type UnifiedOrganizationRole = Omit<Doc<'roles'>, 'scopeType'> & {
  scopeType: 'organization';
};

type ResolvedOrganizationRole =
  | {
      source: 'unified';
      role: UnifiedOrganizationRole;
      summary: OrganizationRoleSummary;
    }
  | {
      source: 'legacy';
      role: Doc<'orgRoles'>;
      summary: OrganizationRoleSummary;
    };

type OrganizationRolePermissionSummary = {
  _id: Id<'rolePermissions'> | Id<'orgRolePermissions'>;
  _creationTime: number;
  roleId: OrganizationRoleId;
  permission: Permission;
};

const organizationRoleIdValidator = v.union(v.id('roles'), v.id('orgRoles'));

function buildCustomRoleKey(scopePrefix: string, name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${scopePrefix}:${slug || 'role'}:${Date.now()}`;
}

function mapLegacyOrganizationRole(
  role: Doc<'orgRoles'>,
): OrganizationRoleSummary {
  return {
    _id: role._id,
    _creationTime: role._creationTime,
    organizationId: role.organizationId,
    scopeType: 'organization',
    key: `legacy:org:${role._id}`,
    name: role.name,
    description: role.description,
    system: role.system,
  };
}

function mapLegacyOrganizationRolePermission(
  roleId: Id<'orgRoles'>,
  permission: Doc<'orgRolePermissions'>,
): OrganizationRolePermissionSummary {
  return {
    _id: permission._id,
    _creationTime: permission._creationTime,
    roleId,
    permission: permission.permission,
  };
}

async function getUnifiedOrganizationRole(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<'organizations'>,
  roleId: Id<'roles'>,
): Promise<UnifiedOrganizationRole | null> {
  const role = await ctx.db.get('roles', roleId);
  if (
    !role ||
    role.organizationId !== organizationId ||
    role.scopeType !== 'organization'
  ) {
    return null;
  }
  return { ...role, scopeType: 'organization' };
}

async function getLegacyOrganizationRole(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<'organizations'>,
  roleId: Id<'orgRoles'>,
) {
  const role = await ctx.db.get('orgRoles', roleId);
  if (!role || role.organizationId !== organizationId) {
    return null;
  }
  return role;
}

async function resolveOrganizationRole(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<'organizations'>,
  roleId: OrganizationRoleId,
): Promise<ResolvedOrganizationRole | null> {
  const normalizedUnified = ctx.db.normalizeId('roles', roleId);
  if (normalizedUnified) {
    const role = await getUnifiedOrganizationRole(
      ctx,
      organizationId,
      normalizedUnified,
    );
    if (role) {
      return {
        source: 'unified' as const,
        role,
        summary: role,
      };
    }
  }

  const normalizedLegacy = ctx.db.normalizeId('orgRoles', roleId);
  if (normalizedLegacy) {
    const role = await getLegacyOrganizationRole(
      ctx,
      organizationId,
      normalizedLegacy,
    );
    if (role) {
      return {
        source: 'legacy' as const,
        role,
        summary: mapLegacyOrganizationRole(role),
      };
    }
  }

  return null;
}

async function createRoleIfMissing(
  ctx: MutationCtx,
  args: {
    organizationId: Id<'organizations'>;
    scopeType: 'organization' | 'team' | 'project';
    key: string;
    name: string;
    description: string;
    system: boolean;
    systemKey?: SystemRoleKey;
    teamId?: Id<'teams'>;
    projectId?: Id<'projects'>;
    permissions: readonly Permission[];
  },
) {
  const existingRole = await ctx.db
    .query('roles')
    .withIndex('by_org_key', q =>
      q.eq('organizationId', args.organizationId).eq('key', args.key),
    )
    .first();

  if (existingRole) {
    return existingRole._id;
  }

  const roleId = await ctx.db.insert('roles', {
    organizationId: args.organizationId,
    scopeType: args.scopeType,
    teamId: args.teamId,
    projectId: args.projectId,
    key: args.key,
    name: args.name,
    description: args.description,
    system: args.system,
    systemKey: args.systemKey,
  });

  for (const permission of args.permissions) {
    await ctx.db.insert('rolePermissions', {
      roleId,
      permission,
    });
  }

  return roleId;
}

async function ensureOrganizationSystemRoles(
  ctx: MutationCtx,
  organizationId: Id<'organizations'>,
) {
  const ownerRoleId = await createRoleIfMissing(ctx, {
    organizationId,
    scopeType: 'organization',
    key: SYSTEM_ROLE_KEYS.ORG_OWNER,
    name: 'Owner',
    description: 'Full organization control',
    system: true,
    systemKey: SYSTEM_ROLE_KEYS.ORG_OWNER,
    permissions: [PERMISSIONS.ALL],
  });

  const adminRoleId = await createRoleIfMissing(ctx, {
    organizationId,
    scopeType: 'organization',
    key: SYSTEM_ROLE_KEYS.ORG_ADMIN,
    name: 'Admin',
    description: 'Explicit built-in organization administrator role',
    system: true,
    systemKey: SYSTEM_ROLE_KEYS.ORG_ADMIN,
    permissions: [
      PERMISSIONS.ORG_VIEW,
      PERMISSIONS.ORG_MANAGE_SETTINGS,
      PERMISSIONS.ORG_MANAGE_BILLING,
      PERMISSIONS.ORG_MANAGE_MEMBERS,
      PERMISSIONS.ORG_MANAGE_ROLES,
      PERMISSIONS.PROJECT_VIEW,
      PERMISSIONS.PROJECT_CREATE,
      PERMISSIONS.PROJECT_EDIT,
      PERMISSIONS.PROJECT_DELETE,
      PERMISSIONS.PROJECT_MEMBER_ADD,
      PERMISSIONS.PROJECT_MEMBER_REMOVE,
      PERMISSIONS.PROJECT_MEMBER_UPDATE,
      PERMISSIONS.PROJECT_LEAD_UPDATE,
      PERMISSIONS.TEAM_VIEW,
      PERMISSIONS.TEAM_CREATE,
      PERMISSIONS.TEAM_EDIT,
      PERMISSIONS.TEAM_DELETE,
      PERMISSIONS.TEAM_MEMBER_ADD,
      PERMISSIONS.TEAM_MEMBER_REMOVE,
      PERMISSIONS.TEAM_MEMBER_UPDATE,
      PERMISSIONS.TEAM_LEAD_UPDATE,
      PERMISSIONS.ISSUE_VIEW,
      PERMISSIONS.ISSUE_CREATE,
      PERMISSIONS.ISSUE_EDIT,
      PERMISSIONS.ISSUE_DELETE,
      PERMISSIONS.ISSUE_ASSIGN,
      PERMISSIONS.ISSUE_ASSIGNMENT_UPDATE,
      PERMISSIONS.ISSUE_RELATION_UPDATE,
      PERMISSIONS.ISSUE_STATE_UPDATE,
      PERMISSIONS.ISSUE_PRIORITY_UPDATE,
    ],
  });

  const memberRoleId = await createRoleIfMissing(ctx, {
    organizationId,
    scopeType: 'organization',
    key: SYSTEM_ROLE_KEYS.ORG_MEMBER,
    name: 'Member',
    description: 'Default organization member role',
    system: true,
    systemKey: SYSTEM_ROLE_KEYS.ORG_MEMBER,
    permissions: [
      PERMISSIONS.ORG_VIEW,
      PERMISSIONS.PROJECT_VIEW,
      PERMISSIONS.TEAM_VIEW,
      PERMISSIONS.ISSUE_VIEW,
      PERMISSIONS.ISSUE_CREATE,
      PERMISSIONS.ISSUE_EDIT,
      PERMISSIONS.ISSUE_ASSIGN,
      PERMISSIONS.ISSUE_STATE_UPDATE,
    ],
  });

  return { ownerRoleId, adminRoleId, memberRoleId };
}

export async function createDefaultTeamRoles(
  ctx: MutationCtx,
  teamId: Id<'teams'>,
) {
  const team = await ctx.db.get('teams', teamId);
  if (!team) {
    throw new ConvexError('TEAM_NOT_FOUND');
  }

  const leadRole = await createRoleIfMissing(ctx, {
    organizationId: team.organizationId,
    scopeType: 'team',
    teamId,
    key: `${SYSTEM_ROLE_KEYS.TEAM_LEAD}:${teamId}`,
    name: 'Lead',
    description: 'Team lead with full team management permissions',
    system: true,
    systemKey: SYSTEM_ROLE_KEYS.TEAM_LEAD,
    permissions: TEAM_SYSTEM_ROLE_PERMISSIONS[SYSTEM_ROLE_KEYS.TEAM_LEAD],
  });

  const memberRole = await createRoleIfMissing(ctx, {
    organizationId: team.organizationId,
    scopeType: 'team',
    teamId,
    key: `${SYSTEM_ROLE_KEYS.TEAM_MEMBER}:${teamId}`,
    name: 'Member',
    description: 'Basic team member role',
    system: true,
    systemKey: SYSTEM_ROLE_KEYS.TEAM_MEMBER,
    permissions: TEAM_SYSTEM_ROLE_PERMISSIONS[SYSTEM_ROLE_KEYS.TEAM_MEMBER],
  });

  return { leadRole, memberRole };
}

export async function createDefaultProjectRoles(
  ctx: MutationCtx,
  projectId: Id<'projects'>,
) {
  const project = await ctx.db.get('projects', projectId);
  if (!project) {
    throw new ConvexError('PROJECT_NOT_FOUND');
  }

  const leadRole = await createRoleIfMissing(ctx, {
    organizationId: project.organizationId,
    scopeType: 'project',
    projectId,
    key: `${SYSTEM_ROLE_KEYS.PROJECT_LEAD}:${projectId}`,
    name: 'Lead',
    description: 'Project lead with full project management permissions',
    system: true,
    systemKey: SYSTEM_ROLE_KEYS.PROJECT_LEAD,
    permissions: PROJECT_SYSTEM_ROLE_PERMISSIONS[SYSTEM_ROLE_KEYS.PROJECT_LEAD],
  });

  const memberRole = await createRoleIfMissing(ctx, {
    organizationId: project.organizationId,
    scopeType: 'project',
    projectId,
    key: `${SYSTEM_ROLE_KEYS.PROJECT_MEMBER}:${projectId}`,
    name: 'Member',
    description: 'Basic project member role',
    system: true,
    systemKey: SYSTEM_ROLE_KEYS.PROJECT_MEMBER,
    permissions:
      PROJECT_SYSTEM_ROLE_PERMISSIONS[SYSTEM_ROLE_KEYS.PROJECT_MEMBER],
  });

  return { leadRole, memberRole };
}

async function getOrganizationSystemRoleId(
  ctx: MutationCtx,
  organizationId: Id<'organizations'>,
  key:
    | typeof SYSTEM_ROLE_KEYS.ORG_OWNER
    | typeof SYSTEM_ROLE_KEYS.ORG_ADMIN
    | typeof SYSTEM_ROLE_KEYS.ORG_MEMBER,
) {
  const roles = await ensureOrganizationSystemRoles(ctx, organizationId);
  if (key === SYSTEM_ROLE_KEYS.ORG_OWNER) return roles.ownerRoleId;
  if (key === SYSTEM_ROLE_KEYS.ORG_ADMIN) return roles.adminRoleId;
  return roles.memberRoleId;
}

async function assignRoleRecord(
  ctx: MutationCtx,
  args: {
    roleId: Id<'roles'>;
    userId: Id<'users'>;
    organizationId: Id<'organizations'>;
    teamId?: Id<'teams'>;
    projectId?: Id<'projects'>;
  },
) {
  const existing = await ctx.db
    .query('roleAssignments')
    .withIndex('by_role_user', q =>
      q.eq('roleId', args.roleId).eq('userId', args.userId),
    )
    .first();

  if (existing) {
    return existing._id;
  }

  return ctx.db.insert('roleAssignments', {
    roleId: args.roleId,
    userId: args.userId,
    organizationId: args.organizationId,
    teamId: args.teamId,
    projectId: args.projectId,
    assignedAt: Date.now(),
  });
}

async function removeSystemAssignments(
  ctx: MutationCtx,
  organizationId: Id<'organizations'>,
  userId: Id<'users'>,
  scope: 'organization' | 'team' | 'project',
  teamId?: Id<'teams'>,
  projectId?: Id<'projects'>,
) {
  const assignments = await ctx.db
    .query('roleAssignments')
    .withIndex('by_org_user', q =>
      q.eq('organizationId', organizationId).eq('userId', userId),
    )
    .collect();

  for (const assignment of assignments) {
    const role = await ctx.db.get('roles', assignment.roleId);
    if (!role?.system) continue;
    if (role.scopeType !== scope) continue;
    if (scope === 'team' && role.teamId !== teamId) continue;
    if (scope === 'project' && role.projectId !== projectId) continue;
    await ctx.db.delete('roleAssignments', assignment._id);
  }
}

export async function syncOrganizationRoleAssignment(
  ctx: MutationCtx,
  organizationId: Id<'organizations'>,
  userId: Id<'users'>,
  role: 'owner' | 'admin' | 'member',
) {
  await removeSystemAssignments(ctx, organizationId, userId, 'organization');

  const key =
    role === 'owner'
      ? SYSTEM_ROLE_KEYS.ORG_OWNER
      : role === 'admin'
        ? SYSTEM_ROLE_KEYS.ORG_ADMIN
        : SYSTEM_ROLE_KEYS.ORG_MEMBER;
  const roleId = await getOrganizationSystemRoleId(ctx, organizationId, key);

  return assignRoleRecord(ctx, {
    roleId,
    userId,
    organizationId,
  });
}

export async function syncTeamRoleAssignment(
  ctx: MutationCtx,
  teamId: Id<'teams'>,
  userId: Id<'users'>,
  role: 'lead' | 'member',
) {
  const team = await ctx.db.get('teams', teamId);
  if (!team) {
    throw new ConvexError('TEAM_NOT_FOUND');
  }

  await removeSystemAssignments(
    ctx,
    team.organizationId,
    userId,
    'team',
    teamId,
  );

  const roles = await createDefaultTeamRoles(ctx, teamId);
  const roleId = role === 'lead' ? roles.leadRole : roles.memberRole;

  return assignRoleRecord(ctx, {
    roleId,
    userId,
    organizationId: team.organizationId,
    teamId,
  });
}

export async function syncProjectRoleAssignment(
  ctx: MutationCtx,
  projectId: Id<'projects'>,
  userId: Id<'users'>,
  role: 'lead' | 'member',
) {
  const project = await ctx.db.get('projects', projectId);
  if (!project) {
    throw new ConvexError('PROJECT_NOT_FOUND');
  }

  await removeSystemAssignments(
    ctx,
    project.organizationId,
    userId,
    'project',
    undefined,
    projectId,
  );

  const roles = await createDefaultProjectRoles(ctx, projectId);
  const roleId = role === 'lead' ? roles.leadRole : roles.memberRole;

  return assignRoleRecord(ctx, {
    roleId,
    userId,
    organizationId: project.organizationId,
    projectId,
  });
}

export async function assignTeamRole(
  ctx: MutationCtx,
  teamId: Id<'teams'>,
  userId: Id<'users'>,
  roleId: Id<'roles'>,
) {
  const team = await ctx.db.get('teams', teamId);
  if (!team) {
    throw new ConvexError('TEAM_NOT_FOUND');
  }

  const role = await ctx.db.get('roles', roleId);
  if (
    !role ||
    role.scopeType !== 'team' ||
    role.teamId !== teamId ||
    role.organizationId !== team.organizationId
  ) {
    throw new ConvexError('ROLE_SCOPE_MISMATCH');
  }

  const membership = await ctx.db
    .query('teamMembers')
    .withIndex('by_team_user', q => q.eq('teamId', teamId).eq('userId', userId))
    .first();
  if (!membership) {
    throw new ConvexError('USER_NOT_TEAM_MEMBER');
  }

  return assignRoleRecord(ctx, {
    roleId,
    userId,
    organizationId: team.organizationId,
    teamId,
  });
}

export async function assignProjectRole(
  ctx: MutationCtx,
  projectId: Id<'projects'>,
  userId: Id<'users'>,
  roleId: Id<'roles'>,
) {
  const project = await ctx.db.get('projects', projectId);
  if (!project) {
    throw new ConvexError('PROJECT_NOT_FOUND');
  }

  const role = await ctx.db.get('roles', roleId);
  if (
    !role ||
    role.scopeType !== 'project' ||
    role.projectId !== projectId ||
    role.organizationId !== project.organizationId
  ) {
    throw new ConvexError('ROLE_SCOPE_MISMATCH');
  }

  const membership = await ctx.db
    .query('projectMembers')
    .withIndex('by_project_user', q =>
      q.eq('projectId', projectId).eq('userId', userId),
    )
    .first();
  if (!membership) {
    throw new ConvexError('USER_NOT_PROJECT_MEMBER');
  }

  return assignRoleRecord(ctx, {
    roleId,
    userId,
    organizationId: project.organizationId,
    projectId,
  });
}

export const createTeamRole = mutation({
  args: {
    teamId: v.id('teams'),
    name: v.string(),
    description: v.optional(v.string()),
    permissions: v.array(permissionValidator),
  },
  handler: async (ctx, args) => {
    await requireAuthUser(ctx);

    const team = await ctx.db.get('teams', args.teamId);
    if (!team) {
      throw new ConvexError('TEAM_NOT_FOUND');
    }

    await requireScopedPermission(
      ctx,
      { organizationId: team.organizationId, teamId: team._id },
      PERMISSIONS.TEAM_EDIT,
    );

    const roleId = await ctx.db.insert('roles', {
      organizationId: team.organizationId,
      scopeType: 'team',
      teamId: team._id,
      key: buildCustomRoleKey(`team:${team._id}`, args.name),
      name: args.name,
      description: args.description,
      system: false,
    });

    for (const permission of args.permissions) {
      await ctx.db.insert('rolePermissions', {
        roleId,
        permission,
      });
    }

    return roleId;
  },
});

export const createProjectRole = mutation({
  args: {
    projectId: v.id('projects'),
    name: v.string(),
    description: v.optional(v.string()),
    permissions: v.array(permissionValidator),
  },
  handler: async (ctx, args) => {
    await requireAuthUser(ctx);

    const project = await ctx.db.get('projects', args.projectId);
    if (!project) {
      throw new ConvexError('PROJECT_NOT_FOUND');
    }

    await requireScopedPermission(
      ctx,
      { organizationId: project.organizationId, projectId: project._id },
      PERMISSIONS.PROJECT_EDIT,
    );

    const roleId = await ctx.db.insert('roles', {
      organizationId: project.organizationId,
      scopeType: 'project',
      projectId: project._id,
      key: buildCustomRoleKey(`project:${project._id}`, args.name),
      name: args.name,
      description: args.description,
      system: false,
    });

    for (const permission of args.permissions) {
      await ctx.db.insert('rolePermissions', {
        roleId,
        permission,
      });
    }

    return roleId;
  },
});

export const assignUserToTeamRole = mutation({
  args: {
    teamId: v.id('teams'),
    userId: v.id('users'),
    roleId: v.id('roles'),
  },
  handler: async (ctx, args) => {
    const actorId = await requireAuthUser(ctx);

    const team = await ctx.db.get('teams', args.teamId);
    if (!team) {
      throw new ConvexError('TEAM_NOT_FOUND');
    }

    await requireScopedPermission(
      ctx,
      { organizationId: team.organizationId, teamId: team._id },
      PERMISSIONS.TEAM_MEMBER_ADD,
    );

    const assignmentId = await assignTeamRole(
      ctx,
      args.teamId,
      args.userId,
      args.roleId,
    );
    const role = await ctx.db.get('roles', args.roleId);

    await recordActivity(ctx, {
      scope: resolveTeamScope(team),
      actorId,
      entityType: 'team',
      eventType: 'team_role_assigned',
      subjectUserId: args.userId,
      details: {
        field: 'role',
        roleKey: role?.key,
        roleName: role?.name,
      },
      snapshot: snapshotForTeam(team),
    });

    return assignmentId;
  },
});

export const assignUserToProjectRole = mutation({
  args: {
    projectId: v.id('projects'),
    userId: v.id('users'),
    roleId: v.id('roles'),
  },
  handler: async (ctx, args) => {
    const actorId = await requireAuthUser(ctx);

    const project = await ctx.db.get('projects', args.projectId);
    if (!project) {
      throw new ConvexError('PROJECT_NOT_FOUND');
    }

    await requireScopedPermission(
      ctx,
      { organizationId: project.organizationId, projectId: project._id },
      PERMISSIONS.PROJECT_MEMBER_ADD,
    );

    const assignmentId = await assignProjectRole(
      ctx,
      args.projectId,
      args.userId,
      args.roleId,
    );
    const role = await ctx.db.get('roles', args.roleId);

    await recordActivity(ctx, {
      scope: resolveProjectScope(project),
      actorId,
      entityType: 'project',
      eventType: 'project_role_assigned',
      subjectUserId: args.userId,
      details: {
        field: 'role',
        roleKey: role?.key,
        roleName: role?.name,
      },
      snapshot: snapshotForProject(project),
    });

    return assignmentId;
  },
});

export const getTeamRoles = query({
  args: {
    teamId: v.id('teams'),
  },
  handler: async (ctx, args) => {
    const team = await ctx.db.get('teams', args.teamId);
    if (!team) {
      throw new ConvexError('TEAM_NOT_FOUND');
    }

    if (!(await canViewTeam(ctx, team))) {
      throw new ConvexError('FORBIDDEN');
    }

    return ctx.db
      .query('roles')
      .withIndex('by_team', q => q.eq('teamId', args.teamId))
      .collect();
  },
});

export const getProjectRoles = query({
  args: {
    projectId: v.id('projects'),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get('projects', args.projectId);
    if (!project) {
      throw new ConvexError('PROJECT_NOT_FOUND');
    }

    if (!(await canViewProject(ctx, project))) {
      throw new ConvexError('FORBIDDEN');
    }

    return ctx.db
      .query('roles')
      .withIndex('by_project', q => q.eq('projectId', args.projectId))
      .collect();
  },
});

export const list = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const org = await getOrganizationBySlug(ctx, args.orgSlug);
    await requireOrgPermission(ctx, org._id, PERMISSIONS.ORG_MANAGE_ROLES);

    const roles = await ctx.db
      .query('roles')
      .withIndex('by_org_scope', q =>
        q.eq('organizationId', org._id).eq('scopeType', 'organization'),
      )
      .collect();
    const legacyRoles = await ctx.db
      .query('orgRoles')
      .withIndex('by_organization', q => q.eq('organizationId', org._id))
      .collect();
    const migratedLegacyKeys = new Set(
      roles
        .filter(role => role.key.startsWith('legacy:org:'))
        .map(role => role.key),
    );

    return [
      ...roles.filter(role => !role.system),
      ...legacyRoles
        .filter(role => !role.system)
        .filter(role => !migratedLegacyKeys.has(`legacy:org:${role._id}`))
        .map(mapLegacyOrganizationRole),
    ].sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const create = mutation({
  args: {
    orgSlug: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    permissions: v.array(permissionValidator),
  },
  handler: async (ctx, args) => {
    await requireAuthUser(ctx);

    const org = await getOrganizationBySlug(ctx, args.orgSlug);
    await requireOrgPermission(ctx, org._id, PERMISSIONS.ORG_MANAGE_ROLES);

    const roleId = await ctx.db.insert('roles', {
      organizationId: org._id,
      scopeType: 'organization',
      key: buildCustomRoleKey(`org:${org._id}`, args.name),
      name: args.name,
      description: args.description,
      system: false,
    });

    for (const permission of args.permissions) {
      await ctx.db.insert('rolePermissions', {
        roleId,
        permission,
      });
    }

    return roleId;
  },
});

export const assign = mutation({
  args: {
    orgSlug: v.string(),
    roleId: organizationRoleIdValidator,
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    await requireAuthUser(ctx);

    const org = await getOrganizationBySlug(ctx, args.orgSlug);
    await requireOrgPermission(ctx, org._id, PERMISSIONS.ORG_MANAGE_ROLES);
    await requireOrganizationMember(ctx, org._id, args.userId);

    const resolvedRole = await resolveOrganizationRole(
      ctx,
      org._id,
      args.roleId,
    );
    if (!resolvedRole) {
      throw new ConvexError('ROLE_NOT_FOUND');
    }

    if (resolvedRole.source === 'legacy') {
      const existingAssignment = await ctx.db
        .query('orgRoleAssignments')
        .withIndex('by_role_user', q =>
          q.eq('roleId', resolvedRole.role._id).eq('userId', args.userId),
        )
        .first();

      if (existingAssignment) {
        return existingAssignment._id;
      }

      return ctx.db.insert('orgRoleAssignments', {
        roleId: resolvedRole.role._id,
        userId: args.userId,
        organizationId: org._id,
        assignedAt: Date.now(),
      });
    }

    return assignRoleRecord(ctx, {
      roleId: resolvedRole.role._id,
      userId: args.userId,
      organizationId: org._id,
    });
  },
});

export const removeAssignment = mutation({
  args: {
    orgSlug: v.string(),
    roleId: organizationRoleIdValidator,
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    await requireAuthUser(ctx);

    const org = await getOrganizationBySlug(ctx, args.orgSlug);
    await requireOrgPermission(ctx, org._id, PERMISSIONS.ORG_MANAGE_ROLES);

    const resolvedRole = await resolveOrganizationRole(
      ctx,
      org._id,
      args.roleId,
    );
    if (!resolvedRole) {
      return;
    }

    if (resolvedRole.source === 'legacy') {
      const assignment = await ctx.db
        .query('orgRoleAssignments')
        .withIndex('by_role_user', q =>
          q.eq('roleId', resolvedRole.role._id).eq('userId', args.userId),
        )
        .first();
      if (assignment && assignment.organizationId === org._id) {
        await ctx.db.delete('orgRoleAssignments', assignment._id);
      }
      return;
    }

    const assignment = await ctx.db
      .query('roleAssignments')
      .withIndex('by_role_user', q =>
        q.eq('roleId', resolvedRole.role._id).eq('userId', args.userId),
      )
      .first();

    if (assignment && assignment.organizationId === org._id) {
      await ctx.db.delete('roleAssignments', assignment._id);
    }
  },
});

export const get = query({
  args: {
    orgSlug: v.string(),
    roleId: organizationRoleIdValidator,
  },
  handler: async (ctx, args) => {
    const org = await getOrganizationBySlug(ctx, args.orgSlug);
    await requireOrgPermission(ctx, org._id, PERMISSIONS.ORG_MANAGE_ROLES);

    const resolvedRole = await resolveOrganizationRole(
      ctx,
      org._id,
      args.roleId,
    );
    if (!resolvedRole) {
      throw new ConvexError('ROLE_NOT_FOUND');
    }

    return resolvedRole.summary;
  },
});

export const getPermissions = query({
  args: {
    roleId: organizationRoleIdValidator,
  },
  handler: async (ctx, args) => {
    await requireAuthUser(ctx);
    const normalizedUnifiedRoleId = ctx.db.normalizeId('roles', args.roleId);
    const normalizedLegacyRoleId = ctx.db.normalizeId('orgRoles', args.roleId);
    const role =
      (normalizedUnifiedRoleId
        ? await ctx.db.get('roles', normalizedUnifiedRoleId)
        : null) ??
      (normalizedLegacyRoleId
        ? await ctx.db.get('orgRoles', normalizedLegacyRoleId)
        : null);
    if (!role) {
      throw new ConvexError('ROLE_NOT_FOUND');
    }

    await requireOrgPermission(
      ctx,
      role.organizationId,
      PERMISSIONS.ORG_MANAGE_ROLES,
    );

    if (normalizedLegacyRoleId) {
      const permissions = await ctx.db
        .query('orgRolePermissions')
        .withIndex('by_role', q => q.eq('roleId', normalizedLegacyRoleId))
        .collect();
      return permissions.map(permission =>
        mapLegacyOrganizationRolePermission(normalizedLegacyRoleId, permission),
      );
    }

    if (!normalizedUnifiedRoleId) {
      throw new ConvexError('ROLE_NOT_FOUND');
    }

    return ctx.db
      .query('rolePermissions')
      .withIndex('by_role', q => q.eq('roleId', normalizedUnifiedRoleId))
      .collect();
  },
});

export const update = mutation({
  args: {
    orgSlug: v.string(),
    roleId: organizationRoleIdValidator,
    name: v.string(),
    description: v.optional(v.string()),
    permissions: v.array(permissionValidator),
  },
  handler: async (ctx, args) => {
    await requireAuthUser(ctx);

    const org = await getOrganizationBySlug(ctx, args.orgSlug);
    await requireOrgPermission(ctx, org._id, PERMISSIONS.ORG_MANAGE_ROLES);

    const resolvedRole = await resolveOrganizationRole(
      ctx,
      org._id,
      args.roleId,
    );
    if (!resolvedRole) {
      throw new ConvexError('ROLE_NOT_FOUND');
    }

    if (resolvedRole.role.system) {
      throw new ConvexError('CANNOT_EDIT_SYSTEM_ROLE');
    }

    if (resolvedRole.source === 'legacy') {
      await ctx.db.patch('orgRoles', resolvedRole.role._id, {
        name: args.name,
        description: args.description,
      });

      const existingPermissions = await ctx.db
        .query('orgRolePermissions')
        .withIndex('by_role', q => q.eq('roleId', resolvedRole.role._id))
        .collect();

      for (const permission of existingPermissions) {
        await ctx.db.delete('orgRolePermissions', permission._id);
      }

      for (const permission of args.permissions) {
        await ctx.db.insert('orgRolePermissions', {
          roleId: resolvedRole.role._id,
          permission,
        });
      }
      return;
    }

    await ctx.db.patch('roles', resolvedRole.role._id, {
      name: args.name,
      description: args.description,
    });

    const existingPermissions = await ctx.db
      .query('rolePermissions')
      .withIndex('by_role', q => q.eq('roleId', resolvedRole.role._id))
      .collect();

    for (const permission of existingPermissions) {
      await ctx.db.delete('rolePermissions', permission._id);
    }

    for (const permission of args.permissions) {
      await ctx.db.insert('rolePermissions', {
        roleId: resolvedRole.role._id,
        permission,
      });
    }
  },
});
