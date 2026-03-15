import { query } from '../_generated/server';
import { v, ConvexError } from 'convex/values';
import type { Doc } from '../_generated/dataModel';
import { getAuthUserId } from '../authUtils';
import { canViewIssue, canViewTeam, canViewProject } from '../access';
import { requireOrgPermission } from '../authz';
import { PERMISSIONS } from '../_shared/permissions';

/**
 * Get organization by slug
 */
export const getBySlug = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    // Find organization
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    // Verify user is a member
    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError('FORBIDDEN');
    }

    return org;
  },
});

/**
 * List organization members with roles
 */
export const listMembersWithRoles = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    // Find organization
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    // Verify user is a member
    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError('FORBIDDEN');
    }

    const members = await ctx.db
      .query('members')
      .withIndex('by_organization', q => q.eq('organizationId', org._id))
      .collect();

    const users = await Promise.all(
      members.map(m => ctx.db.get('users', m.userId)),
    );

    const allAssignments = await ctx.db
      .query('roleAssignments')
      .withIndex('by_organization', q => q.eq('organizationId', org._id))
      .collect();
    const legacyAssignments = await ctx.db
      .query('orgRoleAssignments')
      .withIndex('by_organization', q => q.eq('organizationId', org._id))
      .collect();

    const roleDefs = await Promise.all(
      allAssignments.map(r => ctx.db.get('roles', r.roleId)),
    );
    const legacyRoleIds = Array.from(
      new Set(legacyAssignments.map(assignment => assignment.roleId)),
    );
    const legacyRoleDefs = await Promise.all(
      legacyRoleIds.map(roleId => ctx.db.get('orgRoles', roleId)),
    );
    const legacyRoleMap = new Map(
      legacyRoleDefs
        .filter((role): role is NonNullable<typeof role> => role !== null)
        .map(role => [role._id, role]),
    );
    const migratedLegacyKeys = new Set(
      roleDefs
        .filter((role): role is NonNullable<typeof role> => role !== null)
        .map(role => role.key),
    );

    return members.map((m, i) => {
      const user = users[i];
      const userRoles = allAssignments.filter(
        r => r.userId === m.userId && !r.teamId && !r.projectId,
      );
      const customRoles = userRoles
        .map(ur => roleDefs.find(rd => rd?._id === ur.roleId))
        .filter((r): r is NonNullable<typeof r> => !!r && !r.system);
      const legacyCustomRoles = legacyAssignments
        .filter(assignment => assignment.userId === m.userId)
        .map(assignment => legacyRoleMap.get(assignment.roleId))
        .filter(
          (role): role is NonNullable<typeof role> =>
            !!role &&
            !role.system &&
            !migratedLegacyKeys.has(`legacy:org:${role._id}`),
        )
        .map(role => ({
          _id: role._id,
          _creationTime: role._creationTime,
          organizationId: role.organizationId,
          scopeType: 'organization' as const,
          key: `legacy:org:${role._id}`,
          name: role.name,
          description: role.description,
          system: role.system,
        }));
      const allCustomRoles = [...customRoles, ...legacyCustomRoles];
      return {
        ...m,
        name: user?.name,
        email: user?.email,
        image: user?.image,
        roleId: allCustomRoles[0]?._id ?? null,
        roleName: allCustomRoles[0]?.name ?? null,
        customRoles: allCustomRoles,
      };
    });
  },
});

export const listInvites = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    // Find organization
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    // Verify user is a member
    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError('FORBIDDEN');
    }

    await requireOrgPermission(ctx, org._id, PERMISSIONS.ORG_MANAGE_MEMBERS);

    const invites = await ctx.db
      .query('invitations')
      .withIndex('by_organization', q => q.eq('organizationId', org._id))
      .filter(q => q.eq(q.field('status'), 'pending'))
      .collect();

    return invites.filter(invite => invite.expiresAt >= Date.now());
  },
});

/**
 * Get organization statistics
 */
