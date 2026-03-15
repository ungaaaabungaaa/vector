import { internalMutation, internalQuery } from '../_generated/server';
import { ConvexError, v } from 'convex/values';
import {
  syncOrganizationRoleAssignment,
  syncProjectRoleAssignment,
  syncTeamRoleAssignment,
} from '../roles';
import { buildIssueSearchText } from '../issues/search';
import { createNotificationEvent } from '../notifications/lib';
import { syncDocumentMentions } from '../documents/mentions';
import {
  AssistantPageContext,
  AssistantPendingAction,
  assistantPageContextValidator,
  buildAssistantThreadPatch,
  canAssignIssueForUser,
  canDeleteEntity,
  canEditEntity,
  canUpdateIssueAssignmentStateForUser,
  canManageProjectMembersForUser,
  canManageTeamMembersForUser,
  canViewEntity,
  findIssuePriorityByName,
  findIssueStateByName,
  findMemberByName,
  findProjectStatusByName,
  getAssistantThreadRow,
  makePendingActionId,
  requireAssistantThreadRow,
  requireOrgForAssistant,
  requireOrgPermissionForUser,
  resolveDocumentFromContext,
  resolveFolderFromContext,
  resolveIssueFromContext,
  resolveProjectFromContext,
  resolveTeamFromContext,
} from './lib';
import { PERMISSIONS } from '../permissions/utils';

function summarizePageContext(pageContext: AssistantPageContext) {
  switch (pageContext.kind) {
    case 'document_detail':
      return `current document ${pageContext.documentId ?? 'unknown'}`;
    case 'document_folder':
      return `current document folder ${pageContext.folderId ?? 'unknown'}`;
    case 'documents_list':
      return 'documents list';
    case 'issue_detail':
      return `current issue ${pageContext.issueKey ?? 'unknown'}`;
    case 'issues_list':
      return 'issues list';
    case 'project_detail':
      return `current project ${pageContext.projectKey ?? 'unknown'}`;
    case 'projects_list':
      return 'projects list';
    case 'team_detail':
      return `current team ${pageContext.teamKey ?? 'unknown'}`;
    case 'teams_list':
      return 'teams list';
    default:
      return pageContext.path;
  }
}

export const getPageContextSummary = internalQuery({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    pageContext: assistantPageContextValidator,
  },
  returns: v.string(),
  handler: async (_ctx, args) => {
    return summarizePageContext(args.pageContext);
  },
});

export const getAssistantOrganization = internalQuery({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    return await requireOrgForAssistant(ctx, args.orgSlug, args.userId);
  },
});

export const getCurrentUserContextSummary = internalQuery({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', organization._id).eq('userId', args.userId),
      )
      .first();
    const user = await ctx.db.get('users', args.userId);

    const displayName =
      user?.name?.trim() ||
      user?.email?.trim() ||
      user?.username?.trim() ||
      'Unknown user';
    const identityParts = [`name "${displayName}"`];

    if (user?.email?.trim()) {
      identityParts.push(`email "${user.email.trim()}"`);
    }
    if (user?.username?.trim()) {
      identityParts.push(`username "${user.username.trim()}"`);
    }

    return [
      `The authenticated user you are speaking to is ${identityParts.join(', ')}.`,
      `They are a ${membership?.role ?? 'member'} in organization "${organization.name}" (${organization.slug}).`,
      'Treat references like "me", "my", "myself", "current user", and "my email" as referring to this person unless the user clearly says otherwise.',
    ].join('\n');
  },
});

export const getAssistantThreadForAuthUser = internalQuery({
  args: {
    orgSlug: v.string(),
    authUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = ctx.db.normalizeId('users', args.authUserId);
    if (!userId) {
      return null;
    }

    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      userId,
    );
    return await getAssistantThreadRow(ctx, organization._id, userId);
  },
});

export const listWorkspaceReferenceData = internalQuery({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );

    const [
      teams,
      projects,
      issuePriorities,
      projectStatuses,
      members,
      issueStates,
    ] = await Promise.all([
      ctx.db
        .query('teams')
        .withIndex('by_organization', q =>
          q.eq('organizationId', organization._id),
        )
        .collect(),
      ctx.db
        .query('projects')
        .withIndex('by_organization', q =>
          q.eq('organizationId', organization._id),
        )
        .collect(),
      ctx.db
        .query('issuePriorities')
        .withIndex('by_organization', q =>
          q.eq('organizationId', organization._id),
        )
        .collect(),
      ctx.db
        .query('projectStatuses')
        .withIndex('by_organization', q =>
          q.eq('organizationId', organization._id),
        )
        .collect(),
      ctx.db
        .query('members')
        .withIndex('by_organization', q =>
          q.eq('organizationId', organization._id),
        )
        .collect(),
      ctx.db
        .query('issueStates')
        .withIndex('by_organization', q =>
          q.eq('organizationId', organization._id),
        )
        .collect(),
    ]);

    const userIds = members.map(member => member.userId);
    const users = await Promise.all(
      userIds.map(userId => ctx.db.get('users', userId)),
    );
    const visibleTeams = [];
    for (const team of teams) {
      if (await canViewEntity(ctx, args.userId, team, 'team')) {
        visibleTeams.push(team);
      }
    }
    const visibleProjects = [];
    for (const project of projects) {
      if (await canViewEntity(ctx, args.userId, project, 'project')) {
        visibleProjects.push(project);
      }
    }

    return {
      teams: visibleTeams.map(team => ({
        id: String(team._id),
        key: team.key,
        name: team.name,
      })),
      projects: visibleProjects.map(project => ({
        id: String(project._id),
        key: project.key,
        name: project.name,
      })),
      issuePriorities: issuePriorities.map(priority => ({
        id: String(priority._id),
        name: priority.name,
      })),
      projectStatuses: projectStatuses.map(status => ({
        id: String(status._id),
        name: status.name,
      })),
      issueStates: issueStates.map(state => ({
        id: String(state._id),
        name: state.name,
        type: state.type,
      })),
      members: members.map((member, index) => ({
        id: String(member.userId),
        name:
          users[index]?.name ??
          users[index]?.email ??
          users[index]?.username ??
          'Unknown user',
        email: users[index]?.email ?? undefined,
      })),
    };
  },
});

export const deleteAssistantThreadRow = internalMutation({
  args: {
    assistantThreadId: v.id('assistantThreads'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete('assistantThreads', args.assistantThreadId);
    return null;
  },
});

export const listDocuments = internalQuery({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    pageContext: v.optional(assistantPageContextValidator),
    folderId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    const folder = await resolveFolderFromContext(
      ctx,
      organization._id,
      args.pageContext,
      args.folderId,
    );

    const documents = folder
      ? await ctx.db
          .query('documents')
          .withIndex('by_folder', q => q.eq('folderId', folder._id))
          .collect()
      : await ctx.db
          .query('documents')
          .withIndex('by_organizationId', q =>
            q.eq('organizationId', organization._id),
          )
          .collect();

    const visible = [];
    for (const document of documents) {
      if (document.organizationId !== organization._id) continue;
      if (await canViewEntity(ctx, args.userId, document, 'document')) {
        visible.push(document);
      }
    }

    return visible.slice(0, args.limit ?? 25).map(document => ({
      id: String(document._id),
      title: document.title,
      visibility: document.visibility ?? 'organization',
      folderId: document.folderId ? String(document.folderId) : undefined,
      teamId: document.teamId ? String(document.teamId) : undefined,
      projectId: document.projectId ? String(document.projectId) : undefined,
      lastEditedAt: document.lastEditedAt ?? undefined,
    }));
  },
});

export const getDocument = internalQuery({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    pageContext: v.optional(assistantPageContextValidator),
    documentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    const document = await resolveDocumentFromContext(
      ctx,
      organization._id,
      args.pageContext,
      args.documentId ?? null,
    );

    if (!(await canViewEntity(ctx, args.userId, document, 'document'))) {
      throw new ConvexError('FORBIDDEN');
    }

    return {
      id: String(document._id),
      title: document.title,
      content: document.content ?? '',
      visibility: document.visibility ?? 'organization',
      folderId: document.folderId ? String(document.folderId) : undefined,
      teamId: document.teamId ? String(document.teamId) : undefined,
      projectId: document.projectId ? String(document.projectId) : undefined,
      icon: document.icon ?? undefined,
      color: document.color ?? undefined,
    };
  },
});

