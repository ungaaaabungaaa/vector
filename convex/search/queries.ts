import { query } from '../_generated/server';
import { v } from 'convex/values';
import { getOrganizationBySlug } from '../authz';

export const searchEntities = query({
  args: {
    orgSlug: v.string(),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!args.query.trim())
      return { users: [], teams: [], projects: [], issues: [] };

    const org = await getOrganizationBySlug(ctx, args.orgSlug);
    const limit = args.limit ?? 5;
    const q = args.query.trim();

    // Search users by name
    const userResults = await ctx.db
      .query('users')
      .withSearchIndex('by_name_email_username', s => s.search('name', q))
      .take(limit * 2);

    // Filter to org members
    const orgMembers = await ctx.db
      .query('members')
      .withIndex('by_organization', idx => idx.eq('organizationId', org._id))
      .collect();
    const memberUserIds = new Set(orgMembers.map(m => m.userId));
    const users = userResults
      .filter(u => memberUserIds.has(u._id))
      .slice(0, limit)
      .map(u => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        username: u.username,
        image: u.image,
      }));

    // Search teams by name
    const teams = (
      await ctx.db
        .query('teams')
        .withSearchIndex('search_name', s =>
          s.search('name', q).eq('organizationId', org._id),
        )
        .take(limit)
    ).map(t => ({
      _id: t._id,
      name: t.name,
      key: t.key,
      icon: t.icon,
      color: t.color,
    }));

    // Search projects by name
    const projects = (
      await ctx.db
        .query('projects')
        .withSearchIndex('search_name', s =>
          s.search('name', q).eq('organizationId', org._id),
        )
        .take(limit)
    ).map(p => ({
      _id: p._id,
      name: p.name,
      key: p.key,
      icon: p.icon,
      color: p.color,
    }));

    // Search issues by key, title, and description
    const issues = (
      await ctx.db
        .query('issues')
        .withSearchIndex('search_text', s =>
          s.search('searchText', q).eq('organizationId', org._id),
        )
        .take(limit)
    ).map(i => ({
      _id: i._id,
      title: i.title,
      key: i.key,
    }));

    return { users, teams, projects, issues };
  },
});
