import { query, type QueryCtx } from '../_generated/server';
import { v, ConvexError } from 'convex/values';
import type { Id, Doc, DataModel } from '../_generated/dataModel';
import { hasScopedPermission, permissionMatches } from '../authz';
import { getAuthUserId } from '../authUtils';
import { canViewIssue, canViewProject, canViewTeam } from '../access';
import { PERMISSIONS, type Permission } from '../permissions/utils';
import { isDefined } from '../_shared/typeGuards';
import { buildIssueSearchTextFromIssue } from './search';

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
      return null;
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
    const assigneeStateIds = assignees
      .map(assignment => assignment.stateId)
      .filter((id): id is Id<'issueStates'> => Boolean(id));

    const assigneeUsers = await Promise.all(
      assignees.map(async assignee => {
        if (!assignee.assigneeId) return null;
        return await ctx.db.get('users', assignee.assigneeId);
      }),
    ).then(users => users.filter(isDefined));
    const assigneeStateMap =
      assigneeStateIds.length > 0
        ? await loadDocMap(ctx, 'issueStates', assigneeStateIds)
        : new Map<Id<'issueStates'>, Doc<'issueStates'>>();

    const createdByUser = issue.reporterId
      ? await ctx.db.get('users', issue.reporterId)
      : null;
    const priority = issue.priorityId
      ? await ctx.db.get('issuePriorities', issue.priorityId)
      : null;
    const workflowState = issue.workflowStateId
      ? await ctx.db.get('issueStates', issue.workflowStateId)
      : resolveWorkflowStateFromAssignments(assignees, assigneeStateMap);

    const childIssues = await ctx.db
      .query('issues')
      .withIndex('by_parent', q => q.eq('parentIssueId', issue._id))
      .collect();
    const childAssignmentsByIssue = await loadAssignmentsByIssue(
      ctx,
      childIssues.map(child => child._id),
    );
    const childAssignmentStateIds = Array.from(
      new Set(
        Array.from(childAssignmentsByIssue.values())
          .flat()
          .map(assignment => assignment.stateId)
          .filter((id): id is Id<'issueStates'> => Boolean(id)),
      ),
    );
    const childAssignmentStateMap =
      childAssignmentStateIds.length > 0
        ? await loadDocMap(ctx, 'issueStates', childAssignmentStateIds)
        : new Map<Id<'issueStates'>, Doc<'issueStates'>>();

    const children = await Promise.all(
      childIssues.map(async child => {
        const childPriority = child.priorityId
          ? await ctx.db.get('issuePriorities', child.priorityId)
          : null;
        const state = child.workflowStateId
          ? await ctx.db.get('issueStates', child.workflowStateId)
          : resolveWorkflowStateFromAssignments(
              childAssignmentsByIssue.get(child._id) ?? [],
              childAssignmentStateMap,
            );

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
      workflowState,
      children,
    };
  },
});

type IssueVisibilityAccess = {
  userId: Id<'users'>;
  isOrgMember: boolean;
  hasOrgIssueView: boolean;
  teamIds: Set<Id<'teams'>>;
  projectIds: Set<Id<'projects'>>;
  scopedTeamIds: Set<Id<'teams'>>;
  scopedProjectIds: Set<Id<'projects'>>;
  assignedIssueIds: Set<Id<'issues'>>;
};

