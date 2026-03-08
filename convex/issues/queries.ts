import { query, type QueryCtx } from '../_generated/server';
import { v, ConvexError } from 'convex/values';
import type { Id, Doc, DataModel } from '../_generated/dataModel';
import { getAuthUserId } from '../authUtils';
import { canViewIssue, canViewProject, canViewTeam } from '../access';

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
      .withIndex('by_org_key', q =>
        q.eq('organizationId', org._id).eq('key', args.issueKey),
      )
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

type IssueVisibilityAccess = {
  userId: Id<'users'>;
  isOrgMember: boolean;
  teamIds: Set<Id<'teams'>>;
  projectIds: Set<Id<'projects'>>;
  assignedIssueIds: Set<Id<'issues'>>;
};

type IssueListResult = {
  issues: Array<Record<string, unknown>>;
  total: number;
  counts: Record<string, number>;
};

type IssueListScope = {
  organizationId: Id<'organizations'>;
  projectId?: Id<'projects'>;
  teamId?: Id<'teams'>;
  projectKey?: string;
};

type IssueStateType = Doc<'issueStates'>['type'];

async function loadDocMap<TableName extends keyof DataModel>(
  ctx: QueryCtx,
  table: TableName,
  ids: readonly Id<TableName>[],
) {
  const uniqueIds = Array.from(new Set(ids));
  const docs = await Promise.all(uniqueIds.map(id => ctx.db.get(table, id)));

  return new Map(
    uniqueIds.flatMap((id, index) => {
      const doc = docs[index];
      return doc ? [[id, doc]] : [];
    }),
  );
}

async function resolveProjectId(
  ctx: QueryCtx,
  organizationId: Id<'organizations'>,
  value?: string,
) {
  if (!value) return undefined;

  const normalizedId = ctx.db.normalizeId('projects', value);
  if (normalizedId) {
    const doc = await ctx.db.get('projects', normalizedId);
    if (doc && doc.organizationId === organizationId) {
      return normalizedId;
    }
  }

  const doc = await ctx.db
    .query('projects')
    .withIndex('by_org_key', q =>
      q.eq('organizationId', organizationId).eq('key', value),
    )
    .first();

  return doc?._id ?? null;
}

async function resolveTeamId(
  ctx: QueryCtx,
  organizationId: Id<'organizations'>,
  value?: string,
) {
  if (!value) return undefined;

  const normalizedId = ctx.db.normalizeId('teams', value);
  if (normalizedId) {
    const doc = await ctx.db.get('teams', normalizedId);
    if (doc && doc.organizationId === organizationId) {
      return normalizedId;
    }
  }

  const doc = await ctx.db
    .query('teams')
    .withIndex('by_org_key', q =>
      q.eq('organizationId', organizationId).eq('key', value),
    )
    .first();

  return doc?._id ?? null;
}

async function buildIssueVisibilityAccess(
  ctx: QueryCtx,
  userId: Id<'users'>,
  organizationId: Id<'organizations'>,
): Promise<IssueVisibilityAccess> {
  const [membership, teamMemberships, projectMemberships, assignments] =
    await Promise.all([
      ctx.db
        .query('members')
        .withIndex('by_org_user', q =>
          q.eq('organizationId', organizationId).eq('userId', userId),
        )
        .first(),
      ctx.db
        .query('teamMembers')
        .withIndex('by_user', q => q.eq('userId', userId))
        .collect(),
      ctx.db
        .query('projectMembers')
        .withIndex('by_user', q => q.eq('userId', userId))
        .collect(),
      ctx.db
        .query('issueAssignees')
        .withIndex('by_assignee', q => q.eq('assigneeId', userId))
        .collect(),
    ]);

  return {
    userId,
    isOrgMember: Boolean(membership),
    teamIds: new Set(teamMemberships.map(member => member.teamId)),
    projectIds: new Set(projectMemberships.map(member => member.projectId)),
    assignedIssueIds: new Set(
      assignments.map(assignment => assignment.issueId),
    ),
  };
}

