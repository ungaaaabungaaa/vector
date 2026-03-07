import { query } from '../_generated/server';
import { v, ConvexError } from 'convex/values';
import type { Id, Doc } from '../_generated/dataModel';
import { getAuthUserId } from '../authUtils';
import { canViewIssue } from '../access';

export const getByKey = query({
  args: {
    orgSlug: v.string(),
    issueKey: v.string(),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    const issue = await ctx.db
      .query('issues')
      .withIndex('by_key', q => q.eq('key', args.issueKey))
      .filter(q => q.eq(q.field('organizationId'), org._id))
      .first();

    if (!issue) {
      throw new ConvexError('ISSUE_NOT_FOUND');
    }

    if (!(await canViewIssue(ctx, issue))) {
      throw new ConvexError('FORBIDDEN');
    }

    const project = issue.projectId
      ? await ctx.db.get('projects', issue.projectId)
      : null;
    const assignees = await ctx.db
      .query('issueAssignees')
      .withIndex('by_issue', q => q.eq('issueId', issue._id))
      .collect();

    const assigneeUsers = await Promise.all(
      assignees.map(async assignee => {
        if (!assignee.assigneeId) return null;
        return await ctx.db.get('users', assignee.assigneeId);
      }),
    ).then(users => users.filter(Boolean));

    const createdByUser = issue.reporterId
      ? await ctx.db.get('users', issue.reporterId)
      : null;
    const priority = issue.priorityId
      ? await ctx.db.get('issuePriorities', issue.priorityId)
      : null;

    const childIssues = await ctx.db
      .query('issues')
      .withIndex('by_parent', q => q.eq('parentIssueId', issue._id))
      .collect();

    const children = await Promise.all(
      childIssues.map(async child => {
        const childPriority = child.priorityId
          ? await ctx.db.get('issuePriorities', child.priorityId)
          : null;

        const firstAssignment = await ctx.db
          .query('issueAssignees')
          .withIndex('by_issue', q => q.eq('issueId', child._id))
          .first();

        const state = firstAssignment?.stateId
          ? await ctx.db.get('issueStates', firstAssignment.stateId)
          : null;

        return {
          ...child,
          priority: childPriority,
          state,
        };
      }),
    );

    return {
      ...issue,
      project,
      assignees: assigneeUsers,
      createdBy: createdByUser,
      priority,
      children,
    };
  },
});