export const createDocument = internalMutation({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    pageContext: v.optional(assistantPageContextValidator),
    title: v.string(),
    content: v.optional(v.string()),
    visibility: v.optional(
      v.union(
        v.literal('private'),
        v.literal('organization'),
        v.literal('public'),
      ),
    ),
    teamKey: v.optional(v.string()),
    projectKey: v.optional(v.string()),
    folderId: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    await requireOrgPermissionForUser(
      ctx,
      organization._id,
      args.userId,
      PERMISSIONS.DOCUMENT_CREATE,
    );

    const contextProject =
      args.pageContext?.kind === 'project_detail'
        ? await resolveProjectFromContext(
            ctx,
            organization._id,
            args.pageContext,
          )
        : null;
    const contextTeam =
      args.pageContext?.kind === 'team_detail'
        ? await resolveTeamFromContext(ctx, organization._id, args.pageContext)
        : null;
    const contextDocument =
      args.pageContext?.kind === 'document_detail'
        ? await resolveDocumentFromContext(
            ctx,
            organization._id,
            args.pageContext,
          )
        : null;

    const team = args.teamKey
      ? await resolveTeamFromContext(
          ctx,
          organization._id,
          undefined,
          args.teamKey,
        )
      : contextTeam;
    const project = args.projectKey
      ? await resolveProjectFromContext(
          ctx,
          organization._id,
          undefined,
          args.projectKey,
        )
      : contextProject;
    const folder = await resolveFolderFromContext(
      ctx,
      organization._id,
      args.pageContext,
      args.folderId ??
        (args.pageContext?.kind === 'document_folder'
          ? args.pageContext.folderId
          : contextDocument?.folderId
            ? String(contextDocument.folderId)
            : null),
    );

    const documentTitle = args.title.trim();
    if (!documentTitle) {
      throw new ConvexError('INVALID_INPUT');
    }
    if (documentTitle.length > 200) {
      throw new ConvexError('INVALID_INPUT');
    }
    if (args.content && args.content.length > 50000) {
      throw new ConvexError('INVALID_INPUT');
    }

    const documentId = await ctx.db.insert('documents', {
      organizationId: organization._id,
      title: documentTitle,
      content: args.content,
      icon: args.icon,
      color: args.color,
      folderId: folder?._id,
      teamId: team?._id ?? contextDocument?.teamId,
      projectId: project?._id ?? contextDocument?.projectId,
      createdBy: args.userId,
      lastEditedBy: args.userId,
      lastEditedAt: Date.now(),
      visibility: args.visibility ?? 'organization',
    });

    if (args.content) {
      await syncDocumentMentions(
        ctx,
        documentId,
        organization._id,
        args.content,
      );
    }

    return {
      documentId: String(documentId),
      title: documentTitle,
    };
  },
});

export const updateDocument = internalMutation({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    pageContext: v.optional(assistantPageContextValidator),
    documentId: v.optional(v.string()),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    visibility: v.optional(
      v.union(
        v.literal('private'),
        v.literal('organization'),
        v.literal('public'),
      ),
    ),
    teamKey: v.optional(v.union(v.string(), v.null())),
    projectKey: v.optional(v.union(v.string(), v.null())),
    folderId: v.optional(v.union(v.string(), v.null())),
    icon: v.optional(v.union(v.string(), v.null())),
    color: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    const document = await resolveDocumentFromContext(
      ctx,
      organization._id,
      args.pageContext,
      args.documentId ?? null,
    );

    if (!(await canEditEntity(ctx, args.userId, document, 'document'))) {
      throw new ConvexError('FORBIDDEN');
    }
    if (args.title !== undefined) {
      const trimmedTitle = args.title.trim();
      if (!trimmedTitle || trimmedTitle.length > 200) {
        throw new ConvexError('INVALID_INPUT');
      }
    }
    if (args.content !== undefined && args.content.length > 50000) {
      throw new ConvexError('INVALID_INPUT');
    }

    const team =
      args.teamKey === undefined
        ? undefined
        : args.teamKey === null
          ? null
          : await resolveTeamFromContext(
              ctx,
              organization._id,
              undefined,
              args.teamKey,
            );
    const project =
      args.projectKey === undefined
        ? undefined
        : args.projectKey === null
          ? null
          : await resolveProjectFromContext(
              ctx,
              organization._id,
              undefined,
              args.projectKey,
            );
    const folder =
      args.folderId === undefined
        ? undefined
        : args.folderId === null
          ? null
          : await resolveFolderFromContext(
              ctx,
              organization._id,
              undefined,
              args.folderId,
            );

    await ctx.db.patch('documents', document._id, {
      ...(args.title !== undefined ? { title: args.title.trim() } : {}),
      ...(args.content !== undefined ? { content: args.content } : {}),
      ...(args.visibility !== undefined ? { visibility: args.visibility } : {}),
      ...(args.icon !== undefined ? { icon: args.icon ?? undefined } : {}),
      ...(args.color !== undefined ? { color: args.color ?? undefined } : {}),
      ...(team !== undefined ? { teamId: team?._id } : {}),
      ...(project !== undefined ? { projectId: project?._id } : {}),
      ...(folder !== undefined ? { folderId: folder?._id } : {}),
      lastEditedBy: args.userId,
      lastEditedAt: Date.now(),
    });

    if (args.content !== undefined) {
      await syncDocumentMentions(
        ctx,
        document._id,
        organization._id,
        args.content,
      );
    }

    return {
      documentId: String(document._id),
      title: args.title?.trim() ?? document.title,
    };
  },
});

export const listIssues = internalQuery({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    pageContext: v.optional(assistantPageContextValidator),
    projectKey: v.optional(v.string()),
    teamKey: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    const project =
      args.projectKey || args.pageContext?.kind === 'project_detail'
        ? await resolveProjectFromContext(
            ctx,
            organization._id,
            args.pageContext,
            args.projectKey,
          ).catch(() => null)
        : null;
    const team =
      args.teamKey || args.pageContext?.kind === 'team_detail'
        ? await resolveTeamFromContext(
            ctx,
            organization._id,
            args.pageContext,
            args.teamKey,
          ).catch(() => null)
        : null;

    let issues = project
      ? await ctx.db
          .query('issues')
          .withIndex('by_project', q => q.eq('projectId', project._id))
          .collect()
      : await ctx.db
          .query('issues')
          .withIndex('by_organization', q =>
            q.eq('organizationId', organization._id),
          )
          .collect();

    if (team) {
      issues = issues.filter(issue => issue.teamId === team._id);
    }

    const visible = [];
    for (const issue of issues) {
      if (await canViewEntity(ctx, args.userId, issue, 'issue')) {
        visible.push(issue);
      }
    }

    const issueSlice = visible.slice(0, args.limit ?? 25);
    const results = [];
    for (const issue of issueSlice) {
      const assignees = await ctx.db
        .query('issueAssignees')
        .withIndex('by_issue', q => q.eq('issueId', issue._id))
        .collect();
      const firstAssignment = assignees[0];
      const state = firstAssignment
        ? await ctx.db.get('issueStates', firstAssignment.stateId)
        : null;
      const assignee = firstAssignment?.assigneeId
        ? await ctx.db.get('users', firstAssignment.assigneeId)
        : null;
      const priority = issue.priorityId
        ? await ctx.db.get('issuePriorities', issue.priorityId)
        : null;

      results.push({
        id: String(issue._id),
        key: issue.key,
        title: issue.title,
        visibility: issue.visibility ?? 'organization',
        projectId: issue.projectId ? String(issue.projectId) : undefined,
        teamId: issue.teamId ? String(issue.teamId) : undefined,
        priorityName: priority?.name ?? undefined,
        stateName: state?.name ?? undefined,
        stateType: state?.type ?? undefined,
        assigneeName: assignee?.name ?? assignee?.email ?? undefined,
        startDate: issue.startDate ?? undefined,
        dueDate: issue.dueDate ?? undefined,
        parentIssueId: issue.parentIssueId
          ? String(issue.parentIssueId)
          : undefined,
      });
    }
    return results;
  },
});

export const getIssue = internalQuery({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    pageContext: v.optional(assistantPageContextValidator),
    issueKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    const issue = await resolveIssueFromContext(
      ctx,
      organization._id,
      args.pageContext,
      args.issueKey ?? null,
    );

    if (!(await canViewEntity(ctx, args.userId, issue, 'issue'))) {
      throw new ConvexError('FORBIDDEN');
    }

    const priority = issue.priorityId
      ? await ctx.db.get('issuePriorities', issue.priorityId)
      : null;

    const assignees = await ctx.db
      .query('issueAssignees')
      .withIndex('by_issue', q => q.eq('issueId', issue._id))
      .collect();

    const assigneeDetails = [];
    for (const assignment of assignees) {
      const state = await ctx.db.get('issueStates', assignment.stateId);
      const user = assignment.assigneeId
        ? await ctx.db.get('users', assignment.assigneeId)
        : null;
      assigneeDetails.push({
        assigneeName: user?.name ?? user?.email ?? 'Unassigned',
        stateName: state?.name ?? 'Unknown',
        stateType: state?.type ?? 'todo',
      });
    }

    const parentIssue = issue.parentIssueId
      ? await ctx.db.get('issues', issue.parentIssueId)
      : null;

    return {
      id: String(issue._id),
      key: issue.key,
      title: issue.title,
      description: issue.description ?? '',
      visibility: issue.visibility ?? 'organization',
      teamId: issue.teamId ? String(issue.teamId) : undefined,
      projectId: issue.projectId ? String(issue.projectId) : undefined,
      priorityName: priority?.name ?? undefined,
      startDate: issue.startDate ?? undefined,
      dueDate: issue.dueDate ?? undefined,
      parentIssueKey: parentIssue?.key ?? undefined,
      assignees: assigneeDetails,
    };
  },
});

