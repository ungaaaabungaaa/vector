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

    // Run ALL searches in parallel
    const [userResults, teams, projects, issuesByTitle, issuesByText] =
      await Promise.all([
        // Users: search by name
        ctx.db
          .query('users')
          .withSearchIndex('by_name_email_username', s => s.search('name', q))
          .take(limit * 3),

        // Teams: search by name (scoped to org via search index filter)
        ctx.db
          .query('teams')
          .withSearchIndex('search_name', s =>
            s.search('name', q).eq('organizationId', org._id),
          )
          .take(limit),

        // Projects: search by name (scoped to org via search index filter)
        ctx.db
          .query('projects')
          .withSearchIndex('search_name', s =>
            s.search('name', q).eq('organizationId', org._id),
          )
          .take(limit),

        // Issues: search by title
        ctx.db
          .query('issues')
          .withSearchIndex('search_title', s =>
            s.search('title', q).eq('organizationId', org._id),
          )
          .take(limit),

        // Issues: search by searchText
        ctx.db
          .query('issues')
          .withSearchIndex('search_text', s =>
            s.search('searchText', q).eq('organizationId', org._id),
          )
          .take(limit),
      ]);

    // Filter users to org members using per-user index lookup (not .collect())
    const memberChecks = await Promise.all(
      userResults.map(u =>
        ctx.db
          .query('members')
          .withIndex('by_org_user', idx =>
            idx.eq('organizationId', org._id).eq('userId', u._id),
          )
          .first(),
      ),
    );
    const users = userResults
      .filter((_, i) => memberChecks[i] !== null)
      .slice(0, limit)
      .map(u => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        username: u.username,
        image: u.image,
      }));

    // Deduplicate issues from title + text search
    const seenIssueIds = new Set<string>();
    const rawIssues = [...issuesByTitle, ...issuesByText]
      .filter(i => {
        if (seenIssueIds.has(i._id)) return false;
        seenIssueIds.add(i._id);
        return true;
      })
      .slice(0, limit);

    // Batch-fetch issue states in parallel (fix N+1)
    const issueStates = await Promise.all(
      rawIssues.map(async i => {
        const assignee = await ctx.db
          .query('issueAssignees')
          .withIndex('by_issue', idx => idx.eq('issueId', i._id))
          .first();
        if (!assignee?.stateId) return null;
        return ctx.db.get('issueStates', assignee.stateId);
      }),
    );

    const issues = rawIssues.map((i, idx) => ({
      _id: i._id,
      title: i.title,
      key: i.key,
      stateIcon: issueStates[idx]?.icon ?? undefined,
      stateColor: issueStates[idx]?.color ?? undefined,
    }));

    return {
      users,
      teams: teams.map(t => ({
        _id: t._id,
        name: t.name,
        key: t.key,
        icon: t.icon,
        color: t.color,
      })),
      projects: projects.map(p => ({
        _id: p._id,
        name: p.name,
        key: p.key,
        icon: p.icon,
        color: p.color,
      })),
      issues,
    };
  },
});