export const list = query({
  args: {
    orgSlug: v.string(),
    projectKey: v.optional(v.string()),
    stateId: v.optional(v.id('issueStates')),
    assigneeId: v.optional(v.id('users')),
    limit: v.optional(v.number()),
    parentIssueId: v.optional(v.union(v.id('issues'), v.literal('root'))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError('ACCESS_DENIED');
    }

    let issues;

    if (args.projectKey) {
      const projectKey = args.projectKey;
      const project = await ctx.db
        .query('projects')
        .withIndex('by_org_key', q =>
          q.eq('organizationId', org._id).eq('key', projectKey),
        )
        .first();

      if (!project) {
        throw new ConvexError('PROJECT_NOT_FOUND');
      }

      issues = await ctx.db
        .query('issues')
        .withIndex('by_project', q => q.eq('projectId', project._id))
        .collect();
    } else {
      issues = await ctx.db
        .query('issues')
        .withIndex('by_organization', q => q.eq('organizationId', org._id))
        .collect();
    }

    if (args.parentIssueId) {
      if (args.parentIssueId === 'root') {
        issues = issues.filter(issue => !issue.parentIssueId);
      } else {
        issues = issues.filter(
          issue => issue.parentIssueId === args.parentIssueId,
        );
      }
    }

    if (args.assigneeId) {
      const assigneeIssueIds = new Set();
      const assignments = await ctx.db
        .query('issueAssignees')
        .withIndex('by_assignee', q => q.eq('assigneeId', args.assigneeId))
        .collect();

      assignments.forEach(assignment => {
        assigneeIssueIds.add(assignment.issueId);
      });

      issues = issues.filter(issue => assigneeIssueIds.has(issue._id));
    }

    const issuePromises = issues.map(async issue => {
      const canView = await canViewIssue(ctx, issue);
      return canView ? issue : null;
    });
    const visibleIssues = (await Promise.all(issuePromises)).filter(
      (issue): issue is Doc<'issues'> => issue !== null,
    );

    const projectIds = visibleIssues
      .map(i => i.projectId)
      .filter(Boolean) as Id<'projects'>[];
    const priorityIds = visibleIssues
      .map(i => i.priorityId)
      .filter(Boolean) as Id<'issuePriorities'>[];
    const reporterIds = visibleIssues
      .map(i => i.reporterId)
      .filter(Boolean) as Id<'users'>[];

    const projects = await Promise.all(
      projectIds.map(id => ctx.db.get('projects', id)),
    );
    const priorities = await Promise.all(
      priorityIds.map(id => ctx.db.get('issuePriorities', id)),
    );
    const reporters = await Promise.all(
      reporterIds.map(id => ctx.db.get('users', id)),
    );

    const projectMap = new Map();
    projectIds.forEach((id, i) => {
      if (projects[i]) projectMap.set(id, projects[i]);
    });

    const priorityMap = new Map();
    priorityIds.forEach((id, i) => {
      if (priorities[i]) priorityMap.set(id, priorities[i]);
    });

    const reporterMap = new Map();
    reporterIds.forEach((id, i) => {
      if (reporters[i]) reporterMap.set(id, reporters[i]);
    });

    const allAssignments = await Promise.all(
      visibleIssues.map(issue =>
        ctx.db
          .query('issueAssignees')
          .withIndex('by_issue', q => q.eq('issueId', issue._id))
          .collect(),
      ),
    ).then(results => results.flat());

    const assigneeIds = allAssignments
      .map(a => a.assigneeId)
      .filter(Boolean) as Id<'users'>[];
    const assigneeUsers = await Promise.all(
      assigneeIds.map(id => ctx.db.get('users', id)),
    );
    const assigneeMap = new Map();
    assigneeIds.forEach((id, i) => {
      if (assigneeUsers[i]) assigneeMap.set(id, assigneeUsers[i]);
    });

    const assignmentsByIssue = new Map<Id<'issues'>, typeof allAssignments>();
    for (const assignment of allAssignments) {
      if (!assignmentsByIssue.has(assignment.issueId)) {
        assignmentsByIssue.set(assignment.issueId, []);
      }
      assignmentsByIssue.get(assignment.issueId)!.push(assignment);
    }

    const issuesWithDetails = visibleIssues.map(issue => {
      const project = issue.projectId ? projectMap.get(issue.projectId) : null;
      const priority = issue.priorityId
        ? priorityMap.get(issue.priorityId)
        : null;
      const createdBy = issue.reporterId
        ? reporterMap.get(issue.reporterId)
        : null;

      const issueAssignments = assignmentsByIssue.get(issue._id) ?? [];
      const assigneeUsersList = issueAssignments
        .map(assignment => {
          if (!assignment.assigneeId) return null;
          return assigneeMap.get(assignment.assigneeId);
        })
        .filter(Boolean);

      return {
        ...issue,
        project,
        priority,
        createdBy,
        state: null,
        assignees: assigneeUsersList,
      };
    });

    return issuesWithDetails;
  },
});

export const listComments = query({
  args: {
    issueId: v.id('issues'),
  },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get('issues', args.issueId);
    if (!issue) {
      throw new ConvexError('ISSUE_NOT_FOUND');
    }

    if (!(await canViewIssue(ctx, issue))) {
      throw new ConvexError('FORBIDDEN');
    }

    const comments = await ctx.db
      .query('comments')
      .withIndex('by_issue', q => q.eq('issueId', issue._id))
      .collect();

    const commentsWithAuthors = await Promise.all(
      comments.map(async comment => {
        const author = await ctx.db.get('users', comment.authorId);
        return {
          ...comment,
          author,
        };
      }),
    );

    return commentsWithAuthors;
  },
});

export const getAssignments = query({
  args: {
    issueId: v.id('issues'),
  },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get('issues', args.issueId);
    if (!issue) {
      throw new ConvexError('ISSUE_NOT_FOUND');
    }

    if (!(await canViewIssue(ctx, issue))) {
      throw new ConvexError('FORBIDDEN');
    }

    const assignments = await ctx.db
      .query('issueAssignees')
      .withIndex('by_issue', q => q.eq('issueId', args.issueId))
      .collect();

    const assigneeIds = assignments
      .map(a => a.assigneeId)
      .filter((id): id is Id<'users'> => Boolean(id));
    const assignees = await Promise.all(
      assigneeIds.map(id => ctx.db.get('users', id)),
    );
    const assigneeMap = new Map(assigneeIds.map((id, i) => [id, assignees[i]]));

    const stateIds = assignments
      .map(a => a.stateId)
      .filter((id): id is Id<'issueStates'> => Boolean(id));
    const states = await Promise.all(
      stateIds.map(id => ctx.db.get('issueStates', id)),
    );
    const stateMap = new Map(stateIds.map((id, i) => [id, states[i]]));

    return assignments.map(assignment => ({
      ...assignment,
      assignee: assignment.assigneeId
        ? assigneeMap.get(assignment.assigneeId)
        : null,
      state: assignment.stateId ? stateMap.get(assignment.stateId) : null,
    }));
  },
});