export const createIssue = internalMutation({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    pageContext: v.optional(assistantPageContextValidator),
    title: v.string(),
    description: v.optional(v.string()),
    projectKey: v.optional(v.string()),
    teamKey: v.optional(v.string()),
    priorityName: v.optional(v.string()),
    visibility: v.optional(
      v.union(
        v.literal('private'),
        v.literal('organization'),
        v.literal('public'),
      ),
    ),
    assigneeName: v.optional(v.string()),
    stateName: v.optional(v.string()),
    startDate: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    parentIssueKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    await requireOrgPermissionForUser(
      ctx,
      organization._id,
      args.userId,
      PERMISSIONS.ISSUE_CREATE,
    );

    const project =
      args.projectKey || args.pageContext?.kind === 'project_detail'
        ? await resolveProjectFromContext(
            ctx,
            organization._id,
            args.pageContext,
            args.projectKey,
          ).catch(() => null)
        : null;
    const team =
      args.teamKey || args.pageContext?.kind === 'team_detail'
        ? await resolveTeamFromContext(
            ctx,
            organization._id,
            args.pageContext,
            args.teamKey,
          ).catch(() => null)
        : null;
    const currentIssue =
      args.pageContext?.kind === 'issue_detail'
        ? await resolveIssueFromContext(ctx, organization._id, args.pageContext)
        : null;
    const priority = await findIssuePriorityByName(
      ctx,
      organization._id,
      args.priorityName,
    );

    // Resolve parent issue
    let parentIssueId = undefined;
    if (args.parentIssueKey) {
      const parentIssue = await ctx.db
        .query('issues')
        .withIndex('by_org_key', q =>
          q
            .eq('organizationId', organization._id)
            .eq('key', args.parentIssueKey!),
        )
        .first();
      if (parentIssue) {
        parentIssueId = parentIssue._id;
      }
    }

    // Resolve assignee
    const memberMatch = await findMemberByName(
      ctx,
      organization._id,
      args.assigneeName,
    );

    if (!args.title.trim()) {
      throw new ConvexError('INVALID_INPUT');
    }

    let key: string;
    let sequenceNumber: number;

    if (project ?? currentIssue?.projectId) {
      const resolvedProject =
        project ?? (await ctx.db.get('projects', currentIssue!.projectId!));
      if (!resolvedProject) {
        throw new ConvexError('PROJECT_NOT_FOUND');
      }
      const existingIssues = await ctx.db
        .query('issues')
        .withIndex('by_project', q => q.eq('projectId', resolvedProject._id))
        .collect();
      sequenceNumber = existingIssues.length + 1;
      key = `${resolvedProject.key}-${sequenceNumber}`;
    } else {
      const existingIssues = await ctx.db
        .query('issues')
        .withIndex('by_organization', q =>
          q.eq('organizationId', organization._id),
        )
        .collect();
      sequenceNumber = existingIssues.length + 1;
      key = `${organization.slug.toUpperCase()}-${sequenceNumber}`;
    }

    const issueId = await ctx.db.insert('issues', {
      organizationId: organization._id,
      projectId: project?._id ?? currentIssue?.projectId,
      key,
      sequenceNumber,
      title: args.title.trim(),
      description: args.description?.trim(),
      searchText: buildIssueSearchText({
        key,
        title: args.title.trim(),
        description: args.description?.trim(),
      }),
      priorityId: priority?._id ?? undefined,
      reporterId: args.userId,
      teamId: team?._id ?? currentIssue?.teamId,
      visibility: args.visibility ?? 'organization',
      createdBy: args.userId,
      parentIssueId,
      startDate: args.startDate,
      dueDate: args.dueDate,
    });

    // Resolve issue state (default to todo)
    let issueState = args.stateName
      ? await findIssueStateByName(ctx, organization._id, args.stateName)
      : null;
    if (!issueState) {
      issueState = await ctx.db
        .query('issueStates')
        .withIndex('by_organization', q =>
          q.eq('organizationId', organization._id),
        )
        .filter(q => q.eq(q.field('type'), 'todo'))
        .first();
    }

    if (issueState) {
      await ctx.db.insert('issueAssignees', {
        issueId,
        assigneeId: memberMatch?.user._id ?? undefined,
        stateId: issueState._id,
      });
    }

    const summary: string[] = [key, args.title.trim()];
    if (memberMatch)
      summary.push(
        `assigned to ${memberMatch.user.name ?? memberMatch.user.email}`,
      );
    if (issueState && args.stateName) summary.push(`state: ${issueState.name}`);

    return {
      issueId: String(issueId),
      key,
      title: args.title.trim(),
      summary: summary.join(' — '),
    };
  },
});

export const updateIssue = internalMutation({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    pageContext: v.optional(assistantPageContextValidator),
    issueKey: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    priorityName: v.optional(v.union(v.string(), v.null())),
    teamKey: v.optional(v.union(v.string(), v.null())),
    projectKey: v.optional(v.union(v.string(), v.null())),
    visibility: v.optional(
      v.union(
        v.literal('private'),
        v.literal('organization'),
        v.literal('public'),
      ),
    ),
    assigneeName: v.optional(v.union(v.string(), v.null())),
    stateName: v.optional(v.string()),
    startDate: v.optional(v.union(v.string(), v.null())),
    dueDate: v.optional(v.union(v.string(), v.null())),
    parentIssueKey: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    const issue = await resolveIssueFromContext(
      ctx,
      organization._id,
      args.pageContext,
      args.issueKey ?? null,
    );
    const hasIssueFieldEdits =
      args.title !== undefined ||
      args.description !== undefined ||
      args.priorityName !== undefined ||
      args.teamKey !== undefined ||
      args.projectKey !== undefined ||
      args.visibility !== undefined ||
      args.startDate !== undefined ||
      args.dueDate !== undefined ||
      args.parentIssueKey !== undefined;

    if (
      hasIssueFieldEdits &&
      !(await canEditEntity(ctx, args.userId, issue, 'issue'))
    ) {
      throw new ConvexError('FORBIDDEN');
    }

    const priority =
      args.priorityName === undefined
        ? undefined
        : args.priorityName === null
          ? null
          : await findIssuePriorityByName(
              ctx,
              organization._id,
              args.priorityName,
            );
    const team =
      args.teamKey === undefined
        ? undefined
        : args.teamKey === null
          ? null
          : await resolveTeamFromContext(
              ctx,
              organization._id,
              undefined,
              args.teamKey,
            );
    const project =
      args.projectKey === undefined
        ? undefined
        : args.projectKey === null
          ? null
          : await resolveProjectFromContext(
              ctx,
              organization._id,
              undefined,
              args.projectKey,
            );

    // Resolve parent issue
    let parentIssueId: typeof issue.parentIssueId | undefined = undefined;
    if (args.parentIssueKey !== undefined) {
      if (args.parentIssueKey === null) {
        parentIssueId = undefined;
      } else {
        const parentIssue = await ctx.db
          .query('issues')
          .withIndex('by_org_key', q =>
            q
              .eq('organizationId', organization._id)
              .eq('key', args.parentIssueKey!),
          )
          .first();
        parentIssueId = parentIssue?._id;
      }
    }

    const nextTitle = args.title ?? issue.title;
    const nextDescription = args.description ?? issue.description;

    if (hasIssueFieldEdits) {
      await ctx.db.patch('issues', issue._id, {
        ...(args.title !== undefined ? { title: args.title.trim() } : {}),
        ...(args.description !== undefined
          ? { description: args.description }
          : {}),
        ...(priority !== undefined ? { priorityId: priority?._id } : {}),
        ...(team !== undefined ? { teamId: team?._id } : {}),
        ...(project !== undefined ? { projectId: project?._id } : {}),
        ...(args.visibility !== undefined
          ? { visibility: args.visibility }
          : {}),
        ...(args.startDate !== undefined
          ? { startDate: args.startDate ?? undefined }
          : {}),
        ...(args.dueDate !== undefined
          ? { dueDate: args.dueDate ?? undefined }
          : {}),
        ...(parentIssueId !== undefined ? { parentIssueId } : {}),
        searchText: buildIssueSearchText({
          key: issue.key,
          title: nextTitle,
          description: nextDescription,
        }),
      });
    }

    // Handle assignee and state changes on the issueAssignees table
    const changes: string[] = [];
    if (args.assigneeName !== undefined || args.stateName !== undefined) {
      const existingAssignees = await ctx.db
        .query('issueAssignees')
        .withIndex('by_issue', q => q.eq('issueId', issue._id))
        .collect();

      const newState = args.stateName
        ? await findIssueStateByName(ctx, organization._id, args.stateName)
        : null;
      const memberMatch =
        args.assigneeName === undefined
          ? undefined
          : args.assigneeName === null
            ? null
            : await findMemberByName(ctx, organization._id, args.assigneeName);
      const canModifyAssignments =
        args.assigneeName !== undefined
          ? await canAssignIssueForUser(ctx, args.userId, issue)
          : existingAssignees[0]?.assigneeId
            ? await canUpdateIssueAssignmentStateForUser(
                ctx,
                args.userId,
                issue,
                existingAssignees[0].assigneeId,
              )
            : await canAssignIssueForUser(ctx, args.userId, issue);
      if (!canModifyAssignments) {
        throw new ConvexError('FORBIDDEN');
      }

      if (existingAssignees.length > 0) {
        // Update the first assignment record
        const assignment = existingAssignees[0]!;
        const patch: Record<string, unknown> = {};
        if (memberMatch !== undefined) {
          patch.assigneeId = memberMatch?.user._id ?? undefined;
        }
        if (newState) {
          patch.stateId = newState._id;
        }
        if (Object.keys(patch).length > 0) {
          await ctx.db.patch('issueAssignees', assignment._id, patch);
        }
      } else {
        // Create a new assignment record
        const fallbackState =
          newState ??
          (await ctx.db
            .query('issueStates')
            .withIndex('by_organization', q =>
              q.eq('organizationId', organization._id),
            )
            .filter(q => q.eq(q.field('type'), 'todo'))
            .first());
        if (fallbackState) {
          await ctx.db.insert('issueAssignees', {
            issueId: issue._id,
            assigneeId: memberMatch ? memberMatch.user._id : undefined,
            stateId: fallbackState._id,
          });
        }
      }

      if (memberMatch)
        changes.push(
          `assigned to ${memberMatch.user.name ?? memberMatch.user.email}`,
        );
      if (memberMatch === null) changes.push('unassigned');
      if (newState) changes.push(`state → ${newState.name}`);
    }

    return {
      issueId: String(issue._id),
      key: issue.key,
      title: nextTitle,
      ...(changes.length > 0 ? { changes: changes.join(', ') } : {}),
    };
  },
});