function canUserViewIssueFromAccess(
  access: IssueVisibilityAccess,
  issue: Doc<'issues'>,
  options?: {
    scopedProjectId?: Id<'projects'>;
    scopedProjectVisible?: boolean;
    scopedTeamId?: Id<'teams'>;
    scopedTeamVisible?: boolean;
  },
) {
  const visibility = issue.visibility ?? 'organization';

  if (visibility === 'public') return true;
  if (issue.createdBy === access.userId) return true;
  if (
    options?.scopedProjectVisible &&
    options.scopedProjectId &&
    issue.projectId === options.scopedProjectId
  ) {
    return true;
  }
  if (
    options?.scopedTeamVisible &&
    options.scopedTeamId &&
    issue.teamId === options.scopedTeamId
  ) {
    return true;
  }
  if (issue.teamId && access.teamIds.has(issue.teamId)) return true;
  if (issue.projectId && access.projectIds.has(issue.projectId)) return true;
  if (visibility === 'private') {
    return access.assignedIssueIds.has(issue._id);
  }

  return access.isOrgMember;
}

function matchesIssueSearch(issue: Doc<'issues'>, searchQuery?: string) {
  const normalized = searchQuery?.trim().toLowerCase();
  if (!normalized) return true;

  return (
    issue.title.toLowerCase().includes(normalized) ||
    issue.key.toLowerCase().includes(normalized) ||
    (issue.description ?? '').toLowerCase().includes(normalized)
  );
}

function dedupeIssues(issues: readonly Doc<'issues'>[]) {
  return Array.from(new Map(issues.map(issue => [issue._id, issue])).values());
}

async function collectScopedIssues(ctx: QueryCtx, scope: IssueListScope) {
  if (scope.projectId) {
    const issues = await ctx.db
      .query('issues')
      .withIndex('by_project', q => q.eq('projectId', scope.projectId!))
      .order('desc')
      .collect();

    const legacyIssues = scope.projectKey
      ? (
          await ctx.db
            .query('issues')
            .withIndex('by_organization', q =>
              q.eq('organizationId', scope.organizationId),
            )
            .order('desc')
            .collect()
        ).filter(
          issue =>
            !issue.projectId && issue.key.startsWith(`${scope.projectKey}-`),
        )
      : [];

    const scopedIssues = dedupeIssues([...issues, ...legacyIssues]);

    return scope.teamId
      ? scopedIssues.filter(issue => issue.teamId === scope.teamId)
      : scopedIssues;
  }

  if (scope.teamId) {
    return await ctx.db
      .query('issues')
      .withIndex('by_team', q => q.eq('teamId', scope.teamId!))
      .order('desc')
      .collect();
  }

  return await ctx.db
    .query('issues')
    .withIndex('by_organization', q =>
      q.eq('organizationId', scope.organizationId),
    )
    .order('desc')
    .collect();
}

async function collectIssueCandidates(
  ctx: QueryCtx,
  scope: IssueListScope,
  searchQuery?: string,
) {
  const trimmedSearch = searchQuery?.trim();
  if (!trimmedSearch) {
    return collectScopedIssues(ctx, scope);
  }

  const [searchMatches, exactKeyMatch] = await Promise.all([
    ctx.db
      .query('issues')
      .withSearchIndex('search_text', q => {
        let search = q
          .search('searchText', trimmedSearch)
          .eq('organizationId', scope.organizationId);
        if (scope.projectId) {
          search = search.eq('projectId', scope.projectId);
        }
        if (scope.teamId) {
          search = search.eq('teamId', scope.teamId);
        }
        return search;
      })
      .take(200),
    ctx.db
      .query('issues')
      .withIndex('by_org_key', q =>
        q
          .eq('organizationId', scope.organizationId)
          .eq('key', trimmedSearch.toUpperCase()),
      )
      .first(),
  ]);

  return dedupeIssues(
    exactKeyMatch ? [exactKeyMatch, ...searchMatches] : searchMatches,
  ).filter(issue => {
    if (scope.projectId && issue.projectId !== scope.projectId) {
      return false;
    }
    if (scope.teamId && issue.teamId !== scope.teamId) {
      return false;
    }
    return matchesIssueSearch(issue, trimmedSearch);
  });
}