export const getOrganizationStats = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    // Find organization
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    // Verify user is a member
    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError('FORBIDDEN');
    }

    // Get counts
    const memberCount = await ctx.db
      .query('members')
      .withIndex('by_organization', q => q.eq('organizationId', org._id))
      .collect()
      .then(members => members.length);

    const projectCount = await ctx.db
      .query('projects')
      .withIndex('by_organization', q => q.eq('organizationId', org._id))
      .collect()
      .then(projects => projects.length);

    const teamCount = await ctx.db
      .query('teams')
      .withIndex('by_organization', q => q.eq('organizationId', org._id))
      .collect()
      .then(teams => teams.length);

    const issueCount = await ctx.db
      .query('issues')
      .withIndex('by_organization', q => q.eq('organizationId', org._id))
      .collect()
      .then(issues => issues.length);

    return {
      memberCount,
      projectCount,
      teamCount,
      issueCount,
    };
  },
});

/**
 * List recent projects
 */
export const getRecentProjects = query({
  args: {
    orgSlug: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    // Find organization
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    // Verify user is a member
    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError('FORBIDDEN');
    }

    // Get recent projects
    const projects = await ctx.db
      .query('projects')
      .withIndex('by_organization', q => q.eq('organizationId', org._id))
      .collect();

    const visibleProjects = (
      await Promise.all(
        projects.map(async project =>
          (await canViewProject(ctx, project)) ? project : null,
        ),
      )
    ).filter((project): project is Doc<'projects'> => project !== null);

    return visibleProjects
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, args.limit ?? 5);
  },
});

/**
 * List recent issues
 */
export const getRecentIssues = query({
  args: {
    orgSlug: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    // Find organization
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    // Verify user is a member
    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError('FORBIDDEN');
    }

    // Get recent issues
    const issues = await ctx.db
      .query('issues')
      .withIndex('by_organization', q => q.eq('organizationId', org._id))
      .collect();

    // Filter issues based on visibility permissions
    const issuePromises = issues.map(async issue => {
      const canView = await canViewIssue(ctx, issue);
      return canView ? issue : null;
    });
    const visibleIssues = (await Promise.all(issuePromises)).filter(
      (issue): issue is Doc<'issues'> => issue !== null,
    );

    // Sort by creation time (newest first) and limit
    const sortedIssues = visibleIssues
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, args.limit ?? 10);

    return sortedIssues;
  },
});

/**
 * List organization members
 */
export const listMembers = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    // Find organization
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    // Verify user is a member
    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError('FORBIDDEN');
    }

    // Get all members
    const members = await ctx.db
      .query('members')
      .withIndex('by_organization', q => q.eq('organizationId', org._id))
      .collect();

    // Get user details for each member
    const memberUserIds = members.map(m => m.userId);
    const users = await Promise.all(
      memberUserIds.map(id => ctx.db.get('users', id)),
    );
    const userMap = new Map(memberUserIds.map((id, i) => [id, users[i]]));

    // Combine results
    const membersWithUsers = members.map(member => {
      const user = userMap.get(member.userId);
      return {
        ...member,
        user: user
          ? {
              _id: user._id,
              name: user.name,
              email: user.email,
              image: user.image,
              username: user.username,
              role: user.role,
            }
          : null,
      };
    });

    return membersWithUsers;
  },
});

/**
 * Search organization members
 */