export const listProjects = internalQuery({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    pageContext: v.optional(assistantPageContextValidator),
    teamKey: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    const team =
      args.teamKey || args.pageContext?.kind === 'team_detail'
        ? await resolveTeamFromContext(
            ctx,
            organization._id,
            args.pageContext,
            args.teamKey,
          ).catch(() => null)
        : null;

    let projects = await ctx.db
      .query('projects')
      .withIndex('by_organization', q =>
        q.eq('organizationId', organization._id),
      )
      .collect();

    if (team) {
      projects = projects.filter(project => project.teamId === team._id);
    }

    const visible = [];
    for (const project of projects) {
      if (await canViewEntity(ctx, args.userId, project, 'project')) {
        visible.push(project);
      }
    }

    return visible.slice(0, args.limit ?? 25).map(project => ({
      id: String(project._id),
      key: project.key,
      name: project.name,
      visibility: project.visibility ?? 'organization',
      teamId: project.teamId ? String(project.teamId) : undefined,
      statusId: project.statusId ? String(project.statusId) : undefined,
    }));
  },
});

export const getProject = internalQuery({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    pageContext: v.optional(assistantPageContextValidator),
    projectKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    const project = await resolveProjectFromContext(
      ctx,
      organization._id,
      args.pageContext,
      args.projectKey ?? null,
    );

    if (!(await canViewEntity(ctx, args.userId, project, 'project'))) {
      throw new ConvexError('FORBIDDEN');
    }

    const status = project.statusId
      ? await ctx.db.get('projectStatuses', project.statusId)
      : null;

    return {
      id: String(project._id),
      key: project.key,
      name: project.name,
      description: project.description ?? '',
      visibility: project.visibility ?? 'organization',
      teamId: project.teamId ? String(project.teamId) : undefined,
      statusName: status?.name ?? undefined,
      startDate: project.startDate ?? undefined,
      dueDate: project.dueDate ?? undefined,
    };
  },
});

export const createProject = internalMutation({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    pageContext: v.optional(assistantPageContextValidator),
    key: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    teamKey: v.optional(v.string()),
    statusName: v.optional(v.string()),
    visibility: v.optional(
      v.union(
        v.literal('private'),
        v.literal('organization'),
        v.literal('public'),
      ),
    ),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    await requireOrgPermissionForUser(
      ctx,
      organization._id,
      args.userId,
      PERMISSIONS.PROJECT_CREATE,
    );

    const projectKey = args.key.trim();
    const projectName = args.name.trim();
    if (!projectKey || !projectName) {
      throw new ConvexError('INVALID_INPUT');
    }
    if (projectKey.length > 20 || projectName.length > 100) {
      throw new ConvexError('INVALID_INPUT');
    }
    if (args.description && args.description.length > 5000) {
      throw new ConvexError('INVALID_INPUT');
    }

    const existingProject = await ctx.db
      .query('projects')
      .withIndex('by_org_key', q =>
        q.eq('organizationId', organization._id).eq('key', projectKey),
      )
      .first();
    if (existingProject) {
      throw new ConvexError('PROJECT_KEY_EXISTS');
    }

    const fallbackTeam =
      args.pageContext?.kind === 'team_detail'
        ? await resolveTeamFromContext(
            ctx,
            organization._id,
            args.pageContext,
          ).catch(() => null)
        : null;
    const team = args.teamKey
      ? await resolveTeamFromContext(
          ctx,
          organization._id,
          undefined,
          args.teamKey,
        )
      : fallbackTeam;
    const status = await findProjectStatusByName(
      ctx,
      organization._id,
      args.statusName,
    );

    const projectId = await ctx.db.insert('projects', {
      organizationId: organization._id,
      key: projectKey,
      name: projectName,
      description: args.description?.trim(),
      leadId: args.userId,
      teamId: team?._id,
      statusId: status?._id ?? undefined,
      createdBy: args.userId,
      visibility: args.visibility ?? 'organization',
      icon: args.icon,
      color: args.color,
    });

    await ctx.db.insert('projectMembers', {
      projectId,
      userId: args.userId,
      role: 'lead',
      joinedAt: Date.now(),
    });
    await syncProjectRoleAssignment(ctx, projectId, args.userId, 'lead');

    return {
      projectId: String(projectId),
      key: projectKey,
      name: projectName,
    };
  },
});

export const updateProject = internalMutation({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    pageContext: v.optional(assistantPageContextValidator),
    projectKey: v.optional(v.string()),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    teamKey: v.optional(v.union(v.string(), v.null())),
    statusName: v.optional(v.union(v.string(), v.null())),
    visibility: v.optional(
      v.union(
        v.literal('private'),
        v.literal('organization'),
        v.literal('public'),
      ),
    ),
    startDate: v.optional(v.union(v.string(), v.null())),
    dueDate: v.optional(v.union(v.string(), v.null())),
    icon: v.optional(v.union(v.string(), v.null())),
    color: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    const project = await resolveProjectFromContext(
      ctx,
      organization._id,
      args.pageContext,
      args.projectKey ?? null,
    );

    if (!(await canEditEntity(ctx, args.userId, project, 'project'))) {
      throw new ConvexError('FORBIDDEN');
    }
    if (args.name !== undefined) {
      const trimmedName = args.name.trim();
      if (!trimmedName || trimmedName.length > 100) {
        throw new ConvexError('INVALID_INPUT');
      }
    }
    if (args.description !== undefined && args.description.length > 5000) {
      throw new ConvexError('INVALID_INPUT');
    }

    const team =
      args.teamKey === undefined
        ? undefined
        : args.teamKey === null
          ? null
          : await resolveTeamFromContext(
              ctx,
              organization._id,
              undefined,
              args.teamKey,
            );
    const status =
      args.statusName === undefined
        ? undefined
        : args.statusName === null
          ? null
          : await findProjectStatusByName(
              ctx,
              organization._id,
              args.statusName,
            );

    await ctx.db.patch('projects', project._id, {
      ...(args.name !== undefined ? { name: args.name.trim() } : {}),
      ...(args.description !== undefined
        ? { description: args.description }
        : {}),
      ...(team !== undefined ? { teamId: team?._id } : {}),
      ...(status !== undefined ? { statusId: status?._id } : {}),
      ...(args.visibility !== undefined ? { visibility: args.visibility } : {}),
      ...(args.startDate !== undefined
        ? { startDate: args.startDate ?? undefined }
        : {}),
      ...(args.dueDate !== undefined
        ? { dueDate: args.dueDate ?? undefined }
        : {}),
      ...(args.icon !== undefined ? { icon: args.icon ?? undefined } : {}),
      ...(args.color !== undefined ? { color: args.color ?? undefined } : {}),
    });

    return {
      projectId: String(project._id),
      key: project.key,
      name: args.name?.trim() ?? project.name,
    };
  },
});

export const listTeams = internalQuery({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );

    const teams = await ctx.db
      .query('teams')
      .withIndex('by_organization', q =>
        q.eq('organizationId', organization._id),
      )
      .collect();

    const visible = [];
    for (const team of teams) {
      if (await canViewEntity(ctx, args.userId, team, 'team')) {
        visible.push(team);
      }
    }

    return visible.slice(0, args.limit ?? 25).map(team => ({
      id: String(team._id),
      key: team.key,
      name: team.name,
      visibility: team.visibility ?? 'organization',
    }));
  },
});

export const getTeam = internalQuery({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    pageContext: v.optional(assistantPageContextValidator),
    teamKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    const team = await resolveTeamFromContext(
      ctx,
      organization._id,
      args.pageContext,
      args.teamKey ?? null,
    );

    if (!(await canViewEntity(ctx, args.userId, team, 'team'))) {
      throw new ConvexError('FORBIDDEN');
    }

    return {
      id: String(team._id),
      key: team.key,
      name: team.name,
      description: team.description ?? '',
      visibility: team.visibility ?? 'organization',
      icon: team.icon ?? undefined,
      color: team.color ?? undefined,
    };
  },
});

export const createTeam = internalMutation({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    key: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    visibility: v.optional(
      v.union(
        v.literal('private'),
        v.literal('organization'),
        v.literal('public'),
      ),
    ),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    await requireOrgPermissionForUser(
      ctx,
      organization._id,
      args.userId,
      PERMISSIONS.TEAM_CREATE,
    );

    const teamKey = args.key.trim();
    const teamName = args.name.trim();
    if (!teamKey || !teamName) {
      throw new ConvexError('INVALID_INPUT');
    }
    if (teamKey.length > 10 || teamName.length > 100) {
      throw new ConvexError('INVALID_INPUT');
    }
    if (args.description && args.description.length > 2000) {
      throw new ConvexError('INVALID_INPUT');
    }

    const existingTeam = await ctx.db
      .query('teams')
      .withIndex('by_org_key', q =>
        q.eq('organizationId', organization._id).eq('key', teamKey),
      )
      .first();
    if (existingTeam) {
      throw new ConvexError('TEAM_KEY_EXISTS');
    }

    const teamId = await ctx.db.insert('teams', {
      organizationId: organization._id,
      key: teamKey,
      name: teamName,
      description: args.description?.trim(),
      leadId: args.userId,
      icon: args.icon,
      color: args.color,
      visibility: args.visibility ?? 'organization',
      createdBy: args.userId,
    });

    await ctx.db.insert('teamMembers', {
      teamId,
      userId: args.userId,
      role: 'lead',
      joinedAt: Date.now(),
    });
    await syncTeamRoleAssignment(ctx, teamId, args.userId, 'lead');

    return {
      teamId: String(teamId),
      key: teamKey,
      name: teamName,
    };
  },
});

