import { query } from '../_generated/server';
import { v, ConvexError } from 'convex/values';
import type { Id, Doc } from '../_generated/dataModel';
import { canViewProject } from '../access';

export const getByKey = query({
  args: {
    orgSlug: v.string(),
    projectKey: v.string(),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    const project = await ctx.db
      .query('projects')
      .withIndex('by_org_key', q =>
        q.eq('organizationId', org._id).eq('key', args.projectKey),
      )
      .first();

    if (!project) {
      throw new ConvexError('PROJECT_NOT_FOUND');
    }

    if (!(await canViewProject(ctx, project))) {
      throw new ConvexError('FORBIDDEN');
    }

    const leadUser = project.leadId
      ? await ctx.db.get('users', project.leadId)
      : null;
    return { ...project, lead: leadUser };
  },
});

export const list = query({
  args: {
    orgSlug: v.string(),
    teamId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    let projectsQuery = ctx.db
      .query('projects')
      .withIndex('by_organization', q => q.eq('organizationId', org._id));

    if (args.teamId) {
      const team = await ctx.db
        .query('teams')
        .withIndex('by_org_key', q =>
          q.eq('organizationId', org._id).eq('key', args.teamId!),
        )
        .first();
      if (team) {
        projectsQuery = projectsQuery.filter(q =>
          q.eq(q.field('teamId'), team._id),
        );
      }
    }

    const allProjects = await projectsQuery.collect();

    const projectPromises = allProjects.map(async project => {
      const canView = await canViewProject(ctx, project);
      return canView ? project : null;
    });
    const projects = (await Promise.all(projectPromises)).filter(
      (project): project is Doc<'projects'> => project !== null,
    );

    const leadIds = projects
      .map(p => p.leadId)
      .filter(Boolean) as Id<'users'>[];
    const statusIds = projects
      .map(p => p.statusId)
      .filter(Boolean) as Id<'projectStatuses'>[];

    const leadUsers = await Promise.all(
      leadIds.map(id => ctx.db.get('users', id)),
    );
    const statuses = await Promise.all(
      statusIds.map(id => ctx.db.get('projectStatuses', id)),
    );

    const leadUserMap = new Map(leadIds.map((id, i) => [id, leadUsers[i]]));
    const statusMap = new Map(statusIds.map((id, i) => [id, statuses[i]]));

    const projectsWithDetails = projects.map(project => {
      const leadUser = project.leadId ? leadUserMap.get(project.leadId) : null;
      const status = project.statusId ? statusMap.get(project.statusId) : null;
      return { ...project, lead: leadUser, status };
    });

    return projectsWithDetails;
  },
});

export const listMembers = query({
  args: {
    projectId: v.optional(v.id('projects')),
    orgSlug: v.optional(v.string()),
    projectKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let project: Doc<'projects'> | null = null;

    if (args.projectId) {
      project = await ctx.db.get('projects', args.projectId);
    } else if (args.orgSlug && args.projectKey) {
      const org = await ctx.db
        .query('organizations')
        .withIndex('by_slug', q => q.eq('slug', args.orgSlug!))
        .first();

      if (!org) {
        throw new ConvexError('ORGANIZATION_NOT_FOUND');
      }

      project = await ctx.db
        .query('projects')
        .withIndex('by_org_key', q =>
          q.eq('organizationId', org._id).eq('key', args.projectKey!),
        )
        .first();
    }

    if (!project) {
      throw new ConvexError('PROJECT_NOT_FOUND');
    }

    if (!(await canViewProject(ctx, project))) {
      throw new ConvexError('FORBIDDEN');
    }

    const projectMembers = await ctx.db
      .query('projectMembers')
      .withIndex('by_project', q => q.eq('projectId', project._id))
      .collect();

    const membersWithUsers = await Promise.all(
      projectMembers.map(async member => {
        const user = await ctx.db.get('users', member.userId);
        return { ...member, user };
      }),
    );

    return membersWithUsers;
  },
});