export const searchMembers = query({
  args: {
    orgSlug: v.string(),
    query: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    // Find organization
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    // Verify user is a member
    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError('FORBIDDEN');
    }

    // Get all members
    const members = await ctx.db
      .query('members')
      .withIndex('by_organization', q => q.eq('organizationId', org._id))
      .collect();

    // Get user details for each member
    const memberUserIds = members.map(m => m.userId);
    const users = await Promise.all(
      memberUserIds.map(id => ctx.db.get('users', id)),
    );
    const userMap = new Map(memberUserIds.map((id, i) => [id, users[i]]));

    // Filter and search
    let results = members.map(member => {
      const user = userMap.get(member.userId);
      return {
        ...member,
        user: user
          ? {
              _id: user._id,
              name: user.name,
              email: user.email,
              image: user.image,
              username: user.username,
              role: user.role,
            }
          : null,
      };
    });

    // Apply search filter
    if (args.query) {
      const searchTerm = args.query.toLowerCase();
      results = results.filter(
        member =>
          member.user &&
          (member.user.name?.toLowerCase().includes(searchTerm) ||
            member.user.email?.toLowerCase().includes(searchTerm) ||
            member.user.username?.toLowerCase().includes(searchTerm)),
      );
    }

    // Apply limit
    if (args.limit) {
      results = results.slice(0, args.limit);
    }

    return results;
  },
});

/**
 * List organization teams
 */
export const listTeams = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    // Find organization
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    // Verify user is a member
    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError('FORBIDDEN');
    }

    // Get all teams
    const allTeams = await ctx.db
      .query('teams')
      .withIndex('by_organization', q => q.eq('organizationId', org._id))
      .collect();

    // Filter teams based on visibility permissions
    const teamPromises = allTeams.map(async team => {
      const canView = await canViewTeam(ctx, team);
      return canView ? team : null;
    });
    const visibleTeams = (await Promise.all(teamPromises)).filter(
      (team): team is Doc<'teams'> => team !== null,
    );

    return visibleTeams;
  },
});

/**
 * List organization projects
 */
export const listProjects = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    // Find organization
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    // Verify user is a member
    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError('FORBIDDEN');
    }

    // Get all projects
    const allProjects = await ctx.db
      .query('projects')
      .withIndex('by_organization', q => q.eq('organizationId', org._id))
      .collect();

    // Filter projects based on visibility permissions
    const projectPromises = allProjects.map(async project => {
      const canView = await canViewProject(ctx, project);
      return canView ? project : null;
    });
    const visibleProjects = (await Promise.all(projectPromises)).filter(
      (project): project is Doc<'projects'> => project !== null,
    );

    // Get project statuses and attach to projects
    const projectsWithStatus = await Promise.all(
      visibleProjects.map(async project => {
        const status = project.statusId
          ? await ctx.db.get('projectStatuses', project.statusId)
          : null;

        return {
          ...project,
          statusColor: status?.color,
          statusIcon: status?.icon,
        };
      }),
    );

    return projectsWithStatus;
  },
});

/**
 * List issue states
 */
export const listIssueStates = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    // Find organization
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    // Verify user is a member
    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError('FORBIDDEN');
    }

    // Get issue states
    const states = await ctx.db
      .query('issueStates')
      .withIndex('by_organization', q => q.eq('organizationId', org._id))
      .collect();

    return states;
  },
});

/**
 * List project statuses
 */
export const listProjectStatuses = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    // Find organization
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    // Verify user is a member
    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError('FORBIDDEN');
    }

    // Get project statuses
    const statuses = await ctx.db
      .query('projectStatuses')
      .withIndex('by_organization', q => q.eq('organizationId', org._id))
      .collect();

    return statuses;
  },
});

/**
 * List issue priorities
 */
export const listIssuePriorities = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    // Find organization
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    // Verify user is a member
    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError('FORBIDDEN');
    }

    // Get issue priorities
    const priorities = await ctx.db
      .query('issuePriorities')
      .withIndex('by_organization', q => q.eq('organizationId', org._id))
      .collect();

    return priorities;
  },
});

export const getOrgMember = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      return null;
    }

    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    return membership;
  },
});

/**
 * Get organization logo URL
 */
export const getLogoUrl = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    // Find organization
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org || !org.logo) {
      return null;
    }

    // Generate URL for the logo
    return await ctx.storage.getUrl(org.logo);
  },
});

/**
 * Get file URL by storage ID string (for API routes)
 */
export const getFileUrlByString = query({
  args: {
    storageIdString: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageIdString);
  },
});