export const updateTeam = internalMutation({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    pageContext: v.optional(assistantPageContextValidator),
    teamKey: v.optional(v.string()),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    visibility: v.optional(
      v.union(
        v.literal('private'),
        v.literal('organization'),
        v.literal('public'),
      ),
    ),
    icon: v.optional(v.union(v.string(), v.null())),
    color: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    const team = await resolveTeamFromContext(
      ctx,
      organization._id,
      args.pageContext,
      args.teamKey ?? null,
    );

    if (!(await canEditEntity(ctx, args.userId, team, 'team'))) {
      throw new ConvexError('FORBIDDEN');
    }
    if (args.name !== undefined) {
      const trimmedName = args.name.trim();
      if (!trimmedName || trimmedName.length > 100) {
        throw new ConvexError('INVALID_INPUT');
      }
    }
    if (args.description !== undefined && args.description.length > 2000) {
      throw new ConvexError('INVALID_INPUT');
    }

    await ctx.db.patch('teams', team._id, {
      ...(args.name !== undefined ? { name: args.name.trim() } : {}),
      ...(args.description !== undefined
        ? { description: args.description }
        : {}),
      ...(args.visibility !== undefined ? { visibility: args.visibility } : {}),
      ...(args.icon !== undefined ? { icon: args.icon ?? undefined } : {}),
      ...(args.color !== undefined ? { color: args.color ?? undefined } : {}),
    });

    return {
      teamId: String(team._id),
      key: team.key,
      name: args.name?.trim() ?? team.name,
    };
  },
});

export const setPendingDeleteAction = internalMutation({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    assistantThreadId: v.id('assistantThreads'),
    pageContext: v.optional(assistantPageContextValidator),
    entityType: v.union(
      v.literal('document'),
      v.literal('issue'),
      v.literal('project'),
      v.literal('team'),
    ),
    documentId: v.optional(v.string()),
    issueKey: v.optional(v.string()),
    projectKey: v.optional(v.string()),
    teamKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    const row = await requireAssistantThreadRow(
      ctx,
      organization._id,
      args.userId,
    );
    if (row._id !== args.assistantThreadId) {
      throw new ConvexError('FORBIDDEN');
    }

    const entity =
      args.entityType === 'document'
        ? await resolveDocumentFromContext(
            ctx,
            organization._id,
            args.pageContext,
            args.documentId ?? null,
          )
        : args.entityType === 'issue'
          ? await resolveIssueFromContext(
              ctx,
              organization._id,
              args.pageContext,
              args.issueKey ?? null,
            )
          : args.entityType === 'project'
            ? await resolveProjectFromContext(
                ctx,
                organization._id,
                args.pageContext,
                args.projectKey ?? null,
              )
            : await resolveTeamFromContext(
                ctx,
                organization._id,
                args.pageContext,
                args.teamKey ?? null,
              );

    if (!(await canDeleteEntity(ctx, args.userId, entity, args.entityType))) {
      throw new ConvexError('FORBIDDEN');
    }

    const label = 'title' in entity ? entity.title : entity.name;
    const pendingAction: AssistantPendingAction = {
      id: makePendingActionId(),
      kind: 'delete_entity',
      entityType: args.entityType,
      entityId: String(entity._id),
      entityLabel: label,
      summary: `Delete ${args.entityType} "${label}"`,
      createdAt: Date.now(),
    };

    await ctx.db.patch('assistantThreads', row._id, {
      pendingAction,
      updatedAt: Date.now(),
      ...buildAssistantThreadPatch(
        args.pageContext ?? {
          kind: 'org_generic',
          orgSlug: args.orgSlug,
          path: `/${args.orgSlug}`,
        },
      ),
    });

    return pendingAction;
  },
});

export const executePendingAction = internalMutation({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    actionId: v.string(),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    const row = await requireAssistantThreadRow(
      ctx,
      organization._id,
      args.userId,
    );
    const pendingAction = row.pendingAction;

    if (!pendingAction || pendingAction.id !== args.actionId) {
      throw new ConvexError('PENDING_ACTION_NOT_FOUND');
    }

    switch (pendingAction.entityType) {
      case 'document': {
        const documentId = ctx.db.normalizeId(
          'documents',
          pendingAction.entityId,
        );
        if (!documentId) throw new ConvexError('DOCUMENT_NOT_FOUND');
        const document = await ctx.db.get('documents', documentId);
        if (!document) throw new ConvexError('DOCUMENT_NOT_FOUND');
        if (!(await canDeleteEntity(ctx, args.userId, document, 'document'))) {
          throw new ConvexError('FORBIDDEN');
        }
        const mentions = await ctx.db
          .query('documentMentions')
          .withIndex('by_document', q => q.eq('documentId', document._id))
          .collect();
        for (const mention of mentions) {
          await ctx.db.delete('documentMentions', mention._id);
        }
        await ctx.db.delete('documents', document._id);
        break;
      }
      case 'issue': {
        const issueId = ctx.db.normalizeId('issues', pendingAction.entityId);
        if (!issueId) throw new ConvexError('ISSUE_NOT_FOUND');
        const issue = await ctx.db.get('issues', issueId);
        if (!issue) throw new ConvexError('ISSUE_NOT_FOUND');
        if (!(await canDeleteEntity(ctx, args.userId, issue, 'issue'))) {
          throw new ConvexError('FORBIDDEN');
        }
        const child = await ctx.db
          .query('issues')
          .withIndex('by_parent', q => q.eq('parentIssueId', issue._id))
          .first();
        if (child) throw new ConvexError('HAS_CHILD_ISSUES');
        const assignees = await ctx.db
          .query('issueAssignees')
          .withIndex('by_issue', q => q.eq('issueId', issue._id))
          .collect();
        for (const assignee of assignees) {
          await ctx.db.delete('issueAssignees', assignee._id);
        }
        const comments = await ctx.db
          .query('comments')
          .withIndex('by_issue', q => q.eq('issueId', issue._id))
          .collect();
        for (const comment of comments) {
          await ctx.db.delete('comments', comment._id);
        }
        await ctx.db.delete('issues', issue._id);
        break;
      }
      case 'project': {
        const projectId = ctx.db.normalizeId(
          'projects',
          pendingAction.entityId,
        );
        if (!projectId) throw new ConvexError('PROJECT_NOT_FOUND');
        const project = await ctx.db.get('projects', projectId);
        if (!project) throw new ConvexError('PROJECT_NOT_FOUND');
        if (!(await canDeleteEntity(ctx, args.userId, project, 'project'))) {
          throw new ConvexError('FORBIDDEN');
        }
        const members = await ctx.db
          .query('projectMembers')
          .withIndex('by_project', q => q.eq('projectId', project._id))
          .collect();
        for (const member of members) {
          await ctx.db.delete('projectMembers', member._id);
        }
        const roleAssignments = await ctx.db
          .query('roleAssignments')
          .withIndex('by_project_user', q => q.eq('projectId', project._id))
          .collect();
        for (const assignment of roleAssignments) {
          await ctx.db.delete('roleAssignments', assignment._id);
        }
        const legacyAssignments = await ctx.db
          .query('projectRoleAssignments')
          .withIndex('by_project', q => q.eq('projectId', project._id))
          .collect();
        for (const assignment of legacyAssignments) {
          await ctx.db.delete('projectRoleAssignments', assignment._id);
        }
        const projectTeams = await ctx.db
          .query('projectTeams')
          .withIndex('by_project', q => q.eq('projectId', project._id))
          .collect();
        for (const projectTeam of projectTeams) {
          await ctx.db.delete('projectTeams', projectTeam._id);
        }
        await ctx.db.delete('projects', project._id);
        break;
      }
      case 'team': {
        const teamId = ctx.db.normalizeId('teams', pendingAction.entityId);
        if (!teamId) throw new ConvexError('TEAM_NOT_FOUND');
        const team = await ctx.db.get('teams', teamId);
        if (!team) throw new ConvexError('TEAM_NOT_FOUND');
        if (!(await canDeleteEntity(ctx, args.userId, team, 'team'))) {
          throw new ConvexError('FORBIDDEN');
        }
        const members = await ctx.db
          .query('teamMembers')
          .withIndex('by_team', q => q.eq('teamId', team._id))
          .collect();
        for (const member of members) {
          await ctx.db.delete('teamMembers', member._id);
        }
        const roleAssignments = await ctx.db
          .query('roleAssignments')
          .withIndex('by_team_user', q => q.eq('teamId', team._id))
          .collect();
        for (const assignment of roleAssignments) {
          await ctx.db.delete('roleAssignments', assignment._id);
        }
        const legacyAssignments = await ctx.db
          .query('teamRoleAssignments')
          .withIndex('by_team', q => q.eq('teamId', team._id))
          .collect();
        for (const assignment of legacyAssignments) {
          await ctx.db.delete('teamRoleAssignments', assignment._id);
        }
        await ctx.db.delete('teams', team._id);
        break;
      }
      case 'folder': {
        const folderId = ctx.db.normalizeId(
          'documentFolders',
          pendingAction.entityId,
        );
        if (!folderId) throw new ConvexError('FOLDER_NOT_FOUND');
        const folder = await ctx.db.get('documentFolders', folderId);
        if (!folder || folder.organizationId !== organization._id) {
          throw new ConvexError('FOLDER_NOT_FOUND');
        }
        await requireOrgPermissionForUser(
          ctx,
          organization._id,
          args.userId,
          PERMISSIONS.DOCUMENT_DELETE,
        );
        const documents = await ctx.db
          .query('documents')
          .withIndex('by_folder', q => q.eq('folderId', folder._id))
          .collect();
        for (const document of documents) {
          await ctx.db.patch('documents', document._id, {
            folderId: undefined,
          });
        }
        await ctx.db.delete('documentFolders', folder._id);
        break;
      }
    }

    await ctx.db.patch('assistantThreads', row._id, {
      pendingAction: undefined,
      updatedAt: Date.now(),
    });

    return pendingAction;
  },
});

// ──── Client action queue ────