export const listIssues = query({
  args: {
    orgSlug: v.string(),
    projectId: v.optional(v.string()),
    teamId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    let issuesQuery = ctx.db
      .query('issues')
      .withIndex('by_organization', q => q.eq('organizationId', org._id));

    if (args.projectId) {
      const project = await ctx.db
        .query('projects')
        .withIndex('by_org_key', q =>
          q.eq('organizationId', org._id).eq('key', args.projectId!),
        )
        .first();
      if (project) {
        issuesQuery = issuesQuery.filter(q =>
          q.eq(q.field('projectId'), project._id),
        );
      }
    }

    if (args.teamId) {
      const team = await ctx.db
        .query('teams')
        .withIndex('by_org_key', q =>
          q.eq('organizationId', org._id).eq('key', args.teamId!),
        )
        .first();
      if (team) {
        issuesQuery = issuesQuery.filter(q =>
          q.eq(q.field('teamId'), team._id),
        );
      }
    }

    const allIssues = await issuesQuery.order('desc').collect();

    const visibleIssues: Array<Doc<'issues'>> = [];
    for (const issue of allIssues) {
      const canView = await canViewIssue(ctx, issue);
      if (canView) {
        visibleIssues.push(issue);
      }
    }

    const issuesWithDetails = await Promise.all(
      visibleIssues.map(async issue => {
        const priority = issue.priorityId
          ? await ctx.db.get('issuePriorities', issue.priorityId)
          : null;
        const project = issue.projectId
          ? await ctx.db.get('projects', issue.projectId)
          : null;
        const team = issue.teamId
          ? await ctx.db.get('teams', issue.teamId)
          : null;
        const reporter = issue.reporterId
          ? await ctx.db.get('users', issue.reporterId)
          : null;

        const parentIssue = issue.parentIssueId
          ? await ctx.db.get('issues', issue.parentIssueId)
          : null;

        const assignments = await ctx.db
          .query('issueAssignees')
          .withIndex('by_issue', q => q.eq('issueId', issue._id))
          .collect();

        const assignees = await Promise.all(
          assignments.map(async assignment => {
            const assignee = assignment.assigneeId
              ? await ctx.db.get('users', assignment.assigneeId)
              : null;
            const state = assignment.stateId
              ? await ctx.db.get('issueStates', assignment.stateId)
              : null;
            return {
              assignmentId: assignment._id,
              assigneeId: assignee?._id,
              assigneeName: assignee?.name,
              assigneeEmail: assignee?.email,
              stateId: state?._id,
              stateName: state?.name,
              stateIcon: state?.icon,
              stateColor: state?.color,
              stateType: state?.type,
            };
          }),
        );

        return {
          ...issue,
          id: issue._id,
          updatedAt: issue._creationTime,
          priorityId: priority?._id,
          priorityName: priority?.name,
          priorityIcon: priority?.icon,
          priorityColor: priority?.color,
          projectKey: project?.key,
          teamKey: team?.key,
          reporterName: reporter?.name,
          parentIssueKey: parentIssue?.key,
          assignments:
            assignees.length > 0
              ? assignees
              : [
                  {
                    assignmentId: 'unassigned',
                    assigneeId: undefined,
                    assigneeName: null,
                    assigneeEmail: null,
                    stateId: undefined,
                    stateName: null,
                    stateIcon: null,
                    stateColor: null,
                    stateType: null,
                  },
                ],
        };
      }),
    );

    const flattenedIssues = issuesWithDetails.flatMap(issue =>
      issue.assignments.map(assignment => ({
        ...issue,
        ...assignment,
      })),
    );

    const allStates = await ctx.db
      .query('issueStates')
      .withIndex('by_organization', q => q.eq('organizationId', org._id))
      .collect();

    const counts = allStates.reduce(
      (acc, state) => {
        acc[state.type] = 0;
        return acc;
      },
      {} as Record<string, number>,
    );
    let total = 0;

    issuesWithDetails.forEach(issue => {
      total++;
      const uniqueStates = new Set(
        issue.assignments.map(a => a.stateType).filter(Boolean),
      );
      uniqueStates.forEach(stateType => {
        if (stateType) {
          counts[stateType] = (counts[stateType] || 0) + 1;
        }
      });
    });

    return {
      issues: flattenedIssues.filter(issue => issue.id !== 'unassigned'),
      total,
      counts,
    };
  },
});
