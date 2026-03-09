import { query } from '../_generated/server';
import { v, ConvexError } from 'convex/values';
import type { Id, Doc } from '../_generated/dataModel';
import { canViewTeam } from '../access';
import { isDefined } from '../_shared/typeGuards';

/**
 * Get team by organization slug and team key
 */
export const getByKey = query({
  args: {
    orgSlug: v.string(),
    teamKey: v.string(),
  },
  handler: async (ctx, args) => {
    // Find organization
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    // Find team by key and organization
    const team = await ctx.db
      .query('teams')
      .withIndex('by_org_key', q =>
        q.eq('organizationId', org._id).eq('key', args.teamKey),
      )
      .first();

    if (!team) {
      throw new ConvexError('TEAM_NOT_FOUND');
    }

    // Check if user can view this team based on visibility
    if (!(await canViewTeam(ctx, team))) {
      throw new ConvexError('FORBIDDEN');
    }

    // Get team details including lead user
    const leadUser = team.leadId
      ? await ctx.db.get('users', team.leadId)
      : null;

    return {
      ...team,
      lead: leadUser,
    };
  },
});

/**
 * List teams in organization
 */
export const list = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    // Find organization
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    // Get all teams in organization
    const allTeams = await ctx.db
      .query('teams')
      .withIndex('by_organization', q => q.eq('organizationId', org._id))
      .collect();

    // Filter teams based on visibility permissions
    const teamPromises = allTeams.map(async team => {
      const canView = await canViewTeam(ctx, team);
      return canView ? team : null;
    });
    const teams = (await Promise.all(teamPromises)).filter(
      (team): team is Doc<'teams'> => team !== null,
    );

    // Batch database calls for better performance
    const leadIds = teams.map(t => t.leadId).filter(isDefined);
    const leadUsers = await Promise.all(
      leadIds.map(id => ctx.db.get('users', id)),
    );
    const leadUserMap = new Map(leadIds.map((id, i) => [id, leadUsers[i]]));

    // Get team member counts in batches
    const teamMemberCounts = await Promise.all(
      teams.map(async team => {
        const memberCount = await ctx.db
          .query('teamMembers')
          .withIndex('by_team', q => q.eq('teamId', team._id))
          .collect()
          .then(members => members.length);
        return { teamId: team._id, memberCount };
      }),
    );
    const memberCountMap = new Map(
      teamMemberCounts.map(({ teamId, memberCount }) => [teamId, memberCount]),
    );

    // Combine results
    const teamsWithDetails = teams.map(team => {
      const leadUser = team.leadId ? leadUserMap.get(team.leadId) : null;
      const memberCount = memberCountMap.get(team._id) ?? 0;

      return {
        ...team,
        lead: leadUser,
        memberCount,
      };
    });

    return teamsWithDetails;
  },
});

/**
 * List team members
 */
export const listMembers = query({
  args: {
    teamId: v.optional(v.id('teams')),
  },
  handler: async (ctx, args) => {
    if (!args.teamId) {
      throw new ConvexError('TEAM_NOT_FOUND');
    }
    const team = await ctx.db.get('teams', args.teamId);
    if (!team) {
      throw new ConvexError('TEAM_NOT_FOUND');
    }

    if (!(await canViewTeam(ctx, team))) {
      throw new ConvexError('FORBIDDEN');
    }

    // Get team members
    const teamMembers = await ctx.db
      .query('teamMembers')
      .withIndex('by_team', q => q.eq('teamId', team._id))
      .collect();

    // Get user details for each member
    const membersWithUsers = await Promise.all(
      teamMembers.map(async member => {
        const user = await ctx.db.get('users', member.userId);
        return {
          ...member,
          user,
        };
      }),
    );

    return membersWithUsers;
  },
});