export const enqueueClientAction = internalMutation({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    type: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    const actionId = await ctx.db.insert('assistantActions', {
      organizationId: organization._id,
      userId: args.userId,
      type: args.type,
      payload: args.payload,
      status: 'pending',
      createdAt: Date.now(),
    });
    return { actionId: String(actionId) };
  },
});

export const clearPendingAction = internalMutation({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    const row = await requireAssistantThreadRow(
      ctx,
      organization._id,
      args.userId,
    );
    await ctx.db.patch('assistantThreads', row._id, {
      pendingAction: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

// ──── Team member management ────

export const addTeamMember = internalMutation({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    pageContext: v.optional(assistantPageContextValidator),
    teamKey: v.optional(v.string()),
    memberName: v.string(),
    role: v.optional(v.union(v.literal('lead'), v.literal('member'))),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    const team = await resolveTeamFromContext(
      ctx,
      organization._id,
      args.pageContext,
      args.teamKey,
    );
    const memberMatch = await findMemberByName(
      ctx,
      organization._id,
      args.memberName,
    );
    if (!memberMatch) throw new ConvexError('MEMBER_NOT_FOUND');
    if (!(await canManageTeamMembersForUser(ctx, args.userId, team, 'add'))) {
      throw new ConvexError('FORBIDDEN');
    }

    const existing = await ctx.db
      .query('teamMembers')
      .withIndex('by_team_user', q =>
        q.eq('teamId', team._id).eq('userId', memberMatch.user._id),
      )
      .first();
    if (existing) {
      return {
        message: `${memberMatch.user.name ?? memberMatch.user.email} is already a member of ${team.name}`,
      };
    }

    const role = args.role ?? 'member';
    await ctx.db.insert('teamMembers', {
      teamId: team._id,
      userId: memberMatch.user._id,
      role,
      joinedAt: Date.now(),
    });
    await syncTeamRoleAssignment(ctx, team._id, memberMatch.user._id, role);

    return {
      message: `Added ${memberMatch.user.name ?? memberMatch.user.email} to ${team.name} as ${role}`,
      teamKey: team.key,
      userName: memberMatch.user.name ?? memberMatch.user.email,
    };
  },
});

export const removeTeamMember = internalMutation({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    pageContext: v.optional(assistantPageContextValidator),
    teamKey: v.optional(v.string()),
    memberName: v.string(),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    const team = await resolveTeamFromContext(
      ctx,
      organization._id,
      args.pageContext,
      args.teamKey,
    );
    const memberMatch = await findMemberByName(
      ctx,
      organization._id,
      args.memberName,
    );
    if (!memberMatch) throw new ConvexError('MEMBER_NOT_FOUND');
    if (
      !(await canManageTeamMembersForUser(ctx, args.userId, team, 'remove'))
    ) {
      throw new ConvexError('FORBIDDEN');
    }

    const membership = await ctx.db
      .query('teamMembers')
      .withIndex('by_team_user', q =>
        q.eq('teamId', team._id).eq('userId', memberMatch.user._id),
      )
      .first();
    if (!membership) {
      return {
        message: `${memberMatch.user.name ?? memberMatch.user.email} is not a member of ${team.name}`,
      };
    }

    const scopedAssignments = await ctx.db
      .query('roleAssignments')
      .withIndex('by_team_user', q =>
        q.eq('teamId', team._id).eq('userId', memberMatch.user._id),
      )
      .collect();
    for (const assignment of scopedAssignments) {
      await ctx.db.delete('roleAssignments', assignment._id);
    }

    const legacyAssignments = await ctx.db
      .query('teamRoleAssignments')
      .withIndex('by_user', q => q.eq('userId', memberMatch.user._id))
      .collect();
    for (const assignment of legacyAssignments) {
      if (assignment.teamId === team._id) {
        await ctx.db.delete('teamRoleAssignments', assignment._id);
      }
    }

    await ctx.db.delete('teamMembers', membership._id);
    return {
      message: `Removed ${memberMatch.user.name ?? memberMatch.user.email} from ${team.name}`,
      teamKey: team.key,
      userName: memberMatch.user.name ?? memberMatch.user.email,
    };
  },
});

export const changeTeamLead = internalMutation({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    pageContext: v.optional(assistantPageContextValidator),
    teamKey: v.optional(v.string()),
    leadName: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    const team = await resolveTeamFromContext(
      ctx,
      organization._id,
      args.pageContext,
      args.teamKey,
    );
    if (
      !(await canManageTeamMembersForUser(ctx, args.userId, team, 'update'))
    ) {
      throw new ConvexError('FORBIDDEN');
    }

    if (args.leadName === null) {
      await ctx.db.patch('teams', team._id, { leadId: undefined });
      return { message: `Removed lead from ${team.name}`, teamKey: team.key };
    }

    const memberMatch = await findMemberByName(
      ctx,
      organization._id,
      args.leadName,
    );
    if (!memberMatch) throw new ConvexError('MEMBER_NOT_FOUND');

    await ctx.db.patch('teams', team._id, { leadId: memberMatch.user._id });

    // Ensure lead is a team member
    const existing = await ctx.db
      .query('teamMembers')
      .withIndex('by_team_user', q =>
        q.eq('teamId', team._id).eq('userId', memberMatch.user._id),
      )
      .first();
    if (!existing) {
      await ctx.db.insert('teamMembers', {
        teamId: team._id,
        userId: memberMatch.user._id,
        role: 'lead',
        joinedAt: Date.now(),
      });
    } else if (existing.role !== 'lead') {
      await ctx.db.patch('teamMembers', existing._id, { role: 'lead' });
    }
    await syncTeamRoleAssignment(ctx, team._id, memberMatch.user._id, 'lead');

    return {
      message: `Set ${memberMatch.user.name ?? memberMatch.user.email} as lead of ${team.name}`,
      teamKey: team.key,
      userName: memberMatch.user.name ?? memberMatch.user.email,
    };
  },
});

// ──── Project member management ────

export const addProjectMember = internalMutation({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    pageContext: v.optional(assistantPageContextValidator),
    projectKey: v.optional(v.string()),
    memberName: v.string(),
    role: v.optional(v.union(v.literal('lead'), v.literal('member'))),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    const project = await resolveProjectFromContext(
      ctx,
      organization._id,
      args.pageContext,
      args.projectKey,
    );
    const memberMatch = await findMemberByName(
      ctx,
      organization._id,
      args.memberName,
    );
    if (!memberMatch) throw new ConvexError('MEMBER_NOT_FOUND');
    if (
      !(await canManageProjectMembersForUser(ctx, args.userId, project, 'add'))
    ) {
      throw new ConvexError('FORBIDDEN');
    }

    const existing = await ctx.db
      .query('projectMembers')
      .withIndex('by_project_user', q =>
        q.eq('projectId', project._id).eq('userId', memberMatch.user._id),
      )
      .first();
    if (existing) {
      return {
        message: `${memberMatch.user.name ?? memberMatch.user.email} is already a member of ${project.name}`,
      };
    }

    const role = args.role ?? 'member';
    await ctx.db.insert('projectMembers', {
      projectId: project._id,
      userId: memberMatch.user._id,
      role,
      joinedAt: Date.now(),
    });
    await syncProjectRoleAssignment(
      ctx,
      project._id,
      memberMatch.user._id,
      role,
    );

    return {
      message: `Added ${memberMatch.user.name ?? memberMatch.user.email} to ${project.name} as ${role}`,
      projectKey: project.key,
      userName: memberMatch.user.name ?? memberMatch.user.email,
    };
  },
});

export const removeProjectMember = internalMutation({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    pageContext: v.optional(assistantPageContextValidator),
    projectKey: v.optional(v.string()),
    memberName: v.string(),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    const project = await resolveProjectFromContext(
      ctx,
      organization._id,
      args.pageContext,
      args.projectKey,
    );
    const memberMatch = await findMemberByName(
      ctx,
      organization._id,
      args.memberName,
    );
    if (!memberMatch) throw new ConvexError('MEMBER_NOT_FOUND');
    if (
      !(await canManageProjectMembersForUser(
        ctx,
        args.userId,
        project,
        'remove',
      ))
    ) {
      throw new ConvexError('FORBIDDEN');
    }

    const membership = await ctx.db
      .query('projectMembers')
      .withIndex('by_project_user', q =>
        q.eq('projectId', project._id).eq('userId', memberMatch.user._id),
      )
      .first();
    if (!membership) {
      return {
        message: `${memberMatch.user.name ?? memberMatch.user.email} is not a member of ${project.name}`,
      };
    }

    const scopedAssignments = await ctx.db
      .query('roleAssignments')
      .withIndex('by_project_user', q =>
        q.eq('projectId', project._id).eq('userId', memberMatch.user._id),
      )
      .collect();
    for (const assignment of scopedAssignments) {
      await ctx.db.delete('roleAssignments', assignment._id);
    }

    const legacyAssignments = await ctx.db
      .query('projectRoleAssignments')
      .withIndex('by_user', q => q.eq('userId', memberMatch.user._id))
      .collect();
    for (const assignment of legacyAssignments) {
      if (assignment.projectId === project._id) {
        await ctx.db.delete('projectRoleAssignments', assignment._id);
      }
    }

    await ctx.db.delete('projectMembers', membership._id);
    return {
      message: `Removed ${memberMatch.user.name ?? memberMatch.user.email} from ${project.name}`,
      projectKey: project.key,
      userName: memberMatch.user.name ?? memberMatch.user.email,
    };
  },
});