async function loadAssignmentsByIssue(
  ctx: QueryCtx,
  issueIds: readonly Id<'issues'>[],
) {
  const uniqueIssueIds = Array.from(new Set(issueIds));
  const assignments = await Promise.all(
    uniqueIssueIds.map(issueId =>
      ctx.db
        .query('issueAssignees')
        .withIndex('by_issue', q => q.eq('issueId', issueId))
        .collect(),
    ),
  );

  return new Map(
    uniqueIssueIds.map((issueId, index) => [issueId, assignments[index]]),
  );
}

async function flattenIssueRows(
  ctx: QueryCtx,
  issues: readonly Doc<'issues'>[],
  assignmentsByIssue: Map<Id<'issues'>, Doc<'issueAssignees'>[]>,
) {
  const projectIds = issues
    .map(issue => issue.projectId)
    .filter((id): id is Id<'projects'> => Boolean(id));
  const teamIds = issues
    .map(issue => issue.teamId)
    .filter((id): id is Id<'teams'> => Boolean(id));
  const priorityIds = issues
    .map(issue => issue.priorityId)
    .filter((id): id is Id<'issuePriorities'> => Boolean(id));
  const reporterIds = issues
    .map(issue => issue.reporterId)
    .filter((id): id is Id<'users'> => Boolean(id));
  const parentIssueIds = issues
    .map(issue => issue.parentIssueId)
    .filter((id): id is Id<'issues'> => Boolean(id));

  const assignmentList = issues.flatMap(
    issue => assignmentsByIssue.get(issue._id) ?? [],
  );
  const assigneeIds = assignmentList
    .map(assignment => assignment.assigneeId)
    .filter((id): id is Id<'users'> => Boolean(id));
  const stateIds = assignmentList
    .map(assignment => assignment.stateId)
    .filter((id): id is Id<'issueStates'> => Boolean(id));

  const [
    projectMap,
    teamMap,
    priorityMap,
    reporterMap,
    parentIssueMap,
    assigneeMap,
    stateMap,
  ] = await Promise.all([
    loadDocMap(ctx, 'projects', projectIds),
    loadDocMap(ctx, 'teams', teamIds),
    loadDocMap(ctx, 'issuePriorities', priorityIds),
    loadDocMap(ctx, 'users', reporterIds),
    loadDocMap(ctx, 'issues', parentIssueIds),
    loadDocMap(ctx, 'users', assigneeIds),
    loadDocMap(ctx, 'issueStates', stateIds),
  ]);

  return issues.flatMap(issue => {
    const project = issue.projectId ? projectMap.get(issue.projectId) : null;
    const team = issue.teamId ? teamMap.get(issue.teamId) : null;
    const priority = issue.priorityId
      ? priorityMap.get(issue.priorityId)
      : null;
    const reporter = issue.reporterId
      ? reporterMap.get(issue.reporterId)
      : null;
    const parentIssue = issue.parentIssueId
      ? parentIssueMap.get(issue.parentIssueId)
      : null;

    const assignments = assignmentsByIssue.get(issue._id) ?? [];
    const hydratedAssignments =
      assignments.length > 0
        ? assignments.map(assignment => {
            const assignee = assignment.assigneeId
              ? assigneeMap.get(assignment.assigneeId)
              : null;
            const state = assignment.stateId
              ? stateMap.get(assignment.stateId)
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
          })
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
          ];

    return hydratedAssignments.map(assignment => ({
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
      ...assignment,
    }));
  });
}