type IssueListResult = {
  issues: Awaited<ReturnType<typeof flattenIssueRows>>;
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

async function unifiedRoleMapByPermission(
  ctx: QueryCtx,
  roleIds: readonly Id<'roles'>[],
  permission: Permission,
) {
  const uniqueRoleIds = Array.from(new Set(roleIds));
  const permissionRows = await Promise.all(
    uniqueRoleIds.map(roleId =>
      ctx.db
        .query('rolePermissions')
        .withIndex('by_role', q => q.eq('roleId', roleId))
        .collect(),
    ),
  );

  return new Map(
    uniqueRoleIds.map((roleId, index) => [
      roleId,
      permissionRows[index].some(row =>
        permissionMatches(row.permission, permission),
      ),
    ]),
  );
}

async function legacyTeamRoleMapByPermission(
  ctx: QueryCtx,
  roleIds: readonly Id<'teamRoles'>[],
  permission: Permission,
) {
  const uniqueRoleIds = Array.from(new Set(roleIds));
  const permissionRows = await Promise.all(
    uniqueRoleIds.map(roleId =>
      ctx.db
        .query('teamRolePermissions')
        .withIndex('by_role', q => q.eq('roleId', roleId))
        .collect(),
    ),
  );

  return new Map(
    uniqueRoleIds.map((roleId, index) => [
      roleId,
      permissionRows[index].some(row =>
        permissionMatches(row.permission, permission),
      ),
    ]),
  );
}

async function legacyProjectRoleMapByPermission(
  ctx: QueryCtx,
  roleIds: readonly Id<'projectRoles'>[],
  permission: Permission,
) {
  const uniqueRoleIds = Array.from(new Set(roleIds));
  const permissionRows = await Promise.all(
    uniqueRoleIds.map(roleId =>
      ctx.db
        .query('projectRolePermissions')
        .withIndex('by_role', q => q.eq('roleId', roleId))
        .collect(),
    ),
  );

  return new Map(
    uniqueRoleIds.map((roleId, index) => [
      roleId,
      permissionRows[index].some(row =>
        permissionMatches(row.permission, permission),
      ),
    ]),
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
  const [
    membership,
    teamMemberships,
    projectMemberships,
    assignments,
    roleAssignments,
    legacyTeamAssignments,
    legacyProjectAssignments,
  ] = await Promise.all([
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
    ctx.db
      .query('roleAssignments')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', organizationId).eq('userId', userId),
      )
      .collect(),
    ctx.db
      .query('teamRoleAssignments')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect(),
    ctx.db
      .query('projectRoleAssignments')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect(),
  ]);

  const teamAssignmentsByTeam = new Map<Id<'teams'>, Id<'roles'>[]>();
  for (const assignment of roleAssignments) {
    if (!assignment.teamId) continue;
    const roleIds = teamAssignmentsByTeam.get(assignment.teamId) ?? [];
    roleIds.push(assignment.roleId);
    teamAssignmentsByTeam.set(assignment.teamId, roleIds);
  }

  const legacyTeamAssignmentsByTeam = new Map<Id<'teams'>, Id<'teamRoles'>[]>();
  for (const assignment of legacyTeamAssignments) {
    const roleIds = legacyTeamAssignmentsByTeam.get(assignment.teamId) ?? [];
    roleIds.push(assignment.roleId);
    legacyTeamAssignmentsByTeam.set(assignment.teamId, roleIds);
  }

  const projectAssignmentsByProject = new Map<Id<'projects'>, Id<'roles'>[]>();
  for (const assignment of roleAssignments) {
    if (!assignment.projectId) continue;
    const roleIds = projectAssignmentsByProject.get(assignment.projectId) ?? [];
    roleIds.push(assignment.roleId);
    projectAssignmentsByProject.set(assignment.projectId, roleIds);
  }

  const legacyProjectAssignmentsByProject = new Map<
    Id<'projects'>,
    Id<'projectRoles'>[]
  >();
  for (const assignment of legacyProjectAssignments) {
    const roleIds =
      legacyProjectAssignmentsByProject.get(assignment.projectId) ?? [];
    roleIds.push(assignment.roleId);
    legacyProjectAssignmentsByProject.set(assignment.projectId, roleIds);
  }

  const [
    unifiedIssueViewRoleMap,
    legacyTeamIssueViewRoleMap,
    legacyProjectIssueViewRoleMap,
    hasOrgIssueView,
  ] = await Promise.all([
    unifiedRoleMapByPermission(
      ctx,
      roleAssignments.map(assignment => assignment.roleId),
      PERMISSIONS.ISSUE_VIEW,
    ),
    legacyTeamRoleMapByPermission(
      ctx,
      legacyTeamAssignments.map(assignment => assignment.roleId),
      PERMISSIONS.ISSUE_VIEW,
    ),
    legacyProjectRoleMapByPermission(
      ctx,
      legacyProjectAssignments.map(assignment => assignment.roleId),
      PERMISSIONS.ISSUE_VIEW,
    ),
    hasScopedPermission(
      ctx,
      { organizationId },
      userId,
      PERMISSIONS.ISSUE_VIEW,
    ),
  ]);

  const scopedTeamIds = new Set<Id<'teams'>>();
  for (const [teamId, roleIds] of teamAssignmentsByTeam) {
    if (roleIds.some(roleId => unifiedIssueViewRoleMap.get(roleId))) {
      scopedTeamIds.add(teamId);
    }
  }
  for (const [teamId, roleIds] of legacyTeamAssignmentsByTeam) {
    if (roleIds.some(roleId => legacyTeamIssueViewRoleMap.get(roleId))) {
      scopedTeamIds.add(teamId);
    }
  }

  const scopedProjectIds = new Set<Id<'projects'>>();
  for (const [projectId, roleIds] of projectAssignmentsByProject) {
    if (roleIds.some(roleId => unifiedIssueViewRoleMap.get(roleId))) {
      scopedProjectIds.add(projectId);
    }
  }
  for (const [projectId, roleIds] of legacyProjectAssignmentsByProject) {
    if (roleIds.some(roleId => legacyProjectIssueViewRoleMap.get(roleId))) {
      scopedProjectIds.add(projectId);
    }
  }

  return {
    userId,
    isOrgMember: Boolean(membership),
    hasOrgIssueView,
    teamIds: new Set(teamMemberships.map(member => member.teamId)),
    projectIds: new Set(projectMemberships.map(member => member.projectId)),
    scopedTeamIds,
    scopedProjectIds,
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

  // Private issues: only creator (above) and assignees — team/project membership doesn't help
  if (visibility === 'private') {
    return access.assignedIssueIds.has(issue._id);
  }

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
  if (
    issue.teamId &&
    (access.teamIds.has(issue.teamId) || access.scopedTeamIds.has(issue.teamId))
  ) {
    return true;
  }
  if (
    issue.projectId &&
    (access.projectIds.has(issue.projectId) ||
      access.scopedProjectIds.has(issue.projectId))
  ) {
    return true;
  }

  if (visibility === 'organization') {
    if (issue.projectId || issue.teamId) {
      return access.hasOrgIssueView;
    }
    return access.isOrgMember;
  }

  return false;
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

async function collectScopedIssues(
  ctx: QueryCtx,
  scope: IssueListScope,
  limit?: number,
) {
  const scopedLimit = limit ? Math.max(limit, 1) : undefined;

  if (scope.projectId) {
    const projectQuery = ctx.db
      .query('issues')
      .withIndex('by_project', q => q.eq('projectId', scope.projectId!))
      .order('desc');
    const issues = scopedLimit
      ? await projectQuery.take(scopedLimit)
      : await projectQuery.collect();

    let legacyIssues: Doc<'issues'>[] = [];
    if (scope.projectKey) {
      const legacyQuery = ctx.db
        .query('issues')
        .withIndex('by_organization', q =>
          q.eq('organizationId', scope.organizationId),
        )
        .order('desc');
      const recentOrgIssues = scopedLimit
        ? await legacyQuery.take(Math.max(scopedLimit * 5, 25))
        : await legacyQuery.collect();
      legacyIssues = recentOrgIssues.filter(
        issue =>
          !issue.projectId && issue.key.startsWith(`${scope.projectKey}-`),
      );
    }

    const scopedIssues = dedupeIssues([...issues, ...legacyIssues]).slice(
      0,
      scopedLimit,
    );

    return scope.teamId
      ? scopedIssues.filter(issue => issue.teamId === scope.teamId)
      : scopedIssues;
  }

  if (scope.teamId) {
    const teamQuery = ctx.db
      .query('issues')
      .withIndex('by_team', q => q.eq('teamId', scope.teamId!))
      .order('desc');
    return scopedLimit
      ? await teamQuery.take(scopedLimit)
      : await teamQuery.collect();
  }

  const orgQuery = ctx.db
    .query('issues')
    .withIndex('by_organization', q =>
      q.eq('organizationId', scope.organizationId),
    )
    .order('desc');
  return scopedLimit
    ? await orgQuery.take(scopedLimit)
    : await orgQuery.collect();
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

function resolveWorkflowStateFromAssignments(
  assignments: readonly Doc<'issueAssignees'>[],
  stateMap: ReadonlyMap<Id<'issueStates'>, Doc<'issueStates'>>,
) {
  const fallbackStateId = assignments.find(
    assignment => assignment.stateId,
  )?.stateId;
  return fallbackStateId ? (stateMap.get(fallbackStateId) ?? null) : null;
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
  const workflowStateIds = issues
    .map(issue => issue.workflowStateId)
    .filter((id): id is Id<'issueStates'> => Boolean(id));
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
    workflowStateMap,
    parentIssueMap,
    assigneeMap,
    stateMap,
  ] = await Promise.all([
    loadDocMap(ctx, 'projects', projectIds),
    loadDocMap(ctx, 'teams', teamIds),
    loadDocMap(ctx, 'issuePriorities', priorityIds),
    loadDocMap(ctx, 'users', reporterIds),
    loadDocMap(ctx, 'issueStates', workflowStateIds),
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
    const workflowState = issue.workflowStateId
      ? workflowStateMap.get(issue.workflowStateId)
      : resolveWorkflowStateFromAssignments(
          assignmentsByIssue.get(issue._id) ?? [],
          stateMap,
        );
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
              assigneeImage: assignee?.image,
              stateId: state?._id,
              stateName: state?.name,
              stateIcon: state?.icon,
              stateColor: state?.color,
              stateType: state?.type,
              note: assignment.note ?? null,
            };
          })
        : [
            {
              assignmentId: 'unassigned',
              assigneeId: undefined,
              assigneeName: null,
              assigneeEmail: null,
              assigneeImage: null,
              stateId: undefined,
              stateName: null,
              stateIcon: null,
              stateColor: null,
              stateType: null,
              note: null,
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
      workflowStateId: workflowState?._id,
      workflowStateName: workflowState?.name,
      workflowStateIcon: workflowState?.icon,
      workflowStateColor: workflowState?.color,
      workflowStateType: workflowState?.type,
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

  const counts: Record<string, number> = {};
  for (const state of allStates) {
    counts[state.type] = 0;
  }

  if (issues.length === 0) {
    return counts;
  }

  const issueStateMap = new Map(allStates.map(state => [state._id, state]));
  const unresolvedIssueIds = issues
    .filter(issue => !issue.workflowStateId)
    .map(issue => issue._id);
  const assignmentsByIssue =
    unresolvedIssueIds.length > 0
      ? await loadAssignmentsByIssue(ctx, unresolvedIssueIds)
      : new Map<Id<'issues'>, Doc<'issueAssignees'>[]>();
  const fallbackStateIds = Array.from(
    new Set(
      Array.from(assignmentsByIssue.values())
        .flat()
        .map(assignment => assignment.stateId)
        .filter((id): id is Id<'issueStates'> => Boolean(id)),
    ),
  );
  const fallbackStateMap =
    fallbackStateIds.length > 0
      ? await loadDocMap(ctx, 'issueStates', fallbackStateIds)
      : new Map<Id<'issueStates'>, Doc<'issueStates'>>();

  issues.forEach(issue => {
    const state = issue.workflowStateId
      ? (issueStateMap.get(issue.workflowStateId) ?? null)
      : resolveWorkflowStateFromAssignments(
          assignmentsByIssue.get(issue._id) ?? [],
          fallbackStateMap,
        );
    const stateType = state?.type ?? null;
    if (stateType) {
      counts[stateType] = (counts[stateType] ?? 0) + 1;
    }
  });

  return counts;
}

function buildParentIssueOption(
  issue: Doc<'issues'>,
  priorityMap: Map<Id<'issuePriorities'>, Doc<'issuePriorities'>>,
) {
  const priority = issue.priorityId ? priorityMap.get(issue.priorityId) : null;

  return {
    _id: issue._id,
    key: issue.key,
    title: issue.title,
    priority: priority
      ? {
          _id: priority._id,
          name: priority.name,
          color: priority.color,
          icon: priority.icon,
        }
      : null,
  };
}

function matchesParentIssueSearch(issue: Doc<'issues'>, searchQuery?: string) {
  const normalizedQuery = searchQuery?.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const haystack = (
    issue.searchText ?? buildIssueSearchTextFromIssue(issue)
  ).toLowerCase();

  return haystack.includes(normalizedQuery);
}

async function collectParentIssueCandidates(
  ctx: QueryCtx,
  organizationId: Id<'organizations'>,
  searchQuery?: string,
  relatedProjectId?: Id<'projects'>,
  relatedTeamId?: Id<'teams'>,
  limit = 5,
) {
  const scopes: IssueListScope[] = [];

  if (relatedProjectId) {
    scopes.push({
      organizationId,
      projectId: relatedProjectId,
      teamId: relatedTeamId,
    });
  }

  if (relatedTeamId) {
    scopes.push({
      organizationId,
      teamId: relatedTeamId,
    });
  }

  scopes.push({ organizationId });

  const issuesByScope = await Promise.all(
    scopes.map(scope =>
      searchQuery
        ? collectIssueCandidates(ctx, scope, searchQuery)
        : collectScopedIssues(ctx, scope, Math.max(limit * 3, 10)),
    ),
  );

  return dedupeIssues(issuesByScope.flat()).filter(
    issue => !issue.parentIssueId,
  );
}

export const searchParentOptions = query({
  args: {
    orgSlug: v.string(),
    query: v.optional(v.string()),
    limit: v.optional(v.number()),
    excludeIssueId: v.optional(v.id('issues')),
    selectedIssueId: v.optional(v.id('issues')),
    relatedProjectId: v.optional(v.id('projects')),
    relatedTeamId: v.optional(v.id('teams')),
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
      throw new ConvexError('FORBIDDEN');
    }

    const limit = Math.min(args.limit ?? 5, 5);
    const searchQuery = args.query?.trim();
    const access = await buildIssueVisibilityAccess(ctx, userId, org._id);

    const selectedIssueDoc = args.selectedIssueId
      ? await ctx.db.get('issues', args.selectedIssueId)
      : null;
    const selectedIssue =
      selectedIssueDoc &&
      selectedIssueDoc.organizationId === org._id &&
      canUserViewIssueFromAccess(access, selectedIssueDoc)
        ? selectedIssueDoc
        : null;

    const candidateIssues = (
      await collectParentIssueCandidates(
        ctx,
        org._id,
        searchQuery,
        args.relatedProjectId,
        args.relatedTeamId,
        limit,
      )
    ).filter(issue => {
      if (args.excludeIssueId && issue._id === args.excludeIssueId) {
        return false;
      }

      if (!canUserViewIssueFromAccess(access, issue)) {
        return false;
      }

      return matchesParentIssueSearch(issue, searchQuery);
    });

    const visibleResults =
      selectedIssue &&
      !searchQuery &&
      !candidateIssues.some(issue => issue._id === selectedIssue._id)
        ? [selectedIssue, ...candidateIssues].slice(0, limit)
        : candidateIssues.slice(0, limit);

    const priorityIds = Array.from(
      new Set(
        [selectedIssue, ...visibleResults]
          .map(issue => issue?.priorityId)
          .filter((id): id is Id<'issuePriorities'> => Boolean(id)),
      ),
    );
    const priorityMap = await loadDocMap(ctx, 'issuePriorities', priorityIds);

    return {
      selectedIssue: selectedIssue
        ? buildParentIssueOption(selectedIssue, priorityMap)
        : null,
      results: visibleResults.map(issue =>
        buildParentIssueOption(issue, priorityMap),
      ),
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

    const projectIds = visibleIssues.map(i => i.projectId).filter(isDefined);
    const priorityIds = visibleIssues.map(i => i.priorityId).filter(isDefined);
    const reporterIds = visibleIssues.map(i => i.reporterId).filter(isDefined);
    const workflowStateIds = visibleIssues
      .map(i => i.workflowStateId)
      .filter(isDefined);

    const projects = await Promise.all(
      projectIds.map(id => ctx.db.get('projects', id)),
    );
    const priorities = await Promise.all(
      priorityIds.map(id => ctx.db.get('issuePriorities', id)),
    );
    const reporters = await Promise.all(
      reporterIds.map(id => ctx.db.get('users', id)),
    );
    const workflowStates = await Promise.all(
      workflowStateIds.map(id => ctx.db.get('issueStates', id)),
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
    const stateMap = new Map();
    workflowStateIds.forEach((id, i) => {
      if (workflowStates[i]) stateMap.set(id, workflowStates[i]);
    });

    const allAssignments = await Promise.all(
      visibleIssues.map(issue =>
        ctx.db
          .query('issueAssignees')
          .withIndex('by_issue', q => q.eq('issueId', issue._id))
          .collect(),
      ),
    ).then(results => results.flat());

    const assigneeIds = allAssignments.map(a => a.assigneeId).filter(isDefined);
    const assignmentStateIds = allAssignments
      .map(assignment => assignment.stateId)
      .filter(isDefined);
    const assigneeUsers = await Promise.all(
      assigneeIds.map(id => ctx.db.get('users', id)),
    );
    const assignmentStates = await Promise.all(
      assignmentStateIds.map(id => ctx.db.get('issueStates', id)),
    );
    const assigneeMap = new Map();
    assigneeIds.forEach((id, i) => {
      if (assigneeUsers[i]) assigneeMap.set(id, assigneeUsers[i]);
    });
    const assignmentStateMap = new Map();
    assignmentStateIds.forEach((id, i) => {
      if (assignmentStates[i]) assignmentStateMap.set(id, assignmentStates[i]);
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
      const workflowState = issue.workflowStateId
        ? stateMap.get(issue.workflowStateId)
        : resolveWorkflowStateFromAssignments(
            issueAssignments,
            assignmentStateMap,
          );
      const assigneeUsersList = issueAssignments
        .map(assignment => {
          if (!assignment.assigneeId) return null;
          return assigneeMap.get(assignment.assigneeId);
        })
        .filter(isDefined);

      return {
        ...issue,
        project,
        priority,
        createdBy,
        workflowState,
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