export const changeProjectLead = internalMutation({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    pageContext: v.optional(assistantPageContextValidator),
    projectKey: v.optional(v.string()),
    leadName: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    const project = await resolveProjectFromContext(
      ctx,
      organization._id,
      args.pageContext,
      args.projectKey,
    );
    if (
      !(await canManageProjectMembersForUser(
        ctx,
        args.userId,
        project,
        'update',
      ))
    ) {
      throw new ConvexError('FORBIDDEN');
    }

    if (args.leadName === null) {
      await ctx.db.patch('projects', project._id, { leadId: undefined });
      return {
        message: `Removed lead from ${project.name}`,
        projectKey: project.key,
      };
    }

    const memberMatch = await findMemberByName(
      ctx,
      organization._id,
      args.leadName,
    );
    if (!memberMatch) throw new ConvexError('MEMBER_NOT_FOUND');

    await ctx.db.patch('projects', project._id, {
      leadId: memberMatch.user._id,
    });

    // Ensure lead is a project member
    const existing = await ctx.db
      .query('projectMembers')
      .withIndex('by_project_user', q =>
        q.eq('projectId', project._id).eq('userId', memberMatch.user._id),
      )
      .first();
    if (!existing) {
      await ctx.db.insert('projectMembers', {
        projectId: project._id,
        userId: memberMatch.user._id,
        role: 'lead',
        joinedAt: Date.now(),
      });
    } else if (existing.role !== 'lead') {
      await ctx.db.patch('projectMembers', existing._id, { role: 'lead' });
    }
    await syncProjectRoleAssignment(
      ctx,
      project._id,
      memberMatch.user._id,
      'lead',
    );

    return {
      message: `Set ${memberMatch.user.name ?? memberMatch.user.email} as lead of ${project.name}`,
      projectKey: project.key,
      userName: memberMatch.user.name ?? memberMatch.user.email,
    };
  },
});

// ──── Issue assignment (delegation) ────

export const assignIssue = internalMutation({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    pageContext: v.optional(assistantPageContextValidator),
    issueKey: v.optional(v.string()),
    assigneeName: v.string(),
    stateName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    const issue = await resolveIssueFromContext(
      ctx,
      organization._id,
      args.pageContext,
      args.issueKey ?? null,
    );
    if (!(await canAssignIssueForUser(ctx, args.userId, issue))) {
      throw new ConvexError('FORBIDDEN');
    }

    const memberMatch = await findMemberByName(
      ctx,
      organization._id,
      args.assigneeName,
    );
    if (!memberMatch) throw new ConvexError('MEMBER_NOT_FOUND');

    // Check if already assigned
    const existing = await ctx.db
      .query('issueAssignees')
      .withIndex('by_issue_assignee', q =>
        q.eq('issueId', issue._id).eq('assigneeId', memberMatch.user._id),
      )
      .first();
    if (existing) {
      // Update state if requested
      if (args.stateName) {
        const state = await findIssueStateByName(
          ctx,
          organization._id,
          args.stateName,
        );
        if (state) {
          await ctx.db.patch('issueAssignees', existing._id, {
            stateId: state._id,
          });
          return {
            message: `Updated ${memberMatch.user.name ?? memberMatch.user.email}'s state on ${issue.key} to ${state.name}`,
          };
        }
      }
      return {
        message: `${memberMatch.user.name ?? memberMatch.user.email} is already assigned to ${issue.key}`,
      };
    }

    const state = args.stateName
      ? await findIssueStateByName(ctx, organization._id, args.stateName)
      : await ctx.db
          .query('issueStates')
          .withIndex('by_organization', q =>
            q.eq('organizationId', organization._id),
          )
          .filter(q => q.eq(q.field('type'), 'todo'))
          .first();

    if (!state) throw new ConvexError('NO_DEFAULT_STATE');

    await ctx.db.insert('issueAssignees', {
      issueId: issue._id,
      assigneeId: memberMatch.user._id,
      stateId: state._id,
    });

    return {
      message: `Assigned ${memberMatch.user.name ?? memberMatch.user.email} to ${issue.key}`,
      issueKey: issue.key,
      userName: memberMatch.user.name ?? memberMatch.user.email,
    };
  },
});

export const unassignIssue = internalMutation({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    pageContext: v.optional(assistantPageContextValidator),
    issueKey: v.optional(v.string()),
    assigneeName: v.string(),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    const issue = await resolveIssueFromContext(
      ctx,
      organization._id,
      args.pageContext,
      args.issueKey ?? null,
    );
    if (!(await canAssignIssueForUser(ctx, args.userId, issue))) {
      throw new ConvexError('FORBIDDEN');
    }

    const memberMatch = await findMemberByName(
      ctx,
      organization._id,
      args.assigneeName,
    );
    if (!memberMatch) throw new ConvexError('MEMBER_NOT_FOUND');

    const assignment = await ctx.db
      .query('issueAssignees')
      .withIndex('by_issue_assignee', q =>
        q.eq('issueId', issue._id).eq('assigneeId', memberMatch.user._id),
      )
      .first();
    if (!assignment) {
      return {
        message: `${memberMatch.user.name ?? memberMatch.user.email} is not assigned to ${issue.key}`,
      };
    }

    await ctx.db.delete('issueAssignees', assignment._id);
    return {
      message: `Unassigned ${memberMatch.user.name ?? memberMatch.user.email} from ${issue.key}`,
      issueKey: issue.key,
      userName: memberMatch.user.name ?? memberMatch.user.email,
    };
  },
});

// ──── Document folder management ────

export const createFolder = internalMutation({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    await requireOrgPermissionForUser(
      ctx,
      organization._id,
      args.userId,
      PERMISSIONS.DOCUMENT_CREATE,
    );

    if (!args.name.trim()) throw new ConvexError('INVALID_INPUT');
    if (args.name.trim().length > 100) throw new ConvexError('INVALID_INPUT');

    const folderId = await ctx.db.insert('documentFolders', {
      organizationId: organization._id,
      name: args.name.trim(),
      description: args.description?.trim(),
      icon: args.icon,
      color: args.color,
      createdBy: args.userId,
    });

    return {
      folderId: String(folderId),
      name: args.name.trim(),
      message: `Created folder "${args.name.trim()}"`,
    };
  },
});

export const updateFolder = internalMutation({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    folderId: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    icon: v.optional(v.union(v.string(), v.null())),
    color: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    const folderDocId = ctx.db.normalizeId('documentFolders', args.folderId);
    if (!folderDocId) throw new ConvexError('FOLDER_NOT_FOUND');
    const folder = await ctx.db.get('documentFolders', folderDocId);
    if (!folder || folder.organizationId !== organization._id)
      throw new ConvexError('FOLDER_NOT_FOUND');
    await requireOrgPermissionForUser(
      ctx,
      organization._id,
      args.userId,
      PERMISSIONS.DOCUMENT_EDIT,
    );
    if (args.name !== undefined && !args.name.trim()) {
      throw new ConvexError('INVALID_INPUT');
    }
    if (args.name !== undefined && args.name.trim().length > 100) {
      throw new ConvexError('INVALID_INPUT');
    }

    await ctx.db.patch('documentFolders', folderDocId, {
      ...(args.name !== undefined ? { name: args.name.trim() } : {}),
      ...(args.description !== undefined
        ? { description: args.description ?? undefined }
        : {}),
      ...(args.icon !== undefined ? { icon: args.icon ?? undefined } : {}),
      ...(args.color !== undefined ? { color: args.color ?? undefined } : {}),
    });

    return {
      folderId: args.folderId,
      name: args.name?.trim() ?? folder.name,
      message: `Updated folder "${args.name?.trim() ?? folder.name}"`,
    };
  },
});

export const requestDeleteFolder = internalMutation({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    assistantThreadId: v.id('assistantThreads'),
    folderId: v.string(),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    const folderDocId = ctx.db.normalizeId('documentFolders', args.folderId);
    if (!folderDocId) throw new ConvexError('FOLDER_NOT_FOUND');
    const folder = await ctx.db.get('documentFolders', folderDocId);
    if (!folder || folder.organizationId !== organization._id)
      throw new ConvexError('FOLDER_NOT_FOUND');
    await requireOrgPermissionForUser(
      ctx,
      organization._id,
      args.userId,
      PERMISSIONS.DOCUMENT_DELETE,
    );
    const row = await requireAssistantThreadRow(
      ctx,
      organization._id,
      args.userId,
    );
    if (row._id !== args.assistantThreadId) {
      throw new ConvexError('FORBIDDEN');
    }

    const actionId = makePendingActionId();
    const pendingAction: AssistantPendingAction = {
      id: actionId,
      kind: 'delete_entity',
      entityType: 'folder',
      entityId: args.folderId,
      entityLabel: folder.name,
      summary: `Delete folder "${folder.name}" and unlink its documents`,
      createdAt: Date.now(),
    };

    await ctx.db.patch('assistantThreads', row._id, {
      pendingAction,
      updatedAt: Date.now(),
    });

    return { summary: pendingAction.summary };
  },
});

export const moveDocumentToFolder = internalMutation({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    pageContext: v.optional(assistantPageContextValidator),
    documentId: v.optional(v.string()),
    folderId: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    const document = await resolveDocumentFromContext(
      ctx,
      organization._id,
      args.pageContext,
      args.documentId ?? null,
    );
    if (!(await canEditEntity(ctx, args.userId, document, 'document'))) {
      throw new ConvexError('FORBIDDEN');
    }

    if (args.folderId === null) {
      await ctx.db.patch('documents', document._id, { folderId: undefined });
      return {
        message: `Removed "${document.title}" from its folder`,
        documentTitle: document.title,
      };
    }

    const folderDocId = ctx.db.normalizeId('documentFolders', args.folderId);
    if (!folderDocId) throw new ConvexError('FOLDER_NOT_FOUND');
    const folder = await ctx.db.get('documentFolders', folderDocId);
    if (!folder || folder.organizationId !== organization._id)
      throw new ConvexError('FOLDER_NOT_FOUND');

    await ctx.db.patch('documents', document._id, { folderId: folderDocId });
    return {
      message: `Moved "${document.title}" to folder "${folder.name}"`,
      documentTitle: document.title,
      folderName: folder.name,
    };
  },
});