async function buildIssueCounts(
  ctx: QueryCtx,
  organizationId: Id<'organizations'>,
  issues: readonly Doc<'issues'>[],
) {
  const allStates = await ctx.db
    .query('issueStates')
    .withIndex('by_organization', q => q.eq('organizationId', organizationId))
    .collect();

  const counts = allStates.reduce(
    (acc, state) => {
      acc[state.type] = 0;
      return acc;
    },
    {} as Record<string, number>,
  );

  if (issues.length === 0) {
    return counts;
  }

  const assignmentsByIssue = await loadAssignmentsByIssue(
    ctx,
    issues.map(issue => issue._id),
  );
  const stateIds = Array.from(
    new Set(
      Array.from(assignmentsByIssue.values())
        .flat()
        .map(assignment => assignment.stateId)
        .filter((id): id is Id<'issueStates'> => Boolean(id)),
    ),
  );
  const stateMap = await loadDocMap(ctx, 'issueStates', stateIds);

  issues.forEach(issue => {
    const uniqueStateTypes = new Set(
      (assignmentsByIssue.get(issue._id) ?? [])
        .map(assignment =>
          assignment.stateId ? stateMap.get(assignment.stateId)?.type : null,
        )
        .filter((stateType): stateType is IssueStateType => stateType !== null),
    );

    uniqueStateTypes.forEach(stateType => {
      counts[stateType] = (counts[stateType] ?? 0) + 1;
    });
  });

  return counts;
}

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
    assigneeId: v.optional(v.string()),
    searchQuery: v.optional(v.string()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    includeCounts: v.optional(v.boolean()),
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

    const access = await buildIssueVisibilityAccess(ctx, userId, org._id);

    const [projectId, teamId] = await Promise.all([
      resolveProjectId(ctx, org._id, args.projectId),
      resolveTeamId(ctx, org._id, args.teamId),
    ]);
    const assigneeId = args.assigneeId
      ? ctx.db.normalizeId('users', args.assigneeId)
      : undefined;

    if (
      projectId === null ||
      teamId === null ||
      (args.assigneeId && !assigneeId)
    ) {
      return {
        issues: [],
        total: 0,
        counts: {},
      } satisfies IssueListResult;
    }

    const [scopedProject, scopedTeam] = await Promise.all([
      projectId ? ctx.db.get('projects', projectId) : null,
      teamId ? ctx.db.get('teams', teamId) : null,
    ]);
    const [scopedProjectVisible, scopedTeamVisible] = await Promise.all([
      scopedProject ? canViewProject(ctx, scopedProject) : false,
      scopedTeam ? canViewTeam(ctx, scopedTeam) : false,
    ]);

    const candidateIssues = await collectIssueCandidates(
      ctx,
      {
        organizationId: org._id,
        projectId: projectId ?? undefined,
        teamId: teamId ?? undefined,
        projectKey: scopedProject?.key,
      },
      args.searchQuery,
    );
    const assigneeIssueIds = assigneeId
      ? new Set(
          (
            await ctx.db
              .query('issueAssignees')
              .withIndex('by_assignee', q => q.eq('assigneeId', assigneeId))
              .collect()
          ).map(assignment => assignment.issueId),
        )
      : null;
    const visibleIssues = candidateIssues
      .filter(issue =>
        canUserViewIssueFromAccess(access, issue, {
          scopedProjectId: scopedProjectVisible
            ? (projectId ?? undefined)
            : undefined,
          scopedProjectVisible,
          scopedTeamId: scopedTeamVisible ? (teamId ?? undefined) : undefined,
          scopedTeamVisible,
        }),
      )
      .filter(issue =>
        assigneeIssueIds ? assigneeIssueIds.has(issue._id) : true,
      );

    const pageSize =
      args.pageSize && args.pageSize > 0
        ? Math.min(Math.floor(args.pageSize), 100)
        : undefined;
    const page = args.page && args.page > 0 ? Math.floor(args.page) : 1;
    const pagedIssues =
      pageSize !== undefined
        ? visibleIssues.slice((page - 1) * pageSize, page * pageSize)
        : visibleIssues;

    const assignmentsByIssue = await loadAssignmentsByIssue(
      ctx,
      pagedIssues.map(issue => issue._id),
    );
    const issues = await flattenIssueRows(ctx, pagedIssues, assignmentsByIssue);
    const counts = args.includeCounts
      ? await buildIssueCounts(ctx, org._id, visibleIssues)
      : {};

    return {
      issues,
      total: visibleIssues.length,
      counts,
    } satisfies IssueListResult;
  },
});