export const listFolders = internalQuery({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    const folders = await ctx.db
      .query('documentFolders')
      .withIndex('by_organizationId', q =>
        q.eq('organizationId', organization._id),
      )
      .collect();

    const results = [];
    for (const folder of folders) {
      const docCount = await ctx.db
        .query('documents')
        .withIndex('by_folder', q => q.eq('folderId', folder._id))
        .collect();
      results.push({
        id: String(folder._id),
        name: folder.name,
        description: folder.description ?? undefined,
        color: folder.color ?? undefined,
        documentCount: docCount.length,
      });
    }
    return results;
  },
});

// ──── Organization member management ────

export const listOrgMembers = internalQuery({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    const members = await ctx.db
      .query('members')
      .withIndex('by_organization', q =>
        q.eq('organizationId', organization._id),
      )
      .collect();

    const results = [];
    for (const member of members) {
      const user = await ctx.db.get('users', member.userId);
      if (!user) continue;
      results.push({
        name: user.name ?? user.username ?? user.email ?? 'Unknown',
        email: user.email ?? undefined,
        role: member.role,
        userId: String(member.userId),
      });
    }
    return results;
  },
});

export const listOrgInvites = internalQuery({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    await requireOrgPermissionForUser(
      ctx,
      organization._id,
      args.userId,
      PERMISSIONS.ORG_MANAGE_MEMBERS,
    );

    const invites = await ctx.db
      .query('invitations')
      .withIndex('by_organization', q =>
        q.eq('organizationId', organization._id),
      )
      .collect();

    const pending = invites.filter(
      inv => inv.status === 'pending' && inv.expiresAt > Date.now(),
    );

    const results = [];
    for (const inv of pending) {
      const inviter = await ctx.db.get('users', inv.inviterId);
      results.push({
        inviteId: String(inv._id),
        email: inv.email,
        role: inv.role,
        invitedBy: inviter?.name ?? inviter?.email ?? 'Unknown',
        expiresAt: new Date(inv.expiresAt).toISOString(),
      });
    }
    return results;
  },
});

export const inviteOrgMember = internalMutation({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    email: v.string(),
    role: v.union(v.literal('member'), v.literal('admin')),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    await requireOrgPermissionForUser(
      ctx,
      organization._id,
      args.userId,
      PERMISSIONS.ORG_MANAGE_MEMBERS,
    );

    const email = args.email.toLowerCase().trim();
    if (!email || !email.includes('@')) {
      throw new ConvexError('INVALID_EMAIL');
    }

    const existingUser = await ctx.db
      .query('users')
      .withIndex('email', q => q.eq('email', email))
      .first();

    if (existingUser) {
      const existingMembership = await ctx.db
        .query('members')
        .withIndex('by_org_user', q =>
          q
            .eq('organizationId', organization._id)
            .eq('userId', existingUser._id),
        )
        .first();
      if (existingMembership) {
        return { message: `${email} is already a member of this organization` };
      }
    }

    const inviteId = await ctx.db.insert('invitations', {
      organizationId: organization._id,
      email,
      role: args.role,
      status: 'pending',
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      inviterId: args.userId,
    });

    const inviter = await ctx.db.get('users', args.userId);

    await createNotificationEvent(ctx, {
      type: 'organization_invite',
      actorId: args.userId,
      organizationId: organization._id,
      invitationId: inviteId,
      payload: {
        organizationName: organization.name,
        inviterName:
          inviter?.name ?? inviter?.username ?? inviter?.email ?? 'Someone',
        roleLabel: args.role,
        href: '/settings/invites',
      },
      recipients: [
        {
          userId: existingUser?._id,
          email,
        },
      ],
    });

    return {
      message: `Invited ${email} as ${args.role}`,
      inviteId: String(inviteId),
      email,
      role: args.role,
    };
  },
});

export const revokeOrgInvite = internalMutation({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    inviteId: v.string(),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    await requireOrgPermissionForUser(
      ctx,
      organization._id,
      args.userId,
      PERMISSIONS.ORG_MANAGE_MEMBERS,
    );

    const inviteDocId = ctx.db.normalizeId('invitations', args.inviteId);
    if (!inviteDocId) throw new ConvexError('INVITE_NOT_FOUND');
    const invite = await ctx.db.get('invitations', inviteDocId);
    if (!invite || invite.organizationId !== organization._id) {
      throw new ConvexError('INVITE_NOT_FOUND');
    }
    if (invite.status !== 'pending') {
      return {
        message: `Invitation to ${invite.email} is already ${invite.status}`,
      };
    }

    await ctx.db.patch('invitations', invite._id, {
      status: 'revoked',
      revokedAt: Date.now(),
    });

    return { message: `Revoked invitation to ${invite.email}` };
  },
});

export const removeOrgMember = internalMutation({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    memberName: v.string(),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    await requireOrgPermissionForUser(
      ctx,
      organization._id,
      args.userId,
      PERMISSIONS.ORG_MANAGE_MEMBERS,
    );

    const memberMatch = await findMemberByName(
      ctx,
      organization._id,
      args.memberName,
    );
    if (!memberMatch) throw new ConvexError('MEMBER_NOT_FOUND');

    const member = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q
          .eq('organizationId', organization._id)
          .eq('userId', memberMatch.user._id),
      )
      .first();
    if (!member) throw new ConvexError('MEMBER_NOT_FOUND');

    if (member.role === 'owner') {
      return { message: 'Cannot remove the organization owner' };
    }

    // Clean up all role assignments
    const orgAssignments = await ctx.db
      .query('roleAssignments')
      .withIndex('by_org_user', q =>
        q
          .eq('organizationId', organization._id)
          .eq('userId', memberMatch.user._id),
      )
      .collect();
    for (const assignment of orgAssignments) {
      await ctx.db.delete('roleAssignments', assignment._id);
    }

    const legacyOrgAssignments = await ctx.db
      .query('orgRoleAssignments')
      .withIndex('by_user', q => q.eq('userId', memberMatch.user._id))
      .collect();
    for (const assignment of legacyOrgAssignments) {
      if (assignment.organizationId === organization._id) {
        await ctx.db.delete('orgRoleAssignments', assignment._id);
      }
    }

    const legacyTeamAssignments = await ctx.db
      .query('teamRoleAssignments')
      .withIndex('by_user', q => q.eq('userId', memberMatch.user._id))
      .collect();
    for (const assignment of legacyTeamAssignments) {
      const team = await ctx.db.get('teams', assignment.teamId);
      if (team?.organizationId === organization._id) {
        await ctx.db.delete('teamRoleAssignments', assignment._id);
      }
    }

    const legacyProjectAssignments = await ctx.db
      .query('projectRoleAssignments')
      .withIndex('by_user', q => q.eq('userId', memberMatch.user._id))
      .collect();
    for (const assignment of legacyProjectAssignments) {
      const project = await ctx.db.get('projects', assignment.projectId);
      if (project?.organizationId === organization._id) {
        await ctx.db.delete('projectRoleAssignments', assignment._id);
      }
    }

    // Remove from all teams in this org
    const teamMemberships = await ctx.db
      .query('teamMembers')
      .withIndex('by_user', q => q.eq('userId', memberMatch.user._id))
      .collect();
    for (const membership of teamMemberships) {
      const team = await ctx.db.get('teams', membership.teamId);
      if (team?.organizationId === organization._id) {
        await ctx.db.delete('teamMembers', membership._id);
      }
    }

    // Remove from all projects in this org
    const projectMemberships = await ctx.db
      .query('projectMembers')
      .withIndex('by_user', q => q.eq('userId', memberMatch.user._id))
      .collect();
    for (const membership of projectMemberships) {
      const project = await ctx.db.get('projects', membership.projectId);
      if (project?.organizationId === organization._id) {
        await ctx.db.delete('projectMembers', membership._id);
      }
    }

    await ctx.db.delete('members', member._id);

    const displayName =
      memberMatch.user.name ?? memberMatch.user.email ?? 'Unknown';
    return {
      message: `Removed ${displayName} from the organization`,
      userName: displayName,
    };
  },
});

export const updateOrgMemberRole = internalMutation({
  args: {
    orgSlug: v.string(),
    userId: v.id('users'),
    memberName: v.string(),
    role: v.union(v.literal('member'), v.literal('admin')),
  },
  handler: async (ctx, args) => {
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      args.userId,
    );
    await requireOrgPermissionForUser(
      ctx,
      organization._id,
      args.userId,
      PERMISSIONS.ORG_MANAGE_MEMBERS,
    );

    const memberMatch = await findMemberByName(
      ctx,
      organization._id,
      args.memberName,
    );
    if (!memberMatch) throw new ConvexError('MEMBER_NOT_FOUND');

    const member = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q
          .eq('organizationId', organization._id)
          .eq('userId', memberMatch.user._id),
      )
      .first();
    if (!member) throw new ConvexError('MEMBER_NOT_FOUND');

    if (member.role === 'owner') {
      return { message: "Cannot change the organization owner's role" };
    }

    await ctx.db.patch('members', member._id, { role: args.role });
    await syncOrganizationRoleAssignment(
      ctx,
      organization._id,
      memberMatch.user._id,
      args.role,
    );

    const displayName =
      memberMatch.user.name ?? memberMatch.user.email ?? 'Unknown';
    return {
      message: `Updated ${displayName}'s role to ${args.role}`,
      userName: displayName,
      role: args.role,
    };
  },
});
